import { type NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/ai/embedding';
import { supabaseAdmin } from '@/lib/supabase/server';
import { groq, buildSystemPrompt } from '@/lib/ai/groq';
import { resolveSession } from '@/lib/auth/session';
import { chatRequestSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  AppError,
  badRequest,
  forbidden,
  notFound,
  toAppError,
  appErrorToResponse,
} from '@/lib/errors';
import { RATE_LIMIT, RETRIEVAL, LLM, HYBRID_SEARCH } from '@/lib/constants';
import {
  buildBm25Index,
  bm25Search,
  normalizeBm25Scores,
} from '@/lib/ai/bm25';
import { rerankCandidates } from '@/lib/ai/reranker';

// ⚠️ Bumped from 30s to 60s to accommodate hybrid search + cross-encoder
// re-ranking on slow cold starts.
export const maxDuration = 60;

interface ChunkRow {
  id?: string;
  content: string;
  page_number?: number;
  pageNumber?: number;
  similarity?: number;
  document_id?: string;
}

interface RetrievedChunk {
  content: string;
  pageNumber: number;
  similarity: number;
  documentTitle?: string;
}

interface GroqDelta {
  content?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveSession();

    const rateLimitResult = await rateLimit(session.identifier, {
      points: RATE_LIMIT.chat.points,
      duration: RATE_LIMIT.chat.duration,
      keyPrefix: 'chat',
    });
    if (!rateLimitResult.success) {
      throw new AppError(
        'Too many chat requests. Please slow down.',
        'RATE_LIMIT_EXCEEDED',
        429,
        { reset: rateLimitResult.reset, remaining: rateLimitResult.remaining },
      );
    }

    const body: unknown = await req.json();
    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw badRequest('Invalid request body', parseResult.error.flatten());
    }

    const { chatSessionId, messages, documentIds } = parseResult.data;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw badRequest('At least one message is required.');
    }
    const latestUserMessage = lastMessage.content.trim();

    const queryClient = supabaseAdmin;
    const isGuest = !session.user;

    let allDocIds: string[];
    let docTitle: string;

    if (isGuest) {
      // Guest mode: the chat_sessions row does not exist in Postgres.
      // Use the document IDs passed by the client directly.
      if (!documentIds || documentIds.length === 0) {
        throw badRequest('No documents attached to this chat. Please attach a document first.');
      }
      allDocIds = documentIds;
      docTitle = allDocIds.length > 1
        ? `Guest chat (${allDocIds.length} docs)`
        : 'Guest chat';
    } else {
      // Authenticated: look up the session in the database and verify ownership.
      const expectedUserId = session.user?.id ?? null;

      const { data: sessData } = await queryClient
        .from('chat_sessions')
        .select('id, user_id, title')
        .eq('id', chatSessionId)
        .single<{ id: string; user_id: string | null; title: string }>();

      if (!sessData) {
        throw notFound('Chat session not found.');
      }
      if (sessData.user_id !== expectedUserId) {
        throw forbidden('You do not have access to this chat session.');
      }

      const { data: sessionDocs } = await queryClient
        .from('chat_session_documents')
        .select('document_id')
        .eq('chat_session_id', chatSessionId);

      allDocIds = ((sessionDocs ?? []) as Array<{ document_id: string }>).map(
        (d) => d.document_id,
      );

      if (allDocIds.length === 0) {
        throw badRequest('No documents attached to this chat. Please attach a document first.');
      }

      docTitle = allDocIds.length > 1
        ? `${sessData.title} (${allDocIds.length} docs)`
        : sessData.title;
    }

    let queryForSearch = latestUserMessage;
    if (latestUserMessage.split(' ').length <= 3 && messages.length >= 3) {
      const prev = messages[messages.length - 3];
      if (prev) {
        queryForSearch = `${prev.content} ${latestUserMessage}`;
      }
    }

    // ⚡ Hybrid retrieval + cross-encoder re-ranking
    // 1. Fetch a candidate pool from Postgres vector search (top-20 per doc)
    // 2. Build BM25 index over the candidate pool, score against query
    // 3. Fuse BM25 (normalized to [0,1]) and vector similarity scores
    //    with HYBRID_SEARCH weights (default: 0.4 BM25 + 0.6 vector)
    // 4. Cross-encoder re-rank top-10 of the fused list
    // 5. Return top-6 chunks as LLM context
    const context = await retrieveContext(queryClient, allDocIds, queryForSearch);

    const systemPrompt = buildSystemPrompt(docTitle, context);

    const trimmedHistory = messages.slice(-LLM.historyWindow).map((m) => ({
      role: m.role,
      content:
        m.role === 'assistant' && m.content.length > LLM.historyCharCutoff
          ? `${m.content.slice(0, LLM.historyCharCutoff)}... [Previous context shortened]`
          : m.content,
    }));

    const stream = await groq.chat.completions.create({
      model: LLM.model,
      messages: [{ role: 'system', content: systemPrompt }, ...trimmedHistory],
      stream: true,
      temperature: LLM.temperature,
      max_tokens: LLM.maxTokens,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const metaEvent = `data: ${JSON.stringify({ citations: context })}\n\n`;
        controller.enqueue(encoder.encode(metaEvent));

        for await (const chunk of stream) {
          const delta: GroqDelta | undefined = chunk.choices[0]?.delta;
          const content = delta?.content ?? '';
          if (content) {
            const data = `data: ${JSON.stringify({ text: content })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('Chat failed', {
      error: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
    });
    return NextResponse.json(appErrorToResponse(appError), {
      status: appError.statusCode,
    });
  }
}

/**
 * ⚡ Hybrid retrieval pipeline (vector + BM25 + cross-encoder re-ranking).
 *
 * Strategy:
 *   1. For very small documents (<= RETRIEVAL.smallDocumentThreshold chunks):
 *      skip search entirely — return all chunks (LLM can handle it).
 *   2. Otherwise fetch a candidate pool via Supabase RPC
 *      `match_document_chunks` (vector cosine similarity). Per-doc
 *      balanced quota (top-20 per doc, capped at hybridCandidatePool).
 *   3. Build a BM25 index over the candidate pool and search with
 *      the user's query.
 *   4. Min-max normalize BM25 scores, fuse with vector scores using
 *      HYBRID_SEARCH weights (default 0.4 BM25 + 0.6 vector).
 *   5. Pass the fused top-10 through the cross-encoder (ms-marco-MiniLM-L-6-v2)
 *      for fine-grained re-ranking.
 *   6. Return the top-6 chunks (RERANKER.finalK) as LLM context.
 */
async function retrieveContext(
  client: typeof supabaseAdmin,
  docIds: string[],
  queryForSearch: string,
): Promise<RetrievedChunk[]> {
  const titleMap = await fetchDocTitles(client, docIds);
  const queryVector = await generateEmbedding(queryForSearch);

  // If only 1 document is active
  if (docIds.length === 1) {
    const docId = docIds[0]!;
    const { count } = await client
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);

    if ((count ?? 0) <= RETRIEVAL.smallDocumentThreshold) {
      // Very small doc (e.g. certificates, single-page images) — skip
      // search entirely, give the LLM all chunks.
      const { data: allChunks } = await client
        .from('document_chunks')
        .select('content, page_number')
        .eq('document_id', docId)
        .order('page_number', { ascending: true });

      if (!allChunks) return [];
      const rows = allChunks as Array<{ content: string; page_number: number }>;
      return rows.map((c) => ({
        content: c.content,
        pageNumber: c.page_number ?? 1,
        similarity: 0.95,
        documentTitle: titleMap.get(docId),
      }));
    }

    // Fetch a larger candidate pool than RETRIEVAL.topK so BM25 + re-rank
    // have material to work with.
    const candidatePool = Math.max(RETRIEVAL.hybridCandidatePool, RETRIEVAL.topK);
    const { data: matchedChunks } = await client.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: RETRIEVAL.matchThreshold,
      match_count: candidatePool,
      filter_document_id: docId,
    });

    const matched = (matchedChunks ?? []) as ChunkRow[];
    return fuseAndRerank(matched, queryForSearch, titleMap, docId);
  }

  // Multi-document: fetch top-N candidates per document in parallel,
  // then fuse + re-rank across the combined pool.
  const perDocPool = Math.max(
    3,
    Math.ceil(RETRIEVAL.hybridCandidatePool / docIds.length),
  );

  const perDocPromises = docIds.map(async (docId) => {
    const { count } = await client
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);

    // Small docs (<= 15 chunks) → include all chunks; they'll be fused + re-ranked
    if ((count ?? 0) <= 15) {
      const { data: allChunks } = await client
        .from('document_chunks')
        .select('content, page_number')
        .eq('document_id', docId)
        .order('page_number', { ascending: true });

      return ((allChunks ?? []) as Array<{ content: string; page_number: number }>).map((c) => ({
        content: c.content,
        page_number: c.page_number ?? 1,
        similarity: 0.95,
        document_id: docId,
      }));
    }

    const { data: matchedChunks } = await client.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: RETRIEVAL.matchThreshold,
      match_count: perDocPool,
      filter_document_id: docId,
    });

    return ((matchedChunks ?? []) as ChunkRow[]).map((c) => ({
      content: c.content,
      page_number: c.page_number ?? c.pageNumber ?? 1,
      similarity: c.similarity ?? 0.8,
      document_id: docId,
    }));
  });

  const resultsByDoc = await Promise.all(perDocPromises);
  const combined: Array<{
    content: string;
    page_number: number;
    similarity: number;
    document_id: string;
  }> = [];
  for (const docResults of resultsByDoc) {
    combined.push(...docResults);
  }

  return fuseAndRerankMultiDoc(combined, queryForSearch, titleMap);
}

/**
 * Fuse BM25 + vector scores for a single document, then re-rank with the
 * cross-encoder. Returns top RERANKER.finalK chunks.
 */
async function fuseAndRerank(
  matched: ChunkRow[],
  query: string,
  titleMap: Map<string, string>,
  docId: string,
): Promise<RetrievedChunk[]> {
  if (matched.length === 0) return [];

  // Build BM25 index over the candidate pool
  const indexEntries = matched.map((c, i) => ({
    id: `chunk_${i}`,
    content: c.content,
    originalIndex: i,
  }));
  const bm25Index = buildBm25Index(indexEntries);
  const bm25Results = bm25Search(bm25Index, query, matched.length);
  const bm25Normalized = normalizeBm25Scores(bm25Results);
  const bm25ByIndex = new Map<number, number>();
  for (const r of bm25Normalized) bm25ByIndex.set(r.originalIndex, r.score);

  // Fuse: combined_score = w_bm25 * bm25_norm + w_vector * vector_sim
  const fused = matched.map((c, i) => {
    const vectorSim = c.similarity ?? 0.5;
    const bm25Score = bm25ByIndex.get(i) ?? 0;
    const fusedScore =
      HYBRID_SEARCH.bm25Weight * bm25Score +
      HYBRID_SEARCH.vectorWeight * vectorSim;
    return {
      originalIndex: i,
      content: c.content,
      pageNumber: c.page_number ?? c.pageNumber ?? 1,
      documentTitle: titleMap.get(docId),
      fusedScore,
      vectorSim,
    };
  });

  // Sort by fused score descending, take top-N for re-rank
  fused.sort((a, b) => b.fusedScore - a.fusedScore);
  const topForRerank = fused.slice(0, 10);

  // Cross-encoder re-rank
  const rerankInput = topForRerank.map((r) => ({
    originalIndex: r.originalIndex,
    content: r.content,
  }));
  const reranked = await rerankCandidates(query, rerankInput);

  // Map back to RetrievedChunk
  return reranked.map((r) => {
    const original = fused.find((f) => f.originalIndex === r.originalIndex)!;
    return {
      content: original.content,
      pageNumber: original.pageNumber,
      similarity: r.score, // cross-encoder score
      documentTitle: original.documentTitle,
    };
  });
}

/**
 * Multi-document variant: same fuse + rerank, but the candidate pool
 * contains chunks from multiple documents.
 */
async function fuseAndRerankMultiDoc(
  matched: Array<{
    content: string;
    page_number: number;
    similarity: number;
    document_id: string;
  }>,
  query: string,
  titleMap: Map<string, string>,
): Promise<RetrievedChunk[]> {
  if (matched.length === 0) return [];

  const indexEntries = matched.map((c, i) => ({
    id: `chunk_${i}`,
    content: c.content,
    originalIndex: i,
  }));
  const bm25Index = buildBm25Index(indexEntries);
  const bm25Results = bm25Search(bm25Index, query, matched.length);
  const bm25Normalized = normalizeBm25Scores(bm25Results);
  const bm25ByIndex = new Map<number, number>();
  for (const r of bm25Normalized) bm25ByIndex.set(r.originalIndex, r.score);

  const fused = matched.map((c, i) => {
    const vectorSim = c.similarity ?? 0.5;
    const bm25Score = bm25ByIndex.get(i) ?? 0;
    const fusedScore =
      HYBRID_SEARCH.bm25Weight * bm25Score +
      HYBRID_SEARCH.vectorWeight * vectorSim;
    return {
      originalIndex: i,
      content: c.content,
      pageNumber: c.page_number,
      documentTitle: titleMap.get(c.document_id),
      fusedScore,
      vectorSim,
    };
  });

  fused.sort((a, b) => b.fusedScore - a.fusedScore);
  const topForRerank = fused.slice(0, 10);

  const rerankInput = topForRerank.map((r) => ({
    originalIndex: r.originalIndex,
    content: r.content,
  }));
  const reranked = await rerankCandidates(query, rerankInput);

  return reranked.map((r) => {
    const original = fused.find((f) => f.originalIndex === r.originalIndex)!;
    return {
      content: original.content,
      pageNumber: original.pageNumber,
      similarity: r.score,
      documentTitle: original.documentTitle,
    };
  });
}

async function fetchDocTitles(
  client: typeof supabaseAdmin,
  docIds: string[],
): Promise<Map<string, string>> {
  const { data: docs } = await client
    .from('documents')
    .select('id, title')
    .in('id', docIds);

  const map = new Map<string, string>();
  for (const d of (docs ?? []) as Array<{ id: string; title: string | null }>) {
    map.set(d.id, d.title ?? 'Unknown');
  }
  return map;
}
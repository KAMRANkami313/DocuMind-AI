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
import { RATE_LIMIT, RETRIEVAL, LLM } from '@/lib/constants';

export const maxDuration = 30;

interface DocumentRow {
  id: string;
  title: string | null;
  user_id: string | null;
}

interface ChunkRow {
  id?: string;
  content: string;
  page_number?: number;
  pageNumber?: number;
  similarity?: number;
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

    const { documentId, documentIds, messages } = parseResult.data;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw badRequest('At least one message is required.');
    }
    const latestUserMessage = lastMessage.content.trim();

    const queryClient = supabaseAdmin;

    const { data: docData } = await queryClient
      .from('documents')
      .select('id, title, user_id')
      .eq('id', documentId)
      .single<DocumentRow>();

    if (!docData) {
      throw notFound('Document not found or not accessible.');
    }

    const expectedUserId = session.user?.id ?? null;
    if (docData.user_id !== expectedUserId) {
      throw forbidden('You do not have access to this document.');
    }

    const allDocIds = documentIds && documentIds.length > 0 ? documentIds : [documentId];

    const docTitle =
      allDocIds.length > 1
        ? `${docData.title ?? 'Document'} + ${allDocIds.length - 1} more`
        : docData.title ?? 'Uploaded Document';

    let queryForSearch = latestUserMessage;
    if (latestUserMessage.split(' ').length <= 3 && messages.length >= 3) {
      const prev = messages[messages.length - 3];
      if (prev) {
        queryForSearch = `${prev.content} ${latestUserMessage}`;
      }
    }

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

    const { data: matchedChunks } = await client.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: RETRIEVAL.matchThreshold,
      match_count: RETRIEVAL.topK,
      filter_document_id: docId,
    });

    const matched = (matchedChunks ?? []) as ChunkRow[];
    return matched.map((c) => ({
      content: c.content,
      pageNumber: c.page_number ?? c.pageNumber ?? 1,
      similarity: c.similarity ?? 0.8,
      documentTitle: titleMap.get(docId),
    }));
  }

  // Multi-document: Balanced quota per document (fetched in parallel with Promise.all)
  const perDocCount = Math.max(3, Math.ceil(RETRIEVAL.topK / docIds.length));

  const perDocPromises = docIds.map(async (docId) => {
    const { count } = await client
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', docId);

    // If document is small (e.g. certificates <= 15 chunks), include all chunks
    if ((count ?? 0) <= 15) {
      const { data: allChunks } = await client
        .from('document_chunks')
        .select('content, page_number')
        .eq('document_id', docId)
        .order('page_number', { ascending: true });

      return ((allChunks ?? []) as Array<{ content: string; page_number: number }>).map((c) => ({
        content: c.content,
        pageNumber: c.page_number ?? 1,
        similarity: 0.95,
        documentTitle: titleMap.get(docId),
      }));
    }

    // Otherwise, fetch top-K relevant chunks for this specific document
    const { data: matchedChunks } = await client.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: RETRIEVAL.matchThreshold,
      match_count: perDocCount,
      filter_document_id: docId,
    });

    return ((matchedChunks ?? []) as ChunkRow[]).map((c) => ({
      content: c.content,
      pageNumber: c.page_number ?? c.pageNumber ?? 1,
      similarity: c.similarity ?? 0.8,
      documentTitle: titleMap.get(docId),
    }));
  });

  const resultsByDoc = await Promise.all(perDocPromises);
  const combinedResults: RetrievedChunk[] = [];

  for (const docResults of resultsByDoc) {
    combinedResults.push(...docResults);
  }

  return combinedResults;
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
import { type NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/ai/embedding';
import { supabaseAdmin, createClientForUser } from '@/lib/supabase/server';
import { groq, buildSystemPrompt } from '@/lib/ai/groq';
import { resolveSession } from '@/lib/auth/session';
import { chatRequestSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  AppError,
  badRequest,
  notFound,
  toAppError,
  appErrorToResponse,
} from '@/lib/errors';
import { RATE_LIMIT, RETRIEVAL, LLM } from '@/lib/constants';

export const maxDuration = 30;

interface DocumentRow {
  id: string;
  title: string | null;
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

    const { documentId, messages } = parseResult.data;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw badRequest('At least one message is required.');
    }
    const latestUserMessage = lastMessage.content.trim();

    const queryClient = session.accessToken
      ? createClientForUser(session.accessToken)
      : supabaseAdmin;

    const { data: docData } = await queryClient
      .from('documents')
      .select('id, title')
      .eq('id', documentId)
      .single<DocumentRow>();

    if (!docData) {
      throw notFound('Document not found or not accessible.');
    }
    const docTitle = docData.title ?? 'Uploaded Document';

    let queryForSearch = latestUserMessage;
    if (latestUserMessage.split(' ').length <= 3 && messages.length >= 3) {
      const prev = messages[messages.length - 3];
      if (prev) {
        queryForSearch = `${prev.content} ${latestUserMessage}`;
      }
    }

    const context = await retrieveContext(
      queryClient,
      documentId,
      queryForSearch,
    );

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
  documentId: string,
  queryForSearch: string,
): Promise<RetrievedChunk[]> {
  const { count } = await client
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId);

  const totalChunks = count ?? 0;

  if (totalChunks <= RETRIEVAL.smallDocumentThreshold) {
    const { data: allChunks } = await client
      .from('document_chunks')
      .select('content, page_number')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true });

    if (!allChunks) return [];
    const rows = allChunks as Pick<ChunkRow, 'content' | 'page_number'>[];
    return rows.map((c) => ({
      content: c.content,
      pageNumber: c.page_number ?? 1,
      similarity: 0.95,
    }));
  }

  const queryVector = await generateEmbedding(queryForSearch);

  const { data: matchedChunks } = await client.rpc('match_document_chunks', {
    query_embedding: queryVector,
    match_threshold: RETRIEVAL.matchThreshold,
    match_count: RETRIEVAL.topK,
    filter_document_id: documentId,
  });

  const { data: introChunks } = await client
    .from('document_chunks')
    .select('content, page_number')
    .eq('document_id', documentId)
    .order('page_number', { ascending: true })
    .limit(RETRIEVAL.introPages);

  const matched = (matchedChunks ?? []) as ChunkRow[];
  const intro = (introChunks ?? []) as Pick<ChunkRow, 'content' | 'page_number'>[];
  const combined: ChunkRow[] = [...matched, ...intro];

  const uniqueMap = new Map<string, ChunkRow>();
  for (const item of combined) {
    const key = item.id ?? item.content;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  return Array.from(uniqueMap.values()).map((c) => ({
    content: c.content,
    pageNumber: c.page_number ?? c.pageNumber ?? 1,
    similarity: c.similarity ?? 0.8,
  }));
}
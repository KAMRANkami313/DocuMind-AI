import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  badRequest,
  forbidden,
  notFound,
  toAppError,
  appErrorToResponse,
} from '@/lib/errors';
import { RATE_LIMIT } from '@/lib/constants';
import type { Citation } from '@/types';

interface DocumentRow {
  id: string;
  user_id: string | null;
}

interface ChatMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

const insertMessageSchema = z.object({
  documentId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10_000),
  citations: z.array(z.any()).optional(),
});

async function ensureOwnership(
  documentId: string,
  expectedUserId: string | null,
): Promise<DocumentRow> {
  const { data: docData } = await supabaseAdmin
    .from('documents')
    .select('id, user_id')
    .eq('id', documentId)
    .single<DocumentRow>();

  if (!docData) {
    throw notFound('Document not found.');
  }
  if (docData.user_id !== expectedUserId) {
    throw forbidden('You do not have access to this document.');
  }
  return docData;
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveSession();
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      throw badRequest('documentId query parameter is required.');
    }

    await ensureOwnership(documentId, session.user?.id ?? null);

    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, citations, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to load chat messages', { error, documentId });
      throw badRequest('Failed to load chat messages.');
    }

    const typed = (messages ?? []) as ChatMessageRow[];
    return NextResponse.json({
      messages: typed.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations ?? [],
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('GET /api/messages failed', {
      error: appError.message,
      code: appError.code,
    });
    return NextResponse.json(appErrorToResponse(appError), {
      status: appError.statusCode,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveSession();

    const rateLimitResult = await rateLimit(session.identifier, {
      points: RATE_LIMIT.chat.points,
      duration: RATE_LIMIT.chat.duration,
      keyPrefix: 'message-insert',
    });
    if (!rateLimitResult.success) {
      throw badRequest('Too many requests. Please slow down.');
    }

    const body: unknown = await req.json();
    const parseResult = insertMessageSchema.safeParse(body);
    if (!parseResult.success) {
      throw badRequest('Invalid message body', parseResult.error.flatten());
    }

    const { documentId, role, content, citations } = parseResult.data;
    await ensureOwnership(documentId, session.user?.id ?? null);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        document_id: documentId,
        user_id: session.user?.id ?? null,
        role,
        content,
        citations: (citations as Citation[] | undefined) ?? null,
      })
      .select('id')
      .single<{ id: string }>();

    if (insertError || !inserted) {
      logger.error('Failed to insert chat message', {
        error: insertError,
        documentId,
        role,
      });
      throw badRequest('Failed to save message.');
    }

    return NextResponse.json({ id: inserted.id });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('POST /api/messages failed', {
      error: appError.message,
      code: appError.code,
    });
    return NextResponse.json(appErrorToResponse(appError), {
      status: appError.statusCode,
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await resolveSession();
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('documentId');
    const messageId = searchParams.get('messageId');

    if (!documentId) {
      throw badRequest('documentId query parameter is required.');
    }

    await ensureOwnership(documentId, session.user?.id ?? null);

    if (messageId) {
      const { error } = await supabaseAdmin
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('document_id', documentId);
      if (error) {
        logger.error('Failed to delete message', { error, messageId, documentId });
        throw badRequest('Failed to delete message.');
      }
      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('document_id', documentId);
    if (error) {
      logger.error('Failed to clear chat', { error, documentId });
      throw badRequest('Failed to clear chat.');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('DELETE /api/messages failed', {
      error: appError.message,
      code: appError.code,
    });
    return NextResponse.json(appErrorToResponse(appError), {
      status: appError.statusCode,
    });
  }
}
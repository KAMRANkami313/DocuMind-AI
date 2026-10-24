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

interface SessionRow {
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
  chatSessionId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10_000),
  citations: z.array(z.any()).optional(),
});

async function ensureSessionOwnership(
  sessionId: string,
  expectedUserId: string | null,
): Promise<void> {
  const { data: sessData } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .single<SessionRow>();

  if (!sessData) {
    throw notFound('Chat session not found.');
  }
  if (sessData.user_id !== expectedUserId) {
    throw forbidden('You do not have access to this chat session.');
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveSession();
    const { searchParams } = new URL(req.url);
    const chatSessionId = searchParams.get('chatSessionId');

    if (!chatSessionId) {
      throw badRequest('chatSessionId query parameter is required.');
    }

    await ensureSessionOwnership(chatSessionId, session.user?.id ?? null);

    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, citations, created_at')
      .eq('chat_session_id', chatSessionId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to load chat messages', { error, chatSessionId });
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

    const { chatSessionId, role, content, citations } = parseResult.data;
    await ensureSessionOwnership(chatSessionId, session.user?.id ?? null);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        chat_session_id: chatSessionId,
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
        chatSessionId,
        role,
      });
      throw badRequest('Failed to save message.');
    }

    await supabaseAdmin
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatSessionId);

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
    const chatSessionId = searchParams.get('chatSessionId');
    const messageId = searchParams.get('messageId');

    if (!chatSessionId) {
      throw badRequest('chatSessionId query parameter is required.');
    }

    await ensureSessionOwnership(chatSessionId, session.user?.id ?? null);

    if (messageId) {
      const { error } = await supabaseAdmin
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('chat_session_id', chatSessionId);
      if (error) {
        logger.error('Failed to delete message', { error, messageId, chatSessionId });
        throw badRequest('Failed to delete message.');
      }
      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('chat_session_id', chatSessionId);
    if (error) {
      logger.error('Failed to clear chat', { error, chatSessionId });
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
import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { badRequest, forbidden, notFound, toAppError, appErrorToResponse } from '@/lib/errors';

interface ChatSessionRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

interface MessagePreviewRow {
  content: string;
}

export async function GET() {
  try {
    const session = await resolveSession();
    if (!session.user) {
      return NextResponse.json({ sessions: [] });
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, title, created_at, updated_at, user_id')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Failed to fetch chat sessions', { error });
      return NextResponse.json({ sessions: [] });
    }

    const typed = (sessions ?? []) as ChatSessionRow[];
    const result = [];

    for (const s of typed) {
      const { data: lastMsg } = await supabaseAdmin
        .from('chat_messages')
        .select('content')
        .eq('chat_session_id', s.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<MessagePreviewRow>();

      result.push({
        id: s.id,
        title: s.title,
        preview: lastMsg?.content ? lastMsg.content.slice(0, 80) : undefined,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      });
    }

    return NextResponse.json({ sessions: result });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('GET /api/chat-sessions failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}

export async function POST() {
  try {
    const session = await resolveSession();
    if (!session.user) {
      throw badRequest('Not authenticated.');
    }

    const { data: newSession, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({ user_id: session.user.id, title: 'New Chat' })
      .select('id, title, created_at, updated_at')
      .single<ChatSessionRow>();

    if (error || !newSession) {
      logger.error('Failed to create chat session', { error });
      throw badRequest('Failed to create chat session.');
    }

    return NextResponse.json({
      id: newSession.id,
      title: newSession.title,
      createdAt: newSession.created_at,
      updatedAt: newSession.updated_at,
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('POST /api/chat-sessions failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await resolveSession();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) throw badRequest('Session ID is required.');
    if (!session.user) throw forbidden('Not authenticated.');

    const { data: sess } = await supabaseAdmin
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single<{ user_id: string | null }>();

    if (!sess) throw notFound('Session not found.');
    if (sess.user_id !== session.user.id) throw forbidden('Not your session.');

    await supabaseAdmin.from('chat_sessions').delete().eq('id', sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('DELETE /api/chat-sessions failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}
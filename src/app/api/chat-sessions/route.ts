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
  chat_session_id: string;
  content: string;
  created_at: string;
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
    if (typed.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // ⚡ Performance: batched query instead of N+1.
    // The old code did one round-trip PER session (50 sessions × ~150ms = ~7.5s
    // of latency). Now we issue a SINGLE query that returns the latest message
    // per session in one shot, then dedupe client-side by keeping the first
    // occurrence (since the result is ordered by created_at DESC).
    const sessionIds = typed.map((s) => s.id);
    const { data: latestMessages, error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .select('chat_session_id, content, created_at')
      .in('chat_session_id', sessionIds)
      .order('created_at', { ascending: false });

    if (msgError) {
      logger.error('Failed to fetch latest messages', { error: msgError });
      // Non-fatal — sessions without preview are still usable.
    }

    const previewBySession = new Map<string, string>();
    for (const m of (latestMessages ?? []) as MessagePreviewRow[]) {
      if (!previewBySession.has(m.chat_session_id)) {
        previewBySession.set(m.chat_session_id, m.content);
      }
    }

    const result = typed.map((s) => ({
      id: s.id,
      title: s.title,
      preview: previewBySession.get(s.id)?.slice(0, 80) ?? undefined,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

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
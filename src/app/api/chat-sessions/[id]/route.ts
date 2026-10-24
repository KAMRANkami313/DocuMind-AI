import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { badRequest, forbidden, notFound, toAppError, appErrorToResponse } from '@/lib/errors';

interface SessionRow {
  id: string;
  title: string;
  user_id: string | null;
}

interface MsgRow {
  id: string;
  role: string;
  content: string;
  citations: unknown;
  created_at: string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    if (!sessionId) throw badRequest('Session ID is required.');

    const session = await resolveSession();
    if (!session.user) throw forbidden('Not authenticated.');

    const { data: sess } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, title, user_id')
      .eq('id', sessionId)
      .single<SessionRow>();

    if (!sess) throw notFound('Session not found.');
    if (sess.user_id !== session.user.id) throw forbidden('Not your session.');

    const { data: msgs } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, citations, created_at')
      .eq('chat_session_id', sessionId)
      .order('created_at', { ascending: true });

    const { data: sessionDocs } = await supabaseAdmin
      .from('chat_session_documents')
      .select('document_id')
      .eq('chat_session_id', sessionId);

    const docIds = ((sessionDocs ?? []) as Array<{ document_id: string }>).map((d) => d.document_id);
    const docNames: Record<string, string> = {};
    if (docIds.length > 0) {
      const { data: docRows } = await supabaseAdmin
        .from('documents')
        .select('id, title, file_name')
        .in('id', docIds);
      for (const d of (docRows ?? []) as Array<{ id: string; title: string | null; file_name: string | null }>) {
        docNames[d.id] = d.file_name ?? d.title ?? 'Unknown';
      }
    }

    const typedMsgs = (msgs ?? []) as MsgRow[];

    return NextResponse.json({
      id: sess.id,
      title: sess.title,
      messages: typedMsgs.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        citations: (m.citations as []) ?? [],
        createdAt: m.created_at,
      })),
      documents: docIds.map((id) => ({
        documentId: id,
        documentName: docNames[id] ?? 'Unknown',
      })),
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('GET /api/chat-sessions/[id] failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    if (!sessionId) throw badRequest('Session ID is required.');

    const session = await resolveSession();
    if (!session.user) throw forbidden('Not authenticated.');

    const { data: sess } = await supabaseAdmin
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single<{ user_id: string | null }>();

    if (!sess) throw notFound('Session not found.');
    if (sess.user_id !== session.user.id) throw forbidden('Not your session.');

    const body: unknown = await req.json();
    const { title } = body as { title?: string };
    if (!title || title.trim().length === 0) throw badRequest('Title is required.');

    const { error: updateError } = await supabaseAdmin
      .from('chat_sessions')
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (updateError) {
      logger.error('Failed to rename session', { error: updateError, sessionId });
      throw badRequest('Failed to rename session.');
    }

    return NextResponse.json({ id: sessionId, title: title.trim() });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('PATCH /api/chat-sessions/[id] failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    if (!sessionId) throw badRequest('Session ID is required.');

    const session = await resolveSession();
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
    logger.error('DELETE /api/chat-sessions/[id] failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}
import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { badRequest, forbidden, notFound, toAppError, appErrorToResponse } from '@/lib/errors';
import { MAX_DOCUMENTS_PER_CHAT } from '@/lib/constants';

interface SessionRow {
  id: string;
  user_id: string | null;
}

interface DocRow {
  document_id: string;
  documents: Array<{ id: string; title: string | null; file_name: string | null }>;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    if (!sessionId) throw badRequest('Session ID is required.');

    const session = await resolveSession();
    if (!session.user) throw forbidden('Not authenticated.');

    const { data: sess } = await supabaseAdmin
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single<SessionRow>();

    if (!sess) throw notFound('Session not found.');
    if (sess.user_id !== session.user.id) throw forbidden('Not your session.');

    const { data: docs } = await supabaseAdmin
      .from('chat_session_documents')
      .select('document_id, documents(id, title, file_name)')
      .eq('chat_session_id', sessionId);

    const typed = (docs ?? []) as DocRow[];
    return NextResponse.json({
      documents: typed.map((d) => ({
        documentId: d.document_id,
        documentName: d.documents?.[0]?.file_name ?? d.documents?.[0]?.title ?? 'Unknown',
      })),
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('GET /api/chat-sessions/[id]/documents failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    if (!sessionId) throw badRequest('Session ID is required.');

    const session = await resolveSession();
    if (!session.user) throw forbidden('Not authenticated.');

    const { data: sess } = await supabaseAdmin
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single<SessionRow>();

    if (!sess) throw notFound('Session not found.');
    if (sess.user_id !== session.user.id) throw forbidden('Not your session.');

    const { count } = await supabaseAdmin
      .from('chat_session_documents')
      .select('*', { count: 'exact', head: true })
      .eq('chat_session_id', sessionId);

    if ((count ?? 0) >= MAX_DOCUMENTS_PER_CHAT) {
      throw badRequest(`Maximum ${MAX_DOCUMENTS_PER_CHAT} documents per chat.`);
    }

    const body: unknown = await req.json();
    const { documentId } = body as { documentId?: string };
    if (!documentId) throw badRequest('Document ID is required.');

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('id, user_id, title, file_name')
      .eq('id', documentId)
      .single<{ id: string; user_id: string | null; title: string | null; file_name: string | null }>();

    if (!doc) throw notFound('Document not found.');
    if (doc.user_id !== session.user.id) throw forbidden('Not your document.');

    const { error: attachError } = await supabaseAdmin
      .from('chat_session_documents')
      .insert({ chat_session_id: sessionId, document_id: documentId });

    if (attachError) {
      if (attachError.code === '23505') {
        throw badRequest('Document already attached to this chat.');
      }
      logger.error('Failed to attach document', { error: attachError, sessionId, documentId });
      throw badRequest('Failed to attach document.');
    }

    await supabaseAdmin
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json({
      documentId,
      documentName: doc.file_name ?? doc.title ?? 'Unknown',
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('POST /api/chat-sessions/[id]/documents failed', { error: appError.message });
    return NextResponse.json(appErrorToResponse(appError), { status: appError.statusCode });
  }
}
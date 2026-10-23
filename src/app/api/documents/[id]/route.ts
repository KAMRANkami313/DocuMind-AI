import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import {
  badRequest,
  forbidden,
  notFound,
  toAppError,
  appErrorToResponse,
} from '@/lib/errors';
import type { DocumentPageContent } from '@/lib/api-client';

interface DocumentRow {
  id: string;
  title: string;
  file_name: string;
  user_id: string | null;
}

interface ChunkRow {
  content: string;
  page_number: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;
    if (!documentId) {
      throw badRequest('Document ID is required.');
    }

    const session = await resolveSession();
    const expectedUserId = session.user?.id ?? null;

    const { data: docData } = await supabaseAdmin
      .from('documents')
      .select('id, title, file_name, user_id')
      .eq('id', documentId)
      .single<DocumentRow>();

    if (!docData) {
      throw notFound('Document not found.');
    }
    if (docData.user_id !== expectedUserId) {
      throw forbidden('You do not have access to this document.');
    }

    const { data: chunks, error } = await supabaseAdmin
      .from('document_chunks')
      .select('content, page_number')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true });

    if (error) {
      logger.error('Failed to fetch document chunks', { error, documentId });
      throw badRequest('Failed to load document content.');
    }

    const typed = (chunks ?? []) as ChunkRow[];
    const pageMap = new Map<number, string[]>();
    for (const chunk of typed) {
      const existing = pageMap.get(chunk.page_number) ?? [];
      existing.push(chunk.content);
      pageMap.set(chunk.page_number, existing);
    }

    const pages: DocumentPageContent[] = Array.from(pageMap.entries())
      .map(([pageNumber, texts]) => ({
        pageNumber,
        text: texts.join('\n\n'),
      }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    return NextResponse.json({
      id: docData.id,
      title: docData.title,
      fileName: docData.file_name,
      pages,
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('GET /api/documents/[id] failed', {
      error: appError.message,
      code: appError.code,
    });
    return NextResponse.json(appErrorToResponse(appError), {
      status: appError.statusCode,
    });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;
    if (!documentId) {
      throw badRequest('Document ID is required.');
    }

    const session = await resolveSession();
    const expectedUserId = session.user?.id ?? null;

    const { data: docData } = await supabaseAdmin
      .from('documents')
      .select('id, user_id')
      .eq('id', documentId)
      .single<{ id: string; user_id: string | null }>();

    if (!docData) {
      throw notFound('Document not found.');
    }
    if (docData.user_id !== expectedUserId) {
      throw forbidden('You do not have access to this document.');
    }

    const body: unknown = await req.json();
    const { title } = body as { title?: string };
    if (!title || title.trim().length === 0) {
      throw badRequest('Title is required.');
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({ title: title.trim() })
      .eq('id', documentId)
      .select('id, title')
      .single<{ id: string; title: string }>();

    if (updateError || !updated) {
      logger.error('Failed to rename document', { error: updateError, documentId });
      throw badRequest('Failed to rename document.');
    }

    return NextResponse.json({ id: updated.id, title: updated.title });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('PATCH /api/documents/[id] failed', {
      error: appError.message,
      code: appError.code,
    });
    return NextResponse.json(appErrorToResponse(appError), {
      status: appError.statusCode,
    });
  }
}
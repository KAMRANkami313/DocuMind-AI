import { type NextRequest, NextResponse } from 'next/server';
import { extractPagesFromUpload, type ExtractedPage } from '@/lib/pdf/extractor';
import { splitTextIntoChunks } from '@/lib/pdf/chunker';
import { generateEmbedding } from '@/lib/ai/embedding';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveSession } from '@/lib/auth/session';
import { validateUploadedFile } from '@/lib/validation/file';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  AppError,
  badRequest,
  payloadTooLarge,
  unsupportedMediaType,
  toAppError,
  appErrorToResponse,
} from '@/lib/errors';
import { UPLOAD_LIMITS, RATE_LIMIT } from '@/lib/constants';
import type { ChunkPayload } from '@/lib/pdf/chunker';

// ⚠️ Increased from 60s to give OCR + multi-format extraction room.
// Vercel Hobby allows up to 60s on free tier; the project's "maxDuration"
// hint is what Vercel uses. 60s is the hard cap on Hobby.
export const maxDuration = 60;

interface NewDocumentRow {
  id: string;
}

interface NewChunkRow {
  document_id: string;
  content: string;
  page_number: number;
  embedding: number[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveSession();

    const rateLimitResult = await rateLimit(session.identifier, {
      points: RATE_LIMIT.upload.points,
      duration: RATE_LIMIT.upload.duration,
      keyPrefix: 'upload',
    });
    if (!rateLimitResult.success) {
      throw new AppError(
        'Too many uploads. Please try again later.',
        'RATE_LIMIT_EXCEEDED',
        429,
        { reset: rateLimitResult.reset, remaining: rateLimitResult.remaining },
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw badRequest('No file uploaded.');
    }

    if (file.size > UPLOAD_LIMITS.maxFileSizeBytes) {
      const mb = Math.round(UPLOAD_LIMITS.maxFileSizeBytes / 1024 / 1024);
      throw payloadTooLarge(`File size must not exceed ${mb}MB.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const validation = validateUploadedFile(file, arrayBuffer);
    if (!validation.ok) {
      throw unsupportedMediaType(`Invalid file: ${validation.reason ?? 'unknown error'}`);
    }

    // ⚠️ Multi-format dispatch: the extractor inspects the file's MIME +
    // extension and routes to the right backend (unpdf for PDF, mammoth
    // for .docx, SheetJS for .xlsx, tesseract.js for images, plain
    // TextDecoder for .txt/.md/.csv). For PDFs that look scanned
    // (little extractable text) it falls back to tesseract.js OCR.
    const pages: ExtractedPage[] = await extractPagesFromUpload({
      file: { name: file.name, type: file.type },
      buffer: arrayBuffer,
    });

    const rawChunks: ChunkPayload[] = splitTextIntoChunks(pages);
    if (rawChunks.length === 0) {
      throw badRequest('Document contains no readable text.');
    }

    if (rawChunks.length > UPLOAD_LIMITS.maxChunksPerDocument) {
      throw payloadTooLarge(
        `Document would produce ${rawChunks.length} chunks (max ${UPLOAD_LIMITS.maxChunksPerDocument}).`,
      );
    }

    const insertClient = supabaseAdmin;
    const userId = session.user?.id ?? null;

    const { data: document, error: docError } = await insertClient
      .from('documents')
      .insert({
        title: file.name.replace(/\.[^/.]+$/, ''),
        file_name: file.name,
        user_id: userId,
      })
      .select('id')
      .single<NewDocumentRow>();

    if (docError || !document) {
      logger.error('Failed to insert document metadata', {
        error: docError,
        userId,
      });
      throw new AppError(
        'Failed to record document metadata.',
        'DATABASE_ERROR',
        500,
      );
    }

    const chunksWithEmbeddings: NewChunkRow[] = [];
    for (const chunk of rawChunks) {
      const embedding = await generateEmbedding(chunk.content);
      chunksWithEmbeddings.push({
        document_id: document.id,
        content: chunk.content,
        page_number: chunk.pageNumber,
        embedding,
      });
    }

    const { error: chunkError } = await insertClient
      .from('document_chunks')
      .insert(chunksWithEmbeddings);

    if (chunkError) {
      logger.error('Failed to insert chunks', {
        error: chunkError,
        documentId: document.id,
      });
      await supabaseAdmin.from('documents').delete().eq('id', document.id);
      throw new AppError(
        'Failed to store document chunks.',
        'DATABASE_ERROR',
        500,
      );
    }

    logger.info('Document uploaded', {
      documentId: document.id,
      fileName: file.name,
      totalChunks: chunksWithEmbeddings.length,
      userId: userId ?? 'guest',
    });

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileName: file.name,
      totalChunks: chunksWithEmbeddings.length,
    });
  } catch (error) {
    const appError = toAppError(error);
    logger.error('Upload failed', {
      error: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
    });
    return NextResponse.json(appErrorToResponse(appError), {
      status: appError.statusCode,
    });
  }
}
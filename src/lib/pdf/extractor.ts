// ⚠️ Multi-format dispatcher. The upload route calls `extractPagesFromPdf`
// for backwards-compatibility reasons (the route was written when PDF was
// the only format). Internally we now detect the file kind via magic bytes
// and dispatch to format-specific extractors.
//
// For PDFs: try unpdf's text extraction first. For pages with sparse text
// (e.g. slide decks where each slide has a title + an embedded terminal
// screenshot), fall back to per-page rendering + OCR with tesseract.js.

import { extractText as unpdfExtract } from 'unpdf';
import {
  isExcelMime,
  isExcelExtension,
  isImageMime,
  isImageExtension,
  isWordMime,
  isWordExtension,
  isTextExtension,
  isTextMime,
} from '@/lib/validation/file';
import { RETRIEVAL } from '@/lib/constants';
import { ocrPdfPerPage, looksScanned } from './ocr';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export async function extractPagesFromPdf(buffer: ArrayBuffer): Promise<ExtractedPage[]> {
  // ⚠️ unpdf's extractText() and pdfjs's getDocument() both TRANSFER the
  // ArrayBuffer to their worker thread, detaching the original. We make
  // TWO defensive copies up-front — one for unpdf's text extraction and
  // one for the per-page OCR fallback — so each consumer gets its own
  // fresh buffer. Without this, the second call receives a detached
  // ArrayBuffer and crashes with "Cannot perform ArrayBuffer.prototype.slice
  // on a detached ArrayBuffer".
  const bufferForUnpdf = buffer.slice(0);
  const bufferForOcr = buffer.slice(0);

  // 1. Try unpdf's fast text extraction first.
  const { text, totalPages } = await unpdfExtract(bufferForUnpdf);

  let initialPages: ExtractedPage[] = [];

  if (!text || totalPages === 0) {
    // PDF has zero extractable text — fully scanned/image-based PDF.
    // Skip the unpdf text path entirely and go straight to per-page OCR.
    initialPages = [];
  } else if (Array.isArray(text)) {
    initialPages = text.map((pageText, index) => ({
      pageNumber: index + 1,
      text: sanitizeText(pageText.trim()),
    }));
  } else {
    initialPages = [
      {
        pageNumber: 1,
        text: sanitizeText(String(text).trim()),
      },
    ];
  }

  // 2. If unpdf extracted substantive text per page, we're done.
  if (!looksScanned(initialPages) && initialPages.length > 0) {
    // Even if the document isn't "scanned" overall, individual pages may
    // still have sparse text (e.g. a slide deck where each page has a
    // short title + an embedded image). Run the per-page OCR fallback to
    // fill those gaps — it only OCRs pages where unpdf's text is sparse,
    // so it's fast for documents that are mostly text.
    try {
      const perPage = await ocrPdfPerPage(bufferForOcr, {
        unpdfPages: initialPages,
      });
      // If the per-page pass yielded anything, prefer it (it's more
      // granular than the per-document blob). Otherwise fall through to
      // the original unpdf pages.
      if (perPage.length > 0) {
        return perPage
          .map((p) => ({
            pageNumber: p.pageNumber,
            text: sanitizeText(p.text.trim()),
          }))
          .filter((p) => p.text.length > 0);
      }
    } catch (err) {
      // Per-page OCR fallback failed — log and continue with unpdf's
      // text-only extraction. The document is still usable; we just
      // don't get the embedded-image content.
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[extractor] Per-page OCR fallback failed:', message);
    }
    return initialPages.filter((p) => p.text.length > 0);
  }

  // 3. PDF looks scanned overall (or unpdf returned nothing) — run the
  // full per-page OCR pipeline. This iterates pages, renders each
  // sparse-text page to a canvas via @napi-rs/canvas, and OCRs the
  // canvas with tesseract.js.
  try {
    const ocrPages = await ocrPdfPerPage(bufferForOcr, {
      unpdfPages: initialPages,
    });
    if (ocrPages.length === 0) {
      throw new Error(
        'No text could be extracted from this PDF (it appears to be scanned and OCR failed). ' +
          'Please upload a text-based PDF or pre-process with Adobe Acrobat → "Recognize Text".',
      );
    }
    return ocrPages.map((p) => ({
      pageNumber: p.pageNumber,
      text: sanitizeText(p.text.trim()),
    }));
  } catch (err) {
    // Final fallback — if per-page OCR also fails (e.g. @napi-rs/canvas
    // native binary missing), return whatever unpdf gave us.
    if (initialPages.length > 0) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[extractor] Full per-page OCR failed, returning unpdf text only:', message);
      return initialPages;
    }
    throw err;
  }
}

/**
 * Extract text from a plain text / Markdown / CSV buffer.
 * Used when the upload is text-only (no parsing required).
 */
export async function extractPagesFromText(buffer: ArrayBuffer): Promise<ExtractedPage[]> {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim();
  if (!text) {
    throw new Error('The text file appears to be empty.');
  }
  return [{ pageNumber: 1, text: sanitizeText(text) }];
}

/**
 * Dispatch based on file kind. The upload route already validated the
 * file type via `validateUploadedFile`, so we just look at the file's
 * mime + extension here.
 */
export async function extractPagesFromUpload(args: {
  file: { name: string; type: string };
  buffer: ArrayBuffer;
}): Promise<ExtractedPage[]> {
  const { file, buffer } = args;

  // PDF (text-based OR scanned) — uses unpdf + per-page OCR fallback
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return extractPagesFromPdf(buffer);
  }

  // Word .docx — mammoth
  if (isWordMime(file.type) || isWordExtension(file.name)) {
    const { extractTextFromDocx } = await import('./word-extractor');
    return extractTextFromDocx(buffer);
  }

  // Excel .xlsx/.xls/.csv — SheetJS
  if (isExcelMime(file.type) || isExcelExtension(file.name)) {
    const { extractTextFromExcel } = await import('./excel-extractor');
    return extractTextFromExcel(buffer);
  }

  // Image — tesseract.js OCR
  if (isImageMime(file.type) || isImageExtension(file.name)) {
    const { extractTextFromImage } = await import('./image-extractor');
    return extractTextFromImage(buffer);
  }

  // Plain text / Markdown / CSV — decode directly
  if (isTextMime(file.type) || isTextExtension(file.name)) {
    return extractPagesFromText(buffer);
  }

  // Unknown — best effort: try plain text decode
  return extractPagesFromText(buffer);
}

// Re-export for downstream callers (chunker, tests, etc.)
export type { ExtractedPage as _ReExported } from './extractor';
void RETRIEVAL; // not used here directly, but keeps the import valid for tree-shaking
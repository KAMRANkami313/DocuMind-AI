// ⚠️ Multi-format dispatcher. The upload route calls `extractPagesFromPdf`
// for backwards-compatibility reasons. Internally we dispatch by file
// kind via magic bytes.
//
// For PDFs: try unpdf's text extraction first. Then ALWAYS run the
// per-page OCR pipeline (which uses operator-list inspection to decide
// per-page whether OCR is needed). The previous character-count
// threshold (50 chars) was broken: slide titles like "Task 5: Reading
// and Writing Files in HDFS Using PySpark Commands" exceed 50 chars,
// causing the page to skip OCR even when a terminal screenshot was
// present below the title. The new operator-list approach (per the
// universal ingestion spec) checks for paintImageXObject /
// paintInlineImageXObject in pdfjs's operator list, which is the actual
// ground truth for whether the page has embedded images.

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
import { ocrPdfPerPage } from './ocr';

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
  // TWO defensive copies up-front.
  const bufferForUnpdf = buffer.slice(0);
  const bufferForOcr = buffer.slice(0);

  // 1. Try unpdf's fast text extraction first (for the per-page text
  //    hint that ocrPdfPerPage can use to skip pages with no images).
  let unpdfPages: ExtractedPage[] = [];
  try {
    const { text, totalPages } = await unpdfExtract(bufferForUnpdf);
    if (text && totalPages > 0) {
      if (Array.isArray(text)) {
        unpdfPages = text.map((pageText, index) => ({
          pageNumber: index + 1,
          text: sanitizeText(pageText.trim()),
        }));
      } else {
        unpdfPages = [
          {
            pageNumber: 1,
            text: sanitizeText(String(text).trim()),
          },
        ];
      }
    }
  } catch (err) {
    // unpdf failed (rare — usually means the PDF is corrupt or uses
    // features unpdf doesn't support). Continue to per-page OCR.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[extractor] unpdf.extractText failed, going straight to per-page OCR:', message);
  }

  // 2. ALWAYS run the per-page OCR pipeline. ocrPdfPerPage uses the
  //    operator list to decide per-page:
  //      - Pure text page (no images): returns digital text, skips OCR
  //      - Pure scanned page (no text, has images or nothing): OCR
  //      - Hybrid page (text + images): merge digital text + OCR text
  //    This eliminates the broken 50-char threshold and handles all
  //    the user's reported cases (slide decks with terminal screenshots,
  //    notebooks with Matplotlib charts, certificates with typed names).
  try {
    const perPage = await ocrPdfPerPage(bufferForOcr, {
      unpdfPages,
    });
    if (perPage.length > 0) {
      return perPage
        .map((p) => ({
          pageNumber: p.pageNumber,
          text: sanitizeText(p.text.trim()),
        }))
        .filter((p) => p.text.length > 0);
    }
  } catch (err) {
    // Per-page OCR failed (e.g. @napi-rs/canvas native binary missing
    // on Vercel cold start). Fall back to whatever unpdf gave us.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[extractor] Per-page OCR pipeline failed, falling back to unpdf text only:', message);
  }

  // 3. Final fallback: return unpdf's text only (no embedded-image OCR).
  if (unpdfPages.length > 0) {
    return unpdfPages.filter((p) => p.text.length > 0);
  }

  // 4. Total failure — throw an actionable error. The upload route
  //    catches this and surfaces a friendly message.
  throw new Error(
    'No text could be extracted from this PDF. The file may be corrupt, ' +
      'password-protected, or use features not supported by pdfjs. ' +
      'Try uploading a different format or pre-processing with Adobe Acrobat.',
  );
}

/**
 * Extract text from a plain text / Markdown / CSV buffer.
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
 * file type via `validateUploadedFile`.
 */
export async function extractPagesFromUpload(args: {
  file: { name: string; type: string };
  buffer: ArrayBuffer;
}): Promise<ExtractedPage[]> {
  const { file, buffer } = args;

  // PDF (text-based OR scanned OR hybrid) — uses unpdf + per-page OCR
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return extractPagesFromPdf(buffer);
  }

  // Word .docx — mammoth (text) + jszip (word/media/ images)
  if (isWordMime(file.type) || isWordExtension(file.name)) {
    const { extractTextFromDocx } = await import('./word-extractor');
    return extractTextFromDocx(buffer);
  }

  // Excel .xlsx/.xls/.csv — SheetJS
  if (isExcelMime(file.type) || isExcelExtension(file.name)) {
    const { extractTextFromExcel } = await import('./excel-extractor');
    return extractTextFromExcel(buffer);
  }

  // Image — sharp preprocessing + tesseract.js OCR
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

// ⚠️ Multi-format dispatcher. The upload route calls `extractPagesFromPdf`
// for backwards-compatibility reasons. Internally we dispatch by file
// kind via magic bytes.
//
// For PDFs:
//   1. Run unpdf.extractText() to get fast text-per-page.
//   2. If unpdf's text per page is substantive (≥ RETRIEVAL.scannedPdfTextThreshold
//      on average) → assume the PDF is text-based (academic paper, tech doc,
//      report) → SKIP the per-page OCR pipeline entirely. This restores
//      the fast path the user reported as broken: "the simple text from
//      pdf was very fast earlier but now it is too slow". The previous
//      version ALWAYS ran the per-page pipeline (calling getOperatorList
//      for every page even when there was no need).
//   3. Otherwise (sparse text or zero text → likely scanned PDF or slide
//      deck with terminal screenshots): run the per-page OCR pipeline,
//      which uses pdfjs's operator list to detect embedded image objects
//      per page, renders only the pages that need OCR, and uses Gemini
//      Vision (with sharp+Tesseract fallback) for the actual extraction.

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
  // TWO defensive copies up-front.
  const bufferForUnpdf = buffer.slice(0);
  const bufferForOcr = buffer.slice(0);

  // 1. Try unpdf's fast text extraction first.
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

  // 2. ⚠️ FAST PATH: if unpdf extracted substantive text per page on
  //    average (≥ RETRIEVAL.scannedPdfTextThreshold), assume the PDF
  //    is text-based (academic papers, technical docs, reports). Skip
  //    the per-page OCR pipeline entirely — no getOperatorList() calls,
  //    no canvas rendering, no Gemini API calls. This restores the
  //    "fast as before" behavior the user reported as broken.
  //
  //    The previous version of this file ALWAYS ran the per-page OCR
  //    pipeline (even for pure-text PDFs), which added ~50ms × N pages
  //    of getOperatorList() overhead for no benefit.
  //
  //    `looksScanned()` returns TRUE if avg text-per-page < threshold,
  //    i.e. the PDF is likely scanned/image-based. We invert that here:
  //    if `!looksScanned()` AND unpdf gave us text, use it directly.
  if (unpdfPages.length > 0 && !looksScanned(unpdfPages)) {
    return unpdfPages.filter((p) => p.text.length > 0);
  }

  // 3. SLOW PATH: PDF appears scanned (sparse text overall) OR unpdf
  //    returned nothing. Run the per-page OCR pipeline, which uses
  //    operator-list inspection to decide per-page:
  //      - Pure text page (no images): returns digital text, skips OCR
  //      - Pure scanned page (no text, has images or nothing): OCR
  //      - Hybrid page (text + images): merge digital text + OCR text
  //    This handles the user's reported cases: slide decks with terminal
  //    screenshots, notebooks with Matplotlib charts, certificates with
  //    typed names on colored backgrounds.
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

  // 4. Final fallback: return unpdf's text only (no embedded-image OCR).
  if (unpdfPages.length > 0) {
    return unpdfPages.filter((p) => p.text.length > 0);
  }

  // 5. Total failure — throw an actionable error. The upload route
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

  // Word .docx — mammoth (text) + jszip (word/media/ images via Gemini)
  if (isWordMime(file.type) || isWordExtension(file.name)) {
    const { extractTextFromDocx } = await import('./word-extractor');
    return extractTextFromDocx(buffer);
  }

  // Excel .xlsx/.xls/.csv — SheetJS (no OCR needed, all digital)
  if (isExcelMime(file.type) || isExcelExtension(file.name)) {
    const { extractTextFromExcel } = await import('./excel-extractor');
    return extractTextFromExcel(buffer);
  }

  // Image — Gemini Vision OCR (with sharp+Tesseract fallback)
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

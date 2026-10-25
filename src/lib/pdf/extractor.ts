// ⚠️ Multi-format dispatcher. The upload route calls `extractPagesFromPdf`
// for backwards-compatibility reasons (the route was written when PDF was
// the only format). Internally we now detect the file kind via magic bytes
// and dispatch to format-specific extractors.
//
// For PDFs: try unpdf first. If the PDF appears scanned (very little text
// per page), fall back to tesseract.js OCR.

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
import { ocrPdfBuffer, looksScanned } from './ocr';

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
  const { text, totalPages } = await unpdfExtract(buffer);

  if (!text || totalPages === 0) {
    // The PDF has no extractable text — almost certainly a scanned/image
    // PDF. Run OCR with tesseract.js as a fallback.
    const ocrPages = await ocrPdfBuffer(buffer);
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
  }

  let pages: ExtractedPage[];
  if (Array.isArray(text)) {
    pages = text.map((pageText, index) => ({
      pageNumber: index + 1,
      text: sanitizeText(pageText.trim()),
    }));
  } else {
    pages = [
      {
        pageNumber: 1,
        text: sanitizeText(String(text).trim()),
      },
    ];
  }

  // ⚠️ Scanned-PDF fallback: if unpdf extracted text but the text per
  // page is suspiciously short, the PDF is probably a scanned doc with
  // an embedded text layer that's mostly OCR garbage or zero-length
  // strings. Run OCR to fill in the gaps.
  if (looksScanned(pages)) {
    const ocrPages = await ocrPdfBuffer(buffer);
    if (ocrPages.length > 0) {
      // Merge: prefer OCR text where unpdf returned nothing for that
      // page, otherwise keep unpdf's text (it's usually higher quality
      // when present).
      const mergedByPage = new Map<number, string>();
      for (const p of pages) {
        if (p.text.trim().length > 0) {
          mergedByPage.set(p.pageNumber, p.text);
        }
      }
      for (const p of ocrPages) {
        if (!mergedByPage.has(p.pageNumber) && p.text.trim().length > 0) {
          mergedByPage.set(p.pageNumber, p.text);
        }
      }
      const merged = Array.from(mergedByPage.entries())
        .sort(([a], [b]) => a - b)
        .map(([pageNumber, txt]) => ({
          pageNumber,
          text: sanitizeText(txt),
        }));
      if (merged.length > 0) {
        return merged;
      }
    }
  }

  return pages;
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

  // PDF (text-based OR scanned) — uses unpdf + OCR fallback
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
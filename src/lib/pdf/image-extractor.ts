// ⚠️ Image extractor — runs OCR on a single image buffer using tesseract.js.
// Returns one "page" of text. Page number is always 1 (images don't have
// pagination). The chunker treats it like any other 1-page document.
//
// ⚠️ Resilience: We deliberately do NOT throw when OCR yields < 3 chars.
// The previous behavior threw `OCR failed to extract text from this image.`
// which caused the upload route to return 500 — the user lost the upload
// even when preprocessing later might have worked, and they couldn't
// retry. Now we return the empty text (or whatever we got) and let the
// upload route decide. If still empty after preprocessing, the upload
// route saves a placeholder chunk so the document still attaches to
// the chat and the user can ask follow-up questions.

import { ocrImageBuffer } from './ocr';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractTextFromImage(
  buffer: ArrayBuffer,
): Promise<ExtractedPage[]> {
  const { text, confidence } = await ocrImageBuffer(buffer);

  // ⚠️ Do NOT throw on empty text — return whatever we got (even empty).
  // The upload route will handle the empty case by inserting a placeholder
  // chunk so the document still saves and the chat works.
  void confidence;

  return [{ pageNumber: 1, text: text ?? '' }];
}
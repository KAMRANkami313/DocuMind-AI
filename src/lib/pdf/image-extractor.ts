// ⚠️ Image extractor — runs OCR on a single image buffer using tesseract.js.
// Returns one "page" of text. Page number is always 1 (images don't have
// pagination). The chunker treats it like any other 1-page document.

import { ocrImageBuffer } from './ocr';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractTextFromImage(
  buffer: ArrayBuffer,
): Promise<ExtractedPage[]> {
  const { text, confidence } = await ocrImageBuffer(buffer);

  // If OCR returned nothing useful, throw — the upload route will surface
  // a friendly error ("Could not extract text from this image. Make sure
  // it contains readable text and is not blurry/rotated.")
  if (!text || text.length < 3) {
    throw new Error('OCR failed to extract text from this image.');
  }

  // Embed the OCR confidence as a small header for debugging — stripped
  // out by the chunker's whitespace normalization.
  // (We don't actually inject it into the visible text to avoid confusing
  // the LLM. Kept here in case we want to surface it in the UI later.)
  void confidence;

  return [{ pageNumber: 1, text }];
}
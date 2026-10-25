// ⚠️ Word .docx extractor using mammoth. Converts .docx to plain-text
// HTML, strips tags, and returns one big "page" (page 1). Real pagination
// would require parsing the docx section breaks — overkill for our RAG
// use-case (we chunk on character count anyway).
//
// Note: We deliberately do NOT support the legacy binary .doc format.
// mammoth itself only handles .docx (the modern Office Open XML format).
// Users with .doc files should re-save them as .docx or PDF.

import type { ExtractedPage } from './extractor';

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export async function extractTextFromDocx(
  buffer: ArrayBuffer,
): Promise<ExtractedPage[]> {
  // Dynamic import keeps mammoth out of the client bundle and out of
  // routes that don't handle .docx (chat route, auth route, etc.).
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });

  const text = (result.value || '').trim();

  if (!text) {
    throw new Error('No text could be extracted from this Word document.');
  }

  return [{ pageNumber: 1, text: sanitizeText(text) }];
}
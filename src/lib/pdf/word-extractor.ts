// ⚠️ Word .docx extractor with embedded-image OCR.
//
// mammoth.extractRawText() returns only the body text of the .docx —
// embedded images in `word/media/` are silently stripped. For documents
// like CVs with portrait photos, technical reports with embedded charts,
// or handwritten forms scanned into Word, this loses critical content.
//
// This extractor:
//   1. Calls mammoth.extractRawText() for the body text (1 "page")
//   2. Reads the .docx archive (which is a ZIP file) via JSZip
//   3. Iterates files in `word/media/` (PNG/JPG/EMF/etc.)
//   4. For each image: runs through sharp preprocessing + tesseract.js OCR
//   5. Appends OCR text under an `[Embedded Images & Figures]` section
//      so the LLM knows the epistemic source differs from body text
//
// Note: We deliberately do NOT support the legacy binary .doc format.
// mammoth itself only handles .docx (the modern Office Open XML format).

import type { ExtractedPage } from './extractor';
import { ocrImageBuffer } from './ocr';

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

interface EmbeddedImage {
  filename: string;
  buffer: ArrayBuffer;
}

/**
 * Read all images from `word/media/` in the .docx ZIP archive.
 * Returns an array of `{ filename, buffer }` for each image.
 *
 * Skips non-image files (e.g. decorative .rels files that sometimes
 * live in word/media/).
 */
async function readEmbeddedImages(buffer: ArrayBuffer): Promise<EmbeddedImage[]> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const images: EmbeddedImage[] = [];
    const mediaFolder = zip.folder('word/media');
    if (!mediaFolder) return [];

    const files = mediaFolder.file(/.+\.(png|jpe?g|gif|webp|bmp|tiff?)$/i);
    for (const file of files) {
      try {
        const ab = await file.async('arraybuffer');
        images.push({ filename: file.name, buffer: ab });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[word-extractor] Failed to read ${file.name}:`, message);
      }
    }
    return images;
  } catch (err) {
    // JSZip failed (corrupt archive, not a real .docx, etc.) — return
    // empty so the body-text path still succeeds.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[word-extractor] Failed to read word/media/:', message);
    return [];
  }
}

export async function extractTextFromDocx(
  buffer: ArrayBuffer,
): Promise<ExtractedPage[]> {
  // ⚠️ Defensive copies: mammoth and JSZip both consume the ArrayBuffer;
  // some builds may detach it.
  const bufferForMammoth = buffer.slice(0);
  const bufferForZip = buffer.slice(0);

  // 1. Extract body text via mammoth.
  //    ⚠️ FIX: mammoth's `extractRawText({ arrayBuffer })` option
  //    sometimes fails with "Could not find file in options" when the
  //    ArrayBuffer is from a different runtime context. The reliable
  //    fix is to convert to a Node.js Buffer and use mammoth's `buffer`
  //    option instead — mammoth checks `if (input.buffer)` first and
  //    uses `readFromBuffer(input.buffer, options)` which reliably works.
  //    This was the root cause of the BinSense .docx losing all 12 pages
  //    of body text when mammoth crashed.
  const mammoth = await import('mammoth');
  let bodyText = '';
  try {
    const nodeBuffer = Buffer.from(bufferForMammoth);
    const result = await mammoth.extractRawText({ buffer: nodeBuffer });
    bodyText = (result.value || '').trim();
  } catch (err) {
    // mammoth failed — continue with empty body, we'll still try to OCR
    // embedded images.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[word-extractor] mammoth.extractRawText failed:', message);
  }

  // 2. Extract images from word/media/ and OCR each.
  const images = await readEmbeddedImages(bufferForZip);
  const ocrSections: string[] = [];
  for (const img of images) {
    const { text: ocrText, confidence } = await ocrImageBuffer(img.buffer);
    if (ocrText && ocrText.length > 0) {
      ocrSections.push(
        `[Image: ${img.filename}]\n${ocrText}` +
          (confidence < 60 ? ` (low OCR confidence: ${confidence.toFixed(0)}%)` : ''),
      );
    }
    // If OCR returned empty, skip this image (don't pollute the doc
    // with empty placeholder entries).
  }

  // 3. Merge body text + OCR sections under the [Embedded Images & Figures]
  //    header. The header signals to the LLM (via the system prompt) that
  //    this section was OCR'd from images — different epistemic status
  //    than the body text.
  let finalText = bodyText;
  if (ocrSections.length > 0) {
    const ocrBlock = `[Embedded Images & Figures]:\n${ocrSections.join('\n\n')}`;
    finalText = bodyText
      ? `${bodyText}\n\n${ocrBlock}`
      : ocrBlock;
  }

  // 4. If both body text and OCR returned nothing, throw — there's
  //    literally no content to chunk. The upload route will surface a
  //    friendly error.
  if (!finalText || finalText.trim().length === 0) {
    throw new Error('No text could be extracted from this Word document.');
  }

  return [{ pageNumber: 1, text: sanitizeText(finalText) }];
}
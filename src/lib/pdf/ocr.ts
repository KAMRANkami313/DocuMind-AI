// ⚠️ OCR utility using tesseract.js + sharp preprocessing.
// Used by:
//   - src/lib/pdf/image-extractor.ts (for image uploads: PNG/JPG/WEBP/GIF)
//   - src/lib/pdf/extractor.ts (per-page OCR fallback for PDFs with
//     embedded images, scanned PDFs, and hybrid pages)
//   - src/lib/pdf/word-extractor.ts (for .docx word/media/ images)
//
// Tesseract.js is lazy-loaded only when OCR is actually needed — that
// way the heavy worker + language data is never bundled into the chat
// route or the auth flow, only the upload route.
//
// sharp is also lazy-loaded — it's a ~3MB native binary so we keep it
// out of routes that don't preprocess images (chat, auth, etc.).

import { RETRIEVAL } from '@/lib/constants';

let workerPromise: Promise<unknown> | null = null;

interface TesseractRecognitionResult {
  data: {
    text: string;
    confidence: number;
  };
}

interface TesseractWorker {
  recognize: (
    input: ArrayBuffer | Uint8Array | string,
    options?: unknown,
    progressCallback?: (info: { status: string; progress: number }) => void,
  ) => Promise<TesseractRecognitionResult>;
  terminate: () => Promise<void>;
}

interface SharpStats {
  channels: Array<{
    min: number;
    max: number;
    sum: number;
    squaresSum: number;
    mean: number;
    stdev: number;
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
  }>;
  isOpaque: boolean;
  entropy: number;
  sharpness: number;
  dominant: { r: number; g: number; b: number };
}

interface SharpPipeline {
  stats: () => Promise<SharpStats>;
  negate: (value?: boolean) => SharpPipeline;
  grayscale: (value?: boolean) => SharpPipeline;
  normalize: (value?: boolean) => SharpPipeline;
  sharpen: (options?: unknown) => SharpPipeline;
  png: (options?: unknown) => SharpPipeline;
  // ⚠️ sharp's `.toBuffer()` without args returns a Buffer directly.
  // With `{ resolveWithObject: true }` it returns `{ data, info }`.
  // We use the no-args form and treat the result as a Buffer.
  toBuffer: (options?: { resolveWithObject?: boolean }) => Promise<Buffer>;
}

type SharpConstructor = (input: ArrayBuffer | Uint8Array) => SharpPipeline;

let sharpCtorPromise: Promise<SharpConstructor> | null = null;

async function getSharp(): Promise<SharpConstructor> {
  if (!sharpCtorPromise) {
    sharpCtorPromise = (async () => {
      // Dynamic import keeps sharp out of the client bundle and out of
      // routes that don't preprocess images.
      const mod = await import('sharp');
      return mod.default as unknown as SharpConstructor;
    })();
  }
  return sharpCtorPromise;
}

/**
 * Lazily create a Tesseract worker (English, single-thread).
 */
async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = (await createWorker('eng', 1, {
        cacheMethod: 'none',
        logger: () => {},
      })) as unknown as TesseractWorker;
      return worker;
    })();
  }
  return (await workerPromise) as TesseractWorker;
}

/**
 * ⚠️ Universal image preprocessing for OCR.
 *
 * Different document backgrounds defeat Tesseract's default binarization
 * in different ways:
 *
 *   1. Dark / inverted backgrounds (Linux terminals, dark-mode IDEs):
 *      Tesseract auto-thresholds the image to a binary mask. With a
 *      dark background and bright text, the threshold collapses the
 *      whole image to solid black → 0 chars returned.
 *      Fix: apply `.negate()` first to flip dark backgrounds to white
 *      and bright text to dark, then OCR.
 *
 *   2. Light / colored backgrounds (olive-green certificates, white-bg
 *      Matplotlib charts, paper notes with colored tints):
 *      Tesseract's threshold works but the colored tint lowers contrast
 *      on the dark text, producing garbled output.
 *      Fix: apply `.grayscale().normalize().sharpen()` to strip the
 *      tint, expand the dynamic range to full [0,255], and crisp up
 *      character edges.
 *
 * We distinguish the two cases by computing mean luminance L from
 * sharp's per-channel `.stats()`. The threshold L=115 is empirical
 * (Linux terminal screenshots typically have L≈30-60, white-bg PNGs
 * have L≈180-220, light gray slides have L≈140-180).
 *
 * Output: PNG buffer ready for tesseract.js.
 */
export async function preprocessImage(
  buffer: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  const sharpCtor = await getSharp();
  // Defensive copy — sharp may detach the input ArrayBuffer in some
  // builds. We never want to mutate the caller's buffer.
  const inputBytes: Uint8Array = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer.slice(0))
    : new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

  // First, validate the image is decodable by attempting stats(). If
  // the image is corrupt, sharp.stats() throws → we throw a typed error
  // that ocrImageBuffer can catch and return empty text (instead of
  // passing the corrupt buffer to tesseract.js, which crashes the
  // worker thread with an uncatchable 'Error attempting to read image').
  let statsPipeline: SharpPipeline;
  try {
    statsPipeline = sharpCtor(inputBytes);
  } catch (err) {
    throw new Error(`sharp() constructor failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Compute mean luminance across all channels.
  let meanLuminance = 128; // default if stats fail
  try {
    const stats = await statsPipeline.stats();
    if (stats.channels.length >= 3) {
      // Standard luminance formula: 0.299R + 0.587G + 0.114B
      const r = stats.channels[0]!.mean;
      const g = stats.channels[1]!.mean;
      const b = stats.channels[2]!.mean;
      meanLuminance = 0.299 * r + 0.587 * g + 0.114 * b;
    } else if (stats.channels.length === 1) {
      // Grayscale image — just use the single channel
      meanLuminance = stats.channels[0]!.mean;
    }
  } catch (err) {
    // stats() failed — image is corrupt or unsupported. Throw a typed
    // error so ocrImageBuffer can catch and return empty text.
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`sharp.stats() failed (image likely corrupt): ${message}`);
  }

  // ⚠️ Decision matrix per the universal spec:
  //   L < 115  → dark/inverted bg  → negate() to flip dark→white, text→dark
  //   L ≥ 115  → light/colored bg  → grayscale().normalize().sharpen()
  //
  // Use a fresh pipeline for the actual transforms — reusing the stats
  // pipeline gives "Input image has been processed" errors in sharp 0.33+.
  const transformPipeline = sharpCtor(inputBytes);

  if (meanLuminance < 115) {
    // Dark/inverted: negate + light normalization for OCR
    try {
      const outBuffer = await transformPipeline
        .negate()
        .grayscale()
        .normalize()
        .png()
        .toBuffer();
      // Node Buffer → fresh ArrayBuffer copy
      const ab = new ArrayBuffer(outBuffer.byteLength);
      new Uint8Array(ab).set(new Uint8Array(outBuffer.buffer, outBuffer.byteOffset, outBuffer.byteLength));
      return ab;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[preprocessImage] negate pipeline failed:', message);
      // Fall through to light-bg pipeline
    }
  }

  // Light/colored (or fallback): grayscale + normalize + sharpen
  // ⚠️ We need a fresh pipeline here too because the negate pipeline above
  // may have partially executed. Re-create from the input bytes.
  const lightPipeline = sharpCtor(inputBytes);
  try {
    const outBuffer = await lightPipeline
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
    const ab = new ArrayBuffer(outBuffer.byteLength);
    new Uint8Array(ab).set(new Uint8Array(outBuffer.buffer, outBuffer.byteOffset, outBuffer.byteLength));
    return ab;
  } catch (err) {
    // Both pipelines failed — image is genuinely corrupt. Throw so
    // ocrImageBuffer can catch and return empty text instead of passing
    // the bad buffer to tesseract.js (which would crash the worker).
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`preprocessImage all pipelines failed: ${message}`);
  }
}

/**
 * Run OCR on a single image buffer (PNG / JPG / WEBP / GIF).
 *
 * ⚠️ Universal preprocessing pipeline (per the universal ingestion spec):
 *   1. Compute mean luminance L with sharp.stats()
 *   2. If L < 115 → apply .negate() to flip dark backgrounds to white
 *   3. If L ≥ 115 → apply .grayscale().normalize().sharpen() to strip
 *      colored tints and expand dynamic range
 *   4. Then run tesseract.js OCR on the preprocessed PNG
 *
 * Returns the recognized text trimmed; EMPTY STRING if nothing was
 * found (does NOT throw — caller can decide whether to skip the page
 * or include it as an empty placeholder).
 */
export async function ocrImageBuffer(
  buffer: ArrayBuffer | Uint8Array,
  onProgress?: (info: { status: string; progress: number }) => void,
): Promise<{ text: string; confidence: number }> {
  // 1. Preprocess via sharp (handles dark/colored backgrounds).
  //    ⚠️ If preprocessing fails (e.g. corrupt image), we return empty
  //    text WITHOUT calling tesseract.js — passing a corrupt buffer to
  //    tesseract.js v5 causes an uncatchable worker-thread crash:
  //    'Error attempting to read image' emitted via process.nextTick.
  //    Better to skip the OCR entirely and let the caller handle empty
  //    text (page omitted, or placeholder chunk inserted by upload route).
  let preprocessedBuffer: ArrayBuffer;
  try {
    preprocessedBuffer = await preprocessImage(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[ocrImageBuffer] preprocessing failed, returning empty text:', message);
    return { text: '', confidence: 0 };
  }

  // 2. Run tesseract.js on the preprocessed image.
  const worker = await getWorker();
  try {
    // Defensive copy — tesseract.js transfers the ArrayBuffer to its
    // worker thread, detaching the original. We always pass a fresh copy.
    const input = new Uint8Array(preprocessedBuffer.slice(0));
    const result = await worker.recognize(input, {}, onProgress);
    const text = (result.data?.text ?? '').trim();
    const confidence = result.data?.confidence ?? 0;
    return { text, confidence };
  } catch (err) {
    // OCR failure — return empty. The caller will decide what to do
    // (skip the page, include as empty placeholder, etc.). We do NOT
    // throw — that would crash the upload route with 500.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[ocrImageBuffer] OCR failed:', message);
    return { text: '', confidence: 0 };
  }
}

/**
 * Heuristic: detect whether a PDF is "scanned" (image-based, no real text
 * layer) by measuring the average text-per-page from unpdf's extraction.
 *
 * Used as a coarse filter in extractPagesFromPdf to decide whether to
 * run the heavy per-page OCR pipeline at all. Per-page operator-list
 * inspection (in extractor.ts) makes the final decision per page.
 */
export function looksScanned(
  pages: Array<{ pageNumber: number; text: string }>,
): boolean {
  if (pages.length === 0) return true;
  const totalText = pages.reduce((sum, p) => sum + p.text.length, 0);
  const avgPerPage = totalText / pages.length;
  return avgPerPage < RETRIEVAL.scannedPdfTextThreshold;
}

/**
 * ⚠️ Per-page OCR pipeline for PDFs with embedded images.
 *
 * For each page, uses pdfjs's operator list to detect embedded image
 * objects (paintImageXObject / paintInlineImageXObject). Decision matrix:
 *
 *   - Pure text page (digital text present, NO image objects):
 *     Return digital text immediately. Skip canvas rendering + OCR.
 *     Zero overhead, instant.
 *
 *   - Pure scanned page (zero digital text):
 *     Render page to PNG via unpdf.renderPageAsImage, preprocess with
 *     sharp, OCR with tesseract.js.
 *
 *   - Hybrid page (digital text AND embedded images — e.g. slide decks
 *     with terminal screenshots, notebooks with Matplotlib charts,
 *     certificates with typed names on colored backgrounds):
 *     Keep the digital text, render the page to PNG, preprocess with
 *     sharp, OCR the rendered image, and merge:
 *       `${digitalText}\n\n[Visual Content / Embedded Figures]:\n${ocrText}`
 *
 * This eliminates the broken character-count threshold (50 chars) that
 * previously caused slide titles to skip OCR even when terminal
 * screenshots were present on the same page.
 */
export async function ocrPdfPerPage(
  buffer: ArrayBuffer,
  options: {
    /** Per-page text from unpdf (used as a fast hint — the actual
     * decision is made via the operator list). Optional. */
    unpdfPages?: Array<{ pageNumber: number; text: string }>;
    /** Render scale for canvas. Higher = better OCR accuracy, slower.
     * Default: 2.0 */
    renderScale?: number;
  } = {},
): Promise<Array<{ pageNumber: number; text: string }>> {
  const renderScale = options.renderScale ?? 2.0;
  const unpdfTextByPage = new Map<number, string>();
  if (options.unpdfPages) {
    for (const p of options.unpdfPages) {
      if (p.text.trim().length > 0) unpdfTextByPage.set(p.pageNumber, p.text);
    }
  }

  const unpdfMod = await import('unpdf');
  const { getDocumentProxy, renderPageAsImage, getResolvedPDFJS } = unpdfMod;

  // ⚠️ Defensive copy: pdfjs's getDocument transfers the ArrayBuffer to
  // its worker thread, detaching the original.
  const bufferCopy = buffer.slice(0);
  const pdf = await getDocumentProxy(new Uint8Array(bufferCopy));
  const numPages = pdf.numPages;
  const out: Array<{ pageNumber: number; text: string }> = [];

  // Resolve the pdfjs module so we can access the OPS constants.
  const pdfjs = await getResolvedPDFJS();
  const OPS = (pdfjs as unknown as {
    OPS: Record<string, number>;
  }).OPS;

  for (let i = 1; i <= numPages; i++) {
    const pageProxy = await pdf.getPage(i);

    // 1. Extract digital text via page.getTextContent().
    let digitalText = unpdfTextByPage.get(i) ?? '';
    if (!digitalText) {
      try {
        const textContent = await pageProxy.getTextContent();
        digitalText = textContent.items
          .map((item: unknown) => {
            if (item && typeof item === 'object' && 'str' in item) {
              const str = (item as { str: unknown }).str;
              return typeof str === 'string' ? str : '';
            }
            return '';
          })
          .join(' ')
          .trim();
      } catch {
        // ignore — will rely on OCR
      }
    }

    // 2. Inspect the operator list for embedded image objects.
    let hasImages = false;
    try {
      const ops = await pageProxy.getOperatorList();
      const fnArray = (ops as unknown as { fnArray: number[] }).fnArray ?? [];
      const paintImageXObjectOp = OPS.paintImageXObject;
      const paintInlineImageOp = OPS.paintInlineImageXObject;
      hasImages =
        (typeof paintImageXObjectOp === 'number' && fnArray.includes(paintImageXObjectOp)) ||
        (typeof paintInlineImageOp === 'number' && fnArray.includes(paintInlineImageOp));
    } catch (err) {
      // getOperatorList failed — assume images might exist (safer to
      // attempt OCR than to miss content).
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ocrPdfPerPage] Page ${i} getOperatorList failed:`, message);
      hasImages = true;
    }

    // 3. Decision matrix.
    const hasDigitalText = digitalText.trim().length > 0;

    // Case A: Pure text page — no images, has digital text. Return
    // immediately, skip OCR entirely (instant, 0ms overhead).
    if (hasDigitalText && !hasImages) {
      out.push({ pageNumber: i, text: digitalText });
      continue;
    }

    // Case B & C: Render page to PNG + OCR.
    //   B: Pure scanned page (no digital text, has images OR no text)
    //   C: Hybrid page (has digital text AND has images)
    let ocrText = '';
    let ocrConfidence = 0;
    try {
      const pngBuffer = await renderPageAsImage(pdf, i, {
        scale: renderScale,
        canvasImport: async () => await import('@napi-rs/canvas'),
      });
      const result = await ocrImageBuffer(pngBuffer);
      ocrText = result.text;
      ocrConfidence = result.confidence;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ocrPdfPerPage] Page ${i} render/OCR failed:`, message);
    }

    // Case B: Pure scanned page — OCR is the only source.
    if (!hasDigitalText) {
      if (ocrText.length > 0) {
        out.push({ pageNumber: i, text: ocrText });
        if (ocrConfidence < 60) {
          console.warn(
            `[ocrPdfPerPage] Page ${i} low confidence (${ocrConfidence.toFixed(0)}%)`,
          );
        }
      }
      // If both digital text AND OCR returned nothing, skip the page.
      continue;
    }

    // Case C: Hybrid page — merge digital text + OCR text.
    // The `[Visual Content / Embedded Figures]:` header signals to the
    // LLM (via the system prompt) that this section was OCR'd from
    // embedded images — different epistemic status than the digital
    // text above.
    if (ocrText.length > 0) {
      const merged = `${digitalText}\n\n[Visual Content / Embedded Figures]:\n${ocrText}`;
      out.push({ pageNumber: i, text: merged });
    } else {
      // OCR returned nothing — keep digital text only.
      out.push({ pageNumber: i, text: digitalText });
    }
  }

  return out;
}
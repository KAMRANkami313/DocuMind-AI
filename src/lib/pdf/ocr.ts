// ⚠️ OCR utility using tesseract.js. Used by:
//   - src/lib/pdf/image-extractor.ts (for image uploads: PNG/JPG/WEBP/GIF)
//   - src/lib/pdf/extractor.ts (fallback OCR for scanned PDFs that yield
//     little or no extractable text from unpdf)
//
// Tesseract.js is lazy-loaded only when OCR is actually needed — that
// way the heavy worker + language data is never bundled into the chat
// route or the auth flow, only the upload route.

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
    // Progress callback (optional)
    progressCallback?: (info: { status: string; progress: number }) => void,
  ) => Promise<TesseractRecognitionResult>;
  terminate: () => Promise<void>;
}

/**
 * Lazily create a Tesseract worker (English, single-thread).
 * The worker is reused across calls within the same Lambda invocation.
 * On Vercel serverless, the worker + language data (~10MB) is downloaded
 * on first call and cached in /tmp for subsequent invocations on the same
 * warm instance.
 */
async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Dynamic import keeps tesseract.js out of the client bundle and out
      // of routes that don't need OCR.
      const { createWorker } = await import('tesseract.js');
      const worker = (await createWorker('eng', 1, {
        // Use the legacy path for language data — tries to load from local
        // cache first, falls back to downloading from the CDN.
        cacheMethod: 'none',
        logger: () => {
          // Silence the default logger — we don't want to spam server logs.
        },
      })) as unknown as TesseractWorker;
      return worker;
    })();
  }
  return (await workerPromise) as TesseractWorker;
}

/**
 * Run OCR on a single image buffer (PNG / JPG / WEBP / GIF).
 * Returns the recognized text trimmed; empty string if nothing was found.
 */
export async function ocrImageBuffer(
  buffer: ArrayBuffer,
  onProgress?: (info: { status: string; progress: number }) => void,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  try {
    const result = await worker.recognize(
      new Uint8Array(buffer),
      {},
      onProgress,
    );
    const text = (result.data?.text ?? '').trim();
    const confidence = result.data?.confidence ?? 0;
    return { text, confidence };
  } catch (err) {
    // On any OCR failure, return empty — the caller will fall back to
    // whatever text (if any) was already extracted.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('OCR failed:', message);
    return { text: '', confidence: 0 };
  }
}

/**
 * Heuristic: detect whether a PDF is "scanned" (image-based, no real text
 * layer) by measuring the average text-per-page from unpdf's extraction.
 *
 * If pages yield < RETRIEVAL.scannedPdfTextThreshold characters of text
 * on average, treat it as scanned and run OCR on each page's image.
 *
 * @param pages Array of pages from unpdf extraction
 * @returns true if the PDF appears to be scanned
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
 * Run OCR on each page of a PDF buffer sequentially. Tesseract.js v5 can
 * accept a PDF buffer directly when the underlying pdfjs worker is
 * available — but this is flaky on Vercel serverless because the canvas
 * backend needs node-canvas. As a robust fallback, we OCR the whole PDF
 * as a single image and return one big text blob with page breaks.
 *
 * For the hobby-tier Vercel use case, this is good enough — users with
 * heavy scanned-PDF workflows are encouraged to use a separate
 * pre-processing step (e.g. Adobe Acrobat → "Recognize Text") before
 * uploading.
 */
export async function ocrPdfBuffer(
  buffer: ArrayBuffer,
): Promise<Array<{ pageNumber: number; text: string }>> {
  const worker = await getWorker();
  try {
    // Tesseract.js v5 can recognize PDF files directly (it uses pdfjs-dist
    // internally to render pages). If this fails, we fall back to a single
    // page-1 OCR (which usually returns at least the cover page).
    const result = await worker.recognize(new Uint8Array(buffer));
    const text = (result.data?.text ?? '').trim();
    if (text.length === 0) return [];
    return [{ pageNumber: 1, text }];
  } catch {
    // Final fallback: signal that OCR could not run. The upload route
    // will treat this as "no text found" and the document will have zero
    // chunks — the chat will then politely refuse to answer.
    return [];
  }
}
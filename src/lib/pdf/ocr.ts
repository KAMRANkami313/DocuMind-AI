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
 *
 * Accepts an ArrayBuffer or a Uint8Array (Node Buffer is a Uint8Array).
 *
 * ⚠️ We make a defensive COPY of the input before passing it to tesseract.js
 * because tesseract.js transfers the ArrayBuffer to its worker thread,
 * detaching the original. Without a copy, the caller's buffer becomes
 * unusable after this call returns, and any subsequent consumer (e.g. the
 * next page's OCR, or @napi-rs/canvas's underlying buffer pool) crashes
 * with "Cannot perform Construct on a detached ArrayBuffer".
 */
export async function ocrImageBuffer(
  buffer: ArrayBuffer | Uint8Array,
  onProgress?: (info: { status: string; progress: number }) => void,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  try {
    // Defensive copy — always a fresh ArrayBuffer that tesseract.js is
    // free to detach without breaking any other consumer.
    let input: Uint8Array;
    if (buffer instanceof ArrayBuffer) {
      input = new Uint8Array(buffer.slice(0));
    } else {
      // Uint8Array view — copy bytes into a new ArrayBuffer.
      const copy = new Uint8Array(buffer.byteLength);
      copy.set(buffer);
      input = copy;
    }
    const result = await worker.recognize(input, {}, onProgress);
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
 * ⚠️ Per-page OCR fallback for PDFs that have sparse text on certain
 * pages (e.g., slide decks where each slide has a title at the top and
 * a terminal screenshot below — the screenshot's text is invisible to
 * unpdf's text extraction).
 *
 * This function:
 *   1. Gets the pdfjs document proxy via unpdf.getDocumentProxy
 *   2. Iterates pages 1..N
 *   3. For each page: extracts text content directly via page.getTextContent()
 *   4. If the text is sparse (< threshold), renders the page to a PNG
 *      using unpdf.renderPageAsImage (which uses @napi-rs/canvas internally),
 *      then OCRs the PNG with tesseract.js
 *   5. Merges: keeps whatever unpdf text exists, appends OCR text for the
 *      portions unpdf couldn't see (e.g. terminal screenshots embedded
 *      inside slides)
 *
 * Returns an array of { pageNumber, text } — one entry per page that
 * has any text (either from unpdf OR from OCR). Pages with neither are
 * omitted (the chunker would skip them anyway).
 */
export async function ocrPdfPerPage(
  buffer: ArrayBuffer,
  options: {
    /** Per-page text from unpdf (used to skip pages where unpdf already
     * extracted enough text). Optional — if omitted, we extract text
     * directly via pdfjs per-page. */
    unpdfPages?: Array<{ pageNumber: number; text: string }>;
    /** Render scale for canvas. Higher = better OCR accuracy, slower.
     * Default: 2.0 (good balance for ~12pt text). */
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

  // Dynamic imports — keep heavy native deps out of the bundle when
  // OCR fallback is never triggered (text-based PDFs).
  const unpdfMod = await import('unpdf');
  const { getDocumentProxy, renderPageAsImage } = unpdfMod;

  // ⚠️ Defensive copy: pdfjs's getDocument transfers the ArrayBuffer to
  // its worker thread, detaching the original. We slice the bytes into a
  // fresh ArrayBuffer so the upstream caller's buffer is not corrupted.
  // Without this, the second pass through extractPagesFromPdf (or any
  // subsequent reader of the upload's buffer) crashes with
  // "Cannot perform Construct on a detached ArrayBuffer".
  const bufferCopy = buffer.slice(0);
  const pdf = await getDocumentProxy(new Uint8Array(bufferCopy));
  const numPages = pdf.numPages;
  const out: Array<{ pageNumber: number; text: string }> = [];

  for (let i = 1; i <= numPages; i++) {
    // 1. Get this page's text content directly (per-page, not the
    // whole-document blob unpdf.extractText gives us).
    let pageText = unpdfTextByPage.get(i) ?? '';
    if (!pageText) {
      try {
        const pageProxy = await pdf.getPage(i);
        const textContent = await pageProxy.getTextContent();
        pageText = textContent.items
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
        // ignore — will rely on OCR fallback
      }
    }

    // 2. If the page has substantive text, skip OCR (text layer is good).
    if (pageText.length >= RETRIEVAL.scannedPdfTextThreshold) {
      out.push({ pageNumber: i, text: pageText });
      continue;
    }

    // 3. Sparse text → render this page to a PNG and OCR it.
    //    unpdf.renderPageAsImage uses @napi-rs/canvas internally to
    //    render the page at the requested scale and returns a PNG
    //    ArrayBuffer directly. We MUST pass `canvasImport` so unpdf
    //    knows how to load @napi-rs/canvas in a Node.js environment
    //    (without it, unpdf throws "Parameter 'canvasImport' is required
    //    in Node.js environment").
    try {
      const pngBuffer = await renderPageAsImage(pdf, i, {
        scale: renderScale,
        canvasImport: async () => await import('@napi-rs/canvas'),
      });
      const { text: ocrText, confidence } = await ocrImageBuffer(pngBuffer);

      // Merge: keep whatever existing text we have, append OCR text
      // (separated by double newline so the chunker can split naturally).
      // If OCR returned nothing, fall through to push pageText only.
      if (ocrText && ocrText.length > 0) {
        const merged = [pageText, ocrText]
          .filter((s) => s.length > 0)
          .join('\n\n');
        out.push({ pageNumber: i, text: merged });
        if (confidence < 60) {
          console.warn(
            `[ocr] Page ${i} low confidence (${confidence.toFixed(0)}%) — text may be inaccurate`,
          );
        }
      } else if (pageText.length > 0) {
        out.push({ pageNumber: i, text: pageText });
      }
      // If both unpdf text AND OCR returned nothing, skip the page entirely.
    } catch (err) {
      // Render/OCR failure for this page — keep whatever text we have,
      // log the error so it's debuggable.
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ocr] Page ${i} render/OCR failed:`, message);
      if (pageText.length > 0) {
        out.push({ pageNumber: i, text: pageText });
      }
    }
  }

  return out;
}
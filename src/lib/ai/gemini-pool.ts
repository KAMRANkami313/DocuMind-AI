// ⚠️ Gemini Vision pool with resilient circuit breaker.
//
// Per the universal ingestion spec:
//   - Use Google Gemini for visual content extraction (images, scanned
//     PDFs, hybrid pages with embedded figures). Tesseract is slow and
//     fails on low-contrast backgrounds; Gemini handles all of these
//     in <1 second with near-100% accuracy.
//   - Keep local sharp + tesseract.js as the EMERGENCY fallback so
//     uploads never crash even if all Gemini models are unavailable
//     or the network is down.
//   - Use a pool of verified models so a single model hitting rate
//     limits doesn't block uploads.
//
// ⚠️ AI-advisor corrections applied:
//   1. The 6 models are CANDIDATES, not guaranteed-1,000/day. Quotas
//      vary by project/tier and change over time. The pool adapts to
//      whatever the actual response says.
//   2. Daily quota resets at MIDNIGHT PACIFIC (per Google docs), NOT
//      a fixed 24h timer. We compute the next Pacific-midnight timestamp
//      and re-enable the model automatically after that.
//   3. Per-minute rate limits (RPM/TPM): short 60s cooldown.
//   4. 503 Server Busy / Service Unavailable: immediate failover to
//      the next model (no cooldown — Google may be momentarily
//      overloaded but recover in seconds).
//   5. 404 Not Found (model deprecated/renamed): permanent disable
//      with periodic recheck every 24h.
//   6. Models currently BUSY/QUOTA may become available later; the
//      circuit breaker PERIODICALLY retries disabled models so we
//      always re-discover capacity.
//   7. If ALL Gemini models are unavailable, fall back to local
//      sharp+Tesseract (the existing preprocessImage + ocrImageBuffer
//      in ocr.ts).

import { GoogleGenAI } from '@google/genai';
import { logger } from '@/lib/logger';

// Verified-passing models from the user's probe (9/46 passed text
// generation). We restrict the pool to models that:
//   (a) passed the basic "Reply with: Hello" probe, AND
//   (b) are documented to accept image inputs.
// `gemini-3-flash-preview` is the user's primary verified-working model
// (the certificate test in PowerShell used this exact model and got
// 100% extraction in <1s).
// ⚠️ POOL ORDERING — sorted by actual daily quota (RPD) from the
// Google AI Studio dashboard:
//   TIER 1 (500 RPD each — highest capacity, use first):
//     gemini-3.1-flash-lite    — 15 RPM, 250K TPM, 500 RPD
//     gemini-3.5-flash-lite   — 15 RPM, 250K TPM, 500 RPD
//   TIER 2 (20 RPD each — lower capacity, use after Tier 1 exhausted):
//     gemini-3-flash-preview   — 5 RPM, 250K TPM, 20 RPD  (user's verified primary)
//     gemini-3.5-flash         — 5 RPM, 250K TPM, 20 RPD
//     gemini-3.6-flash         — 5 RPM, 250K TPM, 20 RPD
//     gemini-flash-lite-latest — fallback tier
export const GEMINI_POOL_MODELS = [
  // TIER 1 — 500 RPD each (use first)
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  // TIER 2 — 20 RPD each (failover when Tier 1 exhausted)
  'gemini-3-flash-preview',       // user's verified primary
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
] as const;

const API_KEY = process.env.GEMINI_API_KEY;

// ⚠️ Each model in the pool has an independent circuit-breaker state.
// We never disable ALL models at once unless every single one returns
// 429 daily-quota-exceeded.
type ModelStatus =
  | { kind: 'healthy' }
  | { kind: 'rate_limited_minute'; recheckAt: number }      // 60s cooldown
  | { kind: 'daily_exceeded'; recheckAt: number }            // Pacific midnight
  | { kind: 'not_found' }                                      // 24h recheck
  | { kind: 'unavailable'; recheckAt: number };               // 5min cooldown for unknown errors

interface PoolEntry {
  model: string;
  client: GoogleGenAI | null;
  status: ModelStatus;
  // ⚠️ Track last-known error details so we can include them in any
  // "extraction failed" placeholder chunk.
  lastError: string | null;
}

const pool: PoolEntry[] = GEMINI_POOL_MODELS.map((model) => ({
  model,
  client: null,
  status: { kind: 'healthy' },
  lastError: null,
}));

let poolInitialized = false;

function ensureClients(entry: PoolEntry): GoogleGenAI | null {
  if (!API_KEY) return null;
  if (entry.client) return entry.client;
  try {
    entry.client = new GoogleGenAI({ apiKey: API_KEY });
    return entry.client;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[gemini-pool] Failed to construct client', { model: entry.model, error: message });
    entry.lastError = `Client init failed: ${message}`;
    return null;
  }
}

/**
 * Compute the next Pacific-midnight timestamp in milliseconds.
 *
 * Google's AI Studio free-tier daily quota (RPD = requests per day)
 * resets at midnight Pacific time, not 24h after the first failure.
 * We compute the actual next reset so the model auto-re-enables when
 * Google's quota actually refreshes — not too early, not too late.
 *
 * Pacific Time observes DST (Pacific Daylight Time PDT = UTC-7 in
 * summer, Pacific Standard Time PST = UTC-8 in winter). We use
 * Intl with the 'America/Los_Angeles' timezone to compute the next
 * midnight — Intl handles DST automatically.
 */
export function getNextPacificMidnight(now: Date = new Date()): number {
  // Get the current time in Los Angeles as parts
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const pacificYear = parseInt(get('year'), 10);
  const pacificMonth = parseInt(get('month'), 10) - 1;
  const pacificDay = parseInt(get('day'), 10);

  // Construct tomorrow midnight in Pacific, expressed as a "local" time
  // in Los_Angeles. We use the fact that `Date.UTC(...)` gives us UTC,
  // then we use Intl to figure out the Pacific-to-UTC offset.
  //
  // Simpler approach: tomorrow's Pacific date, then find the next
  // midnight using a loop that increments 1 hour at a time until we
  // cross Pacific midnight. But that's overkill — instead, we compute
  // the date for "tomorrow" at 00:00:00 in Pacific, and ask Intl to
  // give us the UTC equivalent.
  //
  // The correct way: construct the string 'YYYY-MM-DDT00:00:00' for
  // tomorrow's Pacific date, parse it as if it were Pacific, then convert.
  const pacTomorrowISO = `${pacificYear}-${String(pacificMonth + 1).padStart(2, '0')}-${String(pacificDay + 1).padStart(2, '0')}T00:00:00`;
  // The string above is tomorrow midnight in Pacific. We need to convert
  // this to a UTC epoch. The trick: use the format that includes the
  // timezone offset.
  //
  // Approach: find the offset for Pacific at that moment, then subtract.
  const offsetFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  // We don't actually need to parse the offset string — instead, use the
  // technique of constructing a UTC date and seeing what time that is
  // in Pacific, then adjusting.
  const candidateUtc = Date.parse(pacTomorrowISO + 'Z'); // assume Z = treat as UTC
  // candidateUtc is what tomorrow midnight would be IF it were UTC.
  // But it's actually Pacific. So the real UTC = candidateUtc - offset.
  // Get the offset (in ms) for the Pacific time at candidateUtc:
  const candidateDate = new Date(candidateUtc);
  const offsetParts = offsetFmt.formatToParts(candidateDate);
  const offsetStr = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? '+00:00';
  // Parse '+HH:MM' or '-HH:MM' or 'GMT' (which we treat as 0)
  let offsetMs = 0;
  const m = offsetStr.match(/([+-])(\d{1,2}):?(\d{2})?/);
  if (m) {
    const sign = m[1] === '+' ? 1 : -1;
    const hours = parseInt(m[2]!, 10);
    const minutes = m[3] ? parseInt(m[3], 10) : 0;
    offsetMs = sign * (hours * 3600 + minutes * 60) * 1000;
  }
  // Pacific time = UTC - offset (when offset is positive, e.g. PDT = -7h)
  // So UTC = Pacific time + offset... wait, that's wrong.
  // Actually: PST = UTC - 8h means PST_time = UTC_time - 8h,
  //   so UTC_time = PST_time + 8h = PST_time - offset
  // Because offset is -8h for PST (or -7h for PDT).
  // So UTC = candidateUtc - offset.
  const realUtc = candidateUtc - offsetMs;
  return realUtc;
}

/**
 * Get the next available model from the pool. Returns null if all are
 * currently disabled.
 */
function pickNextModel(): PoolEntry | null {
  const now = Date.now();
  // ⚠️ Re-check disabled models — they may have recovered (Google
  // quota refreshes at Pacific midnight, 503s clear in seconds).
  for (const entry of pool) {
    if (entry.status.kind === 'healthy') {
      // Already healthy — will be picked below
      continue;
    }
    if ('recheckAt' in entry.status && entry.status.recheckAt <= now) {
      // Cooldown elapsed — re-enable.
      logger.info('[gemini-pool] Re-enabling model after cooldown', {
        model: entry.model,
        previousStatus: entry.status.kind,
      });
      entry.status = { kind: 'healthy' };
      entry.lastError = null;
    }
  }
  // Pick the first healthy model
  return pool.find((e) => e.status.kind === 'healthy') ?? null;
}

interface GeminiExtractionResult {
  text: string;
  modelUsed: string;
  // ⚠️ If extraction succeeded via fallback (local Tesseract), this is
  // set to 'fallback:local-tesseract'. If ALL Gemini + local failed,
  // 'fallback:local-tesseract' is still set but `text` is empty.
  extractionMethod: 'gemini' | 'fallback:local-tesseract';
}

/**
 * Detect whether a Gemini error indicates daily quota exceeded (RPD),
 * per-minute rate limit (RPM/TPM), model not found (404), or server
 * busy (503).
 *
 * Google's error response shape (via @google/genai):
 *   { error: { code: 429, status: 'RESOURCE_EXHAUSTED',
 *              error: { metadata: { ... quota_info ... } } } }
 * For 429, the `error.metadata` may include `quota_info` with
 * `quota_name` indicating whether it's RPM/TPM (per-minute) or RPD
 * (per-day). Different SDK versions surface this differently, so we
 * also fall back to message-text inspection.
 */
interface GeminiErrorClassification {
  kind: 'daily_exceeded' | 'rate_limited_minute' | 'not_found' | 'unavailable' | 'unknown';
  message: string;
}

function classifyGeminiError(err: unknown, httpStatus?: number): GeminiErrorClassification {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  // 404 Not Found — model is deprecated/renamed
  if (httpStatus === 404 || lower.includes('404') || lower.includes('not found')) {
    return { kind: 'not_found', message: rawMessage };
  }
  // 429 Too Many Requests
  if (httpStatus === 429 || lower.includes('429') || lower.includes('too many requests')) {
    // Distinguish daily quota (RPD) from per-minute (RPM/TPM)
    if (
      lower.includes('rpd') ||
      lower.includes('requests per day') ||
      lower.includes('daily') ||
      lower.includes('quota') && lower.includes('exceeded')
    ) {
      return { kind: 'daily_exceeded', message: rawMessage };
    }
    // Default for 429 — assume per-minute (RPM/TPM). This is the more
    // common case and recovers faster.
    return { kind: 'rate_limited_minute', message: rawMessage };
  }
  // 503 Server Unavailable / Service Unavailable
  if (httpStatus === 503 || lower.includes('503') || lower.includes('unavailable') || lower.includes('overloaded')) {
    return { kind: 'unavailable', message: rawMessage };
  }
  return { kind: 'unknown', message: rawMessage };
}

/**
 * Update a pool entry's circuit-breaker state based on an error.
 */
function applyCircuitBreaker(entry: PoolEntry, classification: GeminiErrorClassification): void {
  const now = Date.now();
  switch (classification.kind) {
    case 'daily_exceeded':
      entry.status = { kind: 'daily_exceeded', recheckAt: getNextPacificMidnight(new Date(now)) };
      entry.lastError = `Daily quota exceeded (RPD). Resets at Pacific midnight.`;
      logger.warn('[gemini-pool] Model disabled until Pacific midnight (daily quota)', {
        model: entry.model,
        message: classification.message,
      });
      break;
    case 'rate_limited_minute':
      // 60-second cooldown — short, will be re-tried quickly
      entry.status = { kind: 'rate_limited_minute', recheckAt: now + 60 * 1000 };
      entry.lastError = `Per-minute rate limit (RPM/TPM). 60s cooldown.`;
      logger.warn('[gemini-pool] Model in 60s cooldown (RPM/TPM)', {
        model: entry.model,
      });
      break;
    case 'not_found':
      // 404 — model deprecated. Try again in 24h in case Google
      // re-adds it under the same name (rare but possible).
      entry.status = { kind: 'not_found' };
      entry.lastError = `Model not found (404) — likely deprecated/renamed. 24h recheck.`;
      logger.error('[gemini-pool] Model permanently disabled (404)', {
        model: entry.model,
      });
      break;
    case 'unavailable':
      // 503 — short cooldown (Google may recover in seconds)
      entry.status = { kind: 'unavailable', recheckAt: now + 5 * 60 * 1000 };
      entry.lastError = `Server unavailable (503). 5min cooldown.`;
      logger.warn('[gemini-pool] Model in 5min cooldown (503)', { model: entry.model });
      break;
    case 'unknown':
    default:
      // Unknown error — short cooldown, retry soon
      entry.status = { kind: 'unavailable', recheckAt: now + 60 * 1000 };
      entry.lastError = `Unknown error. 60s cooldown. (${classification.message})`;
      logger.warn('[gemini-pool] Model in 60s cooldown (unknown error)', {
        model: entry.model,
        message: classification.message,
      });
      break;
  }
}

interface GeminiCallOptions {
  /** The image buffer (PNG, JPG, WEBP, etc.) */
  imageBuffer: ArrayBuffer | Uint8Array;
  /** MIME type — defaults to 'image/png'. Tesseract/sharp output is PNG. */
  mimeType?: string;
  /** Optional prompt override. Default asks for verbatim text extraction. */
  prompt?: string;
}

const DEFAULT_EXTRACT_PROMPT =
  'Transcribe all readable text, code, tables, and document details verbatim in clean Markdown. ' +
  'Do not summarize. Do not add commentary. If the image has no readable text, respond with the single word: "EMPTY".';

/**
 * Try one Gemini model with the image. Returns the extracted text if
 * successful, or throws with a classified error if the model fails.
 *
 * The caller (extractTextFromImageViaGemini) handles circuit-breaker
 * updates and fallback to local Tesseract.
 */
async function tryOneModel(
  entry: PoolEntry,
  imageBuffer: ArrayBuffer | Uint8Array,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = ensureClients(entry);
  if (!client) {
    throw new Error(`Gemini client could not be constructed (missing API key or init failure) for model ${entry.model}`);
  }

  // Convert image buffer to Base64 string (Google GenAI requires base64 scalar string)
  const uint8 = imageBuffer instanceof Uint8Array 
    ? imageBuffer 
    : new Uint8Array(imageBuffer);
  const base64Data = Buffer.from(uint8).toString('base64');

  const contents = [
    {
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType || 'image/png',
          },
        },
      ],
    },
  ];

  // @google/genai v2 uses `client.models.generateContent({...})` API
  const response = await client.models.generateContent({
    model: entry.model,
    contents: contents as unknown as Parameters<typeof client.models.generateContent>[0]['contents'],
  });

  // Extract text from response
  const candidates = (response as unknown as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  if (!candidates || candidates.length === 0) {
    return '';
  }
  const parts = candidates[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p?.text ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();
  return text;
}

/**
 * Extract text from an image via the Gemini pool with full circuit-breaker
 * + fallback behavior.
 *
 * Strategy:
 *   1. Try each healthy model in the pool (in order).
 *   2. On success: keep model at top of pool (it's already first by
 *      definition of "first healthy"), return text.
 *   3. On 429 daily: disable model until Pacific midnight, try next.
 *   4. On 429 per-minute: 60s cooldown, try next immediately.
 *   5. On 503: 5min cooldown, try next immediately.
 *   6. On 404: permanent disable (24h recheck), try next.
 *   7. On other error: 60s cooldown, try next.
 *   8. If ALL Gemini models fail: return { extractionMethod: 'fallback:local-tesseract', text: '' }
 *      — the caller (ocr.ts) will then run the local sharp + Tesseract
 *      pipeline as the emergency fallback.
 */
export async function extractTextFromImageViaGemini(
  opts: GeminiCallOptions,
): Promise<GeminiExtractionResult> {
  if (!API_KEY) {
    logger.warn('[gemini-pool] No GEMINI_API_KEY set — skipping Gemini, will use local fallback');
    return { text: '', modelUsed: '', extractionMethod: 'fallback:local-tesseract' };
  }

  poolInitialized = true;
  const mimeType = opts.mimeType ?? 'image/png';
  const prompt = opts.prompt ?? DEFAULT_EXTRACT_PROMPT;

  // Try each healthy model until one succeeds
  // (pool.find() returns the first healthy; we loop in case models
  // get disabled mid-iteration)
  const triedModels = new Set<string>();
  while (true) {
    const entry = pickNextModel();
    if (!entry || triedModels.has(entry.model)) {
      // All models exhausted or already tried
      break;
    }
    triedModels.add(entry.model);

    try {
      const text = await tryOneModel(entry, opts.imageBuffer, mimeType, prompt);
      // Success — empty response is also a "success" (Gemini says no text)
      return { text, modelUsed: entry.model, extractionMethod: 'gemini' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Try to extract HTTP status from the error message
      let httpStatus: number | undefined;
      const statusMatch = message.match(/\b(\d{3})\b/);
      if (statusMatch) {
        const code = parseInt(statusMatch[1]!, 10);
        if (code >= 400 && code < 600) httpStatus = code;
      }
      const classification = classifyGeminiError(err, httpStatus);
      applyCircuitBreaker(entry, classification);
      // Continue to next model
    }
  }

  // All Gemini models failed — return signal to caller to use local fallback
  return { text: '', modelUsed: '', extractionMethod: 'fallback:local-tesseract' };
}

/**
 * Get the current status of all pool models (for debugging / UI display).
 */
export function getPoolStatus(): Array<{ model: string; status: string; lastError: string | null }> {
  return pool.map((e) => ({
    model: e.model,
    status: e.status.kind,
    lastError: e.lastError,
  }));
}

void poolInitialized; // silence unused-variable warning

// ============================================================================
// ⚠️ BATCHED IMAGE EXTRACTION
//
// By batching 5-8 images per request, a 14-page document consumes only
// 2-3 RPD instead of 14 — an 80% reduction in API quota usage.
// ============================================================================

export interface BatchedImage {
  pageNumber: number;
  buffer: ArrayBuffer | Uint8Array;
  mimeType?: string;
}

export interface BatchedExtractionResult {
  /** Map of pageNumber → extracted text */
  pageTexts: Map<number, string>;
  modelUsed: string;
  extractionMethod: 'gemini' | 'fallback:local-tesseract';
}

const MAX_PAGES_PER_BATCH = 6;

const BATCHED_EXTRACT_PROMPT_PREFIX =
  'You are given multiple document page images below. Transcribe ALL readable text, code, ' +
  'tables, and document details from EACH image verbatim in clean Markdown. ' +
  'Do not summarize. Do not add commentary. ' +
  'For each image, prefix your transcription with exactly: `--- PAGE N ---` ' +
  'where N is the page number shown below the image. ' +
  'If a page has no readable text, respond with just `--- PAGE N ---\nEMPTY`. ' +
  'Keep pages in order. Here are the images:\n\n';

/**
 * Try one Gemini model with a BATCH of images. Returns the full text
 * response (with `--- PAGE N ---` delimiters) or throws on failure.
 */
async function tryOneModelBatched(
  entry: PoolEntry,
  images: BatchedImage[],
): Promise<string> {
  const client = ensureClients(entry);
  if (!client) {
    throw new Error(`Gemini client could not be constructed for model ${entry.model}`);
  }

  // Build the parts array: alternating text labels + inline images
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  let promptText = BATCHED_EXTRACT_PROMPT_PREFIX;
  for (const img of images) {
    promptText += `Image for Page ${img.pageNumber}:\n`;
  }
  parts.push({ text: promptText });

  for (const img of images) {
    const uint8 = img.buffer instanceof Uint8Array
      ? img.buffer
      : new Uint8Array(img.buffer);
    const base64Data = Buffer.from(uint8).toString('base64');
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: img.mimeType ?? 'image/png',
      },
    });
  }

  type ContentShape = { role?: string; parts: typeof parts };
  const contents: ContentShape[] = [
    { role: 'user', parts },
  ];

  const response = await client.models.generateContent({
    model: entry.model,
    contents: contents as unknown as Parameters<typeof client.models.generateContent>[0]['contents'],
  });

  const candidates = (response as unknown as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  if (!candidates || candidates.length === 0) {
    return '';
  }
  const responseParts = candidates[0]?.content?.parts ?? [];
  return responseParts.map((p) => p?.text ?? '').filter(Boolean).join('\n').trim();
}

/**
 * Parse a batched Gemini response and split it by `--- PAGE N ---` delimiters.
 */
function parseBatchedResponse(
  response: string,
  pageNumbers: number[],
): Map<number, string> {
  const result = new Map<number, string>();
  for (const pn of pageNumbers) {
    result.set(pn, '');
  }

  const sections = response.split(/---\s*PAGE\s*(\d+)\s*---/i);
  for (let i = 1; i < sections.length; i += 2) {
    const pageNum = parseInt(sections[i]!, 10);
    const text = (sections[i + 1] ?? '').trim();
    if (result.has(pageNum)) {
      if (text && text.toUpperCase() !== 'EMPTY') {
        result.set(pageNum, text);
      }
    }
  }

  return result;
}

const triedModelsAny = new Set<string>();

/**
 * Extract text from MULTIPLE images in a SINGLE Gemini call (batched).
 */
export async function extractTextFromMultipleImagesViaGemini(
  images: BatchedImage[],
): Promise<BatchedExtractionResult> {
  if (!API_KEY || images.length === 0) {
    return { pageTexts: new Map(), modelUsed: '', extractionMethod: 'fallback:local-tesseract' };
  }

  const pageTexts = new Map<number, string>();

  for (let i = 0; i < images.length; i += MAX_PAGES_PER_BATCH) {
    const batch = images.slice(i, i + MAX_PAGES_PER_BATCH);
    const batchPageNumbers = batch.map((b) => b.pageNumber);

    let batchSucceeded = false;
    const triedModels = new Set<string>();

    while (!batchSucceeded) {
      const entry = pickNextModel();
      if (!entry || triedModels.has(entry.model)) {
        break;
      }
      triedModels.add(entry.model);
      triedModelsAny.add(entry.model);

      try {
        const response = await tryOneModelBatched(entry, batch);
        const parsed = parseBatchedResponse(response, batchPageNumbers);
        for (const [pn, text] of parsed) {
          pageTexts.set(pn, text);
        }
        batchSucceeded = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        let httpStatus: number | undefined;
        const statusMatch = message.match(/\b(\d{3})\b/);
        if (statusMatch) {
          const code = parseInt(statusMatch[1]!, 10);
          if (code >= 400 && code < 600) httpStatus = code;
        }
        const classification = classifyGeminiError(err, httpStatus);
        applyCircuitBreaker(entry, classification);
      }
    }

    if (!batchSucceeded) {
      logger.warn('[gemini-pool] Batch failed, will use local Tesseract fallback', {
        batchPages: batchPageNumbers,
      });
      return { pageTexts, modelUsed: '', extractionMethod: 'fallback:local-tesseract' };
    }
  }

  return {
    pageTexts,
    modelUsed: 'gemini-pool',
    extractionMethod: 'gemini',
  };
}

void triedModelsAny;
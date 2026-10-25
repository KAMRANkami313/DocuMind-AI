export const APP_NAME = 'DocuMind AI';
export const APP_TAGLINE = 'Chat with your documents. Cited, grounded, instant.';

export const STORAGE_KEYS = {
  guestDocuments: 'documind:guest:documents',
  guestChats: 'documind:guest:chats',
  theme: 'documind:theme',
  sidebarCollapsed: 'documind:sidebar:collapsed',
} as const;

// ⚠️ Multi-format support: PDF, plain-text, Word (.docx), Excel (.xlsx/.csv),
// and images (PNG/JPG/WEBP/GIF). Images are OCR'd with tesseract.js; Word
// files via mammoth; Excel via SheetJS (xlsx). Total per chat is still 3
// (MAX_DOCUMENTS_PER_CHAT below — unchanged).
export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  acceptedMimeTypes: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ] as readonly string[],
  acceptedExtensions: [
    '.pdf',
    '.txt',
    '.md',
    '.csv',
    '.docx',
    '.xlsx',
    '.xls',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
  ] as readonly string[],
  maxChunksPerDocument: 1500,
} as const;

export const MAX_DOCUMENTS_PER_CHAT = 3;

export const CHUNKING = {
  chunkSize: 600,
  chunkOverlap: 100,
  minChunkLength: 3,
} as const;

export const RETRIEVAL = {
  smallDocumentThreshold: 35,
  topK: 8,
  introPages: 3,
  matchThreshold: 0.1,
  // Hybrid search: how many candidates to fetch from each retriever BEFORE
  // re-ranking. Larger pools = better recall, slightly more compute.
  hybridCandidatePool: 20,
  // If a PDF's text-per-page is below this threshold (chars), treat the
  // PDF as scanned and run OCR with tesseract.js as a fallback.
  scannedPdfTextThreshold: 50,
} as const;

// ⚠️ Hybrid search weights: how to fuse BM25 (lexical) and vector scores.
// Vector scores are cosine-similarity in [0, 1]. BM25 scores are
// unbounded positive numbers, so we min-max normalize them across the
// candidate pool before fusing. The weights below sum to 1.0.
export const HYBRID_SEARCH = {
  bm25Weight: 0.4,
  vectorWeight: 0.6,
  // BM25 params (Robertson-Sparck-Jones variant)
  bm25K1: 1.5,
  bm25B: 0.75,
} as const;

// ⚠️ Cross-encoder re-ranking: takes the candidate pool from hybrid search
// and re-scores each (query, chunk) pair using a transformer cross-encoder.
// The cross-encoder is much more accurate than bi-encoder similarity for
// passage ranking, at the cost of one inference per candidate.
export const RERANKER = {
  model: 'Xenova/ms-marco-MiniLM-L-6-v2',
  // Re-rank only the top-N candidates from hybrid search to bound latency.
  topN: 10,
  // Final number of chunks to send to the LLM as context.
  finalK: 6,
} as const;

export const LLM = {
  model: 'openai/gpt-oss-120b',
  temperature: 0.3,
  maxTokens: 2000,
  historyWindow: 3,
  historyCharCutoff: 500,
} as const;

export const EMBEDDING = {
  model: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
} as const;

export const RATE_LIMIT = {
  upload: { points: 5, duration: 60 },
  chat: { points: 20, duration: 60 },
} as const;

export const SUGGESTION_SEPARATOR = '<<<SUGGESTIONS>>>';

export const NAV_LINKS = [
  { label: 'Chat', href: '/' },
  { label: 'Library', href: '/library' },
  { label: 'Settings', href: '/settings' },
] as const;

export const KEYBOARD_SHORTCUTS = [
  { keys: ['Cmd', 'K'], label: 'New chat' },
  { keys: ['Cmd', 'Enter'], label: 'Send message' },
  { keys: ['Esc'], label: 'Close dialog' },
] as const;

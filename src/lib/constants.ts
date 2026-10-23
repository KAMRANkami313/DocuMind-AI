export const APP_NAME = 'DocuMind AI';
export const APP_TAGLINE = 'Chat with your documents. Cited, grounded, instant.';

export const STORAGE_KEYS = {
  guestDocuments: 'documind:guest:documents',
  guestChats: 'documind:guest:chats',
  theme: 'documind:theme',
  sidebarCollapsed: 'documind:sidebar:collapsed',
} as const;

export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  acceptedMimeTypes: ['application/pdf', 'text/plain', 'text/markdown'] as readonly string[],
  acceptedExtensions: ['.pdf', '.txt', '.md'] as readonly string[],
  maxChunksPerDocument: 1500,
} as const;

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

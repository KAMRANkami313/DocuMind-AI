export type UserRole = 'user' | 'assistant' | 'system';

export interface User {
  id: string;
  email: string;
  createdAt?: string;
}

export interface AuthSession {
  user: User | null;
  isLoading: boolean;
}

export interface Document {
  id: string;
  title: string;
  fileName: string;
  createdAt: string;
  userId?: string | null;
}

export interface DocumentMeta {
  id: string;
  name: string;
  blobUrl?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  pageNumber: number;
  similarity?: number;
}

export interface IngestionResult {
  documentId: string;
  totalChunks: number;
  fileName: string;
}

export interface Citation {
  chunkId: string;
  pageNumber: number;
  excerpt: string;
  similarity: number;
}

export interface ChatMessage {
  id?: string;
  role: UserRole;
  content: string;
  citations?: Citation[];
  createdAt?: string;
}

export type ChatSessions = Record<string, ChatMessage[]>;

export interface ToastVariant {
  type: 'default' | 'success' | 'error' | 'warning' | 'info';
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant['type'];
  duration: number;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface UploadResponse extends IngestionResult {
  success: true;
}

export interface StreamMetaEvent {
  citations: Array<{
    content: string;
    pageNumber: number;
    similarity: number;
  }>;
}

export interface StreamTextEvent {
  text: string;
}

export interface Document {
  id: string;
  title: string;
  fileName: string;
  createdAt: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  createdAt: Date;
}

export interface Citation {
  chunkId: string;
  pageNumber: number;
  excerpt: string;
  similarity: number;
}
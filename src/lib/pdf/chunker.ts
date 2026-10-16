import { ExtractedPage } from './extractor';

export interface ChunkPayload {
  content: string;
  pageNumber: number;
}

const CHUNK_SIZE = 600; // Optimal character window for 384-d vectors
const CHUNK_OVERLAP = 100; // Preserves semantic bridge between chunks

export function splitTextIntoChunks(pages: ExtractedPage[]): ChunkPayload[] {
  const chunks: ChunkPayload[] = [];

  for (const page of pages) {
    const cleanText = page.text.replace(/\s+/g, ' ').trim();
    if (cleanText.length === 0) continue;

    let start = 0;
    while (start < cleanText.length) {
      const end = Math.min(start + CHUNK_SIZE, cleanText.length);
      const chunkText = cleanText.slice(start, end).trim();

      if (chunkText.length > 30) {
        chunks.push({
          content: chunkText,
          pageNumber: page.pageNumber,
        });
      }

      if (end === cleanText.length) break;
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
  }

  return chunks;
}
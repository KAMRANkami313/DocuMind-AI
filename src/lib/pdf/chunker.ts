import { ExtractedPage } from './extractor';

export interface ChunkPayload {
  content: string;
  pageNumber: number;
}

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 100;

export function splitTextIntoChunks(pages: ExtractedPage[]): ChunkPayload[] {
  const chunks: ChunkPayload[] = [];

  for (const page of pages) {
    const cleanText = page.text.replace(/\s+/g, ' ').trim();
    
    // Ignore completely empty pages (e.g. blank image-only slides)
    if (cleanText.length === 0) continue;

    // For short slides (titles, punchy lecture slides like "YES SIR!"), preserve as a whole chunk
    if (cleanText.length <= CHUNK_SIZE) {
      if (cleanText.length >= 3) { // Captures any word with 3+ characters
        chunks.push({
          content: cleanText,
          pageNumber: page.pageNumber,
        });
      }
      continue;
    }

    // For dense text pages, split with sliding window
    let start = 0;
    while (start < cleanText.length) {
      const end = Math.min(start + CHUNK_SIZE, cleanText.length);
      const chunkText = cleanText.slice(start, end).trim();

      if (chunkText.length >= 3) {
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
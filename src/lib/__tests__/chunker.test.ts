import { describe, it, expect } from 'vitest';
import { splitTextIntoChunks } from '@/lib/pdf/chunker';
import type { ExtractedPage } from '@/lib/pdf/extractor';

function makePage(pageNumber: number, text: string): ExtractedPage {
  return { pageNumber, text };
}

describe('splitTextIntoChunks', () => {
  it('returns empty array for empty pages', () => {
    const result = splitTextIntoChunks([]);
    expect(result).toEqual([]);
  });

  it('returns empty array for page with only whitespace', () => {
    const result = splitTextIntoChunks([makePage(1, '   \n\n\t   ')]);
    expect(result).toEqual([]);
  });

  it('returns single chunk for short page', () => {
    const result = splitTextIntoChunks([makePage(1, 'Hello world')]);
    expect(result).toHaveLength(1);
    expect(result[0]?.pageNumber).toBe(1);
    expect(result[0]?.content).toBe('Hello world');
  });

  it('skips text shorter than 3 characters', () => {
    const result = splitTextIntoChunks([makePage(1, 'ab')]);
    expect(result).toEqual([]);
  });

  it('keeps text with exactly 3 characters', () => {
    const result = splitTextIntoChunks([makePage(1, 'abc')]);
    expect(result).toHaveLength(1);
  });

  it('splits long text into multiple chunks with overlap', () => {
    const longText = 'a'.repeat(1500);
    const result = splitTextIntoChunks([makePage(1, longText)]);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.content.length).toBeLessThanOrEqual(600);
    }
  });

  it('handles multiple pages', () => {
    const pages = [
      makePage(1, 'Page one content here'),
      makePage(2, 'Page two content here'),
      makePage(3, 'Page three content here'),
    ];
    const result = splitTextIntoChunks(pages);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0]?.pageNumber).toBe(1);
    expect(result[result.length - 1]?.pageNumber).toBe(3);
  });

  it('preserves page numbers correctly', () => {
    const pages = [
      makePage(5, 'Content on page five'),
      makePage(10, 'Content on page ten'),
    ];
    const result = splitTextIntoChunks(pages);
    expect(result[0]?.pageNumber).toBe(5);
    expect(result[1]?.pageNumber).toBe(10);
  });

  it('handles text that is exactly CHUNK_SIZE (600 chars)', () => {
    const text = 'x'.repeat(600);
    const result = splitTextIntoChunks([makePage(1, text)]);
    expect(result).toHaveLength(1);
  });

  it('handles text slightly over CHUNK_SIZE', () => {
    const text = 'x'.repeat(601);
    const result = splitTextIntoChunks([makePage(1, text)]);
    expect(result.length).toBeGreaterThan(1);
  });
});
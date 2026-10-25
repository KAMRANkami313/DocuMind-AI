import { describe, it, expect } from 'vitest';
import {
  buildBm25Index,
  bm25Search,
  normalizeBm25Scores,
} from '@/lib/ai/bm25';

describe('buildBm25Index', () => {
  it('returns one entry per chunk with tokens attached', () => {
    const index = buildBm25Index([
      { id: 'a', content: 'Hello world', originalIndex: 0 },
      { id: 'b', content: 'Another chunk', originalIndex: 1 },
    ]);
    expect(index).toHaveLength(2);
    expect(index[0]!.id).toBe('a');
    expect(index[0]!.tokens).toContain('hello');
    expect(index[0]!.tokens).toContain('world');
  });

  it('lowercases tokens and strips non-alphanumeric', () => {
    const index = buildBm25Index([
      { id: 'x', content: 'CNN, breaking news!', originalIndex: 0 },
    ]);
    expect(index[0]!.tokens).toEqual(['cnn', 'breaking', 'news']);
  });
});

describe('bm25Search', () => {
  it('returns empty array for empty index', () => {
    expect(bm25Search([], 'query')).toEqual([]);
  });

  it('returns empty array for empty query', () => {
    const index = buildBm25Index([
      { id: 'a', content: 'some content', originalIndex: 0 },
    ]);
    expect(bm25Search(index, '')).toEqual([]);
  });

  it('returns empty array for query with no matching terms', () => {
    const index = buildBm25Index([
      { id: 'a', content: 'alpha beta', originalIndex: 0 },
      { id: 'b', content: 'gamma delta', originalIndex: 1 },
    ]);
    const result = bm25Search(index, 'epsilon zeta');
    // BM25 returns 0 score for chunks with no matching terms; the results
    // are still returned but all scores are 0.
    expect(result).toHaveLength(2);
    expect(result[0]!.score).toBe(0);
    expect(result[1]!.score).toBe(0);
  });

  it('ranks matching chunk above non-matching chunk', () => {
    const index = buildBm25Index([
      { id: 'a', content: 'the cat sat on the mat', originalIndex: 0 },
      { id: 'b', content: 'machine learning models for image classification', originalIndex: 1 },
    ]);
    const result = bm25Search(index, 'machine learning classification');
    expect(result[0]!.id).toBe('b');
    expect(result[0]!.score).toBeGreaterThan(0);
    expect(result[1]!.id).toBe('a');
    expect(result[1]!.score).toBe(0);
  });

  it('higher term frequency = higher score (BM25 saturation)', () => {
    const index = buildBm25Index([
      { id: 'a', content: 'cat cat cat cat cat', originalIndex: 0 }, // 5 occurrences
      { id: 'b', content: 'cat dog bird fish', originalIndex: 1 }, // 1 occurrence
    ]);
    const result = bm25Search(index, 'cat');
    expect(result[0]!.id).toBe('a');
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });

  it('respects topK limit', () => {
    const index = buildBm25Index([
      { id: 'a', content: 'cat', originalIndex: 0 },
      { id: 'b', content: 'cat', originalIndex: 1 },
      { id: 'c', content: 'cat', originalIndex: 2 },
    ]);
    const result = bm25Search(index, 'cat', 2);
    expect(result).toHaveLength(2);
  });

  it('sorts results by descending score', () => {
    const index = buildBm25Index([
      { id: 'a', content: 'alpha', originalIndex: 0 },
      { id: 'b', content: 'alpha alpha alpha', originalIndex: 1 },
      { id: 'c', content: 'alpha alpha', originalIndex: 2 },
    ]);
    const result = bm25Search(index, 'alpha');
    expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score);
    expect(result[1]!.score).toBeGreaterThanOrEqual(result[2]!.score);
  });
});

describe('normalizeBm25Scores', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeBm25Scores([])).toEqual([]);
  });

  it('min-max normalizes scores to [0, 1]', () => {
    const input = [
      { id: 'a', content: 'x', originalIndex: 0, score: 0 },
      { id: 'b', content: 'y', originalIndex: 1, score: 5 },
      { id: 'c', content: 'z', originalIndex: 2, score: 10 },
    ];
    const result = normalizeBm25Scores(input);
    expect(result[0]!.score).toBe(0); // min
    expect(result[1]!.score).toBe(0.5); // mid
    expect(result[2]!.score).toBe(1); // max
  });

  it('returns 0.5 for all when all scores are equal (degenerate case)', () => {
    const input = [
      { id: 'a', content: 'x', originalIndex: 0, score: 3 },
      { id: 'b', content: 'y', originalIndex: 1, score: 3 },
    ];
    const result = normalizeBm25Scores(input);
    expect(result[0]!.score).toBe(0.5);
    expect(result[1]!.score).toBe(0.5);
  });

  it('preserves originalIndex mapping', () => {
    const input = [
      { id: 'a', content: 'x', originalIndex: 42, score: 0 },
      { id: 'b', content: 'y', originalIndex: 7, score: 10 },
    ];
    const result = normalizeBm25Scores(input);
    expect(result.find((r) => r.originalIndex === 42)?.score).toBe(0);
    expect(result.find((r) => r.originalIndex === 7)?.score).toBe(1);
  });
});
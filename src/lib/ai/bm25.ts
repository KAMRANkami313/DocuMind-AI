// ⚠️ In-memory BM25 (Okapi BM25, Robertson-Sparck-Jones variant).
//
// For each chat request we build a fresh index over the chunks already
// fetched from Postgres (the candidate pool). This avoids the need for
// a Postgres full-text-search index — keeping the SQL schema unchanged.
//
// Scoring formula (per chunk i w.r.t. query q):
//   score_i = Σ_t IDF(t) · ( f(t,i) · (k1+1) ) / ( f(t,i) + k1 · (1 - b + b · |i| / avgdl) )
// where
//   IDF(t) = ln( 1 + (N - n_t + 0.5) / (n_t + 0.5) )
//   N       = total chunks
//   n_t     = number of chunks containing term t
//   f(t,i)  = frequency of t in chunk i
//   |i|     = length of chunk i (in tokens)
//   avgdl   = average chunk length

import { HYBRID_SEARCH } from '@/lib/constants';

export interface Bm25Candidate {
  /** Chunk identifier (we use a stable synthetic id like `${docId}:${idx}`) */
  id: string;
  content: string;
  /** Original index in the input array — caller uses this to look up
   * associated metadata (page number, document title, etc.). */
  originalIndex: number;
  /** Computed BM25 score. Higher = more relevant. */
  score: number;
}

// Tokenizer: lowercase + split on non-alphanumeric. Same approach used by
// most BM25 implementations for English text.
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export interface Bm25IndexEntry {
  id: string;
  content: string;
  originalIndex: number;
  tokens: string[];
}

/**
 * Build a BM25 index from a list of text chunks.
 * Pre-tokenizes each chunk so we can score against multiple queries
 * without re-tokenizing (useful when re-ranking long conversations).
 */
export function buildBm25Index(
  chunks: Array<{ id: string; content: string; originalIndex: number }>,
): Bm25IndexEntry[] {
  return chunks.map((c) => ({
    id: c.id,
    content: c.content,
    originalIndex: c.originalIndex,
    tokens: tokenize(c.content),
  }));
}

/**
 * Score every chunk in the index against the query. Returns a new array
 * (sorted by descending score) with `score` attached to each chunk.
 *
 * `topK` controls how many results to return — pass `Infinity` (the
 * default) to return the whole ranked list.
 */
export function bm25Search(
  index: Bm25IndexEntry[],
  query: string,
  topK: number = Infinity,
): Bm25Candidate[] {
  const k1 = HYBRID_SEARCH.bm25K1;
  const b = HYBRID_SEARCH.bm25B;
  const n = index.length;

  // Edge case: empty index → nothing to score
  if (n === 0) return [];

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  // Pre-compute chunk lengths and average
  const docLengths = index.map((c) => c.tokens.length);
  const avgdl =
    docLengths.reduce((sum, l) => sum + l, 0) / Math.max(1, n);

  // Document frequency per query term
  const docFreq: Record<string, number> = {};
  for (const term of queryTerms) {
    if (docFreq[term] !== undefined) continue;
    let count = 0;
    for (const chunk of index) {
      if (chunk.tokens.includes(term)) count += 1;
    }
    docFreq[term] = count;
  }

  // Term frequency per (chunk, term) pair — computed lazily inside the
  // main loop because n_total_terms can be very large.
  const results: Bm25Candidate[] = [];

  for (let i = 0; i < index.length; i++) {
    const chunk = index[i]!;
    const docLen = docLengths[i]!;

    // Build a term-frequency map for this chunk only once
    const termFreq: Record<string, number> = {};
    for (const tok of chunk.tokens) {
      termFreq[tok] = (termFreq[tok] ?? 0) + 1;
    }

    let score = 0;
    for (const term of queryTerms) {
      const df = docFreq[term] ?? 0;
      if (df === 0) continue; // term not in any chunk → contributes 0

      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      const tf = termFreq[term] ?? 0;
      if (tf === 0) continue;

      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + (b * docLen) / avgdl);
      score += idf * (numerator / denominator);
    }

    results.push({
      id: chunk.id,
      content: chunk.content,
      originalIndex: chunk.originalIndex,
      score,
    });
  }

  results.sort((a, b) => b.score - a.score);
  if (topK === Infinity) return results;
  return results.slice(0, topK);
}

/**
 * Min-max normalize BM25 scores to [0, 1] so they can be fused with
 * vector cosine similarities (which are also in [0, 1] after
 * normalization). If all scores are equal (degenerate case), returns
 * all scores as 0.5.
 */
export function normalizeBm25Scores(
  candidates: Bm25Candidate[],
): Array<{ id: string; score: number; originalIndex: number; content: string }> {
  if (candidates.length === 0) return [];
  const scores = candidates.map((c) => c.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  return candidates.map((c) => ({
    id: c.id,
    content: c.content,
    originalIndex: c.originalIndex,
    score: range === 0 ? 0.5 : (c.score - min) / range,
  }));
}
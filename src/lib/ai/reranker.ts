// ⚠️ Cross-encoder re-ranker using @xenova/transformers.
//
// A bi-encoder (like our all-MiniLM-L6-v2 embedding model) encodes the
// query and the chunk separately and compares with cosine similarity.
// A cross-encoder encodes (query, chunk) PAIRS together — passing both
// through the transformer at once — so it can model token-level
// interactions. This is dramatically more accurate for passage ranking,
// at the cost of one inference per candidate.
//
// We use `Xenova/ms-marco-MiniLM-L-6-v2`, a small (~25MB) cross-encoder
// fine-tuned on MS MARCO passage ranking. Output is a single sigmoid
// probability that the chunk is relevant to the query.

import { pipeline, env, type TextClassificationPipeline } from '@xenova/transformers';
import { RERANKER } from '@/lib/constants';

env.cacheDir = './.transformers-cache';

let rerankerPipeline: TextClassificationPipeline | null = null;

async function getPipeline(): Promise<TextClassificationPipeline> {
  if (!rerankerPipeline) {
    rerankerPipeline = (await pipeline(
      'text-classification',
      RERANKER.model,
    )) as TextClassificationPipeline;
  }
  return rerankerPipeline;
}

export interface RerankerCandidate {
  /** Original index in the candidate pool — caller uses this to map
   * back to the chunk's metadata (page number, document title, etc.) */
  originalIndex: number;
  content: string;
  /** Computed cross-encoder score (sigmoid probability in [0, 1]).
   * Higher = more relevant. */
  score: number;
}

interface RerankPairInput {
  text: string;
  text_pair: string;
}

/**
 * Re-rank a list of candidate chunks against the query using the
 * cross-encoder. Returns the top `RERANKER.finalK` candidates sorted
 * by relevance score (descending).
 *
 * If the cross-encoder fails to load (e.g. first-run model download
 * timed out), we fall back to preserving the input order — the
 * retrieval pipeline still works, just with slightly lower quality.
 */
export async function rerankCandidates(
  query: string,
  candidates: Array<{ originalIndex: number; content: string }>,
): Promise<RerankerCandidate[]> {
  if (candidates.length === 0) return [];

  // Truncate the candidate pool — re-ranking is expensive (one inference
  // per candidate) and the value of re-ranking the bottom of the pool
  // is marginal. Take only RERANKER.topN.
  const pool = candidates.slice(0, RERANKER.topN);

  try {
    const pipe = await getPipeline();

    // Build (query, chunk) pair inputs for the cross-encoder
    const pairs: RerankPairInput[] = pool.map((c) => ({
      text: query,
      text_pair: c.content.slice(0, 512), // ms-marco-MiniLM max input is 512 tokens
    }));

    // The Xenova type defs for TextClassificationPipeline only declare
    // `string | string[]`, but the implementation accepts pair objects
    // ({ text, text_pair }) for cross-encoder models. Cast to unknown
    // first, then to the expected pair-input type, to bypass the
    // type-checker — this is the documented Xenova cross-encoder pattern.
    type PairInput = { text: string; text_pair: string };
    const pairInputs = pairs as unknown as PairInput[];

    // Use a force-cast on the pipeline call to bypass the
    // (string | string[]) type signature.
    const pipeAsAny = pipe as unknown as (
      input: PairInput[] | PairInput,
      options?: { topk: null | number },
    ) => Promise<unknown>;
    const rawOutput = await pipeAsAny(pairInputs, { topk: null });
    const outputs = rawOutput as Array<
      Array<{ label: string; score: number }> | { label: string; score: number }
    >;

    // ms-marco-MiniLM-L-6-v2 outputs a single label "entailment" (or
    // similar) with a sigmoid probability. Take that as the relevance
    // score. Some versions output [{label: 'LABEL_0'}, {label: 'LABEL_1'}];
    // in that case LABEL_1 is the "relevant" label.
    const scored: RerankerCandidate[] = pool.map((c, i) => {
      const out = outputs[i]!;
      let score = 0.5;
      if (Array.isArray(out)) {
        if (out.length >= 2) {
          const relevant = out.find((o) => o.label === 'LABEL_1' || o.label === 'entailment');
          score = relevant?.score ?? out[1]!.score;
        } else if (out.length === 1) {
          score = out[0]!.score;
        }
      } else if (out && typeof out === 'object' && 'score' in out) {
        score = (out as { score: number }).score;
      }
      return {
        originalIndex: c.originalIndex,
        content: c.content,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, RERANKER.finalK);
  } catch (err) {
    // Fallback: preserve original order. Still return only finalK.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[reranker] Cross-encoder failed, falling back to original order:', message);
    return pool
      .slice(0, RERANKER.finalK)
      .map((c) => ({
        originalIndex: c.originalIndex,
        content: c.content,
        score: 0.5,
      }));
  }
}
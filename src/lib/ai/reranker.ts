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
//
// ⚠️ IMPORTANT IMPLEMENTATION DETAIL:
// Xenova v2's TextClassificationPipeline._call(texts, {topk}) destructures
// ONLY `topk` from options and IGNORES other options like `text_pair`.
// It then calls `tokenizer(texts, {padding, truncation})` — passing the
// pair object directly as `text`. The tokenizer's `_encode_text` then
// calls `text.split(this.added_tokens_regex)`, but `text` is an object,
// not a string → crash with `text.split is not a function`.
//
// To avoid this, we BYPASS the pipeline's high-level `_call` and instead
// invoke the pipeline's `tokenizer` + `model` directly with the correct
// pair-input format: `tokenizer(query, { text_pair: chunk, padding: true,
// truncation: true })`. This is the documented Xenova cross-encoder
// pattern that DOES work.

import { pipeline, env } from '@xenova/transformers';
import { RERANKER } from '@/lib/constants';

env.cacheDir = './.transformers-cache';

interface TokenizerInput {
  input_ids: number[];
  attention_mask: number[];
  token_type_ids?: number[];
}

interface Tokenizer {
  _call: (
    text: string,
    options: {
      text_pair?: string;
      padding?: boolean;
      truncation?: boolean;
      add_special_tokens?: boolean;
    },
  ) => TokenizerInput;
}

interface ModelConfig {
  id2label: Record<string, string>;
  problem_type?: string;
}

interface ModelOutput {
  logits: { data: Float32Array | number[]; dims: number[] } | { data: number[]; toNumber: () => number };
}

interface Model {
  _call: (inputs: TokenizerInput) => Promise<ModelOutput>;
  config: ModelConfig;
}

interface PipelineInternals {
  tokenizer: Tokenizer;
  model: Model;
}

let pipelinePromise: Promise<unknown> | null = null;

async function getPipeline(): Promise<PipelineInternals> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const pipe = (await pipeline(
        'text-classification',
        RERANKER.model,
      )) as unknown as PipelineInternals;
      return pipe;
    })();
  }
  return (await pipelinePromise) as PipelineInternals;
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

/**
 * Apply softmax to a raw logit array. ms-marco-MiniLM-L-6-v2 is a
 * single-label classifier (problem_type = 'single_label_classification')
 * so the output is a probability distribution over labels.
 */
function softmax(logits: number[]): number[] {
  if (logits.length === 0) return [];
  const maxLogit = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
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

    // ⚠️ Per-pair inference. We bypass the pipeline's `_call` method
    // (which strips text_pair from options) and instead invoke the
    // pipeline's tokenizer + model directly with the correct pair-input
    // format. Promise.all lets the event loop interleave; the onnxruntime
    // inference itself is sequential per worker, so this is effectively
    // sequential — but the await boundaries let other async work (like
    // HTTP request handling) progress between inferences.
    const scoredPromises = pool.map(async (c) => {
      // Truncate the chunk content to 512 chars (ms-marco-MiniLM max
      // input is 512 tokens, ~512 chars for English).
      const truncatedChunk = c.content.slice(0, 512);

      // Tokenize the (query, chunk) pair — text_pair goes in OPTIONS,
      // not as a property of the input object. This is the key fix.
      const inputs = pipe.tokenizer._call(query, {
        text_pair: truncatedChunk,
        padding: true,
        truncation: true,
        add_special_tokens: true,
      });

      // Run the cross-encoder model
      const output = await pipe.model._call(inputs);

      // Extract logits (a 1D tensor of size = num_labels, typically 2)
      const logitsData =
        (output.logits as { data: Float32Array | number[] }).data ??
        (output.logits as unknown as number[]);
      const logits = Array.from(logitsData);

      // Apply softmax or sigmoid depending on the model's problem_type.
      // ms-marco-MiniLM-L-6-v2 is single_label_classification → softmax.
      const problemType = pipe.model.config.problem_type;
      const id2label = pipe.model.config.id2label ?? { 0: 'LABEL_0', 1: 'LABEL_1' };

      let scores: number[];
      if (problemType === 'multi_label_classification') {
        scores = logits.map(sigmoid);
      } else {
        scores = softmax(logits);
      }

      // Pick the "relevant" label. ms-marco-MiniLM-L-6-v2's id2label is
      // { 0: 'LABEL_0', 1: 'LABEL_1' } where LABEL_1 (index 1) is the
      // "relevant" class. Take the highest non-LABEL_0 score, or fall
      // back to the highest score overall.
      let bestScore = 0.5;
      let bestIdx = -1;
      let bestValue = -Infinity;
      for (let i = 0; i < scores.length; i++) {
        const label = id2label[String(i)] ?? `LABEL_${i}`;
        // Prefer 'LABEL_1' / 'entailment' / 'MATCH' as the relevant label
        const isRelevantLabel =
          label === 'LABEL_1' ||
          label === 'entailment' ||
          label === 'MATCH' ||
          label === 'yes';
        if (isRelevantLabel) {
          bestScore = scores[i]!;
          break;
        }
        if (scores[i]! > bestValue) {
          bestValue = scores[i]!;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0 && bestScore === 0.5) {
        // No explicit "relevant" label found — take the max score
        bestScore = bestValue;
      }

      return {
        originalIndex: c.originalIndex,
        content: c.content,
        score: bestScore,
      };
    });

    const scored = await Promise.all(scoredPromises);

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
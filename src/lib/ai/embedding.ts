import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { EMBEDDING } from '@/lib/constants';

let embeddingPipeline: FeatureExtractionPipeline | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!embeddingPipeline) {
    embeddingPipeline = (await pipeline(
      'feature-extraction',
      EMBEDDING.model,
    )) as FeatureExtractionPipeline;
  }
  return embeddingPipeline;
}

interface EmbeddingOutput {
  data: Float32Array | Int32Array;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = (await pipe(text, {
    pooling: 'mean',
    normalize: true,
  })) as unknown as EmbeddingOutput;

  return Array.from(output.data).map((n) => Number(n));
}
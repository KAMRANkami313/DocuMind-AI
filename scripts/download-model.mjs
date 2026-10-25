import { pipeline, env } from '@xenova/transformers';

env.cacheDir = './.transformers-cache';

console.log('Downloading embedding model (Xenova/all-MiniLM-L6-v2)...');
console.log('This will take 30-60 seconds on first run...');

try {
  await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✓ Embedding model downloaded and cached successfully.');
} catch (error) {
  console.error('✗ Failed to download embedding model:', error.message);
  process.exit(1);
}

console.log('\nDownloading cross-encoder reranker (Xenova/ms-marco-MiniLM-L-6-v2)...');
console.log('This will take ~30 seconds on first run...');

try {
  await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');
  console.log('✓ Cross-encoder reranker downloaded and cached successfully.');
} catch (error) {
  console.error('✗ Failed to download cross-encoder reranker:', error.message);
  // Non-fatal — the chat route will fall back to original order if the
  // reranker model is missing. We don't want to fail the whole build.
  console.warn('  Chat route will fall back to original chunk order (lower quality).');
}

console.log('\nCache location:', env.cacheDir);
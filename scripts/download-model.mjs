import { pipeline, env } from '@xenova/transformers';

env.cacheDir = './.transformers-cache';

console.log('Downloading embedding model (all-MiniLM-L6-v2)...');
console.log('This will take 30-60 seconds on first run...');

try {
  await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✓ Model downloaded and cached successfully.');
  console.log('Cache location:', env.cacheDir);
} catch (error) {
  console.error('✗ Failed to download model:', error.message);
  process.exit(1);
}
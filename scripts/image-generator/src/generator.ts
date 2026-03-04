import { stringToSeed } from './seed.js';
import { getCategoryPalette, computeParticleParams } from './palette.js';
import { generateFlowField, spawnParticles, simulateParticles } from './flow-field.js';
import { renderToBuffer } from './renderer.js';
import type { ArticleMetadata, GeneratorOptions } from './types.js';

/**
 * Generate a deterministic abstract flow-field PNG image from article metadata.
 *
 * Pipeline: metadata → seed/palette → flow field → particles → PNG buffer
 */
export function generateImage(metadata: ArticleMetadata, options?: GeneratorOptions): Buffer {
  const width = options?.width ?? 1200;
  const height = options?.height ?? 630;
  const gridScale = options?.gridScale ?? 4;
  const octaves = options?.octaves ?? 4;
  const scale = 0.005;
  const stepLength = 2.5;

  // Derive seeds from metadata
  const titleSeed = stringToSeed(metadata.title);
  const idSeed = stringToSeed(metadata.id);

  // Select palette from categories
  const palette = getCategoryPalette(metadata.categories);

  // Compute particle params from word count
  const { numParticles, maxSteps } = computeParticleParams(metadata.wordCount);

  // Generate flow field from title seed
  const field = generateFlowField(titleSeed, width, height, scale, octaves, gridScale);

  // Spawn particles from ID seed (so same title + different article = different spawn)
  const particles = spawnParticles(numParticles, idSeed, width, height);

  // Simulate particles through flow field
  simulateParticles(particles, field, maxSteps, stepLength, width, height);

  // Render to PNG
  return renderToBuffer(particles, palette, width, height, options);
}

import { readFileSync } from 'node:fs';
import type { Palette, PaletteConfig } from './types.js';

const DEFAULT_PALETTE: Palette = [
  [0, 140, 200],    // Cyan
  [20, 180, 220],   // Light cyan
  [0, 100, 180],    // Deep blue
];

/**
 * Load palette configuration from a JSON file.
 * Falls back to empty entries + default palette if the file doesn't exist or is invalid.
 */
export function loadPaletteConfig(configPath: string): PaletteConfig {
  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as PaletteConfig;
  } catch {
    return { entries: {}, default: DEFAULT_PALETTE };
  }
}

/**
 * Select a color palette based on article category UUIDs.
 * Merges all matching category palettes into a single combined color pool.
 * Falls back to default palette when no categories match.
 */
export function getCategoryPalette(categoryIds: string[], config?: PaletteConfig): Palette {
  const entries = config?.entries ?? {};
  const fallback = config?.default ?? DEFAULT_PALETTE;
  const merged: Palette = [];
  for (const id of categoryIds) {
    if (entries[id]) {
      merged.push(...entries[id].colors);
    }
  }
  return merged.length > 0 ? merged : fallback;
}

/**
 * Compute particle count and max trail steps from word count.
 * Particles: 100-300, MaxSteps: 150-250.
 */
export function computeParticleParams(wordCount: number): { numParticles: number; maxSteps: number } {
  const numParticles = Math.min(300, Math.max(100, Math.floor(wordCount / 3)));
  const maxSteps = Math.min(250, Math.max(150, Math.floor(wordCount / 3)));
  return { numParticles, maxSteps };
}

import { readFileSync } from 'node:fs';
import type { RGBColor, Palette, PaletteConfig } from './types.js';

const PALETTES: Record<string, Palette> = {
  'AI & Machine Learning': [
    [0, 140, 200],    // Cyan
    [20, 180, 220],   // Light cyan
    [0, 100, 180],    // Deep blue
  ],
  'Ethics of AI': [
    [220, 100, 60],   // Coral
    [240, 140, 80],   // Orange
    [200, 80, 40],    // Deep orange
  ],
  'Sustainability': [
    [40, 180, 100],   // Green
    [60, 200, 120],   // Light green
    [20, 140, 80],    // Deep green
  ],
  'Vibe Coding': [
    [160, 80, 180],   // Purple
    [200, 120, 200],  // Light purple
    [120, 40, 140],   // Deep purple
  ],
};

const DEFAULT_PALETTE: Palette = PALETTES['AI & Machine Learning'];

/**
 * Load palette configuration from a JSON file.
 * Falls back to hardcoded defaults if the file doesn't exist or is invalid.
 */
export function loadPaletteConfig(configPath: string): PaletteConfig {
  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as PaletteConfig;
  } catch {
    return { entries: PALETTES, default: DEFAULT_PALETTE };
  }
}

/**
 * Select a color palette based on article categories.
 * Merges all matching category palettes into a single combined color pool.
 * Falls back to default cyan/blue when no categories match.
 */
export function getCategoryPalette(categories: string[], config?: PaletteConfig): Palette {
  const entries = config?.entries ?? PALETTES;
  const fallback = config?.default ?? DEFAULT_PALETTE;
  const merged: Palette = [];
  for (const cat of categories) {
    if (entries[cat]) {
      merged.push(...entries[cat]);
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

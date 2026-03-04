import type { RGBColor, Palette } from './types.js';

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
 * Select a color palette based on article categories.
 * Uses the first matching category; falls back to default cyan/blue.
 */
export function getCategoryPalette(categories: string[]): Palette {
  for (const cat of categories) {
    if (PALETTES[cat]) {
      return PALETTES[cat];
    }
  }
  return DEFAULT_PALETTE;
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

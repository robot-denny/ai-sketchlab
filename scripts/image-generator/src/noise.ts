import { createPRNG } from './seed.js';

/**
 * Simple 2D gradient noise implementation.
 * Ported from the Python SimpleNoise class in flow_field_generator.py.
 * Uses a seedable PRNG for deterministic permutation table generation.
 */
export class SimpleNoise {
  private perm: Uint8Array;

  constructor(seed: number) {
    // Build permutation table using Fisher-Yates shuffle with seedable PRNG
    const rng = createPRNG(seed);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    this.perm = perm;
  }

  /** Smoothstep fade curve */
  private fade(t: number): number {
    return t * t * (3 - 2 * t);
  }

  /** Linear interpolation */
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  /** Gradient function — maps hash to one of 4 gradient directions */
  private gradient(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /** Generate 2D noise value at (x, y). Returns value in [-1, 1]. */
  noise(x: number, y: number): number {
    const p = this.perm;

    // Grid cell coordinates
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    // Relative coordinates in cell
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Fade curves
    const u = this.fade(xf);
    const v = this.fade(yf);

    // Hash coordinates of 4 corners
    const a = p[xi] + yi;
    const aa = p[a & 255];
    const ab = p[(a + 1) & 255];
    const b = p[(xi + 1) & 255] + yi;
    const ba = p[b & 255];
    const bb = p[(b + 1) & 255];

    // Interpolate gradients
    const x1 = this.lerp(
      this.gradient(aa, xf, yf),
      this.gradient(ba, xf - 1, yf),
      u,
    );
    const x2 = this.lerp(
      this.gradient(ab, xf, yf - 1),
      this.gradient(bb, xf - 1, yf - 1),
      u,
    );

    return this.lerp(x1, x2, v);
  }
}

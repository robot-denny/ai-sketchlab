import { createHash } from 'node:crypto';

/**
 * Convert a string to a deterministic non-negative integer seed
 * using MD5 hash, matching the Python reference implementation.
 */
export function stringToSeed(s: string): number {
  const hex = createHash('md5').update(s).digest('hex');
  // Take first 8 hex chars (32 bits) to stay in safe integer range
  return parseInt(hex.slice(0, 8), 16);
}

/**
 * Seedable PRNG using the Mulberry32 algorithm.
 * Returns a function that produces values in [0, 1).
 */
export function createPRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

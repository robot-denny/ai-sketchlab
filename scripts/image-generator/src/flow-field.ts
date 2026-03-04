import { createPRNG } from './seed.js';
import { SimpleNoise } from './noise.js';
import type { Particle } from './types.js';

export interface FlowField {
  grid: Float64Array;
  gridW: number;
  gridH: number;
  gridScale: number;
}

/**
 * Generate a coarse-grid flow field using multi-octave noise.
 * Computes noise at every `gridScale`th pixel, storing angles in a Float64Array.
 * Use `getAngle()` for bilinear-interpolated lookup at any pixel coordinate.
 */
export function generateFlowField(
  seed: number,
  width: number,
  height: number,
  scale: number,
  octaves: number,
  gridScale: number,
): FlowField {
  const noise = new SimpleNoise(seed);
  const gridW = Math.ceil(width / gridScale) + 1;
  const gridH = Math.ceil(height / gridScale) + 1;
  const grid = new Float64Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const px = gx * gridScale;
      const py = gy * gridScale;

      // Multi-octave noise
      let noiseVal = 0;
      let amplitude = 1.0;
      let frequency = 1.0;

      for (let o = 0; o < octaves; o++) {
        noiseVal += noise.noise(px * scale * frequency, py * scale * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }

      // Clamp to [-1, 1] and convert to angle [0, 2π]
      noiseVal = Math.max(-1, Math.min(1, noiseVal));
      grid[gy * gridW + gx] = (noiseVal + 1) * Math.PI;
    }
  }

  return { grid, gridW, gridH, gridScale };
}

/**
 * Bilinear interpolation of the flow field angle at pixel coordinate (x, y).
 */
export function getAngle(field: FlowField, x: number, y: number): number {
  const { grid, gridW, gridH, gridScale } = field;

  // Map pixel coordinate to grid coordinate
  const gx = x / gridScale;
  const gy = y / gridScale;

  // Grid cell indices (clamped)
  const gx0 = Math.min(Math.floor(gx), gridW - 2);
  const gy0 = Math.min(Math.floor(gy), gridH - 2);
  const gx1 = gx0 + 1;
  const gy1 = gy0 + 1;

  // Fractional position within cell
  const fx = gx - gx0;
  const fy = gy - gy0;

  // Bilinear interpolation of 4 surrounding grid values
  const v00 = grid[gy0 * gridW + gx0];
  const v10 = grid[gy0 * gridW + gx1];
  const v01 = grid[gy1 * gridW + gx0];
  const v11 = grid[gy1 * gridW + gx1];

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
}

/**
 * Spawn particles at random positions using a seedable PRNG.
 */
export function spawnParticles(
  count: number,
  seed: number,
  width: number,
  height: number,
): Particle[] {
  const rng = createPRNG(seed);
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const x = rng() * width;
    const y = rng() * height;
    particles.push({
      x,
      y,
      history: [[x, y]],
      alive: true,
    });
  }

  return particles;
}

/**
 * Walk particles through the flow field, recording their trail.
 * Particles that exit bounds are marked alive: false.
 */
export function simulateParticles(
  particles: Particle[],
  field: FlowField,
  maxSteps: number,
  stepLength: number,
  width: number,
  height: number,
): void {
  for (const particle of particles) {
    if (!particle.alive) continue;

    for (let step = 0; step < maxSteps; step++) {
      const { x, y } = particle;

      // Check bounds
      if (x < 0 || x >= width || y < 0 || y >= height) {
        particle.alive = false;
        break;
      }

      // Get flow direction via bilinear interpolation
      const angle = getAngle(field, x, y);

      // Move particle
      const newX = x + Math.cos(angle) * stepLength;
      const newY = y + Math.sin(angle) * stepLength;

      particle.x = newX;
      particle.y = newY;
      particle.history.push([newX, newY]);
    }
  }
}

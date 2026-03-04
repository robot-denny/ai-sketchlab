import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToBuffer } from '../../scripts/image-generator/src/renderer.js';
import { spawnParticles, generateFlowField, simulateParticles } from '../../scripts/image-generator/src/flow-field.js';
import type { Particle, Palette, RGBColor } from '../../scripts/image-generator/src/types.js';

const CYAN_PALETTE: Palette = [
  [0, 140, 200],
  [20, 180, 220],
  [0, 100, 180],
];

function makeTestParticles(seed: number): Particle[] {
  const width = 200;
  const height = 100;
  const field = generateFlowField(seed, width, height, 0.005, 4, 4);
  const particles = spawnParticles(20, seed, width, height);
  simulateParticles(particles, field, 50, 2.5, width, height);
  return particles;
}

describe('renderer', () => {
  it('outputs a valid PNG (magic bytes \\x89PNG)', () => {
    const particles = makeTestParticles(42);
    const buf = renderToBuffer(particles, CYAN_PALETTE, 200, 100);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50); // P
    assert.equal(buf[2], 0x4e); // N
    assert.equal(buf[3], 0x47); // G
  });

  it('output buffer has non-zero length', () => {
    const particles = makeTestParticles(42);
    const buf = renderToBuffer(particles, CYAN_PALETTE, 200, 100);
    assert.ok(buf.length > 0);
  });

  it('same particles + palette → byte-identical output (determinism)', () => {
    const particles1 = makeTestParticles(42);
    const particles2 = makeTestParticles(42);
    const buf1 = renderToBuffer(particles1, CYAN_PALETTE, 200, 100);
    const buf2 = renderToBuffer(particles2, CYAN_PALETTE, 200, 100);
    assert.ok(Buffer.from(buf1).equals(Buffer.from(buf2)), 'Buffers should be identical for same input');
  });

  it('different particles → different output', () => {
    const particles1 = makeTestParticles(42);
    const particles2 = makeTestParticles(99);
    const buf1 = renderToBuffer(particles1, CYAN_PALETTE, 200, 100);
    const buf2 = renderToBuffer(particles2, CYAN_PALETTE, 200, 100);
    assert.ok(!Buffer.from(buf1).equals(Buffer.from(buf2)), 'Buffers should differ for different input');
  });
});

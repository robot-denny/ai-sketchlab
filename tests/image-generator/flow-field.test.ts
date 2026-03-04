import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SimpleNoise } from '../../scripts/image-generator/src/noise.js';
import {
  generateFlowField,
  getAngle,
  spawnParticles,
  simulateParticles,
} from '../../scripts/image-generator/src/flow-field.js';

// --- SimpleNoise tests ---

describe('SimpleNoise', () => {
  it('returns values in [-1, 1] range', () => {
    const noise = new SimpleNoise(42);
    for (let i = 0; i < 100; i++) {
      const x = i * 0.1;
      const y = i * 0.07;
      const val = noise.noise(x, y);
      assert.ok(val >= -1 && val <= 1, `noise(${x}, ${y}) = ${val} out of [-1, 1]`);
    }
  });

  it('is deterministic: same seed + same coordinates → same value', () => {
    const noise1 = new SimpleNoise(42);
    const noise2 = new SimpleNoise(42);
    for (let i = 0; i < 20; i++) {
      const x = i * 0.37;
      const y = i * 0.53;
      assert.equal(noise1.noise(x, y), noise2.noise(x, y));
    }
  });

  it('different seeds produce different noise values', () => {
    const noise1 = new SimpleNoise(42);
    const noise2 = new SimpleNoise(999);
    let diffCount = 0;
    for (let i = 0; i < 20; i++) {
      const x = i * 0.37;
      const y = i * 0.53;
      if (noise1.noise(x, y) !== noise2.noise(x, y)) diffCount++;
    }
    assert.ok(diffCount > 10, `Expected most values to differ, only ${diffCount}/20 did`);
  });

  it('returns 0 at integer coordinates (gradient noise property)', () => {
    const noise = new SimpleNoise(42);
    // At exact integer coords, gradient noise evaluates to 0
    // because xf=0, yf=0 → fade(0)=0, all gradients weighted by 0
    const val = noise.noise(0, 0);
    assert.ok(Math.abs(val) < 1e-10, `Expected ~0 at integer coords, got ${val}`);
  });
});

// --- generateFlowField tests ---

describe('generateFlowField', () => {
  it('returns Float64Array of correct length', () => {
    const width = 120;
    const height = 63;
    const gridScale = 4;
    const field = generateFlowField(42, width, height, 0.005, 4, gridScale);
    const gridW = Math.ceil(width / gridScale) + 1;
    const gridH = Math.ceil(height / gridScale) + 1;
    assert.equal(field.grid.length, gridW * gridH);
    assert.equal(field.gridW, gridW);
    assert.equal(field.gridH, gridH);
    assert.equal(field.gridScale, gridScale);
  });

  it('is deterministic: same seed → identical flow field', () => {
    const f1 = generateFlowField(42, 120, 63, 0.005, 4, 4);
    const f2 = generateFlowField(42, 120, 63, 0.005, 4, 4);
    assert.deepEqual(f1.grid, f2.grid);
  });

  it('different seeds → different flow fields', () => {
    const f1 = generateFlowField(42, 120, 63, 0.005, 4, 4);
    const f2 = generateFlowField(999, 120, 63, 0.005, 4, 4);
    let diffCount = 0;
    for (let i = 0; i < f1.grid.length; i++) {
      if (f1.grid[i] !== f2.grid[i]) diffCount++;
    }
    assert.ok(diffCount > f1.grid.length * 0.5, 'Expected most grid cells to differ');
  });

  it('all angles are in [0, 2π] range', () => {
    const field = generateFlowField(42, 120, 63, 0.005, 4, 4);
    for (let i = 0; i < field.grid.length; i++) {
      const a = field.grid[i];
      assert.ok(a >= 0 && a <= 2 * Math.PI, `angle ${a} out of [0, 2π]`);
    }
  });
});

// --- getAngle tests ---

describe('getAngle', () => {
  it('interpolates between grid points', () => {
    const field = generateFlowField(42, 120, 63, 0.005, 4, 4);
    // At a grid-aligned point, getAngle should return the grid value directly
    const angle = getAngle(field, 0, 0);
    assert.equal(typeof angle, 'number');
    assert.ok(angle >= 0 && angle <= 2 * Math.PI);
  });

  it('returns valid angles at fractional pixel coordinates', () => {
    const field = generateFlowField(42, 120, 63, 0.005, 4, 4);
    const angle = getAngle(field, 5.7, 3.2);
    assert.equal(typeof angle, 'number');
    assert.ok(angle >= 0 && angle <= 2 * Math.PI);
  });

  it('clamps at boundary coordinates', () => {
    const field = generateFlowField(42, 120, 63, 0.005, 4, 4);
    // Should not throw at max bounds
    const angle = getAngle(field, 119, 62);
    assert.equal(typeof angle, 'number');
  });
});

// --- spawnParticles tests ---

describe('spawnParticles', () => {
  it('returns correct number of particles', () => {
    const particles = spawnParticles(100, 42, 1200, 630);
    assert.equal(particles.length, 100);
  });

  it('all particles within bounds', () => {
    const particles = spawnParticles(200, 42, 1200, 630);
    for (const p of particles) {
      assert.ok(p.x >= 0 && p.x < 1200, `x=${p.x} out of bounds`);
      assert.ok(p.y >= 0 && p.y < 630, `y=${p.y} out of bounds`);
      assert.ok(p.alive, 'newly spawned particle should be alive');
      assert.equal(p.history.length, 1, 'should have initial position in history');
      assert.deepEqual(p.history[0], [p.x, p.y]);
    }
  });

  it('is deterministic: same seed → same positions', () => {
    const p1 = spawnParticles(50, 42, 1200, 630);
    const p2 = spawnParticles(50, 42, 1200, 630);
    for (let i = 0; i < 50; i++) {
      assert.equal(p1[i].x, p2[i].x);
      assert.equal(p1[i].y, p2[i].y);
    }
  });

  it('different seeds → different positions', () => {
    const p1 = spawnParticles(50, 42, 1200, 630);
    const p2 = spawnParticles(50, 999, 1200, 630);
    let diffCount = 0;
    for (let i = 0; i < 50; i++) {
      if (p1[i].x !== p2[i].x) diffCount++;
    }
    assert.ok(diffCount > 25, `Expected most positions to differ, only ${diffCount}/50 did`);
  });
});

// --- simulateParticles tests ---

describe('simulateParticles', () => {
  it('moves particles along flow field (history grows)', () => {
    const field = generateFlowField(42, 200, 100, 0.005, 4, 4);
    const particles = spawnParticles(10, 42, 200, 100);
    simulateParticles(particles, field, 50, 2.0, 200, 100);
    // At least some particles should have accumulated history
    const withHistory = particles.filter(p => p.history.length > 1);
    assert.ok(withHistory.length > 0, 'Some particles should have moved');
  });

  it('particles that exit bounds are marked alive: false', () => {
    const field = generateFlowField(42, 200, 100, 0.005, 4, 4);
    // Spawn at edge to ensure some leave bounds quickly
    const particles = spawnParticles(50, 42, 200, 100);
    simulateParticles(particles, field, 200, 2.5, 200, 100);
    const dead = particles.filter(p => !p.alive);
    assert.ok(dead.length > 0, 'Some particles should have exited bounds');
  });

  it('is deterministic: same inputs → same particle histories', () => {
    const field = generateFlowField(42, 200, 100, 0.005, 4, 4);

    const p1 = spawnParticles(20, 99, 200, 100);
    simulateParticles(p1, field, 50, 2.0, 200, 100);

    const p2 = spawnParticles(20, 99, 200, 100);
    simulateParticles(p2, field, 50, 2.0, 200, 100);

    for (let i = 0; i < 20; i++) {
      assert.equal(p1[i].history.length, p2[i].history.length);
      assert.equal(p1[i].alive, p2[i].alive);
      for (let j = 0; j < p1[i].history.length; j++) {
        assert.equal(p1[i].history[j][0], p2[i].history[j][0]);
        assert.equal(p1[i].history[j][1], p2[i].history[j][1]);
      }
    }
  });

  it('does not move dead particles', () => {
    const field = generateFlowField(42, 200, 100, 0.005, 4, 4);
    const particles = spawnParticles(5, 42, 200, 100);
    // Kill a particle before simulation
    particles[0].alive = false;
    const initialHistory = [...particles[0].history];
    simulateParticles(particles, field, 50, 2.0, 200, 100);
    assert.deepEqual(particles[0].history, initialHistory, 'Dead particle should not move');
  });
});

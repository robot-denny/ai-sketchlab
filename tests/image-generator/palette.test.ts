import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCategoryPalette, computeParticleParams } from '../../scripts/image-generator/src/palette.js';
import type { RGBColor, PaletteConfig } from '../../scripts/image-generator/src/types.js';

// Test UUIDs (fake, used only in tests)
const UUID_AI = 'aaaaaaaa-0000-0000-0000-000000000001';
const UUID_ETHICS = 'aaaaaaaa-0000-0000-0000-000000000002';
const UUID_SUSTAINABILITY = 'aaaaaaaa-0000-0000-0000-000000000003';
const UUID_VIBE = 'aaaaaaaa-0000-0000-0000-000000000004';

const TEST_CONFIG: PaletteConfig = {
  entries: {
    [UUID_AI]: { name: 'AI & Machine Learning', colors: [[0, 140, 200], [20, 180, 220], [0, 100, 180]] },
    [UUID_ETHICS]: { name: 'Ethics of AI', colors: [[220, 100, 60], [240, 140, 80], [200, 80, 40]] },
    [UUID_SUSTAINABILITY]: { name: 'Sustainability', colors: [[40, 180, 100], [60, 200, 120], [20, 140, 80]] },
    [UUID_VIBE]: { name: 'Vibe Coding', colors: [[160, 80, 180], [200, 120, 200], [120, 40, 140]] },
  },
  default: [[0, 140, 200], [20, 180, 220], [0, 100, 180]],
};

function isCyanBlue(palette: RGBColor[]): boolean {
  return palette.every(([r, _g, b]) => b > r);
}

function isCoralOrange(palette: RGBColor[]): boolean {
  return palette.every(([r, _g, b]) => r > b);
}

function isGreen(palette: RGBColor[]): boolean {
  return palette.every(([r, g, b]) => g > r && g > b);
}

function isPurple(palette: RGBColor[]): boolean {
  return palette.every(([r, g, _b]) => r > g);
}

describe('getCategoryPalette', () => {
  it('AI & Machine Learning UUID returns cyan/blue palette', () => {
    const palette = getCategoryPalette([UUID_AI], TEST_CONFIG);
    assert.ok(isCyanBlue(palette), `Expected cyan/blue palette, got ${JSON.stringify(palette)}`);
  });

  it('Ethics of AI UUID returns coral/orange palette', () => {
    const palette = getCategoryPalette([UUID_ETHICS], TEST_CONFIG);
    assert.ok(isCoralOrange(palette), `Expected coral/orange palette, got ${JSON.stringify(palette)}`);
  });

  it('Sustainability UUID returns green palette', () => {
    const palette = getCategoryPalette([UUID_SUSTAINABILITY], TEST_CONFIG);
    assert.ok(isGreen(palette), `Expected green palette, got ${JSON.stringify(palette)}`);
  });

  it('Vibe Coding UUID returns purple palette', () => {
    const palette = getCategoryPalette([UUID_VIBE], TEST_CONFIG);
    assert.ok(isPurple(palette), `Expected purple palette, got ${JSON.stringify(palette)}`);
  });

  it('unknown UUID returns default cyan palette', () => {
    const palette = getCategoryPalette(['unknown-uuid-00000'], TEST_CONFIG);
    assert.ok(isCyanBlue(palette), `Expected default cyan palette, got ${JSON.stringify(palette)}`);
  });

  it('empty categoryIds returns default cyan palette', () => {
    const palette = getCategoryPalette([], TEST_CONFIG);
    assert.ok(isCyanBlue(palette), `Expected default cyan palette, got ${JSON.stringify(palette)}`);
  });

  it('multiple category UUIDs merges all matching palettes', () => {
    const palette = getCategoryPalette([UUID_ETHICS, UUID_SUSTAINABILITY], TEST_CONFIG);
    assert.equal(palette.length, 6, `Expected 6 colors (3+3 merged), got ${palette.length}`);
    assert.ok(isCoralOrange(palette.slice(0, 3) as [RGBColor, RGBColor, RGBColor]),
      `Expected first 3 to be coral/orange, got ${JSON.stringify(palette.slice(0, 3))}`);
    assert.ok(isGreen(palette.slice(3, 6) as [RGBColor, RGBColor, RGBColor]),
      `Expected last 3 to be green, got ${JSON.stringify(palette.slice(3, 6))}`);
  });

  it('multiple UUIDs with one unknown only includes the known palette', () => {
    const palette = getCategoryPalette(['unknown-uuid-00000', UUID_VIBE], TEST_CONFIG);
    assert.equal(palette.length, 3, `Expected 3 colors (only Vibe Coding matched), got ${palette.length}`);
    assert.ok(isPurple(palette), `Expected purple palette, got ${JSON.stringify(palette)}`);
  });

  it('no config falls back to default palette', () => {
    const palette = getCategoryPalette([UUID_AI]);
    assert.ok(isCyanBlue(palette), `Expected default cyan palette when no config, got ${JSON.stringify(palette)}`);
  });
});

describe('computeParticleParams', () => {
  it('100 words returns at least 100 particles', () => {
    const params = computeParticleParams(100);
    assert.ok(params.numParticles >= 100, `Expected >= 100 particles, got ${params.numParticles}`);
  });

  it('2000 words caps at 300 particles', () => {
    const params = computeParticleParams(2000);
    assert.ok(params.numParticles <= 300, `Expected <= 300 particles, got ${params.numParticles}`);
  });

  it('2000 words has reasonable maxSteps', () => {
    const params = computeParticleParams(2000);
    assert.ok(params.maxSteps >= 150 && params.maxSteps <= 250,
      `Expected maxSteps in [150,250], got ${params.maxSteps}`);
  });

  it('0 words returns minimum particle count without crashing', () => {
    const params = computeParticleParams(0);
    assert.ok(params.numParticles >= 100, `Expected >= 100 particles for 0 words, got ${params.numParticles}`);
    assert.ok(params.maxSteps >= 150, `Expected maxSteps >= 150, got ${params.maxSteps}`);
  });
});

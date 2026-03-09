import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCategoryPalette, computeParticleParams } from '../../scripts/image-generator/src/palette.js';
import type { RGBColor } from '../../scripts/image-generator/src/types.js';

function isCyanBlue(palette: RGBColor[]): boolean {
  // Cyan/blue palette has dominant blue/cyan channels
  return palette.every(([r, g, b]) => b > r);
}

function isCoralOrange(palette: RGBColor[]): boolean {
  // Coral/orange palette has dominant red channel
  return palette.every(([r, _g, b]) => r > b);
}

function isGreen(palette: RGBColor[]): boolean {
  // Green palette has dominant green channel
  return palette.every(([r, g, b]) => g > r && g > b);
}

function isPurple(palette: RGBColor[]): boolean {
  // Purple palette has dominant blue+red over green
  return palette.every(([r, g, _b]) => r > g);
}

describe('getCategoryPalette', () => {
  it('"AI & Machine Learning" returns cyan/blue palette', () => {
    const palette = getCategoryPalette(['AI & Machine Learning']);
    assert.ok(isCyanBlue(palette), `Expected cyan/blue palette, got ${JSON.stringify(palette)}`);
  });

  it('"Ethics of AI" returns coral/orange palette', () => {
    const palette = getCategoryPalette(['Ethics of AI']);
    assert.ok(isCoralOrange(palette), `Expected coral/orange palette, got ${JSON.stringify(palette)}`);
  });

  it('"Sustainability" returns green palette', () => {
    const palette = getCategoryPalette(['Sustainability']);
    assert.ok(isGreen(palette), `Expected green palette, got ${JSON.stringify(palette)}`);
  });

  it('"Vibe Coding" returns purple palette', () => {
    const palette = getCategoryPalette(['Vibe Coding']);
    assert.ok(isPurple(palette), `Expected purple palette, got ${JSON.stringify(palette)}`);
  });

  it('unknown category returns default cyan palette', () => {
    const palette = getCategoryPalette(['Cooking']);
    assert.ok(isCyanBlue(palette), `Expected default cyan palette, got ${JSON.stringify(palette)}`);
  });

  it('empty categories returns default cyan palette', () => {
    const palette = getCategoryPalette([]);
    assert.ok(isCyanBlue(palette), `Expected default cyan palette, got ${JSON.stringify(palette)}`);
  });

  it('multiple categories merges all matching palettes', () => {
    const palette = getCategoryPalette(['Ethics of AI', 'Sustainability']);
    assert.equal(palette.length, 6, `Expected 6 colors (3+3 merged), got ${palette.length}`);
    // First 3 colors are coral/orange (Ethics of AI)
    assert.ok(isCoralOrange(palette.slice(0, 3) as [RGBColor, RGBColor, RGBColor]),
      `Expected first 3 to be coral/orange, got ${JSON.stringify(palette.slice(0, 3))}`);
    // Last 3 colors are green (Sustainability)
    assert.ok(isGreen(palette.slice(3, 6) as [RGBColor, RGBColor, RGBColor]),
      `Expected last 3 to be green, got ${JSON.stringify(palette.slice(3, 6))}`);
  });

  it('multiple categories with one unknown only includes the known palette', () => {
    const palette = getCategoryPalette(['Cooking', 'Vibe Coding']);
    assert.equal(palette.length, 3, `Expected 3 colors (only Vibe Coding matched), got ${palette.length}`);
    assert.ok(isPurple(palette), `Expected purple palette, got ${JSON.stringify(palette)}`);
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

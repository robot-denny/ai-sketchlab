import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stringToSeed, createPRNG } from '../../scripts/image-generator/src/seed.js';

describe('stringToSeed', () => {
  it('returns same integer every time (determinism)', () => {
    const a = stringToSeed('hello');
    const b = stringToSeed('hello');
    assert.equal(a, b);
  });

  it('returns different integers for different inputs', () => {
    assert.notEqual(stringToSeed('hello'), stringToSeed('world'));
  });

  it('handles empty string without crashing', () => {
    const seed = stringToSeed('');
    assert.equal(typeof seed, 'number');
    assert.ok(seed >= 0, 'seed should be non-negative');
    assert.ok(Number.isInteger(seed), 'seed should be an integer');
  });
});

describe('createPRNG', () => {
  it('produces same sequence with same seed', () => {
    const rng1 = createPRNG(42);
    const rng2 = createPRNG(42);
    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];
    assert.deepEqual(seq1, seq2);
  });

  it('produces different sequences with different seeds', () => {
    const rng1 = createPRNG(42);
    const rng2 = createPRNG(99);
    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];
    assert.notDeepEqual(seq1, seq2);
  });

  it('returns values between 0 and 1', () => {
    const rng = createPRNG(42);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      assert.ok(val >= 0 && val < 1, `value ${val} out of range`);
    }
  });
});

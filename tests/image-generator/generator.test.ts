import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateImage } from '../../scripts/image-generator/src/generator.js';
import type { ArticleMetadata } from '../../scripts/image-generator/src/types.js';

const SAMPLE_METADATA: ArticleMetadata = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Article',
  title: 'Retaining Humanity in AI-Generated Content',
  wordCount: 500,
  categories: ['AI & Machine Learning'],
};

describe('generator', () => {
  it('generateImage returns a Buffer', () => {
    const buf = generateImage(SAMPLE_METADATA);
    assert.ok(Buffer.isBuffer(buf), 'Result should be a Buffer');
  });

  it('same metadata → byte-identical PNG (determinism)', () => {
    const buf1 = generateImage(SAMPLE_METADATA);
    const buf2 = generateImage(SAMPLE_METADATA);
    assert.ok(buf1.equals(buf2), 'Same metadata should produce identical PNGs');
  });

  it('different title → different PNG', () => {
    const buf1 = generateImage(SAMPLE_METADATA);
    const buf2 = generateImage({ ...SAMPLE_METADATA, title: 'A Completely Different Title' });
    assert.ok(!buf1.equals(buf2), 'Different titles should produce different PNGs');
  });

  it('different node ID → different PNG', () => {
    const buf1 = generateImage(SAMPLE_METADATA);
    const buf2 = generateImage({ ...SAMPLE_METADATA, id: '660e8400-e29b-41d4-a716-446655440001' });
    assert.ok(!buf1.equals(buf2), 'Different IDs should produce different PNGs');
  });

  it('zero word count → valid PNG without crashing', () => {
    const buf = generateImage({ ...SAMPLE_METADATA, wordCount: 0 });
    assert.ok(buf.length > 0);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
  });

  it('empty title → valid PNG without crashing', () => {
    const buf = generateImage({ ...SAMPLE_METADATA, title: '' });
    assert.ok(buf.length > 0);
    assert.equal(buf[0], 0x89);
  });

  it('no categories → valid PNG without crashing', () => {
    const buf = generateImage({ ...SAMPLE_METADATA, categories: [] });
    assert.ok(buf.length > 0);
    assert.equal(buf[0], 0x89);
  });
});

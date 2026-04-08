import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, parsePaletteFromDocument } from '../../scripts/image-generator/src/palette-reader.js';
import type { PaletteConfig, RGBColor } from '../../scripts/image-generator/src/types.js';

// ── hexToRgb ──────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('converts standard hex to RGB', () => {
    assert.deepEqual(hexToRgb('#008cc8'), [0, 140, 200]);
  });

  it('converts black', () => {
    assert.deepEqual(hexToRgb('#000000'), [0, 0, 0]);
  });

  it('converts white', () => {
    assert.deepEqual(hexToRgb('#ffffff'), [255, 255, 255]);
  });

  it('converts uppercase hex', () => {
    assert.deepEqual(hexToRgb('#FF8800'), [255, 136, 0]);
  });

  it('throws on invalid hex string', () => {
    assert.throws(() => hexToRgb('red'), /Invalid hex color/);
    assert.throws(() => hexToRgb('#gg0000'), /Invalid hex color/);
    assert.throws(() => hexToRgb(''), /Invalid hex color/);
    assert.throws(() => hexToRgb('#abc'), /Invalid hex color/);
  });

  it('converts all seed palette colors correctly', () => {
    // AI & Machine Learning
    assert.deepEqual(hexToRgb('#008cc8'), [0, 140, 200]);
    assert.deepEqual(hexToRgb('#14b4dc'), [20, 180, 220]);
    assert.deepEqual(hexToRgb('#0064b4'), [0, 100, 180]);
    // Ethics
    assert.deepEqual(hexToRgb('#dc643c'), [220, 100, 60]);
    // Sustainability
    assert.deepEqual(hexToRgb('#28b464'), [40, 180, 100]);
    // Default
    assert.deepEqual(hexToRgb('#b5aea6'), [181, 174, 166]);
    assert.deepEqual(hexToRgb('#d9c5b4'), [217, 197, 180]);
    assert.deepEqual(hexToRgb('#9c7373'), [156, 115, 115]);
  });
});

// ── parsePaletteFromDocument ──────────────────────────────────

// Helper: build a minimal document response matching the Management API shape
function buildSettingsDoc(options: {
  blocks?: Array<{ categoryId: string; primary: string; mid: string; deep: string }>;
  defaultPrimary?: string;
  defaultMid?: string;
  defaultDeep?: string;
}) {
  const blocks = options.blocks ?? [];
  const contentData = blocks.map((b) => {
    const key = `block-${b.categoryId}`;
    return {
      contentTypeKey: 'element-type-id',
      key,
      values: [
        { alias: 'paletteCategory', value: [{ type: 'document', unique: b.categoryId }] },
        { alias: 'palettePrimary', value: b.primary },
        { alias: 'paletteMid', value: b.mid },
        { alias: 'paletteDeep', value: b.deep },
      ],
    };
  });

  return {
    values: [
      {
        alias: 'categoryPalettes',
        value: {
          contentData,
          settingsData: [],
          layout: { 'Umbraco.BlockList': contentData.map((c) => ({ contentKey: c.key })) },
          expose: contentData.map((c) => ({ contentKey: c.key, culture: null, segment: null })),
        },
      },
      { alias: 'defaultPrimary', value: options.defaultPrimary ?? '#b5aea6' },
      { alias: 'defaultMid', value: options.defaultMid ?? '#d9c5b4' },
      { alias: 'defaultDeep', value: options.defaultDeep ?? '#9c7373' },
    ],
  };
}

describe('parsePaletteFromDocument', () => {
  it('extracts all category palette entries', () => {
    const doc = buildSettingsDoc({
      blocks: [
        { categoryId: 'uuid-ai', primary: '#008cc8', mid: '#14b4dc', deep: '#0064b4' },
        { categoryId: 'uuid-ethics', primary: '#dc643c', mid: '#f08c50', deep: '#c85028' },
      ],
    });

    const config = parsePaletteFromDocument(doc);
    assert.equal(Object.keys(config.entries).length, 2);
    assert.deepEqual(config.entries['uuid-ai'].colors, [[0, 140, 200], [20, 180, 220], [0, 100, 180]]);
    assert.deepEqual(config.entries['uuid-ethics'].colors, [[220, 100, 60], [240, 140, 80], [200, 80, 40]]);
  });

  it('extracts default palette colors', () => {
    const doc = buildSettingsDoc({
      defaultPrimary: '#b5aea6',
      defaultMid: '#d9c5b4',
      defaultDeep: '#9c7373',
    });

    const config = parsePaletteFromDocument(doc);
    assert.deepEqual(config.default, [[181, 174, 166], [217, 197, 180], [156, 115, 115]]);
  });

  it('returns hardcoded defaults for null document', () => {
    const config = parsePaletteFromDocument(null);
    assert.equal(Object.keys(config.entries).length, 0);
    assert.equal(config.default.length, 3);
    // Default palette should be the cyan/blue hardcoded fallback
    assert.ok(config.default.every((c: RGBColor) => c.length === 3));
  });

  it('returns hardcoded defaults for undefined document', () => {
    const config = parsePaletteFromDocument(undefined);
    assert.equal(Object.keys(config.entries).length, 0);
    assert.equal(config.default.length, 3);
  });

  it('handles empty Block List (no category entries)', () => {
    const doc = buildSettingsDoc({ blocks: [] });
    const config = parsePaletteFromDocument(doc);
    assert.equal(Object.keys(config.entries).length, 0);
    // Default colors should still be extracted from the doc
    assert.deepEqual(config.default, [[181, 174, 166], [217, 197, 180], [156, 115, 115]]);
  });

  it('handles missing categoryPalettes value gracefully', () => {
    const doc = {
      values: [
        { alias: 'defaultPrimary', value: '#ff0000' },
        { alias: 'defaultMid', value: '#00ff00' },
        { alias: 'defaultDeep', value: '#0000ff' },
      ],
    };
    const config = parsePaletteFromDocument(doc);
    assert.equal(Object.keys(config.entries).length, 0);
    assert.deepEqual(config.default, [[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  });

  it('handles block where category picker value is empty array', () => {
    const doc = buildSettingsDoc({
      blocks: [{ categoryId: 'uuid-1', primary: '#ff0000', mid: '#00ff00', deep: '#0000ff' }],
    });
    // Simulate empty picker
    doc.values[0].value.contentData[0].values[0].value = [];

    const config = parsePaletteFromDocument(doc);
    // Should skip blocks with no category
    assert.equal(Object.keys(config.entries).length, 0);
  });

  it('preserves category names as empty string (names come from CMS, not stored here)', () => {
    const doc = buildSettingsDoc({
      blocks: [{ categoryId: 'uuid-1', primary: '#ff0000', mid: '#00ff00', deep: '#0000ff' }],
    });
    const config = parsePaletteFromDocument(doc);
    assert.equal(config.entries['uuid-1'].name, '');
  });
});

import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { getDataTypeByName, getPaletteBlockAliases } from '../_umbracoApi';
import dotenv from 'dotenv';

dotenv.config();

// Block-editor parity (Step 5 of `_plans/block-editor-parity-and-reuse-readiness.md`).
//
// Palette membership is pure admin configuration: a block's availability in an
// editor is the data type's `blocks` config, NOT a code-level restriction. After
// Step 4 both page-body palettes offer every renderable block (default parity),
// with two deliberate body-palette exclusions:
//   - `pillarSection` is grid-only (uses Block Grid areas) -> must NOT be in the
//     Block List palette.
//   - `iconLinkRow`'s list home is the separate footer Icon List palette.
//
// These assertions read the data type config via the Management API and resolve
// each `contentElementTypeKey` to its element alias — no hardcoded UUIDs, no
// content fixtures created (E2E resilience rules #1/#2; nothing POSTs /document,
// so this can't hit the cold-AI.Search 500 cascade). getByName-style lookups
// return `null` when missing, asserted with `.toBeTruthy()`.

const LIST_PALETTE = '[BlockList] Main Content';
const GRID_PALETTE = '[BlockGrid] Experiments Body';

test.describe('Block-editor palette parity', () => {
  test.describe.configure({ mode: 'serial' });

  test('both body palettes resolve by name (no hardcoded UUIDs)', async () => {
    const list = await getDataTypeByName(LIST_PALETTE);
    const grid = await getDataTypeByName(GRID_PALETTE);
    expect(list, `"${LIST_PALETTE}" data type should exist`).toBeTruthy();
    expect(grid, `"${GRID_PALETTE}" data type should exist`).toBeTruthy();
    expect(list.editorAlias).toBe('Umbraco.BlockList');
    expect(grid.editorAlias).toBe('Umbraco.BlockGrid');
  });

  test('[BlockList] Main Content offers the cross-added statCallout block', async () => {
    const aliases = await getPaletteBlockAliases(LIST_PALETTE);
    expect(aliases.length, 'list palette should offer blocks').toBeGreaterThan(0);
    expect(aliases).toContain('statCallout');
  });

  test('[BlockGrid] Experiments Body offers the cross-added videoRow block', async () => {
    const aliases = await getPaletteBlockAliases(GRID_PALETTE);
    expect(aliases.length, 'grid palette should offer blocks').toBeGreaterThan(0);
    expect(aliases).toContain('videoRow');
  });

  test('[BlockList] Main Content does NOT offer pillarSection (grid-only, uses areas)', async () => {
    const aliases = await getPaletteBlockAliases(LIST_PALETTE);
    expect(aliases).not.toContain('pillarSection');
  });
});

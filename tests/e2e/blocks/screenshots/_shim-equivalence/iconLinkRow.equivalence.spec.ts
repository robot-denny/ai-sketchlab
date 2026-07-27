import { test, expect } from '@playwright/test';
import { shotOf } from './_shimHelpers';

// Both editors now render iconLinkRow from the single shared view
// (Views/Partials/blocks/Components/iconLinkRow.cshtml), so list and grid are
// identical by construction. iconLinkRow still has no canonical render surface on
// either context (see iconLinkRow.screenshot.spec.ts and iconLinkRow.blockgrid.screenshot.spec.ts).
// The equivalence test is in place for future content authoring; until then
// it skips cleanly.

test.describe('Shim equivalence: iconLinkRow (blocklist == blockgrid)', () => {
  test.skip(
    true,
    'TODO: iconLinkRow has no render surface in either context yet. Add it to /guides/component-guide/ (blocklist) and /experiments/ (blockgrid) and un-skip.',
  );

  test('blocklist and blockgrid render byte-identically', async ({ page }) => {
    const blocklistShot = await shotOf(
      page,
      '/guides/component-guide/',
      'li.list-inline-item:has(our-svg.social-icon)',
    );
    const blockgridShot = await shotOf(
      page,
      '/experiments/',
      '[data-content-element-type-alias="iconLinkRow"] li.list-inline-item',
    );

    expect(blocklistShot.equals(blockgridShot)).toBe(true);
  });
});

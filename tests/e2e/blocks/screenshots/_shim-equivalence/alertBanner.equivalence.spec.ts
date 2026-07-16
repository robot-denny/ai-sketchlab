import { test, expect } from '@playwright/test';
import { shotOf } from './_shimHelpers';

// Both editors now render alertBanner from the ONE shared view
// Views/Partials/blocks/Components/alertBanner.cshtml (the old blockgrid shim
// was removed by _plans/block-editor-parity-and-reuse-readiness.md). Rendered
// output should be byte-identical when the same content data flows through both
// contexts.
//
// Currently the demo site only authors the blocklist version (on
// /styleguide/components/) -- there's no blockgrid alertBanner instance with
// equivalent content. The test skips cleanly when no blockgrid instance is
// found, but the assertion is in place for the day the equivalence becomes
// testable.

test.describe('Shim equivalence: alertBanner (blocklist == blockgrid)', () => {
  test('blocklist and blockgrid render byte-identically', async ({ page }) => {
    // Fast probe (domcontentloaded only) -- skip if the blockgrid surface
    // doesn't author this block yet. The probe goto is the only `await`
    // before `test.skip`; a failed navigation here surfaces as a clear error
    // rather than being masked as a skip.
    await page.goto('/experiments/', { waitUntil: 'domcontentloaded' });
    const blockgridAlert = page.locator(
      '[data-content-element-type-alias="alertBanner"]',
    );
    test.skip(
      (await blockgridAlert.count()) === 0,
      'TODO: alertBanner not authored on a blockgrid surface. Equivalence cannot be proven until both contexts render it with matching content.',
    );

    const blocklistShot = await shotOf(
      page,
      '/styleguide/components/',
      '.alert',
    );
    const blockgridShot = await shotOf(
      page,
      '/experiments/',
      '[data-content-element-type-alias="alertBanner"] .alert',
    );

    expect(blocklistShot.equals(blockgridShot)).toBe(true);
  });
});

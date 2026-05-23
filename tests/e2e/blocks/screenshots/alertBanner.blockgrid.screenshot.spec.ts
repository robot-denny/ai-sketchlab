import { test } from '@umbraco/playwright-testhelpers';
import { expect, prepareForScreenshot, screenshotOptions } from '../../_helpers';

// Canonical surface: the blockgrid shim for alertBanner delegates to the
// blocklist partial via Html.PartialAsync. The /experiments/ page is the
// canonical blockgrid surface for this project, but content authors have
// not added an Alert Banner to it. Until that happens, we probe with a
// fast `domcontentloaded` navigation and skip cleanly if absent.

test.describe('Screenshot: Block Grid alertBanner', () => {
  test('renders blockgrid alertBanner matching baseline', async ({ page }) => {
    // Fast probe -- skip if the block isn't authored on this surface yet.
    const resp = await page.goto('/experiments/', { waitUntil: 'domcontentloaded' });
    expect(resp?.ok(), 'navigation to /experiments/ should succeed').toBeTruthy();

    const block = page.locator('[data-content-element-type-alias="alertBanner"]').first();
    test.skip(
      (await block.count()) === 0,
      'TODO: alertBanner is not currently authored on /experiments/. Add it there to capture this baseline.',
    );

    // Single navigation -- proceed with screenshot capture on the already-loaded page.
    await prepareForScreenshot(page);
    await block.scrollIntoViewIfNeeded();
    await expect(block).toBeVisible({ timeout: 10_000 });
    await expect(block).toHaveScreenshot('alertBanner.blockgrid.png', screenshotOptions());
  });
});

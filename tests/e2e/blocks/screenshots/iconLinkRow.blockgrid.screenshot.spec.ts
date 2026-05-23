import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// NOTE: The blockgrid shim for iconLinkRow has no canonical render surface
// on the demo site. The partial delegates to the blocklist version which
// also lacks coverage; see iconLinkRow.screenshot.spec.ts for the matching
// blocklist skip. When this block is authored on /experiments/ (or another
// blockgrid page), un-skip and regenerate the baseline.

test.describe('Screenshot: Block Grid iconLinkRow', () => {
  test.skip(
    true,
    'TODO: iconLinkRow has no canonical blockgrid render surface yet. Add it to /experiments/ and un-skip this test.',
  );

  test('renders blockgrid iconLinkRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/experiments/',
      '[data-content-element-type-alias="iconLinkRow"]',
    );
    await expect(block).toHaveScreenshot(
      'iconLinkRow.blockgrid.png',
      screenshotOptions(),
    );
  });
});

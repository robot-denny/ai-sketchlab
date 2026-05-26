import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /styleguide/components/ -- partial emits a wrapping
// `<div class="row ...">` with `.youtube-player` inside it. We target the
// row containing the youtube-player so the screenshot includes the caption
// and surrounding spacing.
//
// FRAGILE: the `.row:has(.youtube-player)` selector couples to Bootstrap's
// .row grid class. If the partial moves off Bootstrap rows, retighten via
// a `data-block-alias="videoRow"` attribute on the partial's wrapper.

test.describe('Screenshot: Block List videoRow', () => {
  test('renders videoRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/components/',
      '.row:has(.youtube-player)',
    );
    await expect(block).toHaveScreenshot(
      'videoRow.png',
      screenshotOptions({
        // YouTube iframe content loads from third-party origin; mask it so
        // the screenshot captures the block chrome, not the embedded video.
        mask: [page.locator('.youtube-player iframe, .youtube-player')],
      }),
    );
  });
});

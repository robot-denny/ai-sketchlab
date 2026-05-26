import { test } from '@umbraco/playwright-testhelpers';
import { expect, findNavLinkForTemplate, prepareForScreenshot, screenshotOptions } from '../_helpers';

// Page-template screenshot (Step 6, _plans/arch-safety-net.md).
//
// Canonical surface: the ExperimentsLandingPage document type. This template
// is the canonical render surface for the blockgrid suite (12 blockgrid
// components from Step 5 are baselined individually against blocks on this
// page). The full-page screenshot here adds end-to-end LAYOUT coverage on
// top of the per-block baselines: page chrome, inter-block spacing, the
// experiments timeline rail, etc.
//
// URL is discovered by walking header/nav/footer anchors for a link whose
// destination contains a `umb-block-grid__layout-item` -- the unique
// blockgrid layout wrapper that ExperimentsLandingPage renders.
//
// Dynamic regions to mask:
//   - `time, .post-meta, .article-meta` -- the experiments timeline renders
//     `<time class="exp-timeline__date">` for each entry. Dates are
//     editorial, not derived, but masking keeps the spec resilient if entries
//     are reordered or new ones added.

test.describe('Screenshot: experimentsLandingPage page template', () => {
  test('renders experiments landing page matching baseline', async ({ page }) => {
    const experimentsUrl = await findNavLinkForTemplate(
      page,
      'main .umb-block-grid__layout-item',
    );
    await page.goto(experimentsUrl);
    await prepareForScreenshot(page);

    await expect(page).toHaveScreenshot(
      'experimentsLandingPage.png',
      screenshotOptions({
        fullPage: true,
        mask: [
          page.locator('time, .post-meta, .article-meta'),
        ],
      }),
    );
  });
});

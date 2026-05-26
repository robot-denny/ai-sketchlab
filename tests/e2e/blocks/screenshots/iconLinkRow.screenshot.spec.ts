import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// NOTE: iconLinkRow has no canonical render surface on the demo site today.
// The partial emits `<li class="list-inline-item">...<our-svg class="social-icon"/>...</li>`
// but no published page currently includes this block in a block list.
//
// Per the plan: rather than fabricating new content to render this block,
// we skip the spec with a TODO. When iconLinkRow is added (e.g. to the
// /styleguide/components/ page as a social-links demonstration), un-skip
// this test and regenerate the baseline via `update-snapshots.yml`.

test.describe('Screenshot: Block List iconLinkRow', () => {
  test.skip(
    true,
    'TODO: iconLinkRow has no canonical render surface yet. Add it to /styleguide/components/ and un-skip this test.',
  );

  test('renders iconLinkRow matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/components/',
      'li.list-inline-item:has(our-svg.social-icon)',
    );
    await expect(block).toHaveScreenshot('iconLinkRow.png', screenshotOptions());
  });
});

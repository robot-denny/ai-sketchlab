import { test } from '@umbraco/playwright-testhelpers';
import { discoverBlockOnPage, expect, screenshotOptions } from '../../_helpers';

// Canonical surface: /styleguide/components/ renders all three severity levels
// of the Alert Banner block (.alert-danger / .alert-warning / .alert-info).
// Selector targets the first .alert wrapper -- the emergency (.alert-danger)
// banner -- so the baseline is stable regardless of how many alerts the
// content authors add later.

test.describe('Screenshot: Block List alertBanner', () => {
  test('renders alertBanner matching baseline', async ({ page }) => {
    const block = await discoverBlockOnPage(
      page,
      '/styleguide/components/',
      '.alert',
    );
    await expect(block).toHaveScreenshot('alertBanner.png', screenshotOptions());
  });
});

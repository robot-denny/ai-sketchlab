import { test, expect } from '@playwright/test';

// Home page "latest" section labels (Step 2, _work/umbraco-18-upgrade/plan.md).
//
// The section heading and the archive link text come from dictionary items
// (Home.LatestTitle, Home.ArchiveLink), with a default label when an item is
// missing or blank. These are "label renders" checks: a visitor never sees an
// empty heading or an unlabeled link on the environment under test. They do not
// blank a dictionary item to force the fallback path — that would mutate shared
// content on Dev during Gate 2. The fallback itself was proven manually when the
// views moved to GetDictionaryValueOrDefault.
//
// The home screenshot spec masks this whole section, so these behavioral checks
// live beside it rather than inside it.

test.describe('Home page — latest section labels', () => {
  test('latest section heading and archive link both show text', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.status(), 'navigation to / should return 200').toBe(200);

    const section = page.locator('section.latest');
    await expect(section, 'home page should render the latest section').toBeVisible();

    const heading = section.getByRole('heading', { level: 2 }).first();
    await expect(heading, 'latest heading should not be blank').not.toHaveText(/^\s*$/);

    const archiveLink = section.locator('.archive-link a');
    await expect(archiveLink, 'archive link should not be blank').not.toHaveText(/^\s*$/);
  });
});

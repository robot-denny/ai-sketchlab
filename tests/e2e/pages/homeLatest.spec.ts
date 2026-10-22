import { test, expect } from '@playwright/test';

// Home page "latest" section labels (Step 2, _work/umbraco-18-upgrade/plan.md).
//
// The section heading and the archive link text are dictionary values
// (Home.LatestTitle, Home.ArchiveLink). A missing key or blank translation must
// fall back to a default label — a visitor should never see an empty heading or
// an empty, unlabeled link. The home screenshot spec masks this whole section,
// so these behavioral checks live beside it rather than inside it.

test.describe('Home page — latest section labels', () => {
  test('latest section heading shows visible text', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.status(), 'navigation to / should return 200').toBe(200);

    const section = page.locator('section.latest');
    await expect(section, 'home page should render the latest section').toBeVisible();

    const heading = section.getByRole('heading', { level: 2 }).first();
    await expect(heading).toBeVisible();
    expect((await heading.innerText()).trim(), 'latest heading should not be blank').not.toBe('');
  });

  test('archive link shows visible text', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.status(), 'navigation to / should return 200').toBe(200);

    const archiveLink = page.locator('section.latest .archive-link a');
    await expect(archiveLink).toBeVisible();
    expect((await archiveLink.innerText()).trim(), 'archive link should not be blank').not.toBe('');
  });
});

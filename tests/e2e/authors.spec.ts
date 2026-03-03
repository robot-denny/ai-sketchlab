import { test, expect } from '@playwright/test';

test.describe('Authors pages', () => {
  test('authors list page loads without errors', async ({ page }) => {
    const response = await page.goto('/authors/');
    expect(response?.status(), '/authors/ should return 200').toBe(200);

    // Verify author cards are rendered
    const authorCards = page.locator('.card');
    await expect(authorCards.first()).toBeVisible();
  });

  test('each author detail page loads without errors', async ({ page }) => {
    // Visit the list page and collect all author links
    await page.goto('/authors/');
    const authorLinks = await page.locator('a.text-primary[href*="/authors/"]').evaluateAll(
      (links) => links.map((a) => (a as HTMLAnchorElement).getAttribute('href')).filter(Boolean)
    );

    expect(authorLinks.length, 'Should have at least one author').toBeGreaterThan(0);

    // Visit each author page and assert no 500 errors
    for (const href of authorLinks) {
      const response = await page.goto(href!);
      expect(response?.status(), `${href} should return 200`).toBe(200);

      // Verify the page has the author name heading
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    }
  });
});

import { test, expect } from '@playwright/test';

/**
 * Link Styles E2E Tests
 *
 * Verifies the consolidated link style: bold, underlined, #8859b6 color,
 * black on hover. Header/footer links remain unchanged.
 */

const LINK_COLOR = 'rgb(136, 89, 182)'; // #8859b6
const HOVER_COLOR = 'rgb(0, 0, 0)';     // #000

// ---------- Default link styles ----------

test.describe('Link Styles — Default Links', () => {
  test('content page link has correct color, bold weight, and underline', async ({ page }) => {
    // The login page has inline btn-link elements that double as default-styled links.
    // We also inject a test link to verify the global `a` style directly.
    await page.goto('/member-registration/');

    // Use page.evaluate to inject a test link and read its computed styles
    const styles = await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = 'Test link';
      a.id = 'e2e-test-link';
      document.body.appendChild(a);
      const cs = getComputedStyle(a);
      return {
        color: cs.color,
        fontWeight: cs.fontWeight,
        textDecorationLine: cs.textDecorationLine,
      };
    });

    expect(styles.color).toBe(LINK_COLOR);
    expect(Number(styles.fontWeight)).toBeGreaterThanOrEqual(700);
    expect(styles.textDecorationLine).toContain('underline');
  });

  test('link hover state changes to black', async ({ page }) => {
    await page.goto('/member-registration/');

    // Inject a test link, hover it, and check color
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = 'Hover test link';
      a.id = 'e2e-hover-link';
      a.style.display = 'block';
      a.style.padding = '20px';
      document.body.appendChild(a);
    });

    const link = page.locator('#e2e-hover-link');
    await link.hover();

    const color = await link.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe(HOVER_COLOR);
  });
});

// ---------- Header navigation ----------

test.describe('Link Styles — Header Navigation', () => {
  test('header nav links have no underline and retain existing colors', async ({ page }) => {
    await page.goto('/');
    const navLink = page.locator('.site-head .site-nav a').first();
    await expect(navLink).toBeVisible();

    const textDecoration = await navLink.evaluate((el) => getComputedStyle(el).textDecorationLine);
    const color = await navLink.evaluate((el) => getComputedStyle(el).color);

    expect(textDecoration).toBe('none');
    // Header nav links should NOT be the purple accent color
    expect(color).not.toBe(LINK_COLOR);
  });
});

// ---------- Footer navigation ----------

test.describe('Link Styles — Footer', () => {
  test('footer links retain existing scoped styles', async ({ page }) => {
    await page.goto('/');
    const footerLink = page.locator('footer a').first();

    // Footer may not always have links, skip if none
    if (await footerLink.count() === 0) {
      test.skip();
      return;
    }

    await expect(footerLink).toBeVisible();

    const textDecoration = await footerLink.evaluate((el) => getComputedStyle(el).textDecorationLine);
    const color = await footerLink.evaluate((el) => getComputedStyle(el).color);

    // Footer links should be underlined for identifiability but inherit footer color
    expect(textDecoration).toContain('underline');
    expect(color).not.toBe(LINK_COLOR);
  });
});

// ---------- Blog article card links ----------

test.describe('Link Styles — Article Grid Card', () => {
  test('article card title link uses new link color with bold and underline', async ({ page }) => {
    // Navigate to home page which may have latest articles, or try to find articles page
    await page.goto('/');
    let cardLink = page.locator('.article-grid-card .card-title a').first();

    // If no grid cards on home, check for post-preview links
    if (await cardLink.count() === 0) {
      cardLink = page.locator('.post-preview > a').first();
    }

    // If still no article links, skip
    if (await cardLink.count() === 0) {
      test.skip();
      return;
    }

    await expect(cardLink).toBeVisible();

    const color = await cardLink.evaluate((el) => getComputedStyle(el).color);
    const fontWeight = await cardLink.evaluate((el) => getComputedStyle(el).fontWeight);
    const textDecoration = await cardLink.evaluate((el) => getComputedStyle(el).textDecorationLine);

    expect(color).toBe(LINK_COLOR);
    expect(Number(fontWeight)).toBeGreaterThanOrEqual(700);
    expect(textDecoration).toContain('underline');
  });
});

// ---------- Login page btn-link ----------

test.describe('Link Styles — Login Page', () => {
  test('"create an account" button matches default link style', async ({ page }) => {
    await page.goto('/member-registration/');
    const btnLink = page.locator('#show-register-btn');
    await expect(btnLink).toBeVisible();

    const color = await btnLink.evaluate((el) => getComputedStyle(el).color);
    const fontWeight = await btnLink.evaluate((el) => getComputedStyle(el).fontWeight);
    const textDecoration = await btnLink.evaluate((el) => getComputedStyle(el).textDecorationLine);

    expect(color).toBe(LINK_COLOR);
    expect(Number(fontWeight)).toBeGreaterThanOrEqual(700);
    expect(textDecoration).toContain('underline');
  });
});

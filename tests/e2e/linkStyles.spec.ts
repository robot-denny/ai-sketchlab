import { test, expect } from '@playwright/test';

/**
 * Link Styles E2E Tests
 *
 * Verifies the v2 link treatment: accent color #8B6B4A (rgb 139,107,74),
 * underlined, darkening on hover. The hover color transitions, so the hover test
 * asserts "darker than base" rather than an exact (mid-transition) value. Default
 * links are regular weight; the login button-link carries its own weight/decoration.
 * Header/footer links are scoped separately.
 */

const LINK_COLOR = 'rgb(139, 107, 74)'; // v2 accent link #8B6B4A

// ---------- Default link styles ----------

test.describe('Link Styles — Default Links', () => {
  test('content page link uses the accent color and is underlined', async ({ page }) => {
    // Inject a test link to read the global `a` style directly. (v2 default links
    // are regular weight, not bold — weight is intentionally not asserted here.)
    await page.goto('/member-registration/');

    const styles = await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = 'Test link';
      a.id = 'e2e-test-link';
      document.body.appendChild(a);
      const cs = getComputedStyle(a);
      return { color: cs.color, textDecorationLine: cs.textDecorationLine };
    });

    expect(styles.color).toBe(LINK_COLOR);
    expect(styles.textDecorationLine).toContain('underline');
  });

  test('link darkens on hover', async ({ page }) => {
    await page.goto('/member-registration/');

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
    const rgb = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

    const base = rgb(await link.evaluate((el) => getComputedStyle(el).color));
    await link.hover();
    // The link color transitions on hover — wait past the transition before
    // sampling so we read the settled color, not a mid-animation frame.
    await page.waitForTimeout(500);
    const hovered = rgb(await link.evaluate((el) => getComputedStyle(el).color));

    // Hover darkens the accent link: the color changes and no channel gets lighter.
    expect(hovered).not.toEqual(base);
    expect(
      hovered[0] <= base[0] && hovered[1] <= base[1] && hovered[2] <= base[2],
      `hover color ${hovered} should be no lighter than base ${base}`
    ).toBe(true);
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

    // v2 footer links inherit the footer color and are not underlined (the footer
    // is styled as its own scope, distinct from the global accent-link treatment).
    expect(textDecoration).toBe('none');
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
  test('"create an account" button uses the accent link color', async ({ page }) => {
    await page.goto('/member-registration/');
    const btnLink = page.locator('#show-register-btn');
    await expect(btnLink).toBeVisible();

    // The button-link carries the accent color; its weight/decoration are its own
    // (it is a button, not an inline body link, so it does not match default links).
    const color = await btnLink.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe(LINK_COLOR);
  });
});

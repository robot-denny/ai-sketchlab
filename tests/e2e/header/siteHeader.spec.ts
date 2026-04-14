import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = process.env.URL || 'https://localhost:44367';

// ==============================
// Shared API Helpers (rule #4: refresh tokens)
// ==============================

let _token: string;
let _tokenTimestamp = 0;
const TOKEN_TTL = 250_000;

async function freshToken(): Promise<string> {
  if (_token && Date.now() - _tokenTimestamp < TOKEN_TTL) return _token;
  const resp = await fetch(
    `${API_BASE}/umbraco/management/api/v1/security/back-office/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.UMBRACO_CLIENT_ID!,
        client_secret: process.env.UMBRACO_CLIENT_SECRET!,
      }).toString(),
    }
  );
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  _token = ((await resp.json()) as any).access_token;
  _tokenTimestamp = Date.now();
  return _token;
}

async function apiFetch(token: string, method: string, path: string, body?: any) {
  return fetch(`${API_BASE}/umbraco/management/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/** Fetch the published path for a document (rule #2: never hardcode URL slugs) */
async function getDocumentPath(token: string, docId: string): Promise<string> {
  const resp = await apiFetch(token, 'GET', `/document/urls?id=${docId}`);
  if (!resp.ok) throw new Error(`GET document URLs failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

// ==============================
// Section 1: CSS File Content Tests
// ==============================

test.describe('Site Header — CSS Structure', () => {
  const cssPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/wwwroot/assets/css/styles.css'
  );
  let css: string;

  test.beforeAll(() => {
    css = readFileSync(cssPath, 'utf-8');
  });

  test('#mainNav uses position: sticky (not absolute)', () => {
    // The base #mainNav rule should use sticky positioning
    expect(css).toMatch(/#mainNav\s*\{[^}]*position:\s*sticky/);
    // Should NOT contain position: absolute in the base #mainNav rule
    const baseRule = css.match(/#mainNav\s*\{[^}]*\}/)?.[0] ?? '';
    expect(baseRule).not.toMatch(/position:\s*absolute/);
  });

  test('#mainNav has --surface-primary background', () => {
    const baseRule = css.match(/#mainNav\s*\{[^}]*\}/)?.[0] ?? '';
    expect(baseRule).toMatch(/background-color:\s*var\(--surface-primary/);
  });

  test('#mainNav does not contain .is-fixed rules', () => {
    expect(css).not.toMatch(/#mainNav\.is-fixed/);
  });

  test('#mainNav does not contain .is-visible rules', () => {
    expect(css).not.toMatch(/#mainNav\.is-visible/);
  });

  test('desktop nav link color uses --text-primary (not --text-on-dark)', () => {
    // Find the desktop media query section for #mainNav nav links
    // The nav-link color should reference --text-primary, not --text-on-dark
    const desktopNavLinkPattern = /@media\s*\(\s*min-width:\s*992px\s*\)[^]*?#mainNav\s+\.navbar-nav[^}]*color:\s*var\(--text-primary/;
    expect(css).toMatch(desktopNavLinkPattern);
  });

  test('masthead padding-top does not include 57px compensation', () => {
    expect(css).not.toMatch(/header\.masthead\s*\{[^}]*\+\s*57px/);
  });
});

// ==============================
// Section 2: JavaScript File Content Tests
// ==============================

test.describe('Site Header — JavaScript', () => {
  const jsPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/wwwroot/assets/js/scripts.js'
  );
  let js: string;

  test.beforeAll(() => {
    js = readFileSync(jsPath, 'utf-8');
  });

  test('scripts.js does not contain is-fixed class manipulation', () => {
    expect(js).not.toContain('is-fixed');
  });

  test('scripts.js does not contain is-visible class manipulation', () => {
    expect(js).not.toContain('is-visible');
  });

  test('scripts.js retains section-reveal IntersectionObserver', () => {
    expect(js).toContain('reveal-on-scroll');
    expect(js).toContain('IntersectionObserver');
  });
});

// ==============================
// Section 3: Browser E2E Tests
// ==============================

let homeDocId: string;
let homeDocUrl: string;

test.describe('Site Header — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const token = await freshToken();

    // Find Home page dynamically (rule #1: never hardcode UUIDs)
    const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
    if (!rootResp.ok) throw new Error(`GET doc tree root failed: ${rootResp.status}`);
    const rootData = (await rootResp.json()) as any;

    const homeItem = (rootData.items ?? []).find(
      (item: any) => (item.variants?.[0]?.name ?? '').toLowerCase() === 'home'
    );
    if (!homeItem) throw new Error('Home page not found in document tree root');
    homeDocId = homeItem.id;

    // Get published URL (rule #2: never hardcode URL slugs)
    homeDocUrl = await getDocumentPath(token, homeDocId);
  });

  test('desktop (1200x800): header background is --surface-primary', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const nav = page.locator('#mainNav');
    await expect(nav).toBeVisible();
    const bg = await nav.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 252, 249)');
  });

  test('desktop (1200x800): header has bottom border', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const nav = page.locator('#mainNav');
    const border = await nav.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return `${style.borderBottomWidth} ${style.borderBottomStyle}`;
    });
    expect(border).toMatch(/1px solid/);
  });

  test('desktop (1200x800): nav link text color is --text-primary', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const navLink = page.locator('#mainNav .nav-link').first();
    await expect(navLink).toBeVisible();
    const color = await navLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    expect(color).toBe('rgb(28, 25, 23)');
  });

  test('desktop (1200x800): header position is sticky', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const nav = page.locator('#mainNav');
    const position = await nav.evaluate((el) =>
      window.getComputedStyle(el).position
    );
    expect(position).toBe('sticky');
  });

  test('desktop (1200x800): masthead top is at or below header bottom (no overlap)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const nav = page.locator('#mainNav');
    const masthead = page.locator('header.masthead');

    const navBox = await nav.boundingBox();
    const mastheadBox = await masthead.boundingBox();
    expect(navBox).toBeTruthy();
    expect(mastheadBox).toBeTruthy();

    // Masthead top should be at or below the nav bottom (tolerance of 1px)
    expect(mastheadBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height - 1);
  });

  test('desktop (1200x800): header remains visible after scrolling 500px', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);

    // Scroll down 500px
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300); // wait for any transitions to settle

    const nav = page.locator('#mainNav');
    const box = await nav.boundingBox();
    expect(box).toBeTruthy();
    // Sticky header should be at the top of the viewport (y ~ 0)
    expect(box!.y).toBeLessThanOrEqual(2);

    // Background should still be white (no flash to transparent)
    const bg = await nav.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 252, 249)');
  });

  test('desktop (1200x800): no opacity transition on scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    const nav = page.locator('#mainNav');
    const opacity = await nav.evaluate((el) =>
      window.getComputedStyle(el).opacity
    );
    expect(opacity).toBe('1');

    // Should not have scroll-triggered classes
    const hasFixed = await nav.evaluate((el) => el.classList.contains('is-fixed'));
    const hasVisible = await nav.evaluate((el) => el.classList.contains('is-visible'));
    expect(hasFixed).toBe(false);
    expect(hasVisible).toBe(false);
  });

  test('mobile (390x844): header background is --surface-primary', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(homeDocUrl);
    const nav = page.locator('#mainNav');
    await expect(nav).toBeVisible();
    const bg = await nav.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 252, 249)');
  });

  test('mobile (390x844): nav toggler is visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(homeDocUrl);
    const toggler = page.locator('#mainNav .navbar-toggler');
    await expect(toggler).toBeVisible();
  });

  test('mobile (390x844): header position is sticky', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(homeDocUrl);
    const nav = page.locator('#mainNav');
    const position = await nav.evaluate((el) =>
      window.getComputedStyle(el).position
    );
    expect(position).toBe('sticky');
  });
});

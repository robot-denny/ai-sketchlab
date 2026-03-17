import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { readFileSync, existsSync } from 'fs';
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

/**
 * Find a composition document type by name using direct API calls.
 * Uses freshToken()/apiFetch() instead of umbracoApi fixture to avoid
 * PKCE cookie auth issues with client credentials auth setup.
 * (Rule #1: never hardcode UUIDs; Rule #7: resilient lookups)
 */
async function findCompositionByName(name: string) {
  const token = await freshToken();
  // Get doc type tree root to find Compositions folder
  const rootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
  if (!rootResp.ok) return false;
  const rootData = (await rootResp.json()) as any;
  const compositionsFolder = (rootData.items ?? []).find((r: any) => r.name === 'Compositions');
  if (!compositionsFolder) return false;

  // Get children of Compositions folder
  const childResp = await apiFetch(token, 'GET', `/tree/document-type/children?parentId=${compositionsFolder.id}&skip=0&take=100`);
  if (!childResp.ok) return false;
  const childData = (await childResp.json()) as any;
  const match = (childData.items ?? []).find((c: any) => c.name === name);
  if (!match) return false;

  // Get full document type details
  const dtResp = await apiFetch(token, 'GET', `/document-type/${match.id}`);
  if (!dtResp.ok) return false;
  return await dtResp.json();
}

// ==============================
// Section 1: Document Type Properties
// ==============================

test.describe('Updated Footer — Document Type Properties', () => {
  const compositionName = 'Footer Controls';
  let docType: any;

  test.beforeAll(async () => {
    docType = await findCompositionByName(compositionName);
  });

  test('footerLogo property exists on Footer Controls composition (media picker)', async () => {
    expect(docType, `"${compositionName}" composition should exist`).toBeTruthy();
    const aliases = (docType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'Should have a "footerLogo" property').toContain('footerLogo');
  });

  test('footerDescription property exists on Footer Controls composition (rich text)', async () => {
    expect(docType, `"${compositionName}" composition should exist`).toBeTruthy();
    const aliases = (docType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'Should have a "footerDescription" property').toContain('footerDescription');
  });

  test('footerNavigation property exists on Footer Controls composition (multi-url picker)', async () => {
    expect(docType, `"${compositionName}" composition should exist`).toBeTruthy();
    const aliases = (docType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'Should have a "footerNavigation" property').toContain('footerNavigation');
  });
});

// ==============================
// Section 2: Partial View File Content
// ==============================

test.describe('Updated Footer — Partial View', () => {
  const partialPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/Views/Partials/footer.cshtml'
  );

  test('footer.cshtml exists', () => {
    expect(existsSync(partialPath)).toBe(true);
  });

  test('references FooterLogo, FooterDescription, FooterNavigation model properties', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toContain('FooterLogo');
    expect(content).toContain('FooterDescription');
    expect(content).toContain('FooterNavigation');
  });

  test('contains null checks for logo and navigation', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toMatch(/FooterLogo\s*!=\s*null/);
    expect(content).toMatch(/\.Any\(\)/);
  });
});

// ==============================
// Section 3: CSS File Content
// ==============================

test.describe('Updated Footer — CSS', () => {
  const cssPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/wwwroot/assets/css/styles.css'
  );

  test('styles.css contains .site-footer class', () => {
    const content = readFileSync(cssPath, 'utf-8');
    expect(content).toMatch(/\.site-footer\s*\{/);
  });

  test('contains .footer-nav with Oxanium font reference', () => {
    const content = readFileSync(cssPath, 'utf-8');
    expect(content).toMatch(/\.footer-nav/);
    expect(content).toMatch(/Oxanium/);
  });
});

// ==============================
// Section 4: Browser E2E Tests
// ==============================

let homeDocId: string;
let homeDocUrl: string;

test.describe('Updated Footer — Browser E2E', () => {
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

  test('logo image is visible in footer (desktop 1200x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const footer = page.locator('footer.site-footer');
    await expect(footer).toBeVisible();
    const logo = footer.locator('.footer-brand img');
    await expect(logo).toBeVisible();
  });

  test('body text is visible in footer', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const description = page.locator('footer.site-footer .footer-description');
    await expect(description).toBeVisible();
    const text = await description.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });

  test('footer nav links are present with valid href attributes', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const navLinks = page.locator('footer.site-footer .footer-nav a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      expect(href, `Nav link ${i} should have an href`).toBeTruthy();
    }
  });

  test('desktop: nav element x offset > logo element x offset', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const brand = page.locator('footer.site-footer .footer-brand');
    const nav = page.locator('footer.site-footer nav');
    const brandBox = await brand.boundingBox();
    const navBox = await nav.boundingBox();
    expect(brandBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    expect(navBox!.x).toBeGreaterThan(brandBox!.x);
  });

  test('narrow (390x844): nav element y < logo element y (menu above logo)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(homeDocUrl);
    const brand = page.locator('footer.site-footer .footer-brand');
    const nav = page.locator('footer.site-footer nav');
    const brandBox = await brand.boundingBox();
    const navBox = await nav.boundingBox();
    expect(brandBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    expect(navBox!.y).toBeLessThan(brandBox!.y);
  });

  test('top border is 6px solid rgb(0, 0, 0)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const footer = page.locator('footer.site-footer');
    const borderTop = await footer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`;
    });
    expect(borderTop).toBe('6px solid rgb(0, 0, 0)');
  });

  test('background is white', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const footer = page.locator('footer.site-footer');
    const bg = await footer.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 255, 255)');
  });

  test('nav labels are uppercase (computed text-transform)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const navLink = page.locator('footer.site-footer .footer-nav a').first();
    await expect(navLink).toBeVisible();
    const transform = await navLink.evaluate((el) =>
      window.getComputedStyle(el).textTransform
    );
    expect(transform).toBe('uppercase');
  });
});

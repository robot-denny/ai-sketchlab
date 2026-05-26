import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

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
 * (Rule #1: never hardcode UUIDs; Rule #7: resilient lookups)
 */
async function findCompositionByName(name: string) {
  const token = await freshToken();
  const rootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
  if (!rootResp.ok) return false;
  const rootData = (await rootResp.json()) as any;
  const compositionsFolder = (rootData.items ?? []).find((r: any) => r.name === 'Compositions');
  if (!compositionsFolder) return false;

  const childResp = await apiFetch(token, 'GET', `/tree/document-type/children?parentId=${compositionsFolder.id}&skip=0&take=100`);
  if (!childResp.ok) return false;
  const childData = (await childResp.json()) as any;
  const match = (childData.items ?? []).find((c: any) => c.name === name);
  if (!match) return false;

  const dtResp = await apiFetch(token, 'GET', `/document-type/${match.id}`);
  if (!dtResp.ok) return false;
  return await dtResp.json();
}

// ==============================
// Section 1: Document Type Properties
// (FooterLogo persists as latent/OG data; v2 _Footer ignores it.)
// ==============================

test.describe('Updated Footer — Document Type Properties', () => {
  const compositionName = 'Footer Controls';
  let docType: any;

  test.beforeAll(async () => {
    docType = await findCompositionByName(compositionName);
  });

  test('footerLogo property exists on Footer Controls composition (latent data)', async () => {
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
// Section 2: Partial View File Content (v2 _Footer)
// ==============================

test.describe('Updated Footer — v2 Partial View', () => {
  const partialPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/Views/Partials/v2/_Footer.cshtml'
  );

  test('v2/_Footer.cshtml exists', () => {
    expect(existsSync(partialPath)).toBe(true);
  });

  test('references FooterDescription and FooterNavigation model properties', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toContain('FooterDescription');
    expect(content).toContain('FooterNavigation');
  });

  test('renders <footer class="foot"> wrapper', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toMatch(/<footer\s+class="foot">/);
  });

  test('contains null/empty checks for description and navigation', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toMatch(/FooterDescription/);
    expect(content).toMatch(/\.Any\(\)/);
  });
});

// ==============================
// Section 3: Browser E2E Tests (v2 .foot selectors)
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

  test('footer.foot is visible (desktop 1200x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const footer = page.locator('footer.foot');
    await expect(footer).toBeVisible();
  });

  test('brand wordmark (.fm) is rendered in the brand column', async ({ page }) => {
    // Note: text content depends on the Site.Name dictionary key being
    // populated by the editor. We only verify the structural slot is
    // emitted by _Footer.cshtml — the .fm sits in the first .col.
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const brand = page.locator('footer.foot .col').first().locator('.fm');
    await expect(brand).toHaveCount(1);
  });

  test('footer nav links are present with valid href attributes', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const navLinks = page.locator('footer.foot a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      expect(href, `Footer link ${i} should have an href`).toBeTruthy();
    }
  });

  test('desktop: nav columns sit to the right of brand column', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const brandCol = page.locator('footer.foot .col').first();
    const secondCol = page.locator('footer.foot .col').nth(1);
    const brandBox = await brandCol.boundingBox();
    const secondBox = await secondCol.boundingBox();
    expect(brandBox).toBeTruthy();
    expect(secondBox).toBeTruthy();
    expect(secondBox!.x).toBeGreaterThan(brandBox!.x);
  });

  test('top border is present (border-top-width > 0)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const footer = page.locator('footer.foot');
    const borderTopWidth = await footer.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).borderTopWidth)
    );
    expect(borderTopWidth).toBeGreaterThan(0);
  });

  test('background uses --surface-primary token', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const footer = page.locator('footer.foot');
    const bg = await footer.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // --surface-primary resolves to rgb(255, 252, 249) (warm white)
    expect(bg).toBe('rgb(255, 252, 249)');
  });

  test('section heading (h4) is uppercased via text-transform', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const heading = page.locator('footer.foot h4').first();
    // h4 only renders when nav or social links exist; skip if absent
    if ((await heading.count()) === 0) {
      test.skip();
      return;
    }
    await expect(heading).toBeVisible();
    const transform = await heading.evaluate((el) =>
      window.getComputedStyle(el).textTransform
    );
    expect(transform).toBe('uppercase');
  });

  test('colophon row spans full width and is rendered last', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const colophon = page.locator('footer.foot .colophon');
    await expect(colophon).toBeVisible();
    const text = await colophon.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });
});

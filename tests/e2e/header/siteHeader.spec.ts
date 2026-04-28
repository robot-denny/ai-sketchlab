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

/** Find the Article document-type id (rule #1: never hardcode UUIDs). */
async function findArticleDocTypeId(token: string): Promise<string> {
  const dtRootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
  if (!dtRootResp.ok) throw new Error(`GET doc type tree root failed: ${dtRootResp.status}`);
  const dtRoot = (await dtRootResp.json()) as any;

  const pages = (dtRoot.items ?? []).find((d: any) => d.name === 'Pages');
  if (!pages) throw new Error('"Pages" doc type folder not found');

  const pagesChildrenResp = await apiFetch(
    token,
    'GET',
    `/tree/document-type/children?parentId=${pages.id}&skip=0&take=100`
  );
  if (!pagesChildrenResp.ok)
    throw new Error(`GET Pages children failed: ${pagesChildrenResp.status}`);
  const pagesChildren = (await pagesChildrenResp.json()) as any;

  const articleDt = (pagesChildren.items ?? []).find((d: any) => d.name === 'Article');
  if (!articleDt) throw new Error('"Article" document type not found under Pages');
  return articleDt.id;
}

/** Walk the doc tree under homeId to find a published Article page; return its URL. */
async function findFirstArticleUrl(
  token: string,
  homeId: string,
  articleDtId: string
): Promise<string> {
  const queue: string[] = [homeId];
  const visited = new Set<string>();
  while (queue.length) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);
    const resp = await apiFetch(
      token,
      'GET',
      `/tree/document/children?parentId=${parentId}&skip=0&take=100`
    );
    if (!resp.ok) continue;
    const data = (await resp.json()) as any;
    for (const item of data.items ?? []) {
      if (item.documentType?.id === articleDtId) {
        return await getDocumentPath(token, item.id);
      }
      if (item.hasChildren) queue.push(item.id);
    }
  }
  throw new Error('No Article page found in the document tree under Home');
}

// ==============================
// Section 1: CSS File Content (v2 .site-head in site-chrome.css)
// ==============================

test.describe('Site Header — CSS Structure', () => {
  const cssPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/wwwroot/assets/css/site-chrome.css'
  );
  let css: string;

  test.beforeAll(() => {
    css = readFileSync(cssPath, 'utf-8');
  });

  test('.site-head uses position: sticky', () => {
    expect(css).toMatch(/\.site-head\s*\{[^}]*position:\s*sticky/);
  });

  test('.site-head uses --surface-primary background', () => {
    expect(css).toMatch(/\.site-head\s*\{[^}]*background:\s*var\(--surface-primary/);
  });

  test('.site-head has no scroll-toggled visibility classes', () => {
    expect(css).not.toMatch(/\.site-head\.is-fixed/);
    expect(css).not.toMatch(/\.site-head\.is-visible/);
  });

  test('.site-head .site-nav links use --text-primary', () => {
    expect(css).toMatch(/\.site-head\s+\.site-nav\s+a\s*\{[^}]*color:\s*var\(--text-primary/);
  });
});

// ==============================
// Section 2: JavaScript File Content
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
// Section 3: Browser E2E Tests (.site-head)
// ==============================

let homeDocId: string;
let homeDocUrl: string;
let articleDocUrl: string;

test.describe('Site Header — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const token = await freshToken();

    const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
    if (!rootResp.ok) throw new Error(`GET doc tree root failed: ${rootResp.status}`);
    const rootData = (await rootResp.json()) as any;

    const homeItem = (rootData.items ?? []).find(
      (item: any) => (item.variants?.[0]?.name ?? '').toLowerCase() === 'home'
    );
    if (!homeItem) throw new Error('Home page not found in document tree root');
    homeDocId = homeItem.id;

    homeDocUrl = await getDocumentPath(token, homeDocId);

    const articleDtId = await findArticleDocTypeId(token);
    articleDocUrl = await findFirstArticleUrl(token, homeDocId, articleDtId);
  });

  test('desktop (1200x800): header background is --surface-primary', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const head = page.locator('.site-head');
    await expect(head).toBeVisible();
    const bg = await head.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 252, 249)');
  });

  test('desktop (1200x800): header has bottom border', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const head = page.locator('.site-head');
    const border = await head.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return `${style.borderBottomWidth} ${style.borderBottomStyle}`;
    });
    expect(border).toMatch(/1px solid/);
  });

  test('desktop (1200x800): nav link text color is --text-primary', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const navLink = page.locator('.site-head .site-nav a').first();
    await expect(navLink).toBeVisible();
    const color = await navLink.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    expect(color).toBe('rgb(28, 25, 23)');
  });

  test('desktop (1200x800): header position is sticky', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);
    const head = page.locator('.site-head');
    const position = await head.evaluate((el) =>
      window.getComputedStyle(el).position
    );
    expect(position).toBe('sticky');
  });

  test('desktop (1200x800): article head top is at or below site head bottom (no overlap)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(articleDocUrl);
    const siteHead = page.locator('.site-head');
    const artHead = page.locator('.art-head');

    const siteHeadBox = await siteHead.boundingBox();
    const artHeadBox = await artHead.boundingBox();
    expect(siteHeadBox).toBeTruthy();
    expect(artHeadBox).toBeTruthy();

    expect(artHeadBox!.y).toBeGreaterThanOrEqual(siteHeadBox!.y + siteHeadBox!.height - 1);
  });

  test('desktop (1200x800): header remains visible after scrolling 500px', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    const head = page.locator('.site-head');
    const box = await head.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeLessThanOrEqual(2);

    const bg = await head.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 252, 249)');
  });

  test('desktop (1200x800): no opacity transition on scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(homeDocUrl);

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    const head = page.locator('.site-head');
    const opacity = await head.evaluate((el) =>
      window.getComputedStyle(el).opacity
    );
    expect(opacity).toBe('1');

    const hasFixed = await head.evaluate((el) => el.classList.contains('is-fixed'));
    const hasVisible = await head.evaluate((el) => el.classList.contains('is-visible'));
    expect(hasFixed).toBe(false);
    expect(hasVisible).toBe(false);
  });

  test('mobile (390x844): header background is --surface-primary', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(homeDocUrl);
    const head = page.locator('.site-head');
    await expect(head).toBeVisible();
    const bg = await head.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(255, 252, 249)');
  });

  test('mobile (390x844): nav links remain visible (no toggle in v2 chrome)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(homeDocUrl);
    const navLink = page.locator('.site-head .site-nav a').first();
    await expect(navLink).toBeVisible();
  });

  test('mobile (390x844): header position is sticky', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(homeDocUrl);
    const head = page.locator('.site-head');
    const position = await head.evaluate((el) =>
      window.getComputedStyle(el).position
    );
    expect(position).toBe('sticky');
  });
});

import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { getDocumentTypeByName, getTemplate } from './_umbracoApi';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.URL || 'https://localhost:44367';

// Re-acquire token before each logical operation group (Rule #4).
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

/**
 * Resolve a doc-type id by name via a recursive Management-API tree walk.
 *
 * The testhelpers' `documentType.getByName(...)` uses a `recurseChildren` impl
 * that short-circuits on the first folder with `hasChildren:true`, missing
 * sibling entries — same workaround documented in the imageCarousel spec.
 */
async function findDocTypeIdByName(token: string, name: string): Promise<string | null> {
  async function walk(parentId: string | null): Promise<string | null> {
    const path = parentId
      ? `/tree/document-type/children?parentId=${parentId}&skip=0&take=100`
      : `/tree/document-type/root?skip=0&take=100`;
    const resp = await apiFetch(token, 'GET', path);
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    for (const item of data.items ?? []) {
      if (!item.isFolder && item.name === name) return item.id as string;
      if (item.isFolder) {
        const nested = await walk(item.id);
        if (nested) return nested;
      }
    }
    return null;
  }
  return walk(null);
}

/**
 * Find the published Style Guide document at the site root and return its
 * canonical URL. Walks the document tree dynamically (Rule #1: never hardcode
 * UUIDs; Rule #2: never hardcode URL slugs).
 */
async function getStyleGuideUrl(): Promise<string | null> {
  const token = await freshToken();

  const aliasCache = new Map<string, string>();
  const aliasFor = async (docTypeId: string): Promise<string | null> => {
    if (aliasCache.has(docTypeId)) return aliasCache.get(docTypeId)!;
    const resp = await apiFetch(token, 'GET', `/document-type/${docTypeId}`);
    if (!resp.ok) return null;
    const dt = (await resp.json()) as any;
    if (typeof dt?.alias === 'string') {
      aliasCache.set(docTypeId, dt.alias);
      return dt.alias;
    }
    return null;
  };

  const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
  if (!rootResp.ok) return null;
  const rootData = (await rootResp.json()) as any;

  for (const item of rootData.items ?? []) {
    const childrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document/children?parentId=${item.id}&skip=0&take=100`
    );
    if (!childrenResp.ok) continue;
    const childrenData = (await childrenResp.json()) as any;
    for (const child of childrenData.items ?? []) {
      const dtId = child.documentType?.id;
      if (!dtId) continue;
      const alias = await aliasFor(dtId);
      if (alias !== 'styleGuidePage') continue;
      const urlsResp = await apiFetch(token, 'GET', `/document/urls?id=${child.id}`);
      if (!urlsResp.ok) continue;
      const urls = (await urlsResp.json()) as any[];
      const url = urls?.[0]?.urlInfos?.[0]?.url;
      if (url) return url;
    }
  }
  return null;
}

// ==============================
// Section 1 — Schema tests
// ==============================

test.describe('Style Guide Page — Document Type', () => {
  test('Style Guide Page composition set: SectionRowControls in, FooterControls out', async () => {
    const docType = await getDocumentTypeByName('Style Guide Page');
    expect(docType, '"Style Guide Page" should exist').toBeTruthy();
    expect(docType.alias).toBe('styleGuidePage');
    expect(docType.allowedAsRoot).toBe(true);

    const templateIds: string[] = (docType.allowedTemplates ?? []).map(
      (t: any) => t.id
    );
    expect(templateIds.length, 'at least one allowed template').toBeGreaterThan(0);
    const templateAliases = await Promise.all(
      templateIds.map(async (id) => {
        const tmpl = await getTemplate(id);
        return tmpl?.alias;
      })
    );
    expect(templateAliases).toContain('styleGuidePage');

    const aliases = (docType.properties ?? []).map((p: any) => p.alias);
    expect(aliases).toContain('brandSummary');

    const token = await freshToken();
    const visibilityControlsId = await findDocTypeIdByName(token, 'Visibility Controls');
    const sectionRowControlsId = await findDocTypeIdByName(token, 'Section Row Controls');
    const footerControlsId = await findDocTypeIdByName(token, 'Footer Controls');
    expect(visibilityControlsId, '"Visibility Controls" should exist').toBeTruthy();
    expect(sectionRowControlsId, '"Section Row Controls" should exist').toBeTruthy();

    const compositionIds: string[] = (docType.compositions ?? []).map(
      (c: any) => c.documentType?.id
    );
    expect(compositionIds, 'must include Visibility Controls').toContain(
      visibilityControlsId!
    );
    expect(compositionIds, 'must include Section Row Controls').toContain(
      sectionRowControlsId!
    );
    if (footerControlsId) {
      expect(compositionIds, 'must NOT include Footer Controls').not.toContain(
        footerControlsId
      );
    }
  });

  test('brandSummary lives in a property group whose name is "Content"', async () => {
    const docType = await getDocumentTypeByName('Style Guide Page');
    const prop = (docType.properties ?? []).find((p: any) => p.alias === 'brandSummary');
    expect(prop, 'brandSummary property must exist').toBeTruthy();
    const containerId = prop.container?.id;
    expect(containerId, 'brandSummary must have a container').toBeTruthy();
    const container = (docType.containers ?? []).find((c: any) => c.id === containerId);
    expect(container?.name).toBe('Content');
  });

  test('Three programmatic block element types exist with heading + intro', async () => {
    for (const name of [
      'Color Palette Block',
      'Typography Showcase Block',
      'General Elements Block',
    ]) {
      const dt = await getDocumentTypeByName(name);
      expect(dt, `"${name}" element type should exist`).toBeTruthy();
      expect(dt.isElement, `"${name}" must be an element type`).toBe(true);
      const aliases = (dt.properties ?? []).map((p: any) => p.alias);
      expect(aliases, `"${name}" must include heading`).toContain('heading');
      expect(aliases, `"${name}" must include intro`).toContain('intro');
    }
  });
});

// ==============================
// Section 2 — Page presence
// ==============================

test.describe('Style Guide — Page presence', () => {
  let styleguideUrl: string;

  test.beforeAll(async () => {
    const url = await getStyleGuideUrl();
    expect(url, 'Style Guide page must be published').toBeTruthy();
    styleguideUrl = url!;
  });

  test('Styleguide page is reachable and hidden from top navigation', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.site-nav').getByRole('link', { name: /style ?guide/i })
    ).toHaveCount(0);

    const res = await page.goto(styleguideUrl);
    expect(res?.status()).toBe(200);
  });
});

// ==============================
// Section 3 — Color palette (browser)
// Selectors are emitted by the colorPaletteBlock partial.
// ==============================

test.describe('Style Guide — Color palette block', () => {
  let styleguideUrl: string;

  test.beforeAll(async () => {
    const url = await getStyleGuideUrl();
    expect(url, 'Style Guide page must be published before running palette tests').toBeTruthy();
    styleguideUrl = url!;
  });

  test('Color palette renders one swatch per @umb_swatch annotation with token / value / role', async ({
    page,
  }) => {
    await page.goto(styleguideUrl);

    const swatches = page.locator('[data-styleguide="swatch"]');
    await expect(swatches).not.toHaveCount(0);

    const accent = page.locator('[data-styleguide-token="--accent-primary"]');
    await expect(accent).toBeVisible();
    await expect(accent.locator('[data-styleguide="value"]')).toHaveText(/#C23D2E/i);
    await expect(accent.locator('[data-styleguide="role"]')).toHaveText('Primary action / signal red');

    await expect(page.locator('[data-styleguide-token="--space-md"]')).toHaveCount(0);
  });
});

// ==============================
// Section 4 — Block-driven page layout (browser)
// ==============================

test.describe('Style Guide — Block-driven layout', () => {
  let styleguideUrl: string;

  test.beforeAll(async () => {
    const url = await getStyleGuideUrl();
    expect(url, 'Style Guide page must be published before running layout tests').toBeTruthy();
    styleguideUrl = url!;
  });

  test('Brand summary renders at the top, before the section rows', async ({ page }) => {
    await page.goto(styleguideUrl);
    const brandSummary = page.locator('.styleguide__brand-summary');
    await expect(brandSummary).toBeVisible();

    // Brand summary must precede the first section row in DOM order.
    const positions = await page.evaluate(() => {
      const summary = document.querySelector('.styleguide__brand-summary');
      const firstRow = document.querySelector('.section-row');
      if (!summary || !firstRow) return null;
      const summaryRect = summary.getBoundingClientRect();
      const rowRect = firstRow.getBoundingClientRect();
      return { summaryTop: summaryRect.top, rowTop: rowRect.top };
    });
    expect(positions, 'both elements should be present').not.toBeNull();
    expect(positions!.summaryTop).toBeLessThan(positions!.rowTop);
  });

  test('Each programmatic block renders its editable heading', async ({ page }) => {
    await page.goto(styleguideUrl);
    for (const alias of [
      'colorPaletteBlock',
      'typographyShowcaseBlock',
      'generalElementsBlock',
    ]) {
      const block = page.locator(`[data-block-alias="${alias}"]`);
      await expect(block, `${alias} must render`).toBeVisible();
      // Heading text comes from the editor — we just assert there's some non-empty
      // heading element inside the block.
      const heading = block.locator('h1, h2, h3, h4, h5, h6').first();
      await expect(heading).toBeVisible();
      await expect(heading).not.toHaveText('');
    }
  });

  test('Typography block shows h1–h6 plus the five editor classes', async ({ page }) => {
    await page.goto(styleguideUrl);
    const block = page.locator('[data-block-alias="typographyShowcaseBlock"]');
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      await expect(block.locator(tag).first()).toBeVisible();
    }
    for (const cls of ['lead', 'overline', 'blockquote', 'caption', 'pull-quote']) {
      await expect(block.locator(`.${cls}`).first()).toBeVisible();
    }
  });

  test('General elements block includes link, button, lists, table, inputs', async ({
    page,
  }) => {
    await page.goto(styleguideUrl);
    const block = page.locator('[data-block-alias="generalElementsBlock"]');
    for (const sel of [
      'a',
      'button',
      'ul',
      'ol',
      'table',
      'input[type="text"]',
      'input[type="email"]',
      'textarea',
    ]) {
      await expect(block.locator(sel).first()).toBeVisible();
    }
  });

  test('Components-reference section links to the components page', async ({ page }) => {
    await page.goto(styleguideUrl);
    const link = page.locator('a[href*="/styleguide/components"]');
    await expect(link.first()).toBeVisible();
  });
});

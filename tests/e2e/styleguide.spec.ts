import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
 * sibling entries — the same workaround documented in the imageCarousel spec.
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
 *
 * The tree API returns each node's `documentType.id` but not its alias, so
 * resolve aliases via a per-id `/document-type/{id}` lookup, memoised across
 * the walk.
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
  test('Style Guide Page document type exists with brandSummary + visibility controls', async ({
    umbracoApi,
  }) => {
    const docType = await umbracoApi.documentType.getByName('Style Guide Page');
    expect(docType, '"Style Guide Page" should exist').toBeTruthy();
    expect(docType.alias).toBe('styleGuidePage');
    expect(docType.allowedAsRoot).toBe(true);

    // The doc-type API returns template references as { id } only, so resolve
    // each allowed template's alias via a follow-up fetch.
    const templateIds: string[] = (docType.allowedTemplates ?? []).map(
      (t: any) => t.id
    );
    expect(templateIds.length, 'at least one allowed template').toBeGreaterThan(0);
    const templateAliases = await Promise.all(
      templateIds.map(async (id) => {
        const tmpl = await umbracoApi.template.get(id);
        return tmpl?.alias;
      })
    );
    expect(templateAliases).toContain('styleGuidePage');

    const aliases = (docType.properties ?? []).map((p: any) => p.alias);
    expect(aliases).toContain('brandSummary');

    // Visibility Controls composition provides hideFromTopNavigation,
    // hideFromXMLSitemap, umbracoNaviHide. The doc-type API does not expand
    // inherited properties into `properties`, so verify the composition by id —
    // resolved via a Management-API tree walk so the test stays portable across
    // environments (and works around testhelpers' getByName short-circuit).
    const token = await freshToken();
    const visibilityControlsId = await findDocTypeIdByName(token, 'Visibility Controls');
    expect(visibilityControlsId, '"Visibility Controls" composition should exist').toBeTruthy();
    const compositionIds: string[] = (docType.compositions ?? []).map(
      (c: any) => c.documentType?.id
    );
    expect(compositionIds).toContain(visibilityControlsId!);
  });
});

// ==============================
// Section 2 — Page exists at /styleguide and is hidden from top nav (Step 6)
// ==============================

test.describe('Style Guide — Page presence', () => {
  let styleguideUrl: string;

  test.beforeAll(async () => {
    const url = await getStyleGuideUrl();
    expect(url, 'Style Guide page must be published').toBeTruthy();
    styleguideUrl = url!;
  });

  test('Styleguide page is reachable and hidden from top navigation', async ({ page }) => {
    // Hidden from main nav on the home page.
    await page.goto('/');
    await expect(
      page.locator('.site-nav').getByRole('link', { name: /style ?guide/i })
    ).toHaveCount(0);

    // But reachable directly via its canonical URL.
    const res = await page.goto(styleguideUrl);
    expect(res?.status()).toBe(200);
  });
});

// ==============================
// Section 3 — Color palette (browser)
// Depends on Steps 5–6 (view + published page) for the URL to render.
// ==============================

test.describe('Style Guide — Color palette', () => {
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

    // Spot-check a known token from typography.css.
    const accent = page.locator('[data-styleguide-token="--accent-primary"]');
    await expect(accent).toBeVisible();
    await expect(accent.locator('[data-styleguide="value"]')).toHaveText(/#C23D2E/i);
    await expect(accent.locator('[data-styleguide="role"]')).toHaveText('Primary action / signal red');

    // Tokens without a `/**umb_swatch:...*/` annotation must be excluded.
    await expect(page.locator('[data-styleguide-token="--space-md"]')).toHaveCount(0);
  });
});

// ==============================
// Section 4 — Page layout (browser, Step 5)
// ==============================

test.describe('Style Guide — Page layout', () => {
  let styleguideUrl: string;

  test.beforeAll(async () => {
    const url = await getStyleGuideUrl();
    expect(url, 'Style Guide page must be published before running layout tests').toBeTruthy();
    styleguideUrl = url!;
  });

  test('Five sections render in the prescribed order', async ({ page }) => {
    await page.goto(styleguideUrl);
    const ids = await page
      .locator('[data-styleguide-section]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-styleguide-section')));
    expect(ids).toEqual([
      'brand-summary',
      'color-palette',
      'typography',
      'general-elements',
      'components-reference',
    ]);
  });

  test('Typography section shows h1–h6 plus the five editor classes', async ({ page }) => {
    await page.goto(styleguideUrl);
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      await expect(page.locator(`#typography ${tag}`).first()).toBeVisible();
    }
    for (const cls of ['lead', 'overline', 'blockquote', 'caption', 'pull-quote']) {
      await expect(page.locator(`#typography .${cls}`).first()).toBeVisible();
    }
  });

  test('General elements section includes link, button, lists, table, and inputs', async ({
    page,
  }) => {
    await page.goto(styleguideUrl);
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
      await expect(page.locator(`#general-elements ${sel}`).first()).toBeVisible();
    }
  });

  test('Components-reference section links to the components page', async ({ page }) => {
    await page.goto(styleguideUrl);
    const link = page.locator('#components-reference a[href*="/styleguide/components"]');
    await expect(link).toBeVisible();
  });
});

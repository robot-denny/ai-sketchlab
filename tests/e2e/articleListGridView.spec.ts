import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==============================
// Section 1: File-content Tests
// ==============================

test.describe('Article List Grid View — Razor Template', () => {
  const razorPath = resolve(
    __dirname,
    '../../src/UmbracoProject/Views/Partials/blocklist/Components/latestArticlesRow.cshtml'
  );

  test('reads displayMode from block and branches on isGridView', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content, 'Should read displayMode property').toContain('displayMode');
    expect(content, 'Should compute isGridView flag').toContain('isGridView');
  });

  test('grid mode wraps articles in .article-grid container', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('article-grid');
  });

  test('grid mode uses Bootstrap responsive row-cols classes', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toMatch(/row-cols-1\s+row-cols-md-2\s+row-cols-lg-3/);
  });

  test('grid mode renders article-grid-card class', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('article-grid-card');
  });

  test('grid mode calls GetCropUrl for article thumbnail', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('GetCropUrl');
  });

  test('grid mode renders placeholder div for missing image', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('article-grid-card__no-image');
  });

  test('grid mode renders metaDescription as card-text', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('metaDescription');
    expect(content).toContain('card-text');
  });

  test('grid mode renders categories as badge rounded-pill', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('badge rounded-pill');
  });

  test('grid mode caps articles at 12 with .Take(12)', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('.Take(12)');
  });

  test('list mode renders post-preview elements (no regression)', () => {
    const content = readFileSync(razorPath, 'utf-8');
    expect(content).toContain('post-preview');
  });
});

// ==============================
// Section 2: CSS Tests
// ==============================

test.describe('Article List Grid View — CSS', () => {
  const cssPath = resolve(
    __dirname,
    '../../src/UmbracoProject/wwwroot/assets/css/styles.css'
  );

  test('has .article-grid-card base rule', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.article-grid-card\s*\{/);
  });

  test('has hover box-shadow for grid cards', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.article-grid-card:hover[\s\S]*?box-shadow/);
  });

  test('has .article-grid-card__no-image rule', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toMatch(/\.article-grid-card__no-image\s*\{/);
  });
});

// ==============================
// Section 3: Document Type Test
// ==============================

test.describe('Article List Grid View — Document Type', () => {
  /**
   * Workaround for a known getByName bug in @umbraco/playwright-testhelpers TreeApiHelper:
   * recurseChildren short-circuits on folders, so siblings after a folder may be missed.
   * We search the Elements folder directly instead of relying on recurseChildren. (Rule #7)
   */
  test('latestArticlesRow element type has displayMode property', async ({ umbracoApi }) => {
    const rootResp = await umbracoApi.documentType.getAllAtRoot();
    const rootData = await rootResp.json();
    const rootItems = rootData.items ?? [];

    let elementType: any = false;

    // Primary: search Elements folder
    const elementsFolder = rootItems.find((r: any) => r.name === 'Elements');
    if (elementsFolder) {
      const children = await umbracoApi.documentType.getChildren(elementsFolder.id);
      const match = children.find((c: any) => c.name === 'Latest Articles Row');
      if (match) {
        elementType = await umbracoApi.documentType.get(match.id);
      }
    }

    // Fallback: getByName (may not find everything due to the recurseChildren bug)
    if (!elementType) {
      elementType = await umbracoApi.documentType.getByName('Latest Articles Row');
    }

    expect(elementType, '"Latest Articles Row" element type should exist').toBeTruthy();
    const aliases = (elementType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'Should include displayMode property').toContain('displayMode');
  });
});

// ==============================
// Section 4: Browser E2E Tests
// ==============================

const API_BASE = process.env.URL || 'https://localhost:44367';

/**
 * Content type key for the latestArticlesRow element type (from UDA:
 * document-type__60085a63b77b45099df4bcb75db2755f.uda).
 * This is a stable schema identifier, not a dynamic content UUID — safe to reference directly.
 */
const LAR_CONTENT_TYPE_KEY = '60085a63-b77b-4509-9df4-bcb75db2755f';

let _token: string;
let _tokenTimestamp = 0;
const TOKEN_TTL = 250_000; // refresh well before the 299s expiry

/** Get a fresh API token, reusing cached one if still valid (rule #4) */
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
  if (!resp.ok) throw new Error(`GET document URLs failed for ${docId}: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

/**
 * Find the latestArticlesRow block within the contentRows block list value.
 * Returns the block list value and the index of the matching block.
 */
function findLatestArticlesRowBlock(
  values: any[]
): { blockListValue: any; blockIndex: number } | null {
  const contentRowsEntry = values.find((v: any) => v.alias === 'contentRows');
  if (!contentRowsEntry?.value) return null;

  const blockList = contentRowsEntry.value;
  if (!blockList.contentData) return null;

  const blockIndex = (blockList.contentData as any[]).findIndex(
    (b: any) => b.contentTypeKey === LAR_CONTENT_TYPE_KEY
  );
  if (blockIndex === -1) return null;

  return { blockListValue: blockList, blockIndex };
}

/**
 * Return a new block list value with the latestArticlesRow block's displayMode updated.
 * Adds the value entry if it doesn't already exist.
 */
function setDisplayModeInBlockList(
  blockListValue: any,
  blockIndex: number,
  mode: string
): any {
  const updatedData = [...(blockListValue.contentData as any[])];
  const block = { ...updatedData[blockIndex] };
  const existingValues: any[] = block.values ?? [];

  const hasDm = existingValues.some((v: any) => v.alias === 'displayMode');
  // Umbraco.DropDown.Flexible stores values as arrays even with multiple:false.
  // We must send ["grid"] not "grid" — otherwise Value<string>() returns null.
  block.values = hasDm
    ? existingValues.map((v: any) =>
        v.alias === 'displayMode' ? { ...v, value: [mode] } : v
      )
    : [
        ...existingValues,
        { alias: 'displayMode', culture: null, segment: null, value: [mode] },
      ];

  updatedData[blockIndex] = block;
  return { ...blockListValue, contentData: updatedData };
}

// Module-level state shared across all browser E2E tests (rule #1: dynamic lookups)
let articleListId: string;
let articleListUrl: string;
let articleListDocValues: any[];
let articleListDocTemplate: any;
let articleListDocVariants: any[];
let originalContentRowsValue: any; // deep copy for restoration
let larBlockIndex: number;
let articleDocTypeId: string;
let articleTemplateId: string | undefined;
let firstAuthorId: string | undefined;
const createdArticleIds: string[] = [];

/**
 * Update the latestArticlesRow block's displayMode on the article list page and publish.
 * Updates the module-level articleListDocValues so subsequent helpers see the latest state.
 */
async function updateDisplayMode(token: string, mode: string): Promise<void> {
  const found = findLatestArticlesRowBlock(articleListDocValues);
  if (!found) throw new Error('latestArticlesRow block not found in contentRows');

  const updatedBlockList = setDisplayModeInBlockList(found.blockListValue, larBlockIndex, mode);
  const updatedValues = articleListDocValues.map((v: any) =>
    v.alias === 'contentRows' ? { ...v, value: updatedBlockList } : v
  );

  const putResp = await apiFetch(token, 'PUT', `/document/${articleListId}`, {
    template: articleListDocTemplate,
    values: updatedValues,
    variants: articleListDocVariants,
  });
  if (!putResp.ok) {
    const text = await putResp.text();
    throw new Error(
      `Update displayMode="${mode}" on article list failed: ${putResp.status} - ${text}`
    );
  }

  // Update module-level copy so next call uses latest values
  articleListDocValues = updatedValues;

  const pubResp = await apiFetch(token, 'PUT', `/document/${articleListId}/publish`, {
    publishSchedules: [{ culture: null }],
  });
  if (!pubResp.ok) {
    const text = await pubResp.text();
    throw new Error(`Publish article list failed: ${pubResp.status} - ${text}`);
  }
}

test.describe('Article List Grid View — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    let token = await freshToken();

    // 1. Dynamically look up the "Article List" and "Article" document type IDs (rule #1)
    const dtRootResp = await apiFetch(
      token,
      'GET',
      '/tree/document-type/root?skip=0&take=100'
    );
    if (!dtRootResp.ok)
      throw new Error(`GET doc type tree root failed: ${dtRootResp.status}`);
    const dtRootData = (await dtRootResp.json()) as any;

    const pagesFolder = (dtRootData.items ?? []).find((d: any) => d.name === 'Pages');
    if (!pagesFolder)
      throw new Error('"Pages" folder not found in doc type tree root');

    const pagesChildrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document-type/children?parentId=${pagesFolder.id}&skip=0&take=100`
    );
    if (!pagesChildrenResp.ok)
      throw new Error(`GET Pages children failed: ${pagesChildrenResp.status}`);
    const pagesChildren = (await pagesChildrenResp.json()) as any;
    const pagesItems: any[] = pagesChildren.items ?? [];

    const articleListDtNode = pagesItems.find((d: any) => d.name === 'Article List');
    if (!articleListDtNode) throw new Error('"Article List" document type not found');
    const articleListDtId = articleListDtNode.id;

    const articleDtNode = pagesItems.find((d: any) => d.name === 'Article');
    if (!articleDtNode) throw new Error('"Article" document type not found');
    articleDocTypeId = articleDtNode.id;

    // Get article template from the doc type
    const articleDt = (await (
      await apiFetch(token, 'GET', `/document-type/${articleDtNode.id}`)
    ).json()) as any;
    articleTemplateId = articleDt.allowedTemplates?.[0]?.id;

    // 2. Walk the document tree to find an existing articleList page (rule #1: dynamic lookup)
    // The tree response includes documentType.id so we can match by type.
    const docRootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
    if (!docRootResp.ok)
      throw new Error(`GET document tree root failed: ${docRootResp.status}`);
    const docRootData = (await docRootResp.json()) as any;

    let foundNode: any = null;
    for (const item of docRootData.items ?? []) {
      if (item.documentType?.id === articleListDtId) {
        foundNode = item;
        break;
      }
      // Check one level deeper (article list often lives under Home).
      // Also look for the "Authors" page in the same children so we can
      // satisfy the mandatory author property when creating test articles.
      if (item.hasChildren) {
        const childResp = await apiFetch(
          token,
          'GET',
          `/tree/document/children?parentId=${item.id}&skip=0&take=100`
        );
        if (childResp.ok) {
          const childData = (await childResp.json()) as any;
          for (const child of childData.items ?? []) {
            if (child.documentType?.id === articleListDtId && !foundNode) {
              foundNode = child;
            }
            const childName: string = child.variants?.[0]?.name ?? child.name ?? '';
            if (childName === 'Authors' && child.hasChildren && !firstAuthorId) {
              // Get the first child author page
              const authChildResp = await apiFetch(
                token,
                'GET',
                `/tree/document/children?parentId=${child.id}&skip=0&take=5`
              );
              if (authChildResp.ok) {
                const authData = (await authChildResp.json()) as any;
                const firstAuthor = (authData.items ?? [])[0];
                if (firstAuthor) firstAuthorId = firstAuthor.id;
              }
            }
          }
        }
        if (foundNode) break;
      }
    }
    if (!foundNode) {
      throw new Error(
        'No articleList page found in the document tree. ' +
          'The demo site must have an Article List page with a Latest Articles Row block.'
      );
    }
    articleListId = foundNode.id;

    // 3. Read the full document and verify it has a latestArticlesRow block
    token = await freshToken();
    const docResp = await apiFetch(token, 'GET', `/document/${articleListId}`);
    if (!docResp.ok) throw new Error(`GET document failed: ${docResp.status}`);
    const doc = (await docResp.json()) as any;

    articleListDocValues = doc.values ?? [];
    articleListDocTemplate = doc.template;
    articleListDocVariants = doc.variants ?? [];

    const found = findLatestArticlesRowBlock(articleListDocValues);
    if (!found) {
      throw new Error(
        'No latestArticlesRow block found in the article list page contentRows. ' +
          'Configure a "Latest Articles Row" block on the Article List page before running these tests.'
      );
    }
    larBlockIndex = found.blockIndex;

    // Deep-copy original block list value for restoration in afterAll
    const contentRowsEntry = articleListDocValues.find((v: any) => v.alias === 'contentRows');
    originalContentRowsValue = JSON.parse(JSON.stringify(contentRowsEntry.value));

    // 4. Clean up stale ALGV test articles from prior runs (rule #3)
    const childrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document/children?parentId=${articleListId}&skip=0&take=100`
    );
    if (childrenResp.ok) {
      const childrenData = (await childrenResp.json()) as any;
      for (const child of childrenData.items ?? []) {
        const childName: string = child.variants?.[0]?.name ?? child.name ?? '';
        if (childName.startsWith('ALGV Test')) {
          await apiFetch(token, 'DELETE', `/document/${child.id}`);
        }
      }
    }

    // 5. Create test articles as children of the article list page.
    //    Use future articleDate values so they sort to the top (OrderByDescending(ArticleDate)).

    // Build the author value if we found one (mandatory property on article doc type)
    const authorValue = firstAuthorId
      ? [{ type: 'document', unique: firstAuthorId }]
      : undefined;

    // Article 1: No mainImage — tests the image placeholder path
    const art1Resp = await apiFetch(token, 'POST', '/document', {
      documentType: { id: articleDocTypeId },
      parent: { id: articleListId },
      ...(articleTemplateId ? { template: { id: articleTemplateId } } : {}),
      values: [
        {
          alias: 'articleDate',
          culture: null,
          segment: null,
          value: '2099-01-01 00:00:00',
        },
        {
          alias: 'metaDescription',
          culture: null,
          segment: null,
          value: 'Test meta description for the no-image article',
        },
        ...(authorValue
          ? [{ alias: 'author', culture: null, segment: null, value: authorValue }]
          : []),
      ],
      variants: [{ culture: null, segment: null, name: 'ALGV Test No Image' }],
    });
    if (!art1Resp.ok) {
      const text = await art1Resp.text();
      throw new Error(`Create "ALGV Test No Image" failed: ${art1Resp.status} - ${text}`);
    }
    const art1Id = (art1Resp.headers.get('Location') || '').split('/').pop()!;
    createdArticleIds.push(art1Id);

    // Article 2: No categories — tests the no-badge path
    const art2Resp = await apiFetch(token, 'POST', '/document', {
      documentType: { id: articleDocTypeId },
      parent: { id: articleListId },
      ...(articleTemplateId ? { template: { id: articleTemplateId } } : {}),
      values: [
        {
          alias: 'articleDate',
          culture: null,
          segment: null,
          value: '2098-12-31 00:00:00',
        },
        {
          alias: 'metaDescription',
          culture: null,
          segment: null,
          value: 'Test meta description for the no-categories article',
        },
        ...(authorValue
          ? [{ alias: 'author', culture: null, segment: null, value: authorValue }]
          : []),
      ],
      variants: [{ culture: null, segment: null, name: 'ALGV Test No Categories' }],
    });
    if (!art2Resp.ok) {
      const text = await art2Resp.text();
      throw new Error(
        `Create "ALGV Test No Categories" failed: ${art2Resp.status} - ${text}`
      );
    }
    const art2Id = (art2Resp.headers.get('Location') || '').split('/').pop()!;
    createdArticleIds.push(art2Id);

    // 6. Publish test articles
    token = await freshToken();
    for (const id of createdArticleIds) {
      const pubResp = await apiFetch(token, 'PUT', `/document/${id}/publish`, {
        publishSchedules: [{ culture: null }],
      });
      if (!pubResp.ok) {
        const text = await pubResp.text();
        console.warn(`Publish article ${id} failed: ${pubResp.status} - ${text}`);
      }
    }

    // 7. Set displayMode to "list" and publish the article list page
    token = await freshToken();
    await updateDisplayMode(token, 'list');

    // 8. Get the actual published URL (rule #2: never hardcode slugs)
    token = await freshToken();
    articleListUrl = await getDocumentPath(token, articleListId);
  });

  test.afterAll(async () => {
    let token: string;
    try {
      token = await freshToken();
    } catch {
      return; // Can't clean up without auth — skip
    }

    // 1. Restore the original block list value
    try {
      const restoredValues = articleListDocValues.map((v: any) =>
        v.alias === 'contentRows' ? { ...v, value: originalContentRowsValue } : v
      );
      await apiFetch(token, 'PUT', `/document/${articleListId}`, {
        template: articleListDocTemplate,
        values: restoredValues,
        variants: articleListDocVariants,
      });
      await apiFetch(token, 'PUT', `/document/${articleListId}/publish`, {
        publishSchedules: [{ culture: null }],
      });
    } catch (e) {
      console.warn('Could not restore original block list value:', e);
    }

    // 2. Delete test articles (reverse order to respect depth)
    for (const id of [...createdArticleIds].reverse()) {
      try {
        await apiFetch(token, 'DELETE', `/document/${id}`);
      } catch {
        /* best-effort */
      }
    }
  });

  // Test 1: List mode renders .post-preview, no .article-grid
  test('displayMode=list: renders .post-preview rows, no .article-grid', async ({
    page,
  }) => {
    await page.goto(articleListUrl);
    await expect(page.locator('.post-preview').first()).toBeVisible();
    await expect(page.locator('.article-grid')).toHaveCount(0);
  });

  // Test 2: After switching to grid mode, renders .article-grid, no .post-preview
  test('displayMode=grid: renders .article-grid cards, no .post-preview', async ({
    page,
  }) => {
    const token = await freshToken();
    await updateDisplayMode(token, 'grid');

    await page.goto(articleListUrl);
    await expect(page.locator('.article-grid')).toBeAttached();
    await expect(page.locator('.post-preview')).toHaveCount(0);
  });

  // Test 3: Grid cards contain a linked title inside h2.card-title
  test('grid cards have h2.card-title with a link to the article', async ({ page }) => {
    await page.goto(articleListUrl);
    const cardTitleLink = page.locator('.article-grid-card .card-title a').first();
    await expect(cardTitleLink).toBeVisible();
    const href = await cardTitleLink.getAttribute('href');
    expect(href, 'Card title link should have an href').toBeTruthy();
  });

  // Test 4: Grid card shows .card-text with the article meta description
  test('grid card shows .card-text containing meta description', async ({ page }) => {
    await page.goto(articleListUrl);
    // Test article "ALGV Test No Image" has a known metaDescription (sorts to top)
    const noImageCard = page
      .locator('.article-grid-card')
      .filter({ hasText: 'ALGV Test No Image' });
    await expect(noImageCard).toBeVisible();
    await expect(noImageCard.locator('.card-text')).toBeVisible();
    await expect(noImageCard.locator('.card-text')).toContainText(
      'Test meta description for the no-image article'
    );
  });

  // Test 5: Article without mainImage shows placeholder div, no broken <img>
  test('grid card without mainImage shows placeholder, no <img> inside ratio div', async ({
    page,
  }) => {
    await page.goto(articleListUrl);
    const noImageCard = page
      .locator('.article-grid-card')
      .filter({ hasText: 'ALGV Test No Image' });
    await expect(noImageCard).toBeVisible();
    await expect(noImageCard.locator('.article-grid-card__no-image')).toBeVisible();
    // No <img> inside the ratio container for this card
    await expect(noImageCard.locator('.ratio img')).toHaveCount(0);
  });

  // Test 6: Article without categories shows no .badge elements in its card
  test('grid card without categories shows no badge elements', async ({ page }) => {
    await page.goto(articleListUrl);
    const noCatCard = page
      .locator('.article-grid-card')
      .filter({ hasText: 'ALGV Test No Categories' });
    await expect(noCatCard).toBeVisible();
    await expect(noCatCard.locator('.badge')).toHaveCount(0);
  });

  // Test 7: Desktop (1280×800) — each card is narrower than half the viewport (multi-column)
  test('desktop viewport: grid cards render in multi-column layout', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(articleListUrl);
    await expect(page.locator('.article-grid')).toBeAttached();

    const firstCol = page.locator('.article-grid .col').first();
    await expect(firstCol).toBeVisible();
    const box = await firstCol.boundingBox();
    expect(box, 'First grid column should have a bounding box').not.toBeNull();
    // At 1280px with Bootstrap's row-cols-lg-3, each column is ~33% wide (<500px)
    expect(
      box!.width,
      'Column width at 1280px should be less than 500px (3-column layout)'
    ).toBeLessThan(500);
  });

  // Test 8: Mobile (375×812) — card fills the viewport width (single column stacking)
  test('mobile viewport: grid cards stack in single column', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(articleListUrl);
    await expect(page.locator('.article-grid')).toBeAttached();

    const firstCol = page.locator('.article-grid .col').first();
    await expect(firstCol).toBeVisible();
    const box = await firstCol.boundingBox();
    expect(box, 'First grid column should have a bounding box').not.toBeNull();
    // At 375px with row-cols-1, each column spans the full container width (>300px)
    expect(
      box!.width,
      'Column width at 375px should be greater than 300px (single-column layout)'
    ).toBeGreaterThan(300);
  });

  // Test 9: Switching back to list mode restores .post-preview (regression check)
  test('switch back to displayMode=list: .post-preview items reappear', async ({
    page,
  }) => {
    const token = await freshToken();
    await updateDisplayMode(token, 'list');

    await page.goto(articleListUrl);
    await expect(page.locator('.post-preview').first()).toBeVisible();
    await expect(page.locator('.article-grid')).toHaveCount(0);
  });
});

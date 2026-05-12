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
// Quick, no-server-needed checks that the partial reads metaDescription
// AND still references subtitle (the fallback). Catch the partial drift
// before paying for browser tests.

test.describe('Article listings — Razor partials read metaDescription with subtitle fallback', () => {
  const partials = [
    {
      name: '_ArticleCard.cshtml (article list, search results, author detail, grid mode)',
      path: '../../src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml',
    },
    {
      name: '_LatestSection.cshtml (home page "The Latest" — featured + grid)',
      path: '../../src/UmbracoProject/Views/Partials/v2/_LatestSection.cshtml',
    },
    {
      name: 'latestArticlesRow.cshtml (block list-mode rendering)',
      path: '../../src/UmbracoProject/Views/Partials/blocklist/Components/latestArticlesRow.cshtml',
    },
  ];

  for (const { name, path } of partials) {
    test(`${name} reads metaDescription`, () => {
      const content = readFileSync(resolve(__dirname, path), 'utf-8');
      expect(content, `${name} should read metaDescription`).toMatch(/metaDescription/);
    });

    test(`${name} keeps subtitle available as the fallback`, () => {
      const content = readFileSync(resolve(__dirname, path), 'utf-8');
      expect(content, `${name} should still reference subtitle`).toMatch(/subtitle/i);
    });
  }
});

// ==============================
// Section 2: Browser E2E Tests
// ==============================
// Creates two test articles under the existing Article List page:
//   - "ACM Test With Meta"  : subtitle + metaDescription set → card should render metaDescription
//   - "ACM Test No Meta"    : subtitle set, no metaDescription → card should fall back to subtitle
// Verifies the rendered listing matches the spec, then cleans up.

const API_BASE = process.env.URL || 'https://localhost:44367';

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

async function getDocumentPath(token: string, docId: string): Promise<string> {
  const resp = await apiFetch(token, 'GET', `/document/urls?id=${docId}`);
  if (!resp.ok) throw new Error(`GET document URLs failed for ${docId}: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

// Module-level state shared across browser tests (rule #1: dynamic lookups)
let articleListId: string;
let articleListUrl: string;
let articleDocTypeId: string;
let articleTemplateId: string | undefined;
let firstAuthorId: string | undefined;
const createdArticleIds: string[] = [];

const ARTICLE_WITH_META_NAME = 'ACM Test With Meta';
const ARTICLE_NO_META_NAME = 'ACM Test No Meta';
const STALE_SUBTITLE = 'ACM STALE SUBTITLE DO NOT SHOW';
const FRESH_META = 'ACM FRESH META DESCRIPTION';
const FALLBACK_SUBTITLE = 'ACM FALLBACK SUBTITLE';

test.describe('Article Card metaDescription — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    let token = await freshToken();

    // 1. Look up Article List + Article doc type IDs (rule #1)
    const dtRootResp = await apiFetch(
      token,
      'GET',
      '/tree/document-type/root?skip=0&take=100'
    );
    if (!dtRootResp.ok) throw new Error(`GET doc type tree root failed: ${dtRootResp.status}`);
    const dtRootData = (await dtRootResp.json()) as any;

    const pagesFolder = (dtRootData.items ?? []).find((d: any) => d.name === 'Pages');
    if (!pagesFolder) throw new Error('"Pages" folder not found in doc type tree root');

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

    const articleDtNode = pagesItems.find((d: any) => d.name === 'Article');
    if (!articleDtNode) throw new Error('"Article" document type not found');
    articleDocTypeId = articleDtNode.id;

    const articleDt = (await (
      await apiFetch(token, 'GET', `/document-type/${articleDtNode.id}`)
    ).json()) as any;
    articleTemplateId = articleDt.allowedTemplates?.[0]?.id;

    // 2. Walk the document tree for the Article List page + an Author (rule #1)
    const docRootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
    if (!docRootResp.ok)
      throw new Error(`GET document tree root failed: ${docRootResp.status}`);
    const docRootData = (await docRootResp.json()) as any;

    let foundNode: any = null;
    for (const item of docRootData.items ?? []) {
      if (item.documentType?.id === articleListDtNode.id) {
        foundNode = item;
        break;
      }
      if (item.hasChildren) {
        const childResp = await apiFetch(
          token,
          'GET',
          `/tree/document/children?parentId=${item.id}&skip=0&take=100`
        );
        if (childResp.ok) {
          const childData = (await childResp.json()) as any;
          for (const child of childData.items ?? []) {
            if (child.documentType?.id === articleListDtNode.id && !foundNode) {
              foundNode = child;
            }
            const childName: string = child.variants?.[0]?.name ?? child.name ?? '';
            if (childName === 'Authors' && child.hasChildren && !firstAuthorId) {
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
        'No Article List page found in the document tree. ' +
          'The demo site must have an Article List page configured.'
      );
    }
    articleListId = foundNode.id;

    // 3. Clean stale "ACM Test" articles from prior runs (rule #3)
    token = await freshToken();
    const childrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document/children?parentId=${articleListId}&skip=0&take=100`
    );
    if (childrenResp.ok) {
      const childrenData = (await childrenResp.json()) as any;
      for (const child of childrenData.items ?? []) {
        const childName: string = child.variants?.[0]?.name ?? child.name ?? '';
        if (childName.startsWith('ACM Test')) {
          await apiFetch(token, 'DELETE', `/document/${child.id}`);
        }
      }
    }

    // 4. Create the two test articles (rule #4: re-acquire token per logical group)
    token = await freshToken();
    const authorValue = firstAuthorId
      ? [{ type: 'document', unique: firstAuthorId }]
      : undefined;

    // 4a. Article WITH metaDescription — verify metaDescription is rendered (not subtitle)
    const art1Resp = await apiFetch(token, 'POST', '/document', {
      documentType: { id: articleDocTypeId },
      parent: { id: articleListId },
      ...(articleTemplateId ? { template: { id: articleTemplateId } } : {}),
      values: [
        {
          alias: 'articleDate',
          culture: null,
          segment: null,
          value: '2099-06-01 00:00:00',
        },
        {
          alias: 'subtitle',
          culture: null,
          segment: null,
          value: STALE_SUBTITLE,
        },
        {
          alias: 'metaDescription',
          culture: null,
          segment: null,
          value: FRESH_META,
        },
        ...(authorValue
          ? [{ alias: 'author', culture: null, segment: null, value: authorValue }]
          : []),
      ],
      variants: [{ culture: null, segment: null, name: ARTICLE_WITH_META_NAME }],
    });
    if (!art1Resp.ok) {
      const text = await art1Resp.text();
      throw new Error(
        `Create "${ARTICLE_WITH_META_NAME}" failed: ${art1Resp.status} - ${text}`
      );
    }
    const art1Id = (art1Resp.headers.get('Location') || '').split('/').pop()!;
    createdArticleIds.push(art1Id);

    // 4b. Article WITHOUT metaDescription — verify subtitle fallback
    const art2Resp = await apiFetch(token, 'POST', '/document', {
      documentType: { id: articleDocTypeId },
      parent: { id: articleListId },
      ...(articleTemplateId ? { template: { id: articleTemplateId } } : {}),
      values: [
        {
          alias: 'articleDate',
          culture: null,
          segment: null,
          value: '2099-05-31 00:00:00',
        },
        {
          alias: 'subtitle',
          culture: null,
          segment: null,
          value: FALLBACK_SUBTITLE,
        },
        // intentionally no metaDescription
        ...(authorValue
          ? [{ alias: 'author', culture: null, segment: null, value: authorValue }]
          : []),
      ],
      variants: [{ culture: null, segment: null, name: ARTICLE_NO_META_NAME }],
    });
    if (!art2Resp.ok) {
      const text = await art2Resp.text();
      throw new Error(
        `Create "${ARTICLE_NO_META_NAME}" failed: ${art2Resp.status} - ${text}`
      );
    }
    const art2Id = (art2Resp.headers.get('Location') || '').split('/').pop()!;
    createdArticleIds.push(art2Id);

    // 5. Publish the test articles
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

    // 6. Resolve the article list URL (rule #2: never hardcode slugs)
    token = await freshToken();
    articleListUrl = await getDocumentPath(token, articleListId);
  });

  test.afterAll(async () => {
    let token: string;
    try {
      token = await freshToken();
    } catch {
      return; // can't clean up without auth — skip
    }
    for (const id of [...createdArticleIds].reverse()) {
      try {
        await apiFetch(token, 'DELETE', `/document/${id}`);
      } catch {
        /* best-effort */
      }
    }
  });

  test('article with metaDescription shows it on the card (not subtitle)', async ({
    page,
  }) => {
    await page.goto(articleListUrl);
    // Locate the card by matching its title heading; this is more precise than
    // a global hasText which could match any descendant string.
    const card = page
      .locator('.article-grid-card')
      .filter({ has: page.locator('.card-title', { hasText: ARTICLE_WITH_META_NAME }) });
    await expect(card).toBeVisible();
    await expect(card.locator('.card-sub')).toHaveText(FRESH_META);
    await expect(card.locator('.card-sub')).not.toContainText(STALE_SUBTITLE);
  });

  test('article without metaDescription falls back to subtitle', async ({ page }) => {
    await page.goto(articleListUrl);
    const card = page
      .locator('.article-grid-card')
      .filter({ has: page.locator('.card-title', { hasText: ARTICLE_NO_META_NAME }) });
    await expect(card).toBeVisible();
    await expect(card.locator('.card-sub')).toHaveText(FALLBACK_SUBTITLE);
  });

  test('home page "The Latest": featured article shows metaDescription, grid fallback works', async ({
    page,
  }) => {
    await page.goto('/');

    // The featured slot shows the most-recent article. The 2099-06-01 date
    // on ACM Test With Meta should make it the featured pick.
    const feature = page.locator('.feature');
    await expect(feature.locator('h2')).toContainText(ARTICLE_WITH_META_NAME);
    await expect(feature.locator('.sub')).toHaveText(FRESH_META);
    await expect(feature.locator('.sub')).not.toContainText(STALE_SUBTITLE);

    // The 2099-05-31 article shows up in the grid; subtitle fallback applies.
    const entry = page
      .locator('.entry')
      .filter({ has: page.locator('h3', { hasText: ARTICLE_NO_META_NAME }) });
    await expect(entry).toBeVisible();
    await expect(entry.locator('.sub')).toHaveText(FALLBACK_SUBTITLE);
  });
});

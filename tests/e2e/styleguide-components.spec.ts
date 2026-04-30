import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const API_BASE = process.env.URL || 'https://localhost:44367';

// Cleanup decision (per Step 8 of _plans/living-style-guide.md): the Components
// page is canonical production content, so beforeAll updates it idempotently
// instead of creating-and-deleting per run. There is no `cleanStaleTestData`
// step and no `afterAll` cleanup — the same data IS the production reference.
//
// Doc-type and element-type ids are looked up by name in beforeAll instead of
// being hardcoded (per Step 8: "look up ... dynamically — never hardcode").
// Module-level mutable refs populated before any helper that uses them runs.
let CT!: {
  contentSectionRow: string;
  contentSectionRowSettings: string;
  richTextRow: string;
  codeSnippetRow: string;
  alertBanner: string;
  imageRow: string;
  imageCarouselRow: string;
  imageCarouselSlide: string;
  videoRow: string;
  latestArticlesRow: string;
};
let DT!: {
  content: string;
  contentTemplate: string;
  styleGuidePage: string;
};

// ==============================
// Shared API helpers
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

async function getDocumentPath(token: string, docId: string): Promise<string> {
  const resp = await apiFetch(token, 'GET', `/document/urls?id=${docId}`);
  if (!resp.ok) throw new Error(`GET document URLs failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

// ==============================
// Doc-type tree lookups (resolve element / doc-type ids by name)
// ==============================

/** Walk the doc-type tree depth-first, indexing every leaf entry by display name. */
async function fetchDocTypeIndex(token: string): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  async function walk(parentId: string | null) {
    const path = parentId
      ? `/tree/document-type/children?parentId=${parentId}&skip=0&take=100`
      : `/tree/document-type/root?skip=0&take=100`;
    const resp = await apiFetch(token, 'GET', path);
    if (!resp.ok) return;
    const data = (await resp.json()) as any;
    for (const item of data.items ?? []) {
      if (item.isFolder) {
        await walk(item.id);
      } else if (item.name) {
        byName.set(item.name, item.id);
      }
    }
  }
  await walk(null);
  return byName;
}

/**
 * Resolve every element-type / doc-type id needed by this spec by name. Names
 * are stable identifiers in the .uda files — the random GUIDs they map to are
 * what change between environments / fresh seeds.
 */
async function loadDocumentTypeIds(token: string): Promise<{ ct: typeof CT; dt: typeof DT }> {
  const byName = await fetchDocTypeIndex(token);
  const get = (name: string): string => {
    const id = byName.get(name);
    if (!id) {
      throw new Error(
        `Doc type "${name}" not found in tree. Has the schema been seeded? (run dotnet run once.)`
      );
    }
    return id;
  };

  const ct = {
    contentSectionRow: get('Content Section Row'),
    contentSectionRowSettings: get('Content Section Row Settings'),
    richTextRow: get('Rich Text Row'),
    codeSnippetRow: get('Code Snippet Row'),
    alertBanner: get('Alert Banner'),
    imageRow: get('Image Row'),
    imageCarouselRow: get('Image Carousel Row'),
    imageCarouselSlide: get('Image Carousel Slide'),
    videoRow: get('Video Row'),
    latestArticlesRow: get('Latest Articles Row'),
  };

  const contentId = get('Content');
  const styleGuidePageId = get('Style Guide Page');

  // The Content doc-type's default template id also varies between environments;
  // resolve it via the doc-type details rather than hardcoding the GUID.
  const tokenForFetch = await freshToken();
  const contentResp = await apiFetch(tokenForFetch, 'GET', `/document-type/${contentId}`);
  if (!contentResp.ok) {
    throw new Error(`GET document-type/${contentId} failed: ${contentResp.status}`);
  }
  const contentDoc = (await contentResp.json()) as any;
  const templateId = contentDoc.allowedTemplates?.[0]?.id;
  if (!templateId) {
    throw new Error('Content doc-type has no allowed templates configured.');
  }

  const dt = {
    content: contentId,
    contentTemplate: templateId,
    styleGuidePage: styleGuidePageId,
  };

  return { ct, dt };
}

// ==============================
// Document tree lookups (Rule #1: dynamic)
// ==============================

async function findChildByName(
  token: string,
  parentId: string,
  name: string
): Promise<{ id: string; documentTypeId: string } | null> {
  const resp = await apiFetch(token, 'GET', `/tree/document/children?parentId=${parentId}&skip=0&take=100`);
  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  for (const item of data.items ?? []) {
    if (item.variants?.[0]?.name === name) {
      return { id: item.id, documentTypeId: item.documentType?.id };
    }
  }
  return null;
}

async function findRootChildByDocType(token: string, docTypeId: string): Promise<string | null> {
  const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
  if (!rootResp.ok) return null;
  const root = (await rootResp.json()) as any;
  for (const home of root.items ?? []) {
    const childResp = await apiFetch(
      token,
      'GET',
      `/tree/document/children?parentId=${home.id}&skip=0&take=100`
    );
    if (!childResp.ok) continue;
    const children = (await childResp.json()) as any;
    for (const child of children.items ?? []) {
      if (child.documentType?.id === docTypeId) return child.id;
    }
  }
  return null;
}

/** Walk the doc tree to find the first published Blog page (used by latestArticlesRow). */
async function findBlogPageId(token: string): Promise<string | null> {
  const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
  if (!rootResp.ok) return null;
  const root = (await rootResp.json()) as any;
  for (const home of root.items ?? []) {
    const childResp = await apiFetch(
      token,
      'GET',
      `/tree/document/children?parentId=${home.id}&skip=0&take=100`
    );
    if (!childResp.ok) continue;
    const children = (await childResp.json()) as any;
    // Blog doc-type id seen on the demo site; if missing, fall back to a node named "Blog".
    const byName = (children.items ?? []).find(
      (c: any) => c.variants?.[0]?.name === 'Blog'
    );
    if (byName) return byName.id;
  }
  return null;
}

/** Walk the media tree, return up to `limit` image media keys. */
async function findImageMediaKeys(token: string, limit: number): Promise<string[]> {
  const keys: string[] = [];
  async function walk(parentId: string | null) {
    if (keys.length >= limit) return;
    const url = parentId
      ? `${API_BASE}/umbraco/management/api/v1/tree/media/children?parentId=${parentId}&skip=0&take=100`
      : `${API_BASE}/umbraco/management/api/v1/tree/media/root?skip=0&take=100`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return;
    const data = (await resp.json()) as any;
    for (const item of data.items ?? []) {
      if (keys.length >= limit) break;
      if (item.mediaType?.icon === 'icon-picture') {
        keys.push(item.id);
      } else if (item.hasChildren) {
        await walk(item.id);
      }
    }
  }
  await walk(null);
  return keys;
}

// ==============================
// Block builders
// ==============================

function buildBlockListValue(layoutEntries: any[], contentData: any[], settingsData: any[] = []) {
  return {
    layout: { 'Umbraco.BlockList': layoutEntries },
    contentData,
    settingsData,
    expose: contentData.map((c: any) => ({ contentKey: c.key, culture: null, segment: null })),
  };
}

function tiptapValue(markup: string) {
  return {
    markup,
    blocks: { layout: {}, contentData: [], settingsData: [] },
  };
}

function richTextLabel(text: string) {
  return {
    contentTypeKey: CT.richTextRow,
    key: randomUUID(),
    values: [
      {
        alias: 'content',
        culture: null,
        segment: null,
        value: tiptapValue(`<h3>${text}</h3>`),
      },
    ],
  };
}

function richTextSample() {
  return {
    contentTypeKey: CT.richTextRow,
    key: randomUUID(),
    values: [
      {
        alias: 'content',
        culture: null,
        segment: null,
        value: tiptapValue(
          '<p>This is a Rich Text Row showcasing inline <strong>bold</strong>, <em>italic</em>, and a <a href="/">link</a>.</p>'
        ),
      },
    ],
  };
}

function codeSnippetSample() {
  return {
    contentTypeKey: CT.codeSnippetRow,
    key: randomUUID(),
    values: [
      { alias: 'title', culture: null, segment: null, value: 'JavaScript example' },
      {
        alias: 'code',
        culture: null,
        segment: null,
        value: 'console.log("hello, style guide");',
      },
    ],
  };
}

function alertBannerSample(level: 'emergency' | 'warning' | 'informational', body: string) {
  return {
    contentTypeKey: CT.alertBanner,
    key: randomUUID(),
    values: [
      { alias: 'alertLevel', culture: null, segment: null, value: [level] },
      {
        alias: 'alertContent',
        culture: null,
        segment: null,
        value: tiptapValue(`<p>${body}</p>`),
      },
    ],
  };
}

function imageRowSample(mediaKey: string) {
  return {
    contentTypeKey: CT.imageRow,
    key: randomUUID(),
    values: [
      {
        alias: 'image',
        culture: null,
        segment: null,
        value: [
          {
            key: randomUUID(),
            mediaKey,
            mediaTypeAlias: 'Image',
            crops: [],
            focalPoint: null,
          },
        ],
      },
      { alias: 'caption', culture: null, segment: null, value: 'Image Row caption' },
    ],
  };
}

function imageCarouselRowSample(mediaKeys: string[]) {
  const slideContents = mediaKeys.map((mediaKey, idx) => ({
    contentTypeKey: CT.imageCarouselSlide,
    key: randomUUID(),
    values: [
      {
        alias: 'image',
        culture: null,
        segment: null,
        value: [
          {
            key: randomUUID(),
            mediaKey,
            mediaTypeAlias: 'Image',
            crops: [],
            focalPoint: null,
          },
        ],
      },
      {
        alias: 'caption',
        culture: null,
        segment: null,
        value: `Carousel slide ${idx + 1}`,
      },
    ],
  }));

  const slidesValue = buildBlockListValue(
    slideContents.map((s) => ({ contentKey: s.key })),
    slideContents
  );

  return {
    contentTypeKey: CT.imageCarouselRow,
    key: randomUUID(),
    values: [
      { alias: 'slides', culture: null, segment: null, value: slidesValue },
      { alias: 'showCaptions', culture: null, segment: null, value: true },
      { alias: 'scrollSpeedMs', culture: null, segment: null, value: 4000 },
    ],
  };
}

function videoRowSample() {
  return {
    contentTypeKey: CT.videoRow,
    key: randomUUID(),
    values: [
      {
        alias: 'videoUrl',
        culture: null,
        segment: null,
        // Stable, well-known YouTube ID — partial extracts the videoId via VideoUrlHelper.
        value: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      },
      { alias: 'caption', culture: null, segment: null, value: 'Video Row sample' },
    ],
  };
}

function latestArticlesRowSample(blogPageId: string) {
  return {
    contentTypeKey: CT.latestArticlesRow,
    key: randomUUID(),
    values: [
      { alias: 'articleList', culture: null, segment: null, value: blogPageId },
      { alias: 'pageSize', culture: null, segment: null, value: 6 },
      { alias: 'showPagination', culture: null, segment: null, value: false },
      { alias: 'displayMode', culture: null, segment: null, value: ['grid'] },
    ],
  };
}

function contentSectionRow(title: string, innerBlocks: any[]) {
  const innerLayoutEntries = innerBlocks.map((b) => ({ contentKey: b.key }));
  const innerSectionContent = buildBlockListValue(innerLayoutEntries, innerBlocks);
  return {
    contentTypeKey: CT.contentSectionRow,
    key: randomUUID(),
    values: [
      { alias: 'sectionTitle', culture: null, segment: null, value: title },
      { alias: 'sectionHeadingLevel', culture: null, segment: null, value: ['h2'] },
      {
        alias: 'sectionContent',
        culture: null,
        segment: null,
        value: innerSectionContent,
      },
    ],
  };
}

function contentSectionRowSettings() {
  // Use full-bleed (no bordered .section-row--container box) so the showcase
  // blocks render with the same chrome they'd have in a real article — the
  // bordered look pressed against the inner blocks (especially the alert
  // banners and the carousel) on this reference page.
  return {
    contentTypeKey: CT.contentSectionRowSettings,
    key: randomUUID(),
    values: [
      { alias: 'sectionBackgroundColor', culture: null, segment: null, value: ['none'] },
      {
        alias: 'sectionBackgroundWidth',
        culture: null,
        segment: null,
        value: ['full-bleed'],
      },
    ],
  };
}

// ==============================
// Ensure `/styleguide/components` exists and is up-to-date
// ==============================

async function ensureComponentsPage(): Promise<string> {
  let token = await freshToken();

  const styleGuideId = await findRootChildByDocType(token, DT.styleGuidePage);
  if (!styleGuideId) {
    throw new Error(
      'Style Guide page not found under Home — Step 6 must be completed before Step 7.'
    );
  }

  const blogId = await findBlogPageId(token);
  if (!blogId) {
    throw new Error('Blog page not found — required for the Latest Articles Row showcase.');
  }

  const mediaKeys = await findImageMediaKeys(token, 3);
  if (mediaKeys.length < 3) {
    throw new Error(
      `Need at least 3 image media items in the library; found ${mediaKeys.length}.`
    );
  }

  // Build the three section rows (Text / Media / Lists) per the plan.
  // The Alert Banner showcase renders all three severity levels so the live
  // style guide doubles as a quick reference for editors choosing a level.
  const textRow = contentSectionRow('Text', [
    richTextLabel('Rich Text Row'),
    richTextSample(),
    richTextLabel('Code Snippet Row'),
    codeSnippetSample(),
    richTextLabel('Alert Banner'),
    alertBannerSample('emergency', 'Emergency level — used for service outages and data loss.'),
    alertBannerSample('warning', 'Warning level — used for degraded behaviour or non-blocking issues.'),
    alertBannerSample('informational', 'Informational level — used for non-urgent context and FYI notes.'),
  ]);
  const mediaRow = contentSectionRow('Media', [
    richTextLabel('Image Row'),
    imageRowSample(mediaKeys[0]),
    richTextLabel('Image Carousel Row'),
    imageCarouselRowSample(mediaKeys.slice(0, 3)),
    richTextLabel('Video Row'),
    videoRowSample(),
  ]);
  const listsRow = contentSectionRow('Lists', [
    richTextLabel('Latest Articles Row'),
    latestArticlesRowSample(blogId),
  ]);

  const sectionRows = [textRow, mediaRow, listsRow];
  const settingsBlocks = sectionRows.map(() => contentSectionRowSettings());
  const sectionRowsValue = {
    layout: {
      'Umbraco.BlockList': sectionRows.map((row, i) => ({
        contentKey: row.key,
        settingsKey: settingsBlocks[i].key,
      })),
    },
    contentData: sectionRows,
    settingsData: settingsBlocks,
    expose: sectionRows.map((row) => ({
      contentKey: row.key,
      culture: null,
      segment: null,
    })),
  };

  // Standard payload for the Components page — covers create + update paths.
  const desiredValues = [
    { alias: 'sectionRows', culture: null, segment: null, value: sectionRowsValue },
    { alias: 'hideFromTopNavigation', culture: null, segment: null, value: true },
  ];

  // Idempotent: update if it already exists, otherwise create fresh.
  token = await freshToken();
  const existing = await findChildByName(token, styleGuideId, 'Components');
  let componentsId: string;

  if (existing) {
    componentsId = existing.id;
    token = await freshToken();
    const docResp = await apiFetch(token, 'GET', `/document/${componentsId}`);
    if (!docResp.ok) throw new Error(`GET existing Components failed: ${docResp.status}`);
    const doc = (await docResp.json()) as any;

    // Replace sectionRows + hideFromTopNavigation; preserve any other authored values.
    const aliasesWeManage = new Set(desiredValues.map((v) => v.alias));
    const preserved = (doc.values ?? []).filter(
      (v: any) => !aliasesWeManage.has(v.alias)
    );
    const updatedValues = [...preserved, ...desiredValues];

    token = await freshToken();
    const putResp = await apiFetch(token, 'PUT', `/document/${componentsId}`, {
      template: doc.template ?? { id: DT.contentTemplate },
      values: updatedValues,
      variants: doc.variants ?? [{ culture: null, segment: null, name: 'Components' }],
    });
    if (!putResp.ok) {
      const text = await putResp.text();
      throw new Error(`PUT Components failed: ${putResp.status} - ${text}`);
    }
  } else {
    componentsId = randomUUID();
    token = await freshToken();
    const createResp = await apiFetch(token, 'POST', '/document', {
      id: componentsId,
      parent: { id: styleGuideId },
      documentType: { id: DT.content },
      template: { id: DT.contentTemplate },
      values: desiredValues,
      variants: [{ culture: null, segment: null, name: 'Components' }],
    });
    if (!createResp.ok) {
      const text = await createResp.text();
      throw new Error(`POST Components failed: ${createResp.status} - ${text}`);
    }
  }

  // Publish so the page is reachable from the public site.
  token = await freshToken();
  const pubResp = await apiFetch(token, 'PUT', `/document/${componentsId}/publish`, {
    publishSchedules: [{ culture: null }],
  });
  if (!pubResp.ok) {
    const text = await pubResp.text();
    throw new Error(`Publish Components failed: ${pubResp.status} - ${text}`);
  }

  token = await freshToken();
  return await getDocumentPath(token, componentsId);
}

async function getStyleGuidePageUrl(): Promise<string> {
  const token = await freshToken();
  const id = await findRootChildByDocType(token, DT.styleGuidePage);
  if (!id) throw new Error('Style Guide page not found — Step 6 must be completed.');
  return await getDocumentPath(token, id);
}

// ==============================
// Tests
// ==============================

let componentsUrl: string;

test.describe('Style Guide — Components page', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const token = await freshToken();
    const ids = await loadDocumentTypeIds(token);
    CT = ids.ct;
    DT = ids.dt;
    componentsUrl = await ensureComponentsPage();
  });

  test('Components page is reachable at /styleguide/components', async ({ page }) => {
    expect(componentsUrl).toMatch(/\/styleguide\/components\/?$/);
    const res = await page.goto(componentsUrl);
    expect(res?.status()).toBe(200);
  });

  test('Three section rows render in order: Text, Media, Lists', async ({ page }) => {
    await page.goto(componentsUrl);
    const titles = await page.locator('.section-row__title').allTextContents();
    expect(titles.map((t) => t.trim())).toEqual(['Text', 'Media', 'Lists']);
  });

  test('Each section is preceded by a Rich Text label heading for every showcase block', async ({
    page,
  }) => {
    await page.goto(componentsUrl);
    const labels = await page
      .locator('.richtext h3')
      .evaluateAll((els) => els.map((e) => (e.textContent || '').trim()));
    // One label per showcase block (7 showcase blocks total per the plan).
    expect(labels).toEqual(
      expect.arrayContaining([
        'Rich Text Row',
        'Code Snippet Row',
        'Alert Banner',
        'Image Row',
        'Image Carousel Row',
        'Video Row',
        'Latest Articles Row',
      ])
    );
  });

  test('Showcase blocks render — text category', async ({ page }) => {
    await page.goto(componentsUrl);
    // Rich Text Row sample paragraph
    await expect(
      page.locator('.richtext').filter({ hasText: 'showcasing inline' })
    ).toBeVisible();
    // Code Snippet Row
    await expect(page.locator('pre code').filter({ hasText: 'hello, style guide' })).toBeVisible();
    // Alert Banner — all three severity levels with their respective Bootstrap class.
    await expect(
      page.locator('.alert-danger').filter({ hasText: 'Emergency level' })
    ).toBeVisible();
    await expect(
      page.locator('.alert-warning').filter({ hasText: 'Warning level' })
    ).toBeVisible();
    await expect(
      page.locator('.alert-info').filter({ hasText: 'Informational level' })
    ).toBeVisible();
  });

  test('Showcase blocks render — media category', async ({ page }) => {
    await page.goto(componentsUrl);
    // Image Row
    await expect(page.locator('.image img').first()).toBeVisible();
    // Image Carousel Row — Bootstrap carousel-fade is the new default
    await expect(page.locator('.carousel.carousel-fade').first()).toBeVisible();
    // Video Row — youtube player wrapper
    await expect(page.locator('.youtube-player').first()).toBeAttached();
  });

  test('Showcase blocks render — lists category', async ({ page }) => {
    await page.goto(componentsUrl);
    await expect(page.locator('.article-grid').first()).toBeVisible();
  });

  test('Components page is hidden from the top navigation', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.site-nav').getByRole('link', { name: /components/i })
    ).toHaveCount(0);
  });

  test('Style guide page links to the components page and the link works', async ({ page }) => {
    const styleGuideUrl = await getStyleGuidePageUrl();
    await page.goto(styleGuideUrl);
    const link = page.locator('#components-reference a[href*="/styleguide/components"]');
    await expect(link).toBeVisible();
    await link.click();
    // The published URL may render with or without a trailing slash depending on Umbraco's URL provider.
    await expect(page).toHaveURL(/\/styleguide\/components\/?$/);
  });
});

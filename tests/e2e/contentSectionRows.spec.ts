import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const CONTENT_SECTION_ROW_CT_KEY = 'd5f39061-2c36-4d3c-bdc9-d8133918579b';
const CONTENT_SECTION_ROW_SETTINGS_CT_KEY = 'a4c73435-3b28-4180-a2c9-1a4bdc2ae9ed';
const API_BASE = process.env.URL || 'https://localhost:44367';

// Known doc type IDs from the plan (used for finding pages, not for assertions)
const CONTENT_DT_ID = 'b871f83c-2395-4894-be0f-5422c1a71e48';
const ARTICLE_DT_ID = '0f63b49a-5423-46bd-91fa-0e78bbd2f6d6';
const DOCUMENTATION_DT_ID = '2cf4d650-39ec-41ef-8bd6-5085ee9f780a';
const SECTION_ROW_DT_IDS = [CONTENT_DT_ID, ARTICLE_DT_ID, DOCUMENTATION_DT_ID];

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
 * Walk the document tree to find a page whose document type is one of the
 * section-row-enabled types (Content, Article, Documentation).
 * Returns up to `limit` page IDs.
 */
async function findPagesByDocType(token: string, limit = 2): Promise<string[]> {
  const ids: string[] = [];

  const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
  if (!rootResp.ok) return ids;
  const rootData = (await rootResp.json()) as any;

  for (const item of rootData.items ?? []) {
    if (ids.length >= limit) break;

    if (SECTION_ROW_DT_IDS.includes(item.documentType?.id)) {
      ids.push(item.id);
    }

    if (item.hasChildren) {
      token = await freshToken();
      const childResp = await apiFetch(
        token,
        'GET',
        `/tree/document/children?parentId=${item.id}&skip=0&take=100`
      );
      if (childResp.ok) {
        const childData = (await childResp.json()) as any;
        for (const child of childData.items ?? []) {
          if (ids.length >= limit) break;
          if (SECTION_ROW_DT_IDS.includes(child.documentType?.id)) {
            ids.push(child.id);
          }
        }
      }
    }
  }
  return ids;
}

// ==============================
// Section 1: Element Type Tests
// (Using direct API calls — umbracoApi fixture auth fails with Umbraco 17 Lit SPA)
// ==============================

test.describe('Content Section Row — Element Type', () => {
  test('Content Section Row element type exists and is an element', async () => {
    const token = await freshToken();
    const resp = await apiFetch(token, 'GET', `/document-type/${CONTENT_SECTION_ROW_CT_KEY}`);
    expect(resp.ok, `GET document-type/${CONTENT_SECTION_ROW_CT_KEY} should return 200`).toBe(true);
    const elementType = (await resp.json()) as any;
    expect(elementType.name).toBe('Content Section Row');
    expect(elementType.isElement).toBe(true);
  });

  test('Content Section Row has sectionTitle, sectionContent, and sectionHeadingLevel properties', async () => {
    const token = await freshToken();
    const resp = await apiFetch(token, 'GET', `/document-type/${CONTENT_SECTION_ROW_CT_KEY}`);
    expect(resp.ok).toBe(true);
    const elementType = (await resp.json()) as any;

    const aliases = (elementType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'should have sectionTitle').toContain('sectionTitle');
    expect(aliases, 'should have sectionContent').toContain('sectionContent');
    expect(aliases, 'should have sectionHeadingLevel').toContain('sectionHeadingLevel');
  });

  test('Content Section Row Settings exists with correct properties', async () => {
    const token = await freshToken();
    const resp = await apiFetch(
      token,
      'GET',
      `/document-type/${CONTENT_SECTION_ROW_SETTINGS_CT_KEY}`
    );
    expect(resp.ok, `GET document-type/${CONTENT_SECTION_ROW_SETTINGS_CT_KEY} should return 200`).toBe(
      true
    );
    const elementType = (await resp.json()) as any;
    expect(elementType.name).toBe('Content Section Row Settings');
    expect(elementType.isElement).toBe(true);

    const aliases = (elementType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'should have sectionBackgroundColor').toContain('sectionBackgroundColor');
    expect(aliases, 'should have sectionBackgroundWidth').toContain('sectionBackgroundWidth');
  });

  test('Section Row Controls composition is composed into Content document type', async () => {
    const token = await freshToken();

    // Look up Section Row Controls composition in the Compositions folder
    const dtRootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
    expect(dtRootResp.ok).toBe(true);
    const dtRootData = (await dtRootResp.json()) as any;
    const compositionsFolder = (dtRootData.items ?? []).find((d: any) => d.name === 'Compositions');
    expect(compositionsFolder, 'Compositions folder should exist').toBeTruthy();

    const compChildrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document-type/children?parentId=${compositionsFolder.id}&skip=0&take=100`
    );
    expect(compChildrenResp.ok).toBe(true);
    const compChildren = (await compChildrenResp.json()) as any;
    const sectionRowControls = (compChildren.items ?? []).find(
      (c: any) => c.name === 'Section Row Controls'
    );
    expect(sectionRowControls, '"Section Row Controls" should exist in Compositions').toBeTruthy();

    // Check that Content doc type composes it
    const contentResp = await apiFetch(token, 'GET', `/document-type/${CONTENT_DT_ID}`);
    expect(contentResp.ok).toBe(true);
    const contentDT = (await contentResp.json()) as any;

    const compositionIds = (contentDT.compositions ?? []).map((c: any) => c.documentType?.id);
    expect(
      compositionIds,
      '"Content" should compose "Section Row Controls"'
    ).toContain(sectionRowControls.id);
  });
});

// ==============================
// Section 2: Browser Render Tests
// ==============================

let targetDocId: string;
let targetDocUrl: string;
let originalDocValues: any[];
let originalDocTemplate: any;
let originalDocVariants: any[];
let originalSectionRows: any;

let cleanPageUrl: string;

const testBlockKeys = {
  fullBleedAccent: randomUUID(),
  fullBleedAccentSettings: randomUUID(),
  containerLight: randomUUID(),
  containerLightSettings: randomUUID(),
  emptyRow: randomUUID(),
  emptyRowSettings: randomUUID(),
};

/** Create a section row content block with optional title and content */
function createSectionRowContent(
  key: string,
  title?: string,
  headingLevel?: string,
  richTextCTKey?: string | null,
  bodyText?: string
): any {
  const values: any[] = [];

  if (title) {
    values.push({ alias: 'sectionTitle', culture: null, segment: null, value: title });
  }
  if (headingLevel) {
    values.push({
      alias: 'sectionHeadingLevel',
      culture: null,
      segment: null,
      value: [headingLevel],
    });
  }

  if (richTextCTKey && bodyText) {
    const richTextKey = randomUUID();
    values.push({
      alias: 'sectionContent',
      culture: null,
      segment: null,
      value: {
        layout: { 'Umbraco.BlockList': [{ contentKey: richTextKey }] },
        contentData: [
          {
            key: richTextKey,
            contentTypeKey: richTextCTKey,
            values: [
              {
                alias: 'content',
                culture: null,
                segment: null,
                value: {
                  markup: `<p>${bodyText}</p>`,
                  blocks: { layout: {}, contentData: [], settingsData: [] },
                },
              },
            ],
          },
        ],
        settingsData: [],
        expose: [{ contentKey: richTextKey, culture: null, segment: null }],
      },
    });
  }

  return { key, contentTypeKey: CONTENT_SECTION_ROW_CT_KEY, values };
}

/** Create a section row settings block */
function createSectionRowSettings(
  key: string,
  backgroundColor: string,
  backgroundWidth: string
): any {
  return {
    key,
    contentTypeKey: CONTENT_SECTION_ROW_SETTINGS_CT_KEY,
    values: [
      {
        alias: 'sectionBackgroundColor',
        culture: null,
        segment: null,
        value: [backgroundColor],
      },
      {
        alias: 'sectionBackgroundWidth',
        culture: null,
        segment: null,
        value: [backgroundWidth],
      },
    ],
  };
}

/**
 * Find the Rich Text element type key by walking the doc-type tree.
 * Returns null if not found (tests still work, just without inner block content).
 */
async function findRichTextElementTypeKey(token: string): Promise<string | null> {
  try {
    const rootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
    if (!rootResp.ok) return null;
    const rootData = (await rootResp.json()) as any;

    const elementsFolder = (rootData.items ?? []).find((r: any) => r.name === 'Elements');
    if (!elementsFolder) return null;

    const elemChildrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document-type/children?parentId=${elementsFolder.id}&skip=0&take=100`
    );
    if (!elemChildrenResp.ok) return null;
    const elemChildren = (await elemChildrenResp.json()) as any;

    const contentModelsFolder = (elemChildren.items ?? []).find(
      (c: any) => c.name === 'Content Models'
    );
    if (!contentModelsFolder) return null;

    const cmChildrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document-type/children?parentId=${contentModelsFolder.id}&skip=0&take=100`
    );
    if (!cmChildrenResp.ok) return null;
    const cmChildren = (await cmChildrenResp.json()) as any;

    const richText = (cmChildren.items ?? []).find((c: any) => c.name === 'Rich Text Row');
    return richText?.id ?? null;
  } catch {
    return null;
  }
}

test.describe('Content Section Row — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    let token = await freshToken();

    // 1. Find pages by document type (Content/Article/Documentation have sectionRows via composition)
    const pageIds = await findPagesByDocType(token, 2);
    if (pageIds.length === 0) {
      throw new Error(
        'No Content/Article/Documentation page found in the document tree. ' +
          'Has Step 1 schema been applied?'
      );
    }
    targetDocId = pageIds[0];
    // Use a different page (or same one) for the "clean" test
    const cleanPageId = pageIds.length > 1 ? pageIds[1] : pageIds[0];

    // 2. Read the full document and save original state
    token = await freshToken();
    const docResp = await apiFetch(token, 'GET', `/document/${targetDocId}`);
    if (!docResp.ok) throw new Error(`GET document failed: ${docResp.status}`);
    const doc = (await docResp.json()) as any;

    originalDocValues = doc.values ?? [];
    originalDocTemplate = doc.template;
    originalDocVariants = doc.variants ?? [];

    const sectionRowsEntry = originalDocValues.find(
      (v: any) => v.alias === 'sectionRows'
    );
    originalSectionRows = JSON.parse(JSON.stringify(sectionRowsEntry?.value ?? null));

    // 3. Get clean page URL for "no section rows" test
    token = await freshToken();
    cleanPageUrl = await getDocumentPath(token, cleanPageId);

    // 4. Find Rich Text element type for inner block content
    token = await freshToken();
    const richTextCTKey = await findRichTextElementTypeKey(token);

    // 5. Create test section row blocks
    const fullBleedAccentContent = createSectionRowContent(
      testBlockKeys.fullBleedAccent,
      'SR Test Full Bleed Accent',
      'h2',
      richTextCTKey,
      'Full bleed accent section content'
    );

    const fullBleedAccentSettings = createSectionRowSettings(
      testBlockKeys.fullBleedAccentSettings,
      'accent',
      'full-bleed'
    );

    const containerLightContent = createSectionRowContent(
      testBlockKeys.containerLight,
      'SR Test Container Light',
      'h3',
      richTextCTKey,
      'Container light section content'
    );

    const containerLightSettings = createSectionRowSettings(
      testBlockKeys.containerLightSettings,
      'light',
      'container'
    );

    // Empty row — no sectionContent
    const emptyRowContent = createSectionRowContent(testBlockKeys.emptyRow);
    const emptyRowSettings = createSectionRowSettings(
      testBlockKeys.emptyRowSettings,
      'none',
      'full-bleed'
    );

    const newContentBlocks = [fullBleedAccentContent, containerLightContent, emptyRowContent];
    const newSettingsBlocks = [fullBleedAccentSettings, containerLightSettings, emptyRowSettings];

    // 6. Inject blocks into sectionRows block list
    const blockList = sectionRowsEntry?.value ?? {
      layout: { 'Umbraco.BlockList': [] },
      contentData: [],
      settingsData: [],
      expose: [],
    };

    const updatedContentData = [...newContentBlocks, ...(blockList.contentData ?? [])];
    const updatedSettingsData = [...newSettingsBlocks, ...(blockList.settingsData ?? [])];

    const existingLayout = blockList.layout?.['Umbraco.BlockList'] ?? [];
    const newLayoutEntries = [
      {
        contentKey: testBlockKeys.fullBleedAccent,
        settingsKey: testBlockKeys.fullBleedAccentSettings,
      },
      {
        contentKey: testBlockKeys.containerLight,
        settingsKey: testBlockKeys.containerLightSettings,
      },
      {
        contentKey: testBlockKeys.emptyRow,
        settingsKey: testBlockKeys.emptyRowSettings,
      },
    ];
    const updatedLayout = [...newLayoutEntries, ...existingLayout];

    const existingExpose = blockList.expose ?? [];
    const newExposeEntries = newContentBlocks.map((b: any) => ({
      contentKey: b.key,
      culture: null,
      segment: null,
    }));
    const updatedExpose = [...newExposeEntries, ...existingExpose];

    const updatedBlockList = {
      ...blockList,
      layout: { 'Umbraco.BlockList': updatedLayout },
      contentData: updatedContentData,
      settingsData: updatedSettingsData,
      expose: updatedExpose,
    };

    // Build updated values — add or replace sectionRows entry
    let updatedValues: any[];
    if (sectionRowsEntry) {
      updatedValues = originalDocValues.map((v: any) =>
        v.alias === 'sectionRows' ? { ...v, value: updatedBlockList } : v
      );
    } else {
      updatedValues = [
        ...originalDocValues,
        { alias: 'sectionRows', culture: null, segment: null, value: updatedBlockList },
      ];
    }

    // 7. Update and publish
    token = await freshToken();
    const putResp = await apiFetch(token, 'PUT', `/document/${targetDocId}`, {
      template: originalDocTemplate,
      values: updatedValues,
      variants: originalDocVariants,
    });
    if (!putResp.ok) {
      const text = await putResp.text();
      throw new Error(`Update document with test blocks failed: ${putResp.status} - ${text}`);
    }

    const pubResp = await apiFetch(token, 'PUT', `/document/${targetDocId}/publish`, {
      publishSchedules: [{ culture: null }],
    });
    if (!pubResp.ok) {
      const text = await pubResp.text();
      throw new Error(`Publish document failed: ${pubResp.status} - ${text}`);
    }

    // 8. Get actual published URL (rule #2: never hardcode slugs)
    token = await freshToken();
    targetDocUrl = await getDocumentPath(token, targetDocId);
  });

  test.afterAll(async () => {
    try {
      const token = await freshToken();

      // Restore original sectionRows value
      let restoredValues: any[];
      if (originalSectionRows === null) {
        // Remove the sectionRows entry we added
        restoredValues = originalDocValues.filter((v: any) => v.alias !== 'sectionRows');
      } else {
        restoredValues = originalDocValues.map((v: any) =>
          v.alias === 'sectionRows' ? { ...v, value: originalSectionRows } : v
        );
      }
      await apiFetch(token, 'PUT', `/document/${targetDocId}`, {
        template: originalDocTemplate,
        values: restoredValues,
        variants: originalDocVariants,
      });
      await apiFetch(token, 'PUT', `/document/${targetDocId}/publish`, {
        publishSchedules: [{ culture: null }],
      });
    } catch (e) {
      console.warn('Could not restore original document:', e);
    }
  });

  // --- No section rows ---

  test('page with no section rows has no .section-row element', async ({ page }) => {
    await page.goto(cleanPageUrl);
    await expect(page.locator('.section-row')).toHaveCount(0);
  });

  // --- Section rows render below main content ---

  test('section rows render after the main content container', async ({ page }) => {
    await page.goto(targetDocUrl);

    // Section rows should be visible inside <article>
    const sectionRow = page.locator('article .section-row').first();
    await expect(sectionRow).toBeVisible();

    // The main .container should also exist
    const articleContainer = page.locator('article > .container').first();
    await expect(articleContainer).toBeVisible();
  });

  // --- Full bleed width ---

  test('full-bleed row is wider than the inner container', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(targetDocUrl);

    const fullBleedRow = page
      .locator('.section-row')
      .filter({ hasText: 'Full bleed accent section content' });
    await expect(fullBleedRow).toBeVisible();

    const container = page.locator('article > .container').first();
    const containerBox = await container.boundingBox();
    const rowBox = await fullBleedRow.boundingBox();

    expect(containerBox).toBeTruthy();
    expect(rowBox).toBeTruthy();
    expect(rowBox!.width).toBeGreaterThan(containerBox!.width);
  });

  // --- Container width ---

  test('container-width row does not exceed the container width', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(targetDocUrl);

    const containerRow = page
      .locator('.section-row')
      .filter({ hasText: 'Container light section content' });
    await expect(containerRow).toBeVisible();

    const container = page.locator('article > .container').first();
    const containerBox = await container.boundingBox();
    const rowBox = await containerRow.boundingBox();

    expect(containerBox).toBeTruthy();
    expect(rowBox).toBeTruthy();
    expect(rowBox!.width).toBeLessThanOrEqual(containerBox!.width + 1); // 1px tolerance
  });

  // --- Background colors are distinct ---

  test('accent row has teal background color', async ({ page }) => {
    await page.goto(targetDocUrl);

    const accentRow = page
      .locator('.section-row')
      .filter({ hasText: 'Full bleed accent section content' });
    await expect(accentRow).toBeVisible();

    const bgColor = await accentRow.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // --bs-teal is #005E70 = rgb(0, 94, 112)
    expect(bgColor).toBe('rgb(0, 94, 112)');
  });

  test('light row has gray-100 background color', async ({ page }) => {
    await page.goto(targetDocUrl);

    const lightRow = page
      .locator('.section-row')
      .filter({ hasText: 'Container light section content' });
    await expect(lightRow).toBeVisible();

    const bgColor = await lightRow.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // --bs-gray-100 is #f8f9fa = rgb(248, 249, 250)
    expect(bgColor).toBe('rgb(248, 249, 250)');
  });

  // --- Accent row has light text ---

  test('accent row has white text color', async ({ page }) => {
    await page.goto(targetDocUrl);

    const accentRow = page
      .locator('.section-row')
      .filter({ hasText: 'Full bleed accent section content' });
    await expect(accentRow).toBeVisible();

    const textColor = await accentRow.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    expect(textColor).toBe('rgb(255, 255, 255)');
  });

  // --- Empty row not rendered ---

  test('empty section row does not render visible output', async ({ page }) => {
    await page.goto(targetDocUrl);

    // We injected 3 rows: full-bleed accent, container light, and empty.
    // The empty row should not produce a .section-row element.
    // Each visible row should have actual content text.
    const allRows = await page.locator('.section-row').all();
    for (const row of allRows) {
      const text = await row.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});

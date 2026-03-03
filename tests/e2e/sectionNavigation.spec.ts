import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compositionDisplayName = 'Section Navigation Controls';
const compositionsFolderId = '3503b89f-2819-4e41-86d7-d17dcc5b4212';
const propertyAlias = 'showSectionNavigation';

/**
 * Workaround for a bug in @umbraco/playwright-testhelpers TreeApiHelper.recurseChildren:
 * it short-circuits on the first child with hasChildren=true, so siblings after a folder
 * are never checked. We search the Compositions folder children directly instead.
 */
async function findCompositionByName(umbracoApi: any, name: string) {
  const children = await umbracoApi.documentType.getChildren(compositionsFolderId);
  const match = children.find((c: any) => c.name === name);
  if (!match) return false;
  return await umbracoApi.documentType.get(match.id);
}

test.describe('Section Navigation Controls — Document Type Setup', () => {

  test('sectionNavigationControls composition document type exists', async ({ umbracoApi }) => {
    const docType = await findCompositionByName(umbracoApi, compositionDisplayName);
    expect(docType, `"${compositionDisplayName}" document type should exist`).toBeTruthy();
  });

  test('composition has showSectionNavigation boolean property', async ({ umbracoApi }) => {
    const docType = await findCompositionByName(umbracoApi, compositionDisplayName);
    expect(docType, `"${compositionDisplayName}" document type should exist`).toBeTruthy();

    const aliases = (docType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, `Should have a "${propertyAlias}" property`).toContain(propertyAlias);
  });

  test('content document type includes sectionNavigationControls composition', async ({ umbracoApi }) => {
    const composition = await findCompositionByName(umbracoApi, compositionDisplayName);
    expect(composition, `"${compositionDisplayName}" must exist first`).toBeTruthy();

    const contentType = await umbracoApi.documentType.getByName('Content');
    expect(contentType, '"Content" document type should exist').toBeTruthy();

    const compositionIds = (contentType.compositions ?? []).map((c: any) => c.documentType?.id);
    expect(compositionIds, `"Content" should compose "${compositionDisplayName}"`).toContain(composition.id);
  });

  test('documentation document type includes sectionNavigationControls composition', async ({ umbracoApi }) => {
    const composition = await findCompositionByName(umbracoApi, compositionDisplayName);
    expect(composition, `"${compositionDisplayName}" must exist first`).toBeTruthy();

    const docType = await umbracoApi.documentType.getByName('Documentation');
    expect(docType, '"Documentation" document type should exist').toBeTruthy();

    const compositionIds = (docType.compositions ?? []).map((c: any) => c.documentType?.id);
    expect(compositionIds, `"Documentation" should compose "${compositionDisplayName}"`).toContain(composition.id);
  });
});

test.describe('Section Navigation — View Layout (Step 3)', () => {

  const viewFiles = [
    {
      name: 'content.cshtml',
      relPath: '../../src/UmbracoProject/Views/content.cshtml',
    },
    {
      name: 'documentation.cshtml',
      relPath: '../../src/UmbracoProject/Views/documentation.cshtml',
    },
  ];

  for (const { name, relPath } of viewFiles) {
    test(`${name} reads showSectionNavigation property`, async () => {
      const viewPath = resolve(__dirname, relPath);
      const content = readFileSync(viewPath, 'utf-8');

      expect(
        content,
        `${name} should read the showSectionNavigation property`
      ).toContain('showSectionNavigation');
    });

    test(`${name} renders col-lg-3 sidebar when section nav is enabled`, async () => {
      const viewPath = resolve(__dirname, relPath);
      const content = readFileSync(viewPath, 'utf-8');

      expect(content, `${name} should have a col-lg-3 sidebar column`).toContain('col-lg-3');
      expect(content, `${name} should have a col-lg-9 content column`).toContain('col-lg-9');
    });

    test(`${name} renders sectionNavigation partial`, async () => {
      const viewPath = resolve(__dirname, relPath);
      const content = readFileSync(viewPath, 'utf-8');

      expect(
        content,
        `${name} should render the sectionNavigation partial`
      ).toContain('sectionNavigation.cshtml');
    });

    test(`${name} keeps original layout when section nav is disabled`, async () => {
      const viewPath = resolve(__dirname, relPath);
      const content = readFileSync(viewPath, 'utf-8');

      // Original layout classes should still be present for the non-section-nav path
      expect(content, `${name} should retain col-lg-8 for default layout`).toContain('col-lg-8');
      expect(content, `${name} should retain mx-auto for default layout`).toContain('mx-auto');
    });

    test(`${name} uses PartialAsync (not CachedPartialAsync) for section nav`, async () => {
      const viewPath = resolve(__dirname, relPath);
      const content = readFileSync(viewPath, 'utf-8');

      // Find lines referencing sectionNavigation - they should use PartialAsync
      const lines = content.split('\n');
      const sectionNavLines = lines.filter((l: string) => l.includes('sectionNavigation'));

      expect(
        sectionNavLines.length,
        `${name} should reference sectionNavigation partial`
      ).toBeGreaterThan(0);

      const usesCached = sectionNavLines.some((l: string) => l.includes('CachedPartialAsync'));
      expect(
        usesCached,
        `${name} should NOT use CachedPartialAsync for section nav (it's page-specific)`
      ).toBe(false);

      const usesPartialAsync = sectionNavLines.some((l: string) => l.includes('PartialAsync'));
      expect(
        usesPartialAsync,
        `${name} should use PartialAsync for section nav`
      ).toBe(true);
    });
  }
});

test.describe('Section Navigation — Partial View (Step 2)', () => {

  test('sectionNavigation.cshtml partial exists at the correct path', async () => {
    const partialPath = resolve(
      __dirname,
      '../../src/UmbracoProject/Views/Partials',
      'sectionNavigation.cshtml'
    );

    expect(
      existsSync(partialPath),
      'Partial view "sectionNavigation.cshtml" must exist at Views/Partials/'
    ).toBe(true);
  });

  test('partial contains required structural elements', async () => {
    const partialPath = resolve(
      __dirname,
      '../../src/UmbracoProject/Views/Partials',
      'sectionNavigation.cshtml'
    );

    const content = readFileSync(partialPath, 'utf-8');

    // Must use IPublishedContent model
    expect(content, 'Should inherit from UmbracoViewPage or use IPublishedContent').toMatch(
      /IPublishedContent/
    );

    // Must have desktop and mobile containers
    expect(content, 'Should have a desktop container').toContain('section-nav-desktop');
    expect(content, 'Should have a mobile container').toContain('section-nav-mobile');

    // Must have the nav element with section-nav class
    expect(content, 'Should have a nav.section-nav element').toContain('section-nav');

    // Must have the mobile toggle with Bootstrap collapse
    expect(content, 'Should have a collapse toggle button').toContain('data-bs-toggle="collapse"');
    expect(content, 'Should target sectionNavList').toContain('sectionNavList');

    // Must use IsVisible() for filtering
    expect(content, 'Should filter by IsVisible()').toMatch(/IsVisible\(\)/);

    // Must have active class logic
    expect(content, 'Should have active class logic').toContain('active');

    // Must have children list
    expect(content, 'Should have section-nav-children class').toContain('section-nav-children');

    // Must have suppression logic (render nothing when no items)
    expect(content, 'Should have early return for empty nav').toMatch(/return/);
  });
});

// ============================
// Step 4: CSS Tests
// ============================

test.describe('Section Navigation — CSS (Step 4)', () => {
  const cssPath = resolve(
    __dirname,
    '../../src/UmbracoProject/wwwroot/assets/css/styles.css'
  );

  test('styles.css contains section-nav base styles', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .section-nav base rule').toContain('.section-nav {');
    expect(css, 'Should have .section-nav ul rule').toContain('.section-nav ul');
  });

  test('styles.css contains nav-link and active state styles', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have nav-link rule').toContain('.section-nav .nav-link');
    expect(css, 'Should have active nav-link rule').toContain('.section-nav .nav-link.active');
  });

  test('styles.css contains section-nav-children styles', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .section-nav-children rule').toContain('.section-nav-children');
  });

  test('styles.css contains mobile toggle styles', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .section-nav-toggle rule').toContain('.section-nav-toggle');
    expect(css, 'Should have chevron rotation').toContain('.fa-chevron-down');
  });

  test('styles.css contains responsive desktop/mobile breakpoints', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .section-nav-desktop rule').toContain('.section-nav-desktop');
    expect(css, 'Should have .section-nav-mobile rule').toContain('.section-nav-mobile');
    expect(css, 'Should have 992px media query').toMatch(/@media\s*\([^)]*992px/);
  });
});

// ============================
// Step 5: Browser E2E Tests
// ============================

const API_BASE = process.env.URL || 'https://localhost:44367';

async function getApiToken(): Promise<string> {
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
  return ((await resp.json()) as any).access_token;
}

async function apiFetch(
  token: string,
  method: string,
  path: string,
  body?: any
) {
  return fetch(`${API_BASE}/umbraco/management/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

interface CreatePageOpts {
  name: string;
  parentId: string;
  docTypeId: string;
  templateId: string;
  values?: Array<{ alias: string; culture: null; segment: null; value: any }>;
}

async function createAndPublish(
  token: string,
  opts: CreatePageOpts
): Promise<string> {
  const createResp = await apiFetch(token, 'POST', '/document', {
    documentType: { id: opts.docTypeId },
    parent: { id: opts.parentId },
    template: { id: opts.templateId },
    values: opts.values || [],
    variants: [{ culture: null, segment: null, name: opts.name }],
  });

  if (!createResp.ok) {
    const text = await createResp.text();
    throw new Error(
      `Create "${opts.name}" failed: ${createResp.status} - ${text}`
    );
  }

  // Umbraco returns the new document ID in the Location header
  const location = createResp.headers.get('Location') || '';
  const id = location.split('/').pop()!;

  // Publish
  const pubResp = await apiFetch(token, 'PUT', `/document/${id}/publish`, {
    publishSchedules: [{ culture: null }],
  });
  if (!pubResp.ok) {
    const text = await pubResp.text();
    throw new Error(
      `Publish "${opts.name}" failed: ${pubResp.status} - ${text}`
    );
  }

  return id;
}

test.describe('Section Navigation — Browser E2E (Step 5)', () => {
  test.describe.configure({ mode: 'serial' });

  // Known IDs from Umbraco instance
  const HOME_ID = 'dcf18a51-6919-4cf8-89d1-36b94ce4d963';
  const CONTENT_DT_ID = 'b871f83c-2395-4894-be0f-5422c1a71e48';

  const createdIds: string[] = [];
  let originalAllowedDocTypes: any[] = [];

  let token: string;
  let templateId: string;

  let childAUrl: string;
  let childBUrl: string;
  let loneChildUrl: string;

  test.beforeAll(async () => {
    token = await getApiToken();

    // 1. GET the Content doc type and save original allowedDocumentTypes
    const dtResp = await apiFetch(token, 'GET', `/document-type/${CONTENT_DT_ID}`);
    if (!dtResp.ok) throw new Error(`GET Content doc type failed: ${dtResp.status}`);
    const dt = (await dtResp.json()) as any;

    templateId = dt.allowedTemplates?.[0]?.id;
    if (!templateId) throw new Error('No template found for Content doc type');

    originalAllowedDocTypes = dt.allowedDocumentTypes || [];

    // 2. Temporarily allow Content children under Content
    const alreadyAllowed = originalAllowedDocTypes.some(
      (a: any) => a.documentType?.id === CONTENT_DT_ID
    );
    if (!alreadyAllowed) {
      dt.allowedDocumentTypes = [
        ...originalAllowedDocTypes,
        { documentType: { id: CONTENT_DT_ID }, sortOrder: 0 },
      ];
      const { id: _id, ...updatePayload } = dt;
      const putResp = await apiFetch(
        token, 'PUT', `/document-type/${CONTENT_DT_ID}`, updatePayload
      );
      if (!putResp.ok) {
        const text = await putResp.text();
        throw new Error(`Update Content doc type failed: ${putResp.status} - ${text}`);
      }
    }

    // 3. Create test content hierarchy
    const base = { docTypeId: CONTENT_DT_ID, templateId };

    // Home > SN Test Parent
    const parentId = await createAndPublish(token, {
      ...base,
      name: 'SN Test Parent',
      parentId: HOME_ID,
    });
    createdIds.push(parentId);

    // SN Test Parent > Section Child A (section nav ON)
    const childAId = await createAndPublish(token, {
      ...base,
      name: 'Section Child A',
      parentId,
      values: [
        { alias: 'showSectionNavigation', culture: null, segment: null, value: true },
      ],
    });
    createdIds.push(childAId);
    childAUrl = '/sn-test-parent/section-child-a/';

    // SN Test Parent > Section Child B (section nav OFF)
    const childBId = await createAndPublish(token, {
      ...base,
      name: 'Section Child B',
      parentId,
    });
    createdIds.push(childBId);
    childBUrl = '/sn-test-parent/section-child-b/';

    // SN Test Parent > SN Hidden (umbracoNaviHide ON)
    const hiddenId = await createAndPublish(token, {
      ...base,
      name: 'SN Hidden',
      parentId,
      values: [
        { alias: 'showSectionNavigation', culture: null, segment: null, value: true },
        { alias: 'umbracoNaviHide', culture: null, segment: null, value: true },
      ],
    });
    createdIds.push(hiddenId);

    // Section Child A > SN Grandchild
    const grandchildId = await createAndPublish(token, {
      ...base,
      name: 'SN Grandchild',
      parentId: childAId,
    });
    createdIds.push(grandchildId);

    // Suppression test: lone parent with single child (no siblings, no children → suppressed)
    const loneParentId = await createAndPublish(token, {
      ...base,
      name: 'SN Lone Parent',
      parentId: HOME_ID,
    });
    createdIds.push(loneParentId);

    const loneChildId = await createAndPublish(token, {
      ...base,
      name: 'SN Lone Child',
      parentId: loneParentId,
      values: [
        { alias: 'showSectionNavigation', culture: null, segment: null, value: true },
      ],
    });
    createdIds.push(loneChildId);
    loneChildUrl = '/sn-lone-parent/sn-lone-child/';
  });

  test.afterAll(async () => {
    try { token = await getApiToken(); } catch { /* ignore */ }

    // 1. Delete test pages (children first)
    for (const id of [...createdIds].reverse()) {
      try { await apiFetch(token, 'DELETE', `/document/${id}`); } catch { /* ignore */ }
    }

    // 2. Restore Content doc type's original allowedDocumentTypes
    try {
      const dtResp = await apiFetch(token, 'GET', `/document-type/${CONTENT_DT_ID}`);
      if (dtResp.ok) {
        const dt = (await dtResp.json()) as any;
        dt.allowedDocumentTypes = originalAllowedDocTypes;
        const { id: _id, ...updatePayload } = dt;
        await apiFetch(token, 'PUT', `/document-type/${CONTENT_DT_ID}`, updatePayload);
      }
    } catch { /* best-effort */ }
  });

  // 1. showSectionNavigation = false → no .section-nav
  test('no section nav when showSectionNavigation is false', async ({
    page,
  }) => {
    await page.goto(childBUrl);
    await expect(page.locator('.section-nav')).toHaveCount(0);
  });

  // 2. showSectionNavigation = true → .section-nav exists
  test('section nav visible when showSectionNavigation is true', async ({
    page,
  }) => {
    await page.goto(childAUrl);
    await expect(page.locator('.section-nav')).toBeAttached();
  });

  // 3. Current page link has .active class (scoped to desktop to avoid duplicate matches)
  test('current page link has active class', async ({ page }) => {
    await page.goto(childAUrl);
    const activeLink = page.locator('.section-nav-desktop .nav-link.active');
    await expect(activeLink).toBeVisible();
    await expect(activeLink).toContainText('Section Child A');
  });

  // 4. Sibling page appears in list
  test('sibling page appears in section nav list', async ({ page }) => {
    await page.goto(childAUrl);
    await expect(page.locator('.section-nav')).toContainText('Section Child B');
  });

  // 5. Hidden page does not appear
  test('hidden page does not appear in section nav', async ({ page }) => {
    await page.goto(childAUrl);
    const navText = await page.locator('.section-nav').textContent();
    expect(navText).not.toContain('SN Hidden');
  });

  // 6. Grandchild appears in .section-nav-children (scoped to desktop)
  test('grandchild appears indented in section-nav-children', async ({
    page,
  }) => {
    await page.goto(childAUrl);
    await expect(page.locator('.section-nav-desktop .section-nav-children')).toContainText(
      'SN Grandchild'
    );
  });

  // 7. Desktop viewport: sidebar visible alongside content
  test('desktop: sidebar column visible alongside content', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(childAUrl);
    await expect(page.locator('.section-nav-desktop')).toBeVisible();
  });

  // 8. Mobile viewport: desktop nav hidden, toggle visible
  test('mobile: desktop nav hidden, toggle button visible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(childAUrl);
    await expect(page.locator('.section-nav-desktop')).not.toBeVisible();
    await expect(page.locator('.section-nav-toggle')).toBeVisible();
  });

  // 9. Click toggle → nav list visible
  test('mobile: click toggle shows nav list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(childAUrl);
    await page.locator('.section-nav-toggle').click();
    await expect(page.locator('#sectionNavList')).toBeVisible();
  });

  // 10. Click toggle again → nav list hidden
  test('mobile: click toggle again hides nav list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(childAUrl);
    const toggle = page.locator('.section-nav-toggle');
    await toggle.click();
    // Wait for opening animation to complete before second click
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#sectionNavList.collapse.show').waitFor();
    await toggle.click();
    await expect(page.locator('#sectionNavList')).not.toBeVisible();
  });

  // 11. Toggle aria-expanded reflects state
  test('mobile: toggle aria-expanded reflects correct state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(childAUrl);
    const toggle = page.locator('.section-nav-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    // Wait for collapse animation to complete before second click
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#sectionNavList.collapse.show').waitFor();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  // 12. No visible siblings/children → no section nav
  test('no section nav when only visible item is current page', async ({
    page,
  }) => {
    await page.goto(loneChildUrl);
    await expect(page.locator('.section-nav')).toHaveCount(0);
  });
});

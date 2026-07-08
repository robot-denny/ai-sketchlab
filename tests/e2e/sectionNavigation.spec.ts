import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compositionDisplayName = 'Section Navigation Controls';
const propertyAlias = 'showSectionNavigation';
const API_BASE = process.env.URL || 'https://localhost:44367';

// "Rich Text Row" block element type. Stable schema identifier (deploys via .uda,
// identical across environments), like the element-type keys hardcoded in
// alertBanner.spec.ts / articleListGridView.spec.ts.
const RICH_TEXT_ROW_CT_KEY = 'dd183f78-7d69-4eda-9b4c-a25970583a28';

/**
 * Minimal contentRows Block List value containing a single Rich Text Row block.
 * The v2 content template only renders the section nav inside the contentRows
 * content layout (content.cshtml gates it on `Model.ContentRows.Any()`), so a page
 * that should display the nav must carry at least one contentRows block.
 */
function contentRowsWithRichText(text: string): any {
  const key = randomUUID();
  return {
    layout: { 'Umbraco.BlockList': [{ contentKey: key }] },
    contentData: [
      {
        key,
        contentTypeKey: RICH_TEXT_ROW_CT_KEY,
        values: [
          {
            alias: 'content',
            culture: null,
            segment: null,
            value: {
              markup: `<p>${text}</p>`,
              blocks: { layout: {}, contentData: [], settingsData: [] },
            },
          },
        ],
      },
    ],
    settingsData: [],
    expose: [{ contentKey: key, culture: null, segment: null }],
  };
}

// ==============================
// Shared API Helpers (rule #4: refresh tokens)
//
// The @umbraco/playwright-testhelpers `umbracoApi` fixture fails mid-run with
// "Error refreshing access token." because auth.setup.ts obtains a
// client_credentials token (which never returns a refresh_token) and the
// testhelpers tries to rotate it anyway. Using direct API calls with a
// freshToken() helper — same pattern as contentSectionRows.spec.ts — avoids
// the broken refresh path entirely.
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

/**
 * Walks the document-type tree for the Compositions folder and returns the
 * full document-type payload for the named composition (or null if absent).
 *
 * Replaces a previous @umbraco/playwright-testhelpers-based implementation
 * (kept around the same shape) to avoid the fixture's refresh-token bug.
 * Also replaces a workaround for a testhelpers TreeApiHelper.recurseChildren
 * short-circuit — walking the Compositions folder directly sidesteps that bug
 * too. (Rule #1: never hardcode UUIDs; Rule #7: resilient lookups)
 */
async function findCompositionByName(name: string): Promise<any | null> {
  const token = await freshToken();

  const rootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
  if (!rootResp.ok) return null;
  const rootData = (await rootResp.json()) as any;
  const compositionsFolder = (rootData.items ?? []).find((r: any) => r.name === 'Compositions');
  if (!compositionsFolder) return null;

  const childrenResp = await apiFetch(
    token,
    'GET',
    `/tree/document-type/children?parentId=${compositionsFolder.id}&skip=0&take=100`
  );
  if (!childrenResp.ok) return null;
  const childrenData = (await childrenResp.json()) as any;

  const match = (childrenData.items ?? []).find((c: any) => c.name === name);
  if (!match) return null;

  const dtResp = await apiFetch(token, 'GET', `/document-type/${match.id}`);
  if (!dtResp.ok) return null;
  return await dtResp.json();
}

/**
 * Fetches a document-type by display name by walking the doc-type tree. Checks
 * root-level entries first, then descends one level into each folder (page
 * types like "Content" and "Documentation" live under a "Content Models"
 * folder; elements live under other folders). Rule #1: never hardcode UUIDs.
 */
async function getDocumentTypeByName(name: string): Promise<any | null> {
  const token = await freshToken();

  const rootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
  if (!rootResp.ok) return null;
  const rootData = (await rootResp.json()) as any;
  const rootItems = rootData.items ?? [];

  // Check root first
  const rootMatch = rootItems.find((r: any) => r.name === name);
  if (rootMatch) {
    const dtResp = await apiFetch(token, 'GET', `/document-type/${rootMatch.id}`);
    if (dtResp.ok) return await dtResp.json();
  }

  // Descend into each folder looking for the named doc-type
  for (const rootItem of rootItems) {
    if (!rootItem.hasChildren) continue;
    const childrenResp = await apiFetch(
      token,
      'GET',
      `/tree/document-type/children?parentId=${rootItem.id}&skip=0&take=100`
    );
    if (!childrenResp.ok) continue;
    const childrenData = (await childrenResp.json()) as any;
    const childMatch = (childrenData.items ?? []).find((c: any) => c.name === name);
    if (!childMatch) continue;
    const dtResp = await apiFetch(token, 'GET', `/document-type/${childMatch.id}`);
    if (dtResp.ok) return await dtResp.json();
  }

  return null;
}

test.describe('Section Navigation Controls — Document Type Setup', () => {

  test('sectionNavigationControls composition document type exists', async () => {
    const docType = await findCompositionByName(compositionDisplayName);
    expect(docType, `"${compositionDisplayName}" document type should exist`).toBeTruthy();
  });

  test('composition has showSectionNavigation boolean property', async () => {
    const docType = await findCompositionByName(compositionDisplayName);
    expect(docType, `"${compositionDisplayName}" document type should exist`).toBeTruthy();

    const aliases = (docType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, `Should have a "${propertyAlias}" property`).toContain(propertyAlias);
  });

  test('content document type includes sectionNavigationControls composition', async () => {
    const composition = await findCompositionByName(compositionDisplayName);
    expect(composition, `"${compositionDisplayName}" must exist first`).toBeTruthy();

    const contentType = await getDocumentTypeByName('Content');
    expect(contentType, '"Content" document type should exist').toBeTruthy();

    const compositionIds = (contentType.compositions ?? []).map((c: any) => c.documentType?.id);
    expect(compositionIds, `"Content" should compose "${compositionDisplayName}"`).toContain(composition.id);
  });

  test('documentation document type includes sectionNavigationControls composition', async () => {
    const composition = await findCompositionByName(compositionDisplayName);
    expect(composition, `"${compositionDisplayName}" must exist first`).toBeTruthy();

    const docType = await getDocumentTypeByName('Documentation');
    expect(docType, '"Documentation" document type should exist').toBeTruthy();

    const compositionIds = (docType.compositions ?? []).map((c: any) => c.documentType?.id);
    expect(compositionIds, `"Documentation" should compose "${compositionDisplayName}"`).toContain(composition.id);
  });

  // The "Hide From Section Navigation" toggle lives on the *Visibility Controls*
  // composition (not Section Navigation Controls) alongside the other Hide-From
  // toggles — see _plans/section-nav-hide-toggle.md Key Decisions.
  test('Visibility Controls composition has hideFromSectionNavigation boolean property', async () => {
    const docType = await findCompositionByName('Visibility Controls');
    expect(docType, '"Visibility Controls" document type should exist').toBeTruthy();

    const props = docType.properties ?? [];
    const newProp = props.find((p: any) => p.alias === 'hideFromSectionNavigation');
    expect(newProp, 'Should have a "hideFromSectionNavigation" property').toBeTruthy();

    // Prove it uses the SAME True/False data type as the existing sibling toggles
    // rather than hardcoding a data-type UUID (resilience rule #1). If it were mistyped
    // (string/dropdown) the Razor .Value<bool>() would silently default to false at runtime
    // instead of failing loudly — so pin the editor by comparing to a known boolean sibling.
    const siblingToggle = props.find((p: any) => p.alias === 'hideFromTopNavigation');
    expect(siblingToggle, 'sibling toggle "hideFromTopNavigation" should exist').toBeTruthy();
    expect(
      newProp.dataType?.id,
      'hideFromSectionNavigation should reuse the shared True/False data type of the sibling toggles'
    ).toBe(siblingToggle.dataType?.id);
  });

  // Guide page types (Guides, How-To Guide) compose a SEPARATE "Guide Visibility
  // Controls" composition, so hideFromSectionNavigation had to be mirrored there too
  // (the original toggle only landed on the standard "Visibility Controls"). NB: pin
  // the data type against umbracoNaviHide, NOT hideFromTopNavigation — the latter uses
  // a divergent (drifted) True/False data type on this composition. See ROADMAP:
  // guide-visibility-composition-consolidation.
  test('Guide Visibility Controls composition has hideFromSectionNavigation boolean property', async () => {
    // Unlike the standard "Visibility Controls", this composition lives at the doc-type
    // tree ROOT (not inside the "Compositions" folder), so findCompositionByName misses it.
    // getDocumentTypeByName checks root first, then folders — resilient either way.
    const docType = await getDocumentTypeByName('Guide Visibility Controls');
    expect(docType, '"Guide Visibility Controls" document type should exist').toBeTruthy();

    const props = docType.properties ?? [];
    const newProp = props.find((p: any) => p.alias === 'hideFromSectionNavigation');
    expect(newProp, 'Should have a "hideFromSectionNavigation" property').toBeTruthy();

    const siblingToggle = props.find((p: any) => p.alias === 'umbracoNaviHide');
    expect(siblingToggle, 'sibling toggle "umbracoNaviHide" should exist').toBeTruthy();
    expect(
      newProp.dataType?.id,
      'hideFromSectionNavigation should reuse a shared True/False data type'
    ).toBe(siblingToggle.dataType?.id);
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

    test(`${name} renders sectionNavigation partial`, async () => {
      const viewPath = resolve(__dirname, relPath);
      const content = readFileSync(viewPath, 'utf-8');

      expect(
        content,
        `${name} should render the sectionNavigation partial`
      ).toContain('sectionNavigation.cshtml');
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

    // Must emit the v2 .section-nav aside
    expect(content, 'Should render an <aside class="section-nav">').toMatch(
      /<aside[^>]*class="section-nav"/
    );

    // Must use IsVisible() for filtering
    expect(content, 'Should filter by IsVisible()').toMatch(/IsVisible\(\)/);

    // Must additionally filter on the hideFromSectionNavigation toggle
    expect(content, 'Should filter by hideFromSectionNavigation').toMatch(/hideFromSectionNavigation/);

    // Must emit the v2 active-link modifier
    expect(content, 'Should have is-current class for active links').toContain('is-current');

    // Must emit the v2 child-link modifier
    expect(content, 'Should have li.child for nested children').toMatch(/class="child"/);

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
    '../../src/UmbracoProject/wwwroot/assets/css/site-chrome.css'
  );

  test('site-chrome.css contains section-nav base styles', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .section-nav base rule').toMatch(/\.section-nav\s*\{/);
    expect(css, 'Should have .section-nav ul rule').toMatch(/\.section-nav\s+ul/);
  });

  test('site-chrome.css contains link and is-current state styles', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .section-nav a rule').toMatch(/\.section-nav\s+a/);
    expect(css, 'Should have .section-nav a.is-current rule').toMatch(/\.section-nav\s+a\.is-current/);
  });

  test('site-chrome.css contains child indent styles', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .section-nav li.child rule').toMatch(/\.section-nav\s+li\.child/);
  });

  test('site-chrome.css contains .content grid layout', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have .content grid rule').toMatch(/\.content\s*\{/);
    expect(css, 'Should have .content.no-nav single-column rule').toMatch(/\.content\.no-nav/);
  });

  test('site-chrome.css makes section-nav static at narrow viewports', async () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css, 'Should have a narrow-viewport media query').toMatch(/@media\s*\([^)]*820px/);
    expect(css, 'Should set .section-nav to position:static at narrow widths').toMatch(
      /\.section-nav\s*\{[^}]*position\s*:\s*static/
    );
  });
});

// ============================
// Step 5: Browser E2E Tests
// (freshToken / apiFetch defined at top of file — shared with setup tests.)
// ============================

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

/** Fetch the published path for a document (rule #2: never hardcode URL slugs) */
async function getDocumentPath(token: string, docId: string): Promise<string> {
  const resp = await apiFetch(token, 'GET', `/document/urls?id=${docId}`);
  if (!resp.ok) throw new Error(`GET document URLs failed for ${docId}: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

/** Recursively delete a document and all its children */
async function deleteDocTree(token: string, id: string) {
  const childResp = await apiFetch(token, 'GET', `/tree/document/children?parentId=${id}&skip=0&take=100`);
  if (childResp.ok) {
    const childData = (await childResp.json()) as any;
    const children = childData.items ?? childData;
    for (const child of children) {
      await deleteDocTree(token, child.id);
    }
  }
  await apiFetch(token, 'DELETE', `/document/${id}`);
}

/** Clean up leftover test pages from a previous failed run (rule #3) */
async function cleanStaleTestPages(token: string, parentId: string, names: string[]) {
  const childResp = await apiFetch(token, 'GET', `/tree/document/children?parentId=${parentId}&skip=0&take=100`);
  if (!childResp.ok) return;
  const childData = (await childResp.json()) as any;
  const children = childData.items ?? childData;
  // Document tree items store names in variants[0].name
  for (const child of children) {
    const childName = child.variants?.[0]?.name ?? child.name;
    if (names.includes(childName)) {
      await deleteDocTree(token, child.id);
    }
  }
}

test.describe('Section Navigation — Browser E2E (Step 5)', () => {
  test.describe.configure({ mode: 'serial' });

  // Dynamically resolved in beforeAll (rule #1: never hardcode UUIDs)
  let homeId: string;
  let contentDtId: string;

  const createdIds: string[] = [];
  let originalAllowedDocTypes: any[] = [];

  let token: string;
  let templateId: string;

  let childAUrl: string;
  let childBUrl: string;
  let loneChildUrl: string;
  let secNavSuppressionVisibleChildUrl: string;

  // The fixture hierarchy now creates ~11 pages sequentially (each a create+publish
  // round-trip); the default 30s hook budget is too tight. Give setup/teardown more room.
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    token = await freshToken();

    // 1. Dynamically find Home page (rule #1: never hardcode UUIDs)
    // Document tree items store names in variants[0].name, not .name
    const docRootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
    if (!docRootResp.ok) throw new Error(`GET document tree root failed: ${docRootResp.status}`);
    const docRootData = (await docRootResp.json()) as any;
    const homeNode = (docRootData.items ?? []).find(
      (d: any) => (d.variants?.[0]?.name ?? d.name) === 'Home'
    );
    if (!homeNode) throw new Error('Home page not found in document tree root');
    homeId = homeNode.id;

    // 2. Dynamically find Content document type (rule #1)
    // Content lives inside the "Pages" folder in the doc-type tree
    const dtRootResp = await apiFetch(token, 'GET', '/tree/document-type/root?skip=0&take=100');
    if (!dtRootResp.ok) throw new Error(`GET doc type tree root failed: ${dtRootResp.status}`);
    const dtRootData = (await dtRootResp.json()) as any;
    const pagesFolder = (dtRootData.items ?? []).find((d: any) => d.name === 'Pages');
    if (!pagesFolder) throw new Error('"Pages" folder not found in doc-type tree root');
    const pagesChildrenResp = await apiFetch(
      token, 'GET', `/tree/document-type/children?parentId=${pagesFolder.id}&skip=0&take=100`
    );
    if (!pagesChildrenResp.ok) throw new Error(`GET Pages children failed: ${pagesChildrenResp.status}`);
    const pagesChildren = (await pagesChildrenResp.json()) as any;
    const contentDTNode = (pagesChildren.items ?? []).find((d: any) => d.name === 'Content');
    if (!contentDTNode) throw new Error('"Content" document type not found in Pages folder');
    contentDtId = contentDTNode.id;

    // 3. Clean up stale test data from previous failed runs (rule #3)
    await cleanStaleTestPages(token, homeId, ['SN Test Parent', 'SN Lone Parent', 'SN SecNav Lone Parent']);

    // 4. GET the Content doc type for template and allowed children
    token = await freshToken();
    const dtResp = await apiFetch(token, 'GET', `/document-type/${contentDtId}`);
    if (!dtResp.ok) throw new Error(`GET Content doc type failed: ${dtResp.status}`);
    const dt = (await dtResp.json()) as any;

    templateId = dt.allowedTemplates?.[0]?.id;
    if (!templateId) throw new Error('No template found for Content doc type');

    originalAllowedDocTypes = dt.allowedDocumentTypes || [];

    // 5. Temporarily allow Content children under Content
    const alreadyAllowed = originalAllowedDocTypes.some(
      (a: any) => a.documentType?.id === contentDtId
    );
    if (!alreadyAllowed) {
      dt.allowedDocumentTypes = [
        ...originalAllowedDocTypes,
        { documentType: { id: contentDtId }, sortOrder: 0 },
      ];
      const { id: _id, ...updatePayload } = dt;
      const putResp = await apiFetch(
        token, 'PUT', `/document-type/${contentDtId}`, updatePayload
      );
      if (!putResp.ok) {
        const text = await putResp.text();
        throw new Error(`Update Content doc type failed: ${putResp.status} - ${text}`);
      }
    }

    // 6. Create test content hierarchy
    token = await freshToken();
    const base = { docTypeId: contentDtId, templateId };

    // Home > SN Test Parent
    const parentId = await createAndPublish(token, {
      ...base,
      name: 'SN Test Parent',
      parentId: homeId,
    });
    createdIds.push(parentId);

    // SN Test Parent > Section Child A (section nav ON)
    const childAId = await createAndPublish(token, {
      ...base,
      name: 'Section Child A',
      parentId,
      values: [
        { alias: 'showSectionNavigation', culture: null, segment: null, value: true },
        // The section nav renders inside the contentRows content layout
        // (content.cshtml gates it on Model.ContentRows.Any()), so this page needs
        // at least one contentRows block for the nav to appear.
        { alias: 'contentRows', culture: null, segment: null, value: contentRowsWithRichText('SN test content') },
      ],
    });
    createdIds.push(childAId);

    // SN Test Parent > Section Child B (section nav OFF)
    const childBId = await createAndPublish(token, {
      ...base,
      name: 'Section Child B',
      parentId,
    });
    createdIds.push(childBId);

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

    // SN Test Parent > SN SecNav Hidden (hideFromSectionNavigation ON, umbracoNaviHide OFF).
    // Covers both: a sibling excluded by the new toggle, AND independence from the
    // Hide-From-Search toggle (umbracoNaviHide is unticked, yet it's still filtered out).
    const secNavHiddenSiblingId = await createAndPublish(token, {
      ...base,
      name: 'SN SecNav Hidden',
      parentId,
      values: [
        { alias: 'showSectionNavigation', culture: null, segment: null, value: true },
        { alias: 'hideFromSectionNavigation', culture: null, segment: null, value: true },
      ],
    });
    createdIds.push(secNavHiddenSiblingId);

    // Section Child A > SN Grandchild
    token = await freshToken();
    const grandchildId = await createAndPublish(token, {
      ...base,
      name: 'SN Grandchild',
      parentId: childAId,
    });
    createdIds.push(grandchildId);

    // Section Child A > SN SecNav Hidden Child (hideFromSectionNavigation ON).
    // Should be absent from the indented .section-nav li.child list under Section Child A.
    const secNavHiddenChildId = await createAndPublish(token, {
      ...base,
      name: 'SN SecNav Hidden Child',
      parentId: childAId,
      values: [
        { alias: 'hideFromSectionNavigation', culture: null, segment: null, value: true },
      ],
    });
    createdIds.push(secNavHiddenChildId);

    // Suppression test: lone parent with single child (no siblings, no children → suppressed)
    const loneParentId = await createAndPublish(token, {
      ...base,
      name: 'SN Lone Parent',
      parentId: homeId,
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

    // Suppression via the new toggle: a parent whose only *other* sibling is hidden
    // by hideFromSectionNavigation. On the visible child's page the sibling list is
    // [current page, hidden sibling]; after filtering the hidden one out, no other
    // siblings and no children remain → the partial suppresses (0 .section-nav).
    token = await freshToken();
    const secNavLoneParentId = await createAndPublish(token, {
      ...base,
      name: 'SN SecNav Lone Parent',
      parentId: homeId,
    });
    createdIds.push(secNavLoneParentId);

    const secNavVisibleChildId = await createAndPublish(token, {
      ...base,
      name: 'SN SecNav Visible Child',
      parentId: secNavLoneParentId,
      values: [
        { alias: 'showSectionNavigation', culture: null, segment: null, value: true },
      ],
    });
    createdIds.push(secNavVisibleChildId);

    const secNavHiddenSiblingId2 = await createAndPublish(token, {
      ...base,
      name: 'SN SecNav Hidden Suppression Sibling',
      parentId: secNavLoneParentId,
      values: [
        { alias: 'hideFromSectionNavigation', culture: null, segment: null, value: true },
      ],
    });
    createdIds.push(secNavHiddenSiblingId2);

    // 7. Fetch actual published URLs (rule #2: never hardcode URL slugs)
    token = await freshToken();
    childAUrl = await getDocumentPath(token, childAId);
    childBUrl = await getDocumentPath(token, childBId);
    loneChildUrl = await getDocumentPath(token, loneChildId);
    secNavSuppressionVisibleChildUrl = await getDocumentPath(token, secNavVisibleChildId);
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    try { token = await freshToken(); } catch { /* ignore */ }

    // 1. Delete test pages (children first)
    for (const id of [...createdIds].reverse()) {
      try { await apiFetch(token, 'DELETE', `/document/${id}`); } catch { /* ignore */ }
    }

    // 2. Restore Content doc type's original allowedDocumentTypes
    if (contentDtId) {
      try {
        const dtResp = await apiFetch(token, 'GET', `/document-type/${contentDtId}`);
        if (dtResp.ok) {
          const dt = (await dtResp.json()) as any;
          dt.allowedDocumentTypes = originalAllowedDocTypes;
          const { id: _id, ...updatePayload } = dt;
          await apiFetch(token, 'PUT', `/document-type/${contentDtId}`, updatePayload);
        }
      } catch { /* best-effort */ }
    }
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

  // 3. Current page link has .is-current class
  test('current page link has is-current class', async ({ page }) => {
    await page.goto(childAUrl);
    const currentLink = page.locator('.section-nav a.is-current');
    await expect(currentLink).toBeVisible();
    await expect(currentLink).toContainText('Section Child A');
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

  // 6. Grandchild appears as a li.child entry
  test('grandchild appears indented as li.child', async ({ page }) => {
    await page.goto(childAUrl);
    await expect(page.locator('.section-nav li.child')).toContainText('SN Grandchild');
  });

  // 7. Desktop viewport: section-nav visible alongside content (sticky rail)
  test('desktop: section-nav visible alongside content', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(childAUrl);
    await expect(page.locator('.section-nav')).toBeVisible();
    // Two-column .content grid is in effect at desktop widths.
    const position = await page
      .locator('.section-nav')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });

  // 8. Mobile viewport: section-nav still visible (static, stacked above body)
  test('mobile: section-nav visible and statically positioned', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(childAUrl);
    const sectionNav = page.locator('.section-nav');
    await expect(sectionNav).toBeVisible();
    const position = await sectionNav.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('static');
  });

  // 9. No visible siblings/children → no section nav
  test('no section nav when only visible item is current page', async ({
    page,
  }) => {
    await page.goto(loneChildUrl);
    await expect(page.locator('.section-nav')).toHaveCount(0);
  });

  // 10. Sibling hidden via hideFromSectionNavigation is absent; an unticked sibling present
  test('sibling with hideFromSectionNavigation is absent; unticked sibling present', async ({
    page,
  }) => {
    await page.goto(childAUrl);
    // Section Child B (unticked) is still present
    await expect(page.locator('.section-nav')).toContainText('Section Child B');
    // SN SecNav Hidden (hideFromSectionNavigation ON) is filtered out
    const navText = await page.locator('.section-nav').textContent();
    expect(navText).not.toContain('SN SecNav Hidden');
  });

  // 11. Independence of the two filters, proven bidirectionally on Section Child A's sibling list:
  //   - "SN SecNav Hidden": hideFromSectionNavigation ON, umbracoNaviHide OFF → excluded by the NEW toggle
  //     (it would appear if only IsVisible() were applied, so its absence proves the new toggle filters it).
  //   - "SN Hidden": umbracoNaviHide ON, hideFromSectionNavigation unset → excluded by IsVisible() alone.
  //   - "Section Child B": neither flag set → included.
  // Together these show the two filters act independently, in both directions.
  test('the section-nav and search/IsVisible filters are independent', async ({
    page,
  }) => {
    await page.goto(childAUrl);
    const navText = (await page.locator('.section-nav').textContent()) ?? '';
    // Excluded by the new toggle alone (umbracoNaviHide unticked).
    expect(navText).not.toContain('SN SecNav Hidden');
    // Excluded by umbracoNaviHide alone (hideFromSectionNavigation unset).
    expect(navText).not.toContain('SN Hidden');
    // Neither flag set → included.
    expect(navText).toContain('Section Child B');
  });

  // 12. Child hidden via hideFromSectionNavigation absent from the indented li.child list
  test('child with hideFromSectionNavigation is absent from li.child list', async ({
    page,
  }) => {
    await page.goto(childAUrl);
    // The visible grandchild is present
    await expect(page.locator('.section-nav li.child')).toContainText('SN Grandchild');
    // The hidden child is filtered out
    const childrenText = await page.locator('.section-nav li.child').allTextContents();
    expect(childrenText.join(' ')).not.toContain('SN SecNav Hidden Child');
  });

  // 13. Suppression: toggle removes the last meaningful sibling → no section nav
  test('no section nav when hideFromSectionNavigation removes the last sibling', async ({
    page,
  }) => {
    await page.goto(secNavSuppressionVisibleChildUrl);
    await expect(page.locator('.section-nav')).toHaveCount(0);
  });
});

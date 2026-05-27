import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { getDocumentTypeByName } from '../_umbracoApi';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const elementTypeName = 'Alert Banner';
const ALERT_BANNER_CT_KEY = '17c66d28-107b-4934-bc01-3b5777d42c8a';
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

// ==============================
// Section 1: Element Type Tests
// ==============================

test.describe('Alert Banner — Element Type', () => {
  test('element type exists with correct properties including iconOverride', async () => {
    const elementType = await getDocumentTypeByName(elementTypeName);
    expect(elementType, `"${elementTypeName}" should exist`).toBeTruthy();
    expect(elementType.isElement).toBe(true);

    const aliases = (elementType.properties ?? []).map((p: any) => p.alias);
    expect(aliases).toContain('alertLevel');
    expect(aliases).toContain('alertContent');
    expect(aliases).toContain('iconOverride');
  });

  test('iconOverride property is optional and uses dropdown editor', async () => {
    const elementType = await getDocumentTypeByName(elementTypeName);
    expect(elementType).toBeTruthy();

    const prop = (elementType.properties ?? []).find(
      (p: any) => p.alias === 'iconOverride'
    );
    expect(prop, 'iconOverride property should exist').toBeTruthy();
    expect(prop.isMandatory, 'iconOverride should not be mandatory').toBeFalsy();
  });
});

// ==============================
// Section 2: Partial View Tests
// ==============================

test.describe('Alert Banner — Partial View', () => {
  const partialPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/Views/Partials/blocklist/Components/alertBanner.cshtml'
  );

  test('partial view file exists', () => {
    expect(existsSync(partialPath)).toBe(true);
  });

  test('partial contains icon override logic and flexbox layout', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toContain('iconOverride');
    expect(content).toContain('d-flex');
    expect(content).toContain('fa-solid fa-circle-exclamation');
    expect(content).toContain('fa-solid fa-triangle-exclamation');
    expect(content).toContain('fa-solid fa-circle-info');
  });
});

// ==============================
// Section 3: Browser E2E Tests
// ==============================

// Module-level state for browser tests
let targetDocId: string;
let targetDocUrl: string;
let originalDocValues: any[];
let originalDocTemplate: any;
let originalDocVariants: any[];
let originalContentRows: any;

// Unique keys for the test blocks
const testBlockKeys = {
  emergency: randomUUID(),
  warning: randomUUID(),
  info: randomUUID(),
  override: randomUUID(),
};

/**
 * Create a block contentData entry for an alert banner.
 * Dropdown values are arrays (Umbraco.DropDown.Flexible).
 * Rich text (Tiptap) values use { markup, blocks } format.
 */
function createAlertBlock(
  key: string,
  level: string,
  labelText: string,
  iconOverride?: string
): any {
  const values: any[] = [
    { alias: 'alertLevel', culture: null, segment: null, value: [level] },
    {
      alias: 'alertContent',
      culture: null,
      segment: null,
      value: {
        markup: `<p>${labelText}</p>`,
        blocks: { layout: {}, contentData: [], settingsData: [] },
      },
    },
  ];

  if (iconOverride) {
    values.push({
      alias: 'iconOverride',
      culture: null,
      segment: null,
      value: [iconOverride],
    });
  }

  return { key, contentTypeKey: ALERT_BANNER_CT_KEY, values };
}

test.describe('Alert Banner Icons — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    let token = await freshToken();

    // 1. Walk the document tree to find a page with contentRows (rule #1: dynamic lookup)
    const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
    if (!rootResp.ok) throw new Error(`GET doc tree root failed: ${rootResp.status}`);
    const rootData = (await rootResp.json()) as any;

    let foundDocId: string | null = null;

    for (const item of rootData.items ?? []) {
      // Check this page
      const docResp = await apiFetch(token, 'GET', `/document/${item.id}`);
      if (docResp.ok) {
        const doc = (await docResp.json()) as any;
        if ((doc.values ?? []).some((v: any) => v.alias === 'contentRows')) {
          foundDocId = item.id;
          break;
        }
      }

      // Check one level of children
      if (item.hasChildren && !foundDocId) {
        const childResp = await apiFetch(
          token,
          'GET',
          `/tree/document/children?parentId=${item.id}&skip=0&take=100`
        );
        if (childResp.ok) {
          const childData = (await childResp.json()) as any;
          for (const child of childData.items ?? []) {
            token = await freshToken();
            const cDocResp = await apiFetch(token, 'GET', `/document/${child.id}`);
            if (cDocResp.ok) {
              const cDoc = (await cDocResp.json()) as any;
              if ((cDoc.values ?? []).some((v: any) => v.alias === 'contentRows')) {
                foundDocId = child.id;
                break;
              }
            }
          }
        }
      }
      if (foundDocId) break;
    }

    if (!foundDocId) {
      throw new Error(
        'No page with contentRows block list found in the document tree. ' +
          'The demo site must have a page with a contentRows block list.'
      );
    }
    targetDocId = foundDocId;

    // 2. Read the full document and save original state
    token = await freshToken();
    const docResp = await apiFetch(token, 'GET', `/document/${targetDocId}`);
    if (!docResp.ok) throw new Error(`GET document failed: ${docResp.status}`);
    const doc = (await docResp.json()) as any;

    originalDocValues = doc.values ?? [];
    originalDocTemplate = doc.template;
    originalDocVariants = doc.variants ?? [];

    const contentRowsEntry = originalDocValues.find(
      (v: any) => v.alias === 'contentRows'
    );
    originalContentRows = JSON.parse(JSON.stringify(contentRowsEntry?.value ?? null));

    // 3. Create test alert banner blocks with identifiable text
    const emergencyBlock = createAlertBlock(
      testBlockKeys.emergency,
      'emergency',
      'ABTest emergency alert'
    );
    const warningBlock = createAlertBlock(
      testBlockKeys.warning,
      'warning',
      'ABTest warning alert'
    );
    const infoBlock = createAlertBlock(
      testBlockKeys.info,
      'informational',
      'ABTest info alert'
    );
    const overrideBlock = createAlertBlock(
      testBlockKeys.override,
      'informational',
      'ABTest override alert',
      'fa-solid fa-heart'
    );

    const newBlocks = [emergencyBlock, warningBlock, infoBlock, overrideBlock];

    // 4. Inject blocks at the start of the existing block list
    const blockList = contentRowsEntry?.value ?? {
      layout: { 'Umbraco.BlockList': [] },
      contentData: [],
      settingsData: [],
      expose: [],
    };

    const updatedContentData = [...newBlocks, ...(blockList.contentData ?? [])];

    const existingLayout = blockList.layout?.['Umbraco.BlockList'] ?? [];
    const newLayoutEntries = newBlocks.map((b: any) => ({ contentKey: b.key }));
    const updatedLayout = [...newLayoutEntries, ...existingLayout];

    const existingExpose = blockList.expose ?? [];
    const newExposeEntries = newBlocks.map((b: any) => ({
      contentKey: b.key,
      culture: null,
      segment: null,
    }));
    const updatedExpose = [...newExposeEntries, ...existingExpose];

    const updatedBlockList = {
      ...blockList,
      layout: { 'Umbraco.BlockList': updatedLayout },
      contentData: updatedContentData,
      expose: updatedExpose,
    };

    const updatedValues = originalDocValues.map((v: any) =>
      v.alias === 'contentRows' ? { ...v, value: updatedBlockList } : v
    );

    // 5. Update and publish
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

    // 6. Get actual published URL (rule #2: never hardcode slugs)
    token = await freshToken();
    targetDocUrl = await getDocumentPath(token, targetDocId);
  });

  test.afterAll(async () => {
    try {
      const token = await freshToken();

      // Restore original contentRows value
      const restoredValues = originalDocValues.map((v: any) =>
        v.alias === 'contentRows' ? { ...v, value: originalContentRows } : v
      );
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

  test('emergency alert renders default icon (fa-circle-exclamation) in .alert-danger', async ({
    page,
  }) => {
    await page.goto(targetDocUrl);
    const alert = page.locator('.alert-danger').filter({ hasText: 'ABTest emergency alert' });
    await expect(alert).toBeVisible();
    // FA JS replaces <i> with <svg> elements in the DOM
    await expect(alert.locator('svg.fa-circle-exclamation')).toBeVisible();
  });

  test('warning alert renders default icon (fa-triangle-exclamation) in .alert-warning', async ({
    page,
  }) => {
    await page.goto(targetDocUrl);
    const alert = page.locator('.alert-warning').filter({ hasText: 'ABTest warning alert' });
    await expect(alert).toBeVisible();
    await expect(alert.locator('svg.fa-triangle-exclamation')).toBeVisible();
  });

  test('informational alert renders default icon (fa-circle-info) in .alert-info', async ({
    page,
  }) => {
    await page.goto(targetDocUrl);
    const alert = page.locator('.alert-info').filter({ hasText: 'ABTest info alert' });
    await expect(alert).toBeVisible();
    await expect(alert.locator('svg.fa-circle-info')).toBeVisible();
  });

  test('alert with icon override renders fa-heart instead of default', async ({
    page,
  }) => {
    await page.goto(targetDocUrl);
    const alert = page.locator('.alert-info').filter({ hasText: 'ABTest override alert' });
    await expect(alert).toBeVisible();
    // Override should show fa-heart, not the default fa-circle-info
    await expect(alert.locator('svg.fa-heart')).toBeVisible();
    await expect(alert.locator('svg.fa-circle-info')).toHaveCount(0);
  });
});

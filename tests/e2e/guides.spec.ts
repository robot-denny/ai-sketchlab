import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import dotenv from 'dotenv';

dotenv.config();

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

/**
 * Resolve a doc-type id by name via a recursive Management-API tree walk.
 * Workaround for the `getByName(...)` short-circuit bug in @umbraco/playwright-testhelpers.
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

async function findDataTypeIdByName(token: string, name: string): Promise<string | null> {
  async function walk(parentId: string | null): Promise<string | null> {
    const path = parentId
      ? `/tree/data-type/children?parentId=${parentId}&skip=0&take=100`
      : `/tree/data-type/root?skip=0&take=100`;
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

test.describe('Guides schema', () => {
  test('True/False (default true) data type exists with default=1', async () => {
    const token = await freshToken();
    const id = await findDataTypeIdByName(token, 'True/False (default true)');
    expect(id, '"True/False (default true)" data type should exist').toBeTruthy();

    const resp = await apiFetch(token, 'GET', `/data-type/${id}`);
    expect(resp.ok, 'data type GET succeeds').toBeTruthy();
    const dt = (await resp.json()) as any;
    expect(dt.editorAlias).toBe('Umbraco.TrueFalse');
    const defaultValue = (dt.values ?? []).find((v: any) => v.alias === 'default')?.value;
    // backoffice serialises booleans as `true` or the string "1" depending on UI
    expect(
      defaultValue === true || defaultValue === '1' || defaultValue === 1,
      'default toggle value should be truthy (true / "1" / 1)'
    ).toBeTruthy();
  });

  // SKIPPED 2026-07-08: the 4th property (hideFromSectionNavigation) is correct in git but is
  // stuck mid-propagation on Cloud — the #23 deploy failed at extraction, so Dev's/Live's DB
  // still has 3 properties while the .uda has 4, and Deploy reports "up to date" (it diffs
  // commit-to-commit, not file-to-DB), so neither the dashboard nor an API import re-applies it.
  // Un-skip once the guide composition is force-re-extracted on the Cloud envs. Tracked in
  // ROADMAP: guide-visibility-composition-consolidation.
  test.skip('Guide Visibility Controls composition exists with four boolean properties', async () => {
    const token = await freshToken();
    const id = await findDocTypeIdByName(token, 'Guide Visibility Controls');
    expect(id, '"Guide Visibility Controls" composition should exist').toBeTruthy();

    const resp = await apiFetch(token, 'GET', `/document-type/${id}`);
    expect(resp.ok).toBeTruthy();
    const dt = (await resp.json()) as any;
    expect(dt.alias).toBe('guideVisibilityControls');

    const aliases = (dt.properties ?? []).map((p: any) => p.alias).sort();
    expect(aliases).toEqual(
      // hideFromSectionNavigation added 2026-07-08 to mirror the standard Visibility
      // Controls composition (guide page types were previously missing the toggle).
      ['hideFromSectionNavigation', 'hideFromTopNavigation', 'hideFromXMLSitemap', 'umbracoNaviHide'].sort()
    );

    // hideFromTopNavigation must use the new default-true data type
    const defaultTrueId = await findDataTypeIdByName(token, 'True/False (default true)');
    const sharedTrueFalseId = await findDataTypeIdByName(token, 'True/false');
    const hideFromTopNav = (dt.properties ?? []).find(
      (p: any) => p.alias === 'hideFromTopNavigation'
    );
    expect(hideFromTopNav?.dataType?.id).toBe(defaultTrueId);

    // umbracoNaviHide, hideFromXMLSitemap and hideFromSectionNavigation must use the shared True/False
    for (const alias of ['umbracoNaviHide', 'hideFromXMLSitemap', 'hideFromSectionNavigation']) {
      const prop = (dt.properties ?? []).find((p: any) => p.alias === alias);
      expect(prop?.dataType?.id, `${alias} should use shared True/False`).toBe(sharedTrueFalseId);
    }

    // All four properties must live on a "Visibility" tab
    const visibilityContainer = (dt.containers ?? []).find(
      (c: any) => c.name === 'Visibility'
    );
    expect(visibilityContainer, 'Visibility tab should exist').toBeTruthy();
    for (const alias of ['hideFromTopNavigation', 'umbracoNaviHide', 'hideFromXMLSitemap', 'hideFromSectionNavigation']) {
      const prop = (dt.properties ?? []).find((p: any) => p.alias === alias);
      expect(prop?.container?.id).toBe(visibilityContainer.id);
    }
  });

  test('Guides parent doc type has the expected shape', async () => {
    const token = await freshToken();
    const id = await findDocTypeIdByName(token, 'Guides');
    expect(id, '"Guides" doc type should exist').toBeTruthy();

    const resp = await apiFetch(token, 'GET', `/document-type/${id}`);
    expect(resp.ok).toBeTruthy();
    const dt = (await resp.json()) as any;
    expect(dt.alias).toBe('guides');

    // Required compositions
    const expectedCompositionNames = [
      'Header Controls',
      'SEO Controls',
      'Section Row Controls',
      'Guide Visibility Controls',
    ];
    const expectedCompositionIds = await Promise.all(
      expectedCompositionNames.map((n) => findDocTypeIdByName(token, n))
    );
    const compositionIds = (dt.compositions ?? []).map(
      (c: any) => c.documentType?.id
    );
    for (let i = 0; i < expectedCompositionNames.length; i++) {
      expect(
        compositionIds,
        `Guides must include ${expectedCompositionNames[i]}`
      ).toContain(expectedCompositionIds[i]);
    }

    // Allowed children: only howToGuidePage
    const howToId = await findDocTypeIdByName(token, 'How-To Guide Page');
    expect(howToId, '"How-To Guide Page" should exist for allowedChildren check').toBeTruthy();
    const allowedChildIds = (dt.allowedDocumentTypes ?? []).map(
      (a: any) => a.documentType?.id
    );
    expect(allowedChildIds, 'Guides must allow How-To Guide Page as child').toContain(howToId);
    expect(allowedChildIds.length, 'Guides should have exactly one allowed child type').toBe(1);

    // No own properties
    expect(
      (dt.properties ?? []).length,
      'Guides should have no own properties'
    ).toBe(0);
  });

  test('How-To Guide Page doc type has description, screenshot, generationMetadata properties', async () => {
    const token = await freshToken();
    const id = await findDocTypeIdByName(token, 'How-To Guide Page');
    expect(id, '"How-To Guide Page" doc type should exist').toBeTruthy();

    const resp = await apiFetch(token, 'GET', `/document-type/${id}`);
    expect(resp.ok).toBeTruthy();
    const dt = (await resp.json()) as any;
    expect(dt.alias).toBe('howToGuidePage');

    const aliases = (dt.properties ?? []).map((p: any) => p.alias);
    expect(aliases).toContain('description');
    expect(aliases).toContain('screenshot');
    expect(aliases).toContain('generationMetadata');

    // Compositions
    const expectedCompositionNames = [
      'Header Controls',
      'SEO Controls',
      'Section Row Controls',
      'Guide Visibility Controls',
    ];
    const expectedCompositionIds = await Promise.all(
      expectedCompositionNames.map((n) => findDocTypeIdByName(token, n))
    );
    const compositionIds = (dt.compositions ?? []).map(
      (c: any) => c.documentType?.id
    );
    for (let i = 0; i < expectedCompositionNames.length; i++) {
      expect(
        compositionIds,
        `How-To Guide Page must include ${expectedCompositionNames[i]}`
      ).toContain(expectedCompositionIds[i]);
    }

    // generationMetadata must be a multi-line text (Textarea editor) with the warning description
    const genMeta = (dt.properties ?? []).find((p: any) => p.alias === 'generationMetadata');
    expect(genMeta?.description).toMatch(/auto-managed.*\/guide/i);
    expect(genMeta?.validation?.mandatory ?? false).toBe(false);

    // description must use a Tiptap rich text editor
    const description = (dt.properties ?? []).find((p: any) => p.alias === 'description');
    const descDataTypeResp = await apiFetch(
      token,
      'GET',
      `/data-type/${description.dataType.id}`
    );
    const descDataType = (await descDataTypeResp.json()) as any;
    expect(descDataType.editorUiAlias).toBe('Umb.PropertyEditorUi.Tiptap');
    expect(description?.validation?.mandatory ?? false).toBe(false);

    // screenshot must use a Media Picker editor
    const screenshot = (dt.properties ?? []).find((p: any) => p.alias === 'screenshot');
    const shotDataTypeResp = await apiFetch(
      token,
      'GET',
      `/data-type/${screenshot.dataType.id}`
    );
    const shotDataType = (await shotDataTypeResp.json()) as any;
    expect(shotDataType.editorUiAlias).toBe('Umb.PropertyEditorUi.MediaPicker');
    expect(screenshot?.validation?.mandatory ?? false).toBe(false);

    // No allowed children
    expect((dt.allowedDocumentTypes ?? []).length).toBe(0);
  });

  test('Home allows Guides as a child', async () => {
    const token = await freshToken();
    const homeId = await findDocTypeIdByName(token, 'Home');
    expect(homeId, '"Home" doc type should exist').toBeTruthy();

    const guidesId = await findDocTypeIdByName(token, 'Guides');
    expect(guidesId, '"Guides" doc type should exist').toBeTruthy();

    const resp = await apiFetch(token, 'GET', `/document-type/${homeId}`);
    expect(resp.ok).toBeTruthy();
    const home = (await resp.json()) as any;

    const allowedChildIds = (home.allowedDocumentTypes ?? []).map(
      (a: any) => a.documentType?.id
    );
    expect(allowedChildIds, 'Home must allow Guides as a child').toContain(guidesId);
  });

  test('/guides/ returns 200 and renders the landing page', async ({ request }) => {
    const resp = await request.get('/guides/');
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    expect(body).toContain('Guides');
  });

  test('main top navigation does not contain a Guides link', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.locator('nav.site-nav a');
    const count = await navLinks.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = (await navLinks.nth(i).textContent()) ?? '';
      texts.push(t.trim());
    }
    const matches = texts.filter((t) => /guides/i.test(t));
    expect(matches, `nav links: ${JSON.stringify(texts)}`).toEqual([]);
  });
});

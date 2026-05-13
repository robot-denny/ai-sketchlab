import { expect, test } from '@playwright/test';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const API_BASE = process.env.URL || 'https://localhost:44367';

// ── Auth (CLAUDE.md rule #4: refresh between logical phases) ──

let _token: string;
let _tokenAt = 0;
const TOKEN_TTL = 250_000;

async function freshToken(): Promise<string> {
  if (_token && Date.now() - _tokenAt < TOKEN_TTL) return _token;
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
    },
  );
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  _token = ((await resp.json()) as { access_token: string }).access_token;
  _tokenAt = Date.now();
  return _token;
}

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const token = await freshToken();
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const resp = await fetch(`${API_BASE}/umbraco/management/api/v1${path}`, init);
  if (!resp.ok) {
    throw new Error(`${method} ${path} → ${resp.status} ${await resp.text()}`);
  }
  if (resp.status === 204) return undefined;
  const text = await resp.text();
  return text ? JSON.parse(text) : undefined;
}

// ── Dynamic lookups (CLAUDE.md rule #1: no hardcoded UUIDs) ──

interface DocTypeRef {
  id: string;
  alias: string;
  name: string;
  isElement: boolean;
}

async function walkDocTypeTree(parentId: string | null): Promise<{ id: string; name: string; isFolder: boolean; hasChildren: boolean }[]> {
  const path = parentId
    ? `/tree/document-type/children?parentId=${parentId}&skip=0&take=500`
    : `/tree/document-type/root?skip=0&take=500`;
  const data = await api('GET', path);
  return data.items ?? [];
}

async function buildDocTypeIndex(): Promise<Map<string, DocTypeRef>> {
  // Build alias → ref map by walking the entire document-type tree, then
  // fetching detail for each leaf so we can read the alias (the tree items
  // expose name but not alias).
  const aliasIndex = new Map<string, DocTypeRef>();
  const idIndex = new Map<string, DocTypeRef>();

  async function walk(parentId: string | null): Promise<void> {
    const items = await walkDocTypeTree(parentId);
    const detailPromises: Promise<void>[] = [];
    for (const item of items) {
      if (item.isFolder) {
        if (item.hasChildren) await walk(item.id);
        continue;
      }
      detailPromises.push(
        api('GET', `/document-type/${item.id}`).then((detail: any) => {
          const ref: DocTypeRef = {
            id: detail.id,
            alias: detail.alias,
            name: detail.name,
            isElement: !!detail.isElement,
          };
          aliasIndex.set(detail.alias, ref);
          idIndex.set(detail.id, ref);
        }),
      );
    }
    await Promise.all(detailPromises);
  }

  await walk(null);

  // Expose the id index as a property on the alias map for convenience.
  (aliasIndex as any).__byId = idIndex;
  return aliasIndex;
}

async function walkDataTypeTree(parentId: string | null): Promise<{ id: string; name: string; isFolder: boolean; hasChildren: boolean }[]> {
  const path = parentId
    ? `/tree/data-type/children?parentId=${parentId}&skip=0&take=500`
    : `/tree/data-type/root?skip=0&take=500`;
  const data = await api('GET', path);
  return data.items ?? [];
}

async function findDataTypeByName(name: string): Promise<{ id: string; name: string }> {
  async function walk(parentId: string | null): Promise<{ id: string; name: string } | null> {
    const items = await walkDataTypeTree(parentId);
    for (const item of items) {
      if (item.name === name && !item.isFolder) return { id: item.id, name: item.name };
      if (item.isFolder && item.hasChildren) {
        const nested = await walk(item.id);
        if (nested) return nested;
      }
    }
    return null;
  }
  const found = await walk(null);
  if (!found) throw new Error(`Data type "${name}" not found`);
  return found;
}

async function findHomeDocumentId(homeDocTypeId: string): Promise<string> {
  const root = await api('GET', '/tree/document/root?skip=0&take=100');
  const home = (root.items ?? []).find((i: any) => i.documentType?.id === homeDocTypeId);
  if (!home) throw new Error('Home document not found in tree root');
  return home.id;
}

async function cleanStaleTransientPages(homeId: string, namePrefix: string): Promise<void> {
  const children = await api(
    'GET',
    `/tree/document/children?parentId=${homeId}&skip=0&take=500`,
  );
  const stale = (children.items ?? []).filter((i: any) => {
    const name: string | undefined = i.variants?.[0]?.name;
    return typeof name === 'string' && name.startsWith(namePrefix);
  });
  for (const old of stale) {
    await api('DELETE', `/document/${old.id}`);
  }
}

// ── Fixture state ──

const TRANSIENT_NAME_PREFIX = 'Exp BG Test';

let docTypeIndex: Map<string, DocTypeRef>;
let experimentsDocType: DocTypeRef;
let homeDocType: DocTypeRef;
let bodyDataTypeId: string;
let bodyDataType: any;
let transientPageId: string;

test.beforeAll(async () => {
  // Phase 1: build alias-indexed maps of all doc types & locate the
  // experiments + home doc types and the body data type.
  await freshToken();
  docTypeIndex = await buildDocTypeIndex();

  const expRef = docTypeIndex.get('experimentsLandingPage');
  if (!expRef) {
    throw new Error('Document type "experimentsLandingPage" not found — run the schema setup first.');
  }
  experimentsDocType = expRef;

  const homeRef = docTypeIndex.get('home');
  if (!homeRef) {
    throw new Error('Document type "home" not found.');
  }
  homeDocType = homeRef;

  const bodyDt = await findDataTypeByName('[BlockGrid] Experiments Body');
  bodyDataTypeId = bodyDt.id;
  bodyDataType = await api('GET', `/data-type/${bodyDataTypeId}`);

  // Phase 2 (fresh token): clean stale transient pages, then create a new one.
  await freshToken();
  const homeId = await findHomeDocumentId(homeDocType.id);
  await cleanStaleTransientPages(homeId, TRANSIENT_NAME_PREFIX);

  await freshToken();
  transientPageId = randomUUID();
  const transientName = `${TRANSIENT_NAME_PREFIX} ${Date.now()}`;
  await api('POST', '/document', {
    id: transientPageId,
    parent: { id: homeId },
    documentType: { id: experimentsDocType.id },
    template: null,
    values: [],
    variants: [{ culture: null, segment: null, name: transientName }],
  });
});

test.afterAll(async () => {
  // Fresh token in case the run took >5 min.
  if (!transientPageId) return;
  await freshToken();
  try {
    await api('DELETE', `/document/${transientPageId}`);
  } catch {
    // Best-effort cleanup — don't fail the suite if it's already gone.
  }
});

// ── Tests ──

test('body property binds to the Block Grid editor UI (not Block List)', async () => {
  const dt = await api('GET', `/document-type/${experimentsDocType.id}`);
  const body = (dt.properties ?? []).find((p: any) => p.alias === 'body');
  expect(body, 'body property should exist on experimentsLandingPage').toBeTruthy();
  expect(body.dataType?.id, 'body must reference a data type').toBeTruthy();

  // Resolve the bound data type and check its editor UI alias.
  const boundDt = await api('GET', `/data-type/${body.dataType.id}`);
  expect(boundDt.editorUiAlias).toBe('Umb.PropertyEditorUi.BlockGrid');
  expect(boundDt.editorUiAlias).not.toBe('Umb.PropertyEditorUi.BlockList');
  // And that it's the canonical Block Grid editor at the schema level.
  expect(boundDt.editorAlias).toMatch(/^Umbraco\.BlockGrid$/);
});

test('[BlockGrid] Experiments Body: 12 columns + showcaseHero / pillarSection at root', async () => {
  const values: Array<{ alias: string; value: any }> = bodyDataType.values ?? [];
  const gridColumns = values.find((v) => v.alias === 'gridColumns')?.value;
  expect(gridColumns, 'gridColumns config').toBe(12);

  const blocks: any[] = values.find((v) => v.alias === 'blocks')?.value ?? [];
  expect(blocks.length).toBeGreaterThan(0);

  const idMap: Map<string, DocTypeRef> = (docTypeIndex as any).__byId;
  const aliasesAtRoot = blocks
    .filter((b) => b.allowAtRoot === true)
    .map((b) => idMap.get(b.contentElementTypeKey)?.alias)
    .filter(Boolean) as string[];

  expect(aliasesAtRoot).toEqual(
    expect.arrayContaining(['showcaseHero', 'pillarSection']),
  );
});

test('pillarSection has three named areas (header / body / media) with the spec-required allowances', async () => {
  const blocks: any[] = bodyDataType.values?.find((v: any) => v.alias === 'blocks')?.value ?? [];
  const idMap: Map<string, DocTypeRef> = (docTypeIndex as any).__byId;

  const pillarBlock = blocks.find(
    (b) => idMap.get(b.contentElementTypeKey)?.alias === 'pillarSection',
  );
  expect(pillarBlock, 'pillarSection block config should exist').toBeTruthy();

  const areas: any[] = pillarBlock.areas ?? [];
  expect(areas.length, 'pillarSection should expose three named areas').toBe(3);

  const areaByAlias = new Map<string, any>();
  for (const a of areas) {
    areaByAlias.set(a.alias, a);
  }

  for (const expectedAlias of ['header', 'body', 'media']) {
    expect(
      areaByAlias.has(expectedAlias),
      `area "${expectedAlias}" should be configured`,
    ).toBe(true);
  }

  const aliasesIn = (areaAlias: string): string[] => {
    const area = areaByAlias.get(areaAlias);
    const allowance: any[] = area?.specifiedAllowance ?? [];
    return allowance
      .map((a) => idMap.get(a.elementTypeKey)?.alias)
      .filter(Boolean) as string[];
  };

  // Body must include the editorial blocks called out in the plan.
  const bodyAliases = aliasesIn('body');
  expect(bodyAliases).toEqual(
    expect.arrayContaining([
      'featureCard',
      'commandBadge',
      'statCallout',
      'pullQuoteBlock',
      'timelineRow',
    ]),
  );

  // Media is restricted to imageRow + embeddedSketch — nothing else.
  const mediaAliases = aliasesIn('media').sort();
  expect(mediaAliases).toEqual(['embeddedSketch', 'imageRow'].sort());

  // Header should at minimum allow richTextRow + commandBadge + alertBanner per the plan.
  const headerAliases = aliasesIn('header');
  expect(headerAliases).toEqual(
    expect.arrayContaining(['richTextRow', 'commandBadge', 'alertBanner']),
  );
});

test('transient page was created with the experiments doc type (schema smoke check)', async () => {
  // The page creation in beforeAll already proves the schema accepts a new
  // instance; this just verifies the persisted record reports the expected
  // doc-type binding.
  const doc = await api('GET', `/document/${transientPageId}`);
  expect(doc.documentType?.id).toBe(experimentsDocType.id);
});

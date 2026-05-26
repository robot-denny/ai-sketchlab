import dotenv from 'dotenv';

dotenv.config();

export const API_BASE = process.env.URL || 'https://localhost:44367';

// ── Auth (CLAUDE.md rule #4: refresh between logical phases) ──

let _token: string;
let _tokenAt = 0;
const TOKEN_TTL = 250_000;

export async function freshToken(): Promise<string> {
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

export async function api(method: string, path: string, body?: unknown): Promise<any> {
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

// ── Dynamic doc-type lookup (CLAUDE.md rule #1: no hardcoded UUIDs) ──

async function findDocTypeIdByAlias(alias: string, parentId: string | null = null): Promise<string | null> {
  const path = parentId
    ? `/tree/document-type/children?parentId=${parentId}&skip=0&take=500`
    : `/tree/document-type/root?skip=0&take=500`;
  const data = await api('GET', path);
  for (const item of data.items ?? []) {
    if (item.isFolder) {
      if (item.hasChildren) {
        const nested = await findDocTypeIdByAlias(alias, item.id);
        if (nested) return nested;
      }
      continue;
    }
    const detail = await api('GET', `/document-type/${item.id}`);
    if (detail.alias === alias) return detail.id;
  }
  return null;
}

const docTypeIdCache = new Map<string, string>();

async function resolveDocTypeId(alias: string): Promise<string> {
  if (docTypeIdCache.has(alias)) return docTypeIdCache.get(alias)!;
  const id = await findDocTypeIdByAlias(alias);
  if (!id) throw new Error(`Document type with alias "${alias}" not found`);
  docTypeIdCache.set(alias, id);
  return id;
}

/**
 * Resolve the seeded Experiments Landing Page URL by walking the document tree
 * dynamically — no hardcoded UUIDs or slugs. Throws if the seeded page is missing.
 */
export async function resolveExperimentsUrl(): Promise<string> {
  const [homeTypeId, expTypeId] = await Promise.all([
    resolveDocTypeId('home'),
    resolveDocTypeId('experimentsLandingPage'),
  ]);

  const root = await api('GET', '/tree/document/root?skip=0&take=100');
  const home = (root.items ?? []).find((i: any) => i.documentType?.id === homeTypeId);
  if (!home) throw new Error('Home document not found');

  const children = await api(
    'GET',
    `/tree/document/children?parentId=${home.id}&skip=0&take=200`,
  );
  const page = (children.items ?? []).find(
    (i: any) => i.documentType?.id === expTypeId,
  );
  if (!page) {
    throw new Error(
      'Experiments Landing Page not found under Home — run `node scripts/seed-experiments-page.mjs` first.',
    );
  }

  const detail = await api('GET', `/document/${page.id}`);
  return detail.urls?.[0]?.url ?? '/experiments';
}

/**
 * Umbraco Management API helpers for the guide-generator CLI.
 *
 * Auth + low-level request helpers mirror scripts/image-generator/src/umbraco-api.ts.
 * Higher-level helpers know about the Guides doc-type model added in Step 1.
 */

import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// ── .env loading (lazy) ────────────────────────────────────────

interface EnvConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

let cachedEnv: EnvConfig | null = null;

function loadEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const envContents = fs.readFileSync(envPath, 'utf8');
    for (const line of envContents.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    }
  }

  cachedEnv = {
    baseUrl: process.env.UMBRACO_BASE_URL || env.UMBRACO_BASE_URL || 'https://localhost:44367',
    clientId: process.env.UMBRACO_CLIENT_ID || env.UMBRACO_CLIENT_ID || '',
    clientSecret: process.env.UMBRACO_CLIENT_SECRET || env.UMBRACO_CLIENT_SECRET || '',
  };

  // Allow self-signed certs for local dev
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  return cachedEnv;
}

// ── HTTP helpers ───────────────────────────────────────────────

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export function request(
  method: string,
  urlPath: string,
  body: unknown,
  token?: string,
): Promise<HttpResponse> {
  const { baseUrl } = loadEnv();
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const options: https.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
      rejectUnauthorized: false,
    };
    if (token) options.headers!['Authorization'] = `Bearer ${token}`;

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        const result: HttpResponse = {
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: data,
        };
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`${method} ${urlPath} → ${res.statusCode}\n${data}`));
        } else {
          resolve(result);
        }
      });
    });
    req.on('error', reject);
    if (body != null) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── Auth ───────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenIssuedAt = 0;

async function authenticate(): Promise<string> {
  const { baseUrl, clientId, clientSecret } = loadEnv();
  if (!clientId || !clientSecret) {
    throw new Error('UMBRACO_CLIENT_ID / UMBRACO_CLIENT_SECRET missing from environment or .env');
  }
  const body = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;
  return new Promise((resolve, reject) => {
    const url = new URL('/umbraco/management/api/v1/security/back-office/token', baseUrl);
    const options: https.RequestOptions = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      rejectUnauthorized: false,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`Auth failed: ${res.statusCode} ${data}`));
        } else {
          const { access_token } = JSON.parse(data);
          cachedToken = access_token;
          tokenIssuedAt = Date.now();
          resolve(access_token);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Returns a valid bearer token. Re-authenticates if the current token is older
 * than 250 seconds (Umbraco tokens expire at 299s).
 */
export async function getToken(): Promise<string> {
  const age = (Date.now() - tokenIssuedAt) / 1000;
  if (!cachedToken || age > 250) {
    return authenticate();
  }
  return cachedToken;
}

// ── Document type helpers ──────────────────────────────────────

export interface DocumentTypeProperty {
  alias: string;
  name: string;
  dataType?: { id: string };
  [k: string]: unknown;
}

export interface DocumentType {
  id: string;
  alias: string;
  name: string;
  isElement?: boolean;
  properties?: DocumentTypeProperty[];
  compositions?: Array<{ documentType: { id: string } }>;
  allowedDocumentTypes?: Array<{ documentType: { id: string }; sortOrder: number }>;
  [k: string]: unknown;
}

/**
 * Look up a document type (or element type) by its alias.
 * Walks the doc-type tree (root + children of any folders) until it finds a
 * match, then GETs the full record.
 */
export async function getDocumentTypeByAlias(
  token: string,
  alias: string,
): Promise<DocumentType | null> {
  const lower = alias.toLowerCase();

  async function searchTree(parentId: string | null): Promise<string | null> {
    const url = parentId
      ? `/umbraco/management/api/v1/tree/document-type/children?parentId=${parentId}&skip=0&take=200`
      : '/umbraco/management/api/v1/tree/document-type/root?skip=0&take=200';
    const res = await request('GET', url, null, token);
    const items: any[] = JSON.parse(res.body).items ?? [];
    for (const item of items) {
      if (!item.isFolder) {
        // Tree items expose `name` directly; alias is only on the full record.
        // Cheap pre-filter on name; fallback to fetching when uncertain.
        const candidateName: string = item.name ?? item.variants?.[0]?.name ?? '';
        if (candidateName.toLowerCase().replace(/\s+/g, '') === lower) {
          return item.id;
        }
      }
    }
    // Pre-filter pass missed: do a fetch-all-leaves pass to read aliases.
    for (const item of items) {
      if (item.isFolder) {
        const nested = await searchTree(item.id);
        if (nested) return nested;
      } else {
        const detail = await request('GET', `/umbraco/management/api/v1/document-type/${item.id}`, null, token);
        const dt = JSON.parse(detail.body) as DocumentType;
        if (dt.alias?.toLowerCase() === lower) return dt.id;
      }
    }
    return null;
  }

  const id = await searchTree(null);
  if (!id) return null;
  const detail = await request('GET', `/umbraco/management/api/v1/document-type/${id}`, null, token);
  return JSON.parse(detail.body) as DocumentType;
}

// ── Document tree helpers ──────────────────────────────────────

interface TreeItem {
  id: string;
  name?: string;
  variants?: Array<{ name: string }>;
  hasChildren?: boolean;
}

async function getDocumentTreeRoot(token: string): Promise<TreeItem[]> {
  const res = await request(
    'GET',
    '/umbraco/management/api/v1/tree/document/root?skip=0&take=200',
    null,
    token,
  );
  return JSON.parse(res.body).items ?? [];
}

async function getDocumentChildren(token: string, parentId: string): Promise<TreeItem[]> {
  const res = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${parentId}&skip=0&take=200`,
    null,
    token,
  );
  return JSON.parse(res.body).items ?? [];
}

function nameOf(item: TreeItem): string {
  return item.variants?.[0]?.name ?? item.name ?? '';
}

/** Locate the Guides parent page under Home. Returns null if not yet created. */
export async function getGuidesParentId(token: string): Promise<string | null> {
  const root = await getDocumentTreeRoot(token);
  const home = root.find((i) => nameOf(i) === 'Home');
  if (!home) return null;
  const homeChildren = await getDocumentChildren(token, home.id);
  const guides = homeChildren.find((i) => nameOf(i) === 'Guides');
  return guides?.id ?? null;
}

/**
 * Find an existing How-To Guide page whose `generationMetadata.lastFeatureAlias`
 * matches the given feature alias. Returns null when no matching page exists.
 */
export async function findGuidePageByFeatureAlias(
  token: string,
  featureAlias: string,
): Promise<{ id: string; document: any } | null> {
  const guidesId = await getGuidesParentId(token);
  if (!guidesId) return null;

  const children = await getDocumentChildren(token, guidesId);
  for (const child of children) {
    const detail = await request('GET', `/umbraco/management/api/v1/document/${child.id}`, null, token);
    const doc = JSON.parse(detail.body);
    const metaRaw = doc.values?.find((v: any) => v.alias === 'generationMetadata')?.value;
    if (typeof metaRaw === 'string' && metaRaw.trim()) {
      try {
        const meta = JSON.parse(metaRaw);
        if (meta?.lastFeatureAlias === featureAlias) {
          return { id: child.id, document: doc };
        }
      } catch {
        // Fall through — malformed metadata can't match.
      }
    }
  }
  return null;
}

// ── Guide page CRUD ────────────────────────────────────────────

export interface GuidePageCreateInput {
  /** Parent Guides page UUID. */
  parentId: string;
  /** How-To Guide Page document type UUID. */
  documentTypeId: string;
  /** Default template UUID for howToGuidePage. */
  templateId: string;
  /** Page name, e.g. "How to use the Alert Banner". */
  name: string;
  /** Rich-text HTML for the description property. */
  descriptionHtml: string;
  /** JSON-stringified generation metadata. */
  generationMetadata: string;
  /** sectionRows block list value (may be undefined to leave empty). */
  sectionRows?: unknown;
  /** Defaults to true — guides are hidden from the top nav. */
  hideFromTopNavigation?: boolean;
}

export async function createGuidePage(
  token: string,
  input: GuidePageCreateInput,
): Promise<string> {
  const id = randomUUID();
  const values: any[] = [
    { alias: 'description', culture: null, segment: null, value: input.descriptionHtml },
    { alias: 'generationMetadata', culture: null, segment: null, value: input.generationMetadata },
    {
      alias: 'hideFromTopNavigation',
      culture: null,
      segment: null,
      value: input.hideFromTopNavigation ?? true,
    },
  ];
  if (input.sectionRows !== undefined) {
    values.push({ alias: 'sectionRows', culture: null, segment: null, value: input.sectionRows });
  }

  const payload = {
    id,
    documentType: { id: input.documentTypeId },
    template: { id: input.templateId },
    parent: { id: input.parentId },
    values,
    variants: [{ culture: null, segment: null, name: input.name }],
  };

  await request('POST', '/umbraco/management/api/v1/document', payload, token);
  return id;
}

export interface GuidePageUpdateInput {
  /** Existing how-to guide document. Pass through from `findGuidePageByFeatureAlias`. */
  document: any;
  /** Replacement description HTML. */
  descriptionHtml: string;
  /** Replacement generation-metadata JSON. */
  generationMetadata: string;
}

export async function updateGuidePage(
  token: string,
  documentId: string,
  input: GuidePageUpdateInput,
): Promise<void> {
  const doc = input.document;
  const values: any[] = [...(doc.values ?? [])];

  function upsert(alias: string, value: unknown) {
    const idx = values.findIndex((v) => v.alias === alias);
    if (idx >= 0) {
      values[idx] = { ...values[idx], value };
    } else {
      values.push({ alias, culture: null, segment: null, value });
    }
  }

  upsert('description', input.descriptionHtml);
  upsert('generationMetadata', input.generationMetadata);

  const updatePayload = {
    template: doc.template,
    values,
    variants: doc.variants?.map((v: any) => ({
      culture: v.culture,
      segment: v.segment,
      name: v.name,
      state: v.state,
    })),
  };

  await request('PUT', `/umbraco/management/api/v1/document/${documentId}`, updatePayload, token);
}

/** Publish a document for the invariant culture. */
export async function publishDocument(token: string, documentId: string): Promise<void> {
  const payload = { publishSchedules: [{ culture: null, segment: null }] };
  await request(
    'PUT',
    `/umbraco/management/api/v1/document/${documentId}/publish`,
    payload,
    token,
  );
}

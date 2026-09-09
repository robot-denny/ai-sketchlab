/**
 * Umbraco Management API access for the spell-card sync CLI.
 *
 * Auth, `.env` loading and the low-level request helper mirror
 * `scripts/guide-generator/src/umbracoApi.ts`. Above them sits one deck-specific
 * read: `readDeckCards`, which walks Spellbook → stacks → cards the way
 * `tests/e2e/_spellDeckFixture.ts` does, so the tool and the specs agree on what
 * the deck *is* rather than each carrying its own idea of it.
 *
 * Every export here is a GET. The report mode is read-only by construction, not
 * by discipline — there is no write helper in this module to call by accident.
 */

import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  // The local dev certificate is self-signed, so it has to be tolerated — but
  // only for localhost. Steps 6 and 7 of this increment point the same tool at
  // Dev and Live, and a process-wide "trust anything" left on for those would
  // silently disable certificate checking against a real environment.
  if (isLocal(cachedEnv.baseUrl)) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  return cachedEnv;
}

/** The site this run reads from, for the report's header line. */
export function baseUrl(): string {
  return loadEnv().baseUrl;
}

// ── HTTP helpers ───────────────────────────────────────────────

interface HttpResponse {
  status: number;
  body: string;
}

/** Whether the target is the local dev site, which serves a self-signed cert. */
function isLocal(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * How long to wait on a request before giving up. Without this a stalled TLS
 * connection leaves the promise pending for ever, and because the deck read fans
 * out inside nested `Promise.all` one hung socket takes the whole batch with it.
 */
const REQUEST_TIMEOUT_MS = 30_000;

function get(urlPath: string, token: string): Promise<HttpResponse> {
  const { baseUrl } = loadEnv();
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const options: https.RequestOptions = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      rejectUnauthorized: !isLocal(baseUrl),
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`GET ${urlPath} → ${res.statusCode}\n${data}`));
        } else {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`GET ${urlPath} timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.end();
  });
}

async function getJson<T>(urlPath: string, token: string): Promise<T> {
  const res = await get(urlPath, token);
  return JSON.parse(res.body) as T;
}

// ── Auth ───────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenIssuedAt = 0;

function authenticate(): Promise<string> {
  const { baseUrl, clientId, clientSecret } = loadEnv();
  if (!clientId || !clientSecret) {
    throw new Error('UMBRACO_CLIENT_ID / UMBRACO_CLIENT_SECRET missing from environment or .env');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  return new Promise((resolve, reject) => {
    const url = new URL('/umbraco/management/api/v1/security/back-office/token', baseUrl);
    const options: https.RequestOptions = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      rejectUnauthorized: !isLocal(baseUrl),
      timeout: REQUEST_TIMEOUT_MS,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) {
          // The body can echo the request; report the status only.
          reject(new Error(`Auth failed: ${res.statusCode}`));
        } else {
          const { access_token } = JSON.parse(data);
          cachedToken = access_token;
          tokenIssuedAt = Date.now();
          resolve(access_token);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Auth request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
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

// ── Tree shapes ────────────────────────────────────────────────

interface TreeItem {
  id: string;
  name?: string;
  isFolder?: boolean;
  hasChildren?: boolean;
  variants?: Array<{ name: string }>;
  documentType?: { id: string };
}

interface TreeResponse {
  items?: TreeItem[];
}

function nameOf(item: TreeItem): string {
  return item.variants?.[0]?.name ?? item.name ?? '';
}

/**
 * One page is read per tree call, and that is deliberate: the deck holds tens of
 * nodes, not hundreds. What is *not* acceptable is truncating in silence, because
 * a short read would report a clean comparison on a roster it never fully saw —
 * so a full page throws instead.
 */
const TREE_PAGE_SIZE = 200;

function treeUrl(kind: 'document' | 'document-type', parentId: string | null): string {
  const page = `skip=0&take=${TREE_PAGE_SIZE}`;
  return parentId
    ? `/umbraco/management/api/v1/tree/${kind}/children?parentId=${parentId}&${page}`
    : `/umbraco/management/api/v1/tree/${kind}/root?${page}`;
}

async function treeItems(
  kind: 'document' | 'document-type',
  parentId: string | null,
  token: string,
): Promise<TreeItem[]> {
  const data = await getJson<TreeResponse>(treeUrl(kind, parentId), token);
  const items = data.items ?? [];
  if (items.length >= TREE_PAGE_SIZE) {
    throw new Error(
      `${kind} tree under ${parentId ?? 'root'} filled a page of ${TREE_PAGE_SIZE}. ` +
        'The read is truncated and any comparison from it would be wrong. ' +
        'Raise TREE_PAGE_SIZE or add pagination.',
    );
  }
  return items;
}

// ── Document types ─────────────────────────────────────────────

/**
 * Resolve the given document-type aliases to their ids in one traversal of the
 * doc-type tree, descending into folders. Aliases live only on the full record,
 * so each leaf is fetched — cheap enough for a throwaway tool, and it avoids the
 * name-shaped guessing that breaks when a type is renamed.
 *
 * **This walk is sequential on purpose, unlike `readDeckCards` below.** It stops
 * the moment every wanted alias is found, and the four spell-card types sit near
 * each other, so it exits long before the round-trip count matters. Parallelizing
 * it would trade that early exit for a full sweep of the tree.
 *
 * Throws when an alias is not found: a missing spell-card type means the deck's
 * schema increment has not shipped, which is worth failing loudly over.
 */
export async function documentTypeIdsByAlias(
  token: string,
  aliases: readonly string[],
): Promise<Map<string, string>> {
  const wanted = new Set(aliases);
  const found = new Map<string, string>();

  async function walk(parentId: string | null): Promise<void> {
    for (const item of await treeItems('document-type', parentId, token)) {
      if (found.size === wanted.size) return;
      if (!item.isFolder) {
        const detail = await getJson<{ alias?: string }>(
          `/umbraco/management/api/v1/document-type/${item.id}`,
          token,
        );
        if (detail.alias && wanted.has(detail.alias)) found.set(detail.alias, item.id);
      }
      if (item.hasChildren) await walk(item.id);
    }
  }

  await walk(null);

  const missing = aliases.filter((alias) => !found.has(alias));
  if (missing.length > 0) {
    throw new Error(`Document type(s) not found: ${missing.join(', ')}`);
  }
  return found;
}

// ── The deck ───────────────────────────────────────────────────

/** One card as the site stores it. */
export interface LiveCard {
  id: string;
  /** The node name, which is what a Cantrip unit is matched on. */
  name: string;
  /** The parent stack's node name, for the report's grouping. */
  stack: string;
  kind: 'Spell' | 'Reference';
  /** Stored property values, flattened to strings and keyed by alias. */
  values: Record<string, string>;
}

/**
 * A dropdown stores a single-element array (`["Then"]`); a text box stores a
 * string. Flatten both to the string a card field actually holds.
 */
function flatten(value: unknown): string {
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : '';
  return value == null ? '' : String(value);
}

async function documentValues(id: string, token: string): Promise<Record<string, string>> {
  const doc = await getJson<{ values?: Array<{ alias: string; value: unknown }> }>(
    `/umbraco/management/api/v1/document/${id}`,
    token,
  );
  const values: Record<string, string> = {};
  for (const v of doc.values ?? []) values[v.alias] = flatten(v.value);
  return values;
}

/** Find the Spellbook content node, wherever in the tree it has been placed. */
async function findSpellbookId(token: string, spellbookTypeId: string): Promise<string> {
  async function walk(parentId: string | null): Promise<string | null> {
    const items = await treeItems('document', parentId, token);
    for (const item of items) {
      if (item.documentType?.id === spellbookTypeId) return item.id;
    }
    for (const item of items) {
      if (item.hasChildren) {
        const nested = await walk(item.id);
        if (nested) return nested;
      }
    }
    return null;
  }

  const id = await walk(null);
  if (!id) throw new Error('No Spellbook content node found — the deck has not been authored.');
  return id;
}

/**
 * Read every card in the deck, in tree order: Spellbook → stacks → cards.
 *
 * The walk is breadth-parallel per level, matching the deck fixture's reasoning
 * — a sequential walk of 30-odd cards spends most of its time waiting.
 */
export async function readDeckCards(token: string): Promise<LiveCard[]> {
  const typeIds = await documentTypeIdsByAlias(token, [
    'spellbook',
    'spellCardStack',
    'spellCardSpell',
    'spellCardReference',
  ]);
  const stackTypeId = typeIds.get('spellCardStack')!;
  const spellTypeId = typeIds.get('spellCardSpell')!;
  const referenceTypeId = typeIds.get('spellCardReference')!;

  const spellbookId = await findSpellbookId(token, typeIds.get('spellbook')!);
  const stackItems = (await treeItems('document', spellbookId, token)).filter(
    (item) => item.documentType?.id === stackTypeId,
  );

  const perStack = await Promise.all(
    stackItems.map(async (stackItem) => {
      const cardItems = (await treeItems('document', stackItem.id, token)).filter(
        (item) =>
          item.documentType?.id === spellTypeId || item.documentType?.id === referenceTypeId,
      );
      return Promise.all(
        cardItems.map(
          async (cardItem): Promise<LiveCard> => ({
            id: cardItem.id,
            name: nameOf(cardItem),
            stack: nameOf(stackItem),
            kind: cardItem.documentType?.id === spellTypeId ? 'Spell' : 'Reference',
            values: await documentValues(cardItem.id, token),
          }),
        ),
      );
    }),
  );

  return perStack.flat();
}

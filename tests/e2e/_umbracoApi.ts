// Shared Management-API helpers for E2E specs that assert on schema
// (document types / element types / templates).
//
// WHY THIS EXISTS
// ---------------
// The `@umbraco/playwright-testhelpers` `umbracoApi` fixture fails mid-run with
// "Error refreshing access token." auth.setup.ts obtains a client_credentials
// token (which never returns a refresh_token) and the fixture tries to rotate it
// anyway. Specs that used `umbracoApi.documentType.*` therefore crash with
// `Cannot read properties of undefined (reading 'match')` once the initial token
// expires (~299 s into the run). These helpers call the Management API directly
// with a self-refreshing client_credentials token instead. Pattern mirrors the
// freshToken() helpers already inlined in sectionNavigation.spec.ts /
// contentSectionRows.spec.ts — consolidated here so specs stop duplicating it.

import dotenv from 'dotenv';

dotenv.config();

/**
 * The Umbraco instance every helper talks to. Exported so a spec that also makes
 * raw HTTP requests (e.g. as an anonymous visitor) targets the same host as the
 * fixtures it created, rather than reading a different env var.
 */
export const API_BASE = process.env.URL || 'https://localhost:44367';
const TOKEN_TTL = 250_000; // refresh well before the 299 s expiry

/**
 * Shared root prefix for every CI-created content fixture. Composing all
 * fixture names from this constant means they cluster together in the Home
 * children list (the leading bracket also sorts them to the top of the tree)
 * and are trivially greppable — a naming-convention "corral" that needs no
 * dedicated doc type or schema change. Each spec keeps its own sub-label after
 * the prefix (e.g. `[E2E] EBA`, `[E2E] Exp BG Test`) so a spec still finds and
 * cleans up only its own fixtures. When you change this value, update every
 * spec's clean-before-setup filter in lockstep (they match on the prefixed name).
 */
export const TEST_FIXTURE_PREFIX = '[E2E]';

let _token = '';
let _tokenTs = 0;

/** Get a client_credentials token, reusing the cached one until near expiry. */
export async function freshToken(): Promise<string> {
  if (_token && Date.now() - _tokenTs < TOKEN_TTL) return _token;
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
  _tokenTs = Date.now();
  return _token;
}

/** Authenticated Management-API fetch (token auto-refreshed). */
export async function apiFetch(method: string, path: string, body?: any): Promise<Response> {
  const token = await freshToken();
  return fetch(`${API_BASE}/umbraco/management/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/** Find the Home node id from the document tree root (E2E rule #1: no hardcoded UUIDs). */
export async function findHomeDocId(): Promise<string> {
  const resp = await apiFetch('GET', '/tree/document/root?skip=0&take=100');
  if (!resp.ok) throw new Error(`GET doc tree root failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  const homeItem = (data.items ?? []).find(
    (item: any) => (item.variants?.[0]?.name ?? '').toLowerCase() === 'home'
  );
  if (!homeItem) throw new Error('Home page not found in document tree root');
  return homeItem.id;
}

/** Fetch the published path for a document (E2E rule #2: never hardcode URL slugs). */
export async function getDocumentPath(docId: string): Promise<string> {
  const resp = await apiFetch('GET', `/document/urls?id=${docId}`);
  if (!resp.ok) throw new Error(`GET document URLs failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

/**
 * Like {@link getDocumentPath} but returns `null` instead of throwing when the
 * document has no published URL — for specs that treat "no URL yet" as an
 * expected state (e.g. a page authored in a later step) rather than an error.
 */
export async function tryGetDocumentPath(docId: string): Promise<string | null> {
  const resp = await apiFetch('GET', `/document/urls?id=${docId}`);
  // Throw on an API failure (real error); return null ONLY for the legitimate
  // "node exists but has no published URL yet" case — so a content-gated caller's
  // null means genuine not-ready, never a swallowed API error.
  if (!resp.ok) {
    throw new Error(`tryGetDocumentPath: /document/urls failed for ${docId} → ${resp.status}`);
  }
  const data = (await resp.json()) as any;
  return data[0]?.urlInfos?.[0]?.url ?? null;
}

/** Walk the whole document tree, returning every content node of a given doc type. */
export async function collectContentNodesByDocType(
  docTypeId: string
): Promise<Array<{ id: string; name: string }>> {
  const found: Array<{ id: string; name: string }> = [];
  async function walk(parentId: string | null) {
    const path = parentId
      ? `/tree/document/children?parentId=${parentId}&skip=0&take=100`
      : `/tree/document/root?skip=0&take=100`;
    const resp = await apiFetch('GET', path);
    // Throw (don't silently return) on a non-OK tree response: a failed API call
    // mid-walk is a real error, not "content absent". Callers use a null/empty
    // result to mean genuine not-found (→ a content-gated spec may skip); an API
    // failure must surface loudly instead of masquerading as absence.
    if (!resp.ok) {
      throw new Error(`collectContentNodesByDocType: tree walk failed at ${path} → ${resp.status}`);
    }
    const data = (await resp.json()) as any;
    for (const item of data.items ?? []) {
      if (item.documentType?.id === docTypeId) {
        found.push({ id: item.id, name: item.variants?.[0]?.name ?? '' });
      }
      if (item.hasChildren) {
        await walk(item.id);
      }
    }
  }
  await walk(null);
  return found;
}

/**
 * Find a document type / element type by display name, walking the tree
 * (root + nested folders such as Elements / Pages / Compositions). Returns the
 * full document-type object (flat `properties` array, `allowedTemplates`, etc.)
 * or `null` if not found.
 *
 * Replacement for `umbracoApi.documentType.getByName(name)` (see file header).
 * Resilient to folder nesting, unlike the testhelpers `recurseChildren` (E2E rule #7).
 */
export async function getDocumentTypeByName(name: string): Promise<any | null> {
  async function search(parentId: string | null, depth: number): Promise<any | null> {
    const path = parentId
      ? `/tree/document-type/children?parentId=${parentId}&take=100`
      : `/tree/document-type/root?take=100`;
    const resp = await apiFetch('GET', path);
    if (!resp.ok) return null;
    const items: any[] = ((await resp.json()) as any).items ?? [];

    // Match a concrete (non-folder) doc type at this level first.
    const hit = items.find((it) => !it.isFolder && it.name === name);
    if (hit) {
      const full = await apiFetch('GET', `/document-type/${hit.id}`);
      return full.ok ? await full.json() : null;
    }

    // Otherwise descend into folders.
    if (depth > 0) {
      for (const it of items) {
        if (it.hasChildren) {
          const found = await search(it.id, depth - 1);
          if (found) return found;
        }
      }
    }
    return null;
  }
  return search(null, 3);
}

/** Fetch a template by id, or null. Replaces `umbracoApi.template.get(id)`. */
export async function getTemplate(id: string): Promise<any | null> {
  const resp = await apiFetch('GET', `/template/${id}`);
  return resp.ok ? await resp.json() : null;
}

/**
 * Find a data type by display name (E2E rule #1: never hardcode UUIDs). Walks
 * the data-type tree (root + folders) and returns the full data-type object
 * (with its `values` array holding e.g. the block-editor `blocks` config), or
 * `null` if not found. Mirrors `getDocumentTypeByName`.
 */
export async function getDataTypeByName(name: string): Promise<any | null> {
  async function search(parentId: string | null, depth: number): Promise<any | null> {
    const path = parentId
      ? `/tree/data-type/children?parentId=${parentId}&take=100`
      : `/tree/data-type/root?take=100`;
    const resp = await apiFetch('GET', path);
    if (!resp.ok) return null;
    const items: any[] = ((await resp.json()) as any).items ?? [];

    const hit = items.find((it) => !it.isFolder && it.name === name);
    if (hit) {
      const full = await apiFetch('GET', `/data-type/${hit.id}`);
      return full.ok ? await full.json() : null;
    }

    if (depth > 0) {
      for (const it of items) {
        if (it.hasChildren) {
          const found = await search(it.id, depth - 1);
          if (found) return found;
        }
      }
    }
    return null;
  }
  return search(null, 3);
}

/**
 * Resolve a block-editor data type's offered element-type aliases. Reads the
 * `blocks` value from the data type, then resolves each `contentElementTypeKey`
 * to its element-type alias via the document-type API (E2E rule #1: no
 * hardcoded UUIDs — keys are resolved live per environment). Returns a
 * de-duplicated array of aliases.
 */
export async function getPaletteBlockAliases(dataTypeName: string): Promise<string[]> {
  const dt = await getDataTypeByName(dataTypeName);
  if (!dt) return [];
  const blocksValue = (dt.values ?? []).find((v: any) => v.alias === 'blocks');
  const blocks: any[] = blocksValue?.value ?? [];
  const aliases: string[] = [];
  for (const block of blocks) {
    const key = block.contentElementTypeKey;
    if (!key) continue;
    const resp = await apiFetch('GET', `/document-type/${key}`);
    if (!resp.ok) continue;
    const et = (await resp.json()) as any;
    if (et.alias) aliases.push(et.alias);
  }
  return [...new Set(aliases)];
}

// ---------------------------------------------------------------------------
// Media helpers (temporary-file upload → create → recycle bin → restore/delete)
// ---------------------------------------------------------------------------

/** Find a media type id by display name at the media-type tree root (E2E rule #1). */
export async function getMediaTypeIdByName(name: string): Promise<string> {
  const resp = await apiFetch('GET', '/tree/media-type/root?skip=0&take=100');
  if (!resp.ok) throw new Error(`GET media-type tree root failed: ${resp.status}`);
  const items: any[] = ((await resp.json()) as any).items ?? [];
  const hit = items.find((it) => !it.isFolder && it.name === name);
  if (!hit) {
    throw new Error(
      `Media type "${name}" not found at the media-type tree root ` +
        `(this lookup does not descend into folders; move the type to the root or extend the lookup)`
    );
  }
  return hit.id;
}

/**
 * Upload bytes as a Management-API temporary file and return its id. The
 * endpoint is multipart (`Id` + `File`), so it can't go through the JSON
 * {@link apiFetch}.
 */
export async function uploadTemporaryFile(
  fileName: string,
  bytes: Uint8Array,
  mimeType: string
): Promise<string> {
  const id = crypto.randomUUID();
  const form = new FormData();
  form.append('Id', id);
  form.append('File', new Blob([bytes], { type: mimeType }), fileName);
  const token = await freshToken();
  const resp = await fetch(`${API_BASE}/umbraco/management/api/v1/temporary-file`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(`POST temporary-file failed: ${resp.status} ${await resp.text()}`);
  }
  return id;
}

/**
 * Create a media item whose `umbracoFile` is a previously uploaded temporary
 * file. Created at the media root unless `parentId` is given. Returns the new id.
 */
export async function createMediaFromTemporaryFile(opts: {
  name: string;
  mediaTypeId: string;
  temporaryFileId: string;
  parentId?: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  const resp = await apiFetch('POST', '/media', {
    id,
    parent: opts.parentId ? { id: opts.parentId } : null,
    mediaType: { id: opts.mediaTypeId },
    variants: [{ name: opts.name, culture: null, segment: null }],
    values: [
      {
        alias: 'umbracoFile',
        culture: null,
        segment: null,
        value: { temporaryFileId: opts.temporaryFileId },
      },
    ],
  });
  if (!resp.ok) throw new Error(`POST media failed: ${resp.status} ${await resp.text()}`);
  return id;
}

/** Fetch the public URL path of a media item's file (E2E rule #2: never hardcode paths). */
export async function getMediaPath(mediaId: string): Promise<string> {
  const resp = await apiFetch('GET', `/media/urls?id=${mediaId}`);
  if (!resp.ok) throw new Error(`GET media URLs failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for media ${mediaId}`);
  return url;
}

/** Move a media item to the media recycle bin. */
export async function moveMediaToRecycleBin(mediaId: string): Promise<void> {
  const resp = await apiFetch('PUT', `/media/${mediaId}/move-to-recycle-bin`);
  if (!resp.ok) {
    throw new Error(`PUT media move-to-recycle-bin failed: ${resp.status} ${await resp.text()}`);
  }
}

/** Restore a media item from the recycle bin (to `targetId`, or the media root when null). */
export async function restoreMediaFromRecycleBin(
  mediaId: string,
  targetId: string | null = null
): Promise<void> {
  const resp = await apiFetch('PUT', `/recycle-bin/media/${mediaId}/restore`, {
    target: targetId ? { id: targetId } : null,
  });
  if (!resp.ok) {
    throw new Error(`PUT recycle-bin media restore failed: ${resp.status} ${await resp.text()}`);
  }
}

/**
 * List media items whose name starts with `prefix`, at the media root and at
 * the media recycle-bin root, with where each one was found.
 */
export async function findMediaByNamePrefix(
  prefix: string
): Promise<Array<{ id: string; name: string; trashed: boolean }>> {
  const found: Array<{ id: string; name: string; trashed: boolean }> = [];
  for (const [path, trashed] of [
    ['/tree/media/root?skip=0&take=1000', false],
    ['/recycle-bin/media/root?skip=0&take=1000', true],
  ] as const) {
    const resp = await apiFetch('GET', path);
    if (!resp.ok) throw new Error(`findMediaByNamePrefix: GET ${path} failed: ${resp.status}`);
    for (const item of ((await resp.json()) as any).items ?? []) {
      const name: string = item.variants?.[0]?.name ?? '';
      if (name.startsWith(prefix)) found.push({ id: item.id, name, trashed });
    }
  }
  return found;
}

/**
 * Permanently delete a media item, wherever it is: trash it first if needed,
 * then delete it from the recycle bin. A 404 at either stage means it is
 * already gone, which counts as success.
 */
export async function deleteMediaPermanently(mediaId: string): Promise<void> {
  const trash = await apiFetch('PUT', `/media/${mediaId}/move-to-recycle-bin`);
  if (trash.status === 404) return;
  if (!trash.ok) {
    // Only "already in the recycle bin" (400, operationStatus InTrash) is benign;
    // any other failure must surface here, not as a confusing DELETE error later.
    const body = await trash.text();
    let operationStatus: string | undefined;
    try {
      operationStatus = (JSON.parse(body) as any)?.operationStatus;
    } catch {
      // Not JSON: fall through to the error below.
    }
    if (!(trash.status === 400 && operationStatus === 'InTrash')) {
      throw new Error(`deleteMediaPermanently: trash failed: ${trash.status} ${body}`);
    }
  }
  const resp = await apiFetch('DELETE', `/recycle-bin/media/${mediaId}`);
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`DELETE recycle-bin media failed: ${resp.status} ${await resp.text()}`);
  }
}

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

const API_BASE = process.env.URL || 'https://localhost:44367';
const TOKEN_TTL = 250_000; // refresh well before the 299 s expiry

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

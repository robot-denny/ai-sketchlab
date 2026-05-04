/**
 * Computes a deterministic SHA-256 signature over the inputs that drive a
 * generated How-To Guide page. Matches the schema in `_plans/editor-how-to-guides.md`
 * (Key Decisions → Source signature).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  getDocumentTypeByAlias,
  getToken,
  request,
  type DocumentType,
  type DocumentTypeProperty,
} from './umbracoApi.js';
import type { Feature } from './features.js';

export const SCHEMA_VERSION = 1;

export interface SignatureProperty {
  alias: string;
  name: string;
  dataTypeAlias: string;
}

export interface SignaturePayload {
  partial: string;
  partialContent: string;
  elementType: {
    alias: string;
    properties: SignatureProperty[];
  };
  agentSystemPromptHash: string;
  schemaVersion: typeof SCHEMA_VERSION;
}

export interface BuildSignaturePayloadInput {
  partialPath: string;
  partialContent: string;
  elementType: {
    alias: string;
    name?: string;
    properties: Array<{ alias: string; name: string; dataTypeAlias: string }>;
  };
  agentSystemPromptHash: string;
}

/**
 * Pure: assemble the deterministic signature payload from already-resolved inputs.
 * Properties are sorted by alias and stripped to the minimal `{alias,name,dataTypeAlias}` shape
 * so any non-signature metadata (sortOrder, descriptions, etc.) cannot influence the hash.
 */
export function buildSignaturePayload(input: BuildSignaturePayloadInput): SignaturePayload {
  const properties: SignatureProperty[] = input.elementType.properties
    .map((p) => ({
      alias: p.alias,
      name: p.name,
      dataTypeAlias: p.dataTypeAlias,
    }))
    .sort((a, b) => a.alias.localeCompare(b.alias));

  return {
    partial: input.partialPath,
    partialContent: input.partialContent,
    elementType: {
      alias: input.elementType.alias,
      properties,
    },
    agentSystemPromptHash: input.agentSystemPromptHash,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Pure: stable JSON-encode the payload (with sorted top-level keys) and SHA-256 it. */
export function hashPayload(payload: SignaturePayload): string {
  const canonical = stableStringify(payload);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

// ── Live data fetching ────────────────────────────────────────

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function partialPathFor(featureAlias: string): string {
  return path.join(
    'src',
    'UmbracoProject',
    'Views',
    'Partials',
    'blocklist',
    'Components',
    `${featureAlias}.cshtml`,
  );
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

async function lookupDataTypeAliasMap(
  token: string,
  dataTypeIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(dataTypeIds.filter(Boolean)));
  for (const id of unique) {
    try {
      const res = await request('GET', `/umbraco/management/api/v1/data-type/${id}`, null, token);
      const dt = JSON.parse(res.body);
      // Data types don't expose a true "alias" — fall back to name (display).
      map.set(id, dt.name ?? '');
    } catch {
      map.set(id, '');
    }
  }
  return map;
}

/**
 * Find the element type whose display name matches the feature alias
 * (case- and whitespace-insensitive). Returns null when no match is found.
 */
async function findElementTypeForFeature(
  token: string,
  featureAlias: string,
): Promise<DocumentType | null> {
  const target = normalize(featureAlias);

  // First try direct alias match — fast path.
  const byAlias = await getDocumentTypeByAlias(token, featureAlias);
  if (byAlias) return byAlias;

  // Fallback: walk the document-type tree looking for a name match.
  async function walk(parentId: string | null): Promise<DocumentType | null> {
    const url = parentId
      ? `/umbraco/management/api/v1/tree/document-type/children?parentId=${parentId}&skip=0&take=200`
      : '/umbraco/management/api/v1/tree/document-type/root?skip=0&take=200';
    const res = await request('GET', url, null, token);
    const items: any[] = JSON.parse(res.body).items ?? [];
    for (const item of items) {
      if (item.isFolder) {
        const nested = await walk(item.id);
        if (nested) return nested;
        continue;
      }
      const candidateName: string = item.name ?? item.variants?.[0]?.name ?? '';
      if (normalize(candidateName) === target) {
        const detail = await request('GET', `/umbraco/management/api/v1/document-type/${item.id}`, null, token);
        return JSON.parse(detail.body) as DocumentType;
      }
    }
    return null;
  }

  return walk(null);
}

/**
 * Read the partial file + look up the matching element type, then return the
 * deterministic payload and its SHA-256 hex digest.
 */
export async function computeSourceSignature(
  featureAlias: string,
  opts: { agentSystemPromptHash?: string } = {},
): Promise<{ signature: string; payload: SignaturePayload }> {
  const partialRelative = partialPathFor(featureAlias);
  const partialAbsolute = path.join(REPO_ROOT, partialRelative);
  if (!fs.existsSync(partialAbsolute)) {
    throw new Error(`Partial not found for feature "${featureAlias}": ${partialRelative}`);
  }
  const partialContent = fs.readFileSync(partialAbsolute, 'utf8');

  const token = await getToken();
  const elementType = await findElementTypeForFeature(token, featureAlias);
  if (!elementType) {
    throw new Error(`No element type found whose display name matches "${featureAlias}".`);
  }

  const properties: DocumentTypeProperty[] = elementType.properties ?? [];
  const dataTypeIds = properties
    .map((p) => p.dataType?.id)
    .filter((id): id is string => typeof id === 'string');
  const dataTypeAliasMap = await lookupDataTypeAliasMap(token, dataTypeIds);

  const payload = buildSignaturePayload({
    partialPath: partialRelative,
    partialContent,
    elementType: {
      alias: elementType.alias,
      name: elementType.name,
      properties: properties.map((p) => ({
        alias: p.alias,
        name: p.name,
        dataTypeAlias: dataTypeAliasMap.get(p.dataType?.id ?? '') ?? '',
      })),
    },
    agentSystemPromptHash: opts.agentSystemPromptHash ?? '',
  });

  return { signature: hashPayload(payload), payload };
}

// ── Global-feature signature ──────────────────────────────────

/**
 * Signature payload for a global (non-block) feature. Hashes a list of
 * source files; entries prefixed with `doc-type:<alias>` resolve to the
 * element type's properties (alias / name / dataTypeAlias) the same way
 * block signatures resolve their element type.
 */
export interface GlobalSignaturePayload {
  featureAlias: string;
  sources: Array<{
    kind: 'file' | 'doc-type';
    ref: string;
    /** File contents (kind=file) or null when `kind=doc-type`. */
    content: string | null;
    /** Resolved element-type properties when `kind=doc-type`, else null. */
    properties: SignatureProperty[] | null;
  }>;
  agentSystemPromptHash: string;
  schemaVersion: typeof SCHEMA_VERSION;
}

async function readFileSource(relativePath: string): Promise<string> {
  const absolute = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Source file not found: ${relativePath}`);
  }
  return fs.readFileSync(absolute, 'utf8');
}

async function readDocTypeProperties(
  token: string,
  alias: string,
): Promise<SignatureProperty[]> {
  const dt = await getDocumentTypeByAlias(token, alias);
  if (!dt) {
    throw new Error(`Document type not found: ${alias}`);
  }
  const properties: DocumentTypeProperty[] = dt.properties ?? [];
  const dataTypeIds = properties
    .map((p) => p.dataType?.id)
    .filter((id): id is string => typeof id === 'string');
  const dataTypeAliasMap = await lookupDataTypeAliasMap(token, dataTypeIds);
  return properties
    .map((p) => ({
      alias: p.alias,
      name: p.name,
      dataTypeAlias: dataTypeAliasMap.get(p.dataType?.id ?? '') ?? '',
    }))
    .sort((a, b) => a.alias.localeCompare(b.alias));
}

/**
 * Compute a deterministic SHA-256 signature for a global feature. Reads each
 * file source from disk; for `doc-type:` source markers, resolves the element
 * type's properties via the Management API and hashes the alias/name/dataType
 * triples instead.
 */
export async function computeGlobalSourceSignature(
  feature: Feature,
  opts: { agentSystemPromptHash?: string } = {},
): Promise<{ signature: string; payload: GlobalSignaturePayload }> {
  if (feature.kind !== 'global') {
    throw new Error(
      `computeGlobalSourceSignature called with non-global feature: ${feature.alias}`,
    );
  }

  const token = await getToken();
  const sources: GlobalSignaturePayload['sources'] = [];
  for (const ref of feature.sources) {
    if (ref.startsWith('doc-type:')) {
      const alias = ref.slice('doc-type:'.length);
      const properties = await readDocTypeProperties(token, alias);
      sources.push({ kind: 'doc-type', ref, content: null, properties });
    } else {
      const content = await readFileSource(ref);
      sources.push({ kind: 'file', ref, content, properties: null });
    }
  }

  const payload: GlobalSignaturePayload = {
    featureAlias: feature.alias,
    sources,
    agentSystemPromptHash: opts.agentSystemPromptHash ?? '',
    schemaVersion: SCHEMA_VERSION,
  };

  const canonical = stableStringify(payload);
  const signature = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return { signature, payload };
}

/**
 * Single entry point that dispatches on `feature.kind`. Block features use the
 * legacy element-type-based payload; global features use the multi-source
 * payload. Both return the same `{ signature, payload }` shape with payload
 * typed as a discriminated union.
 */
export async function computeFeatureSignature(
  feature: Feature,
  opts: { agentSystemPromptHash?: string } = {},
): Promise<
  | { signature: string; payload: SignaturePayload; kind: 'block' }
  | { signature: string; payload: GlobalSignaturePayload; kind: 'global' }
> {
  if (feature.kind === 'block') {
    const { signature, payload } = await computeSourceSignature(feature.alias, opts);
    return { signature, payload, kind: 'block' };
  }
  const { signature, payload } = await computeGlobalSourceSignature(feature, opts);
  return { signature, payload, kind: 'global' };
}

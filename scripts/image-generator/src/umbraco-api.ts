/**
 * Umbraco Management API integration for the image generator.
 *
 * Provides functions to fetch article metadata, resolve categories,
 * upload images to the media library, and assign them as mainImage.
 *
 * Follows the same auth/HTTP patterns as scripts/add-section-nav-property.cjs.
 */

import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { extractWordCount } from './word-count.js';
import type { ArticleMetadata } from './types.js';

// ── Load .env ──────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
const envContents = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of envContents.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const BASE_URL = env.UMBRACO_BASE_URL || 'https://localhost:44367';
const CLIENT_ID = env.UMBRACO_CLIENT_ID;
const CLIENT_SECRET = env.UMBRACO_CLIENT_SECRET;

// Allow self-signed certs for local dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Known IDs ──────────────────────────────────────────────────

const FOLDER_MEDIA_TYPE_ID = 'f38bd2d7-65d0-48e6-95dc-87ce06ec2d3d';
const IMAGE_MEDIA_TYPE_ID = 'cc07b313-0843-4aa8-bbda-871c8da728c8';

// ── HTTP helpers ───────────────────────────────────────────────

interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function request(method: string, urlPath: string, body: unknown, token?: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
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

/** Upload binary data as multipart/form-data to the temporary file endpoint. */
function uploadMultipart(
  urlPath: string,
  fields: Record<string, string>,
  fileField: string,
  fileBuffer: Buffer,
  fileName: string,
  token: string,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;
    const url = new URL(urlPath, BASE_URL);

    // Build multipart body
    const parts: Buffer[] = [];

    for (const [key, value] of Object.entries(fields)) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      ));
    }

    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const options: https.RequestOptions = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
        'Authorization': `Bearer ${token}`,
      },
      rejectUnauthorized: false,
    };

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
          reject(new Error(`POST ${urlPath} → ${res.statusCode}\n${data}`));
        } else {
          resolve(result);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Auth ───────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenIssuedAt = 0;

export async function authenticate(): Promise<string> {
  const body = `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
  return new Promise((resolve, reject) => {
    const url = new URL('/umbraco/management/api/v1/security/back-office/token', BASE_URL);
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

/** Re-authenticate if the token is older than 250 seconds (tokens expire at 299s). */
export async function freshToken(): Promise<string> {
  const age = (Date.now() - tokenIssuedAt) / 1000;
  if (!cachedToken || age > 250) {
    return authenticate();
  }
  return cachedToken;
}

// ── Category resolution ────────────────────────────────────────

/**
 * Build a Map<uuid, name> of all categories.
 * Walks the document tree to find the Categories container, then fetches its children.
 */
export async function resolveCategories(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Find the "Categories" node under Home
  const rootRes = await request('GET', '/umbraco/management/api/v1/tree/document/root?skip=0&take=100', null, token);
  const rootItems = JSON.parse(rootRes.body).items;
  const home = rootItems.find((i: any) => i.variants?.[0]?.name === 'Home');
  if (!home) return map;

  const childrenRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${home.id}&skip=0&take=100`,
    null,
    token,
  );
  const children = JSON.parse(childrenRes.body).items;
  const categoriesNode = children.find((i: any) => i.variants?.[0]?.name === 'Categories');
  if (!categoriesNode) return map;

  // Fetch category children
  const catChildrenRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${categoriesNode.id}&skip=0&take=100`,
    null,
    token,
  );
  const catChildren = JSON.parse(catChildrenRes.body).items;
  for (const cat of catChildren) {
    const name = cat.variants?.[0]?.name;
    if (name) {
      map.set(cat.id, name);
    }
  }

  return map;
}

// ── Word count extraction from Block List ──────────────────────

/**
 * Extract total word count from a contentRows block list value.
 * Aggregates text from all blocks' rich text content.
 */
function extractWordCountFromBlockList(contentRowsValue: any): number {
  if (!contentRowsValue) return 0;

  let totalWords = 0;
  const contentData = contentRowsValue.contentData ?? [];

  for (const block of contentData) {
    const values = block.values ?? [];
    for (const val of values) {
      const v = val.value;
      if (v == null) continue;

      // Rich text with markup (Tiptap RTE)
      if (typeof v === 'object' && v.markup) {
        totalWords += extractWordCount(v.markup);
      }
      // Plain HTML string
      else if (typeof v === 'string') {
        totalWords += extractWordCount(v);
      }
      // Tiptap JSON (has type and content)
      else if (typeof v === 'object' && v.type && v.content) {
        totalWords += extractWordCount(v);
      }
    }
  }

  return totalWords;
}

// ── Fetch articles ─────────────────────────────────────────────

/**
 * Fetch all articles from the Blog section with resolved metadata.
 * Walks: Document root → Home → Blog → article children.
 */
export async function fetchArticles(token: string): Promise<ArticleMetadata[]> {
  // Pre-fetch category map for resolving MNTP references
  const categoryMap = await resolveCategories(token);

  // Walk tree to find Blog node
  const rootRes = await request('GET', '/umbraco/management/api/v1/tree/document/root?skip=0&take=100', null, token);
  const rootItems = JSON.parse(rootRes.body).items;
  const home = rootItems.find((i: any) => i.variants?.[0]?.name === 'Home');
  if (!home) throw new Error('Could not find Home node in document tree');

  const childrenRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${home.id}&skip=0&take=100`,
    null,
    token,
  );
  const children = JSON.parse(childrenRes.body).items;
  const blogNode = children.find((i: any) => i.variants?.[0]?.name === 'Blog');
  if (!blogNode) throw new Error('Could not find Blog node under Home');

  // Fetch article children
  const articlesRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${blogNode.id}&skip=0&take=100`,
    null,
    token,
  );
  const articleItems = JSON.parse(articlesRes.body).items;

  // Fetch full document for each article
  const articles: ArticleMetadata[] = [];
  for (const item of articleItems) {
    token = await freshToken();
    const docRes = await request('GET', `/umbraco/management/api/v1/document/${item.id}`, null, token);
    const doc = JSON.parse(docRes.body);

    const values = doc.values ?? [];
    const getValue = (alias: string) => values.find((v: any) => v.alias === alias)?.value;

    // Title: from headerControls composition, fall back to document name
    const title = getValue('title') || doc.variants?.[0]?.name || item.variants?.[0]?.name || 'Untitled';

    // Categories: MNTP format [{ type: "document", unique: "uuid" }]
    const categoriesRaw = getValue('categories') ?? [];
    const categoryIds: string[] = [];
    const categories: string[] = [];
    for (const ref of categoriesRaw) {
      const uuid = ref.unique ?? ref.id ?? ref;
      categoryIds.push(uuid);
      const name = categoryMap.get(uuid);
      if (name) categories.push(name);
    }

    // Word count: from contentRows block list
    const contentRows = getValue('contentRows');
    const wordCount = extractWordCountFromBlockList(contentRows);

    articles.push({
      id: item.id,
      name: doc.variants?.[0]?.name || item.variants?.[0]?.name || 'Untitled',
      title,
      wordCount,
      categories,
      categoryIds,
    });
  }

  return articles;
}

/**
 * Fetch a single article by ID.
 */
export async function fetchArticleById(token: string, id: string): Promise<ArticleMetadata> {
  const categoryMap = await resolveCategories(token);

  const docRes = await request('GET', `/umbraco/management/api/v1/document/${id}`, null, token);
  const doc = JSON.parse(docRes.body);

  const values = doc.values ?? [];
  const getValue = (alias: string) => values.find((v: any) => v.alias === alias)?.value;

  const title = getValue('title') || doc.variants?.[0]?.name || 'Untitled';

  const categoriesRaw = getValue('categories') ?? [];
  const categoryIds: string[] = [];
  const categories: string[] = [];
  for (const ref of categoriesRaw) {
    const uuid = ref.unique ?? ref.id ?? ref;
    categoryIds.push(uuid);
    const name = categoryMap.get(uuid);
    if (name) categories.push(name);
  }

  const contentRows = getValue('contentRows');
  const wordCount = extractWordCountFromBlockList(contentRows);

  return {
    id,
    name: doc.variants?.[0]?.name || 'Untitled',
    title,
    wordCount,
    categories,
    categoryIds,
  };
}

/**
 * Find an article by name (case-insensitive partial match).
 * Returns the first matching article's tree item { id, name }.
 */
export async function findArticleByName(token: string, name: string): Promise<{ id: string; name: string } | null> {
  const rootRes = await request('GET', '/umbraco/management/api/v1/tree/document/root?skip=0&take=100', null, token);
  const rootItems = JSON.parse(rootRes.body).items;
  const home = rootItems.find((i: any) => i.variants?.[0]?.name === 'Home');
  if (!home) return null;

  const childrenRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${home.id}&skip=0&take=100`,
    null,
    token,
  );
  const children = JSON.parse(childrenRes.body).items;
  const blogNode = children.find((i: any) => i.variants?.[0]?.name === 'Blog');
  if (!blogNode) return null;

  const articlesRes = await request(
    'GET',
    `/umbraco/management/api/v1/tree/document/children?parentId=${blogNode.id}&skip=0&take=100`,
    null,
    token,
  );
  const articleItems = JSON.parse(articlesRes.body).items;

  const lowerName = name.toLowerCase();
  const match = articleItems.find((i: any) => {
    const n = i.variants?.[0]?.name ?? '';
    return n.toLowerCase().includes(lowerName);
  });

  if (!match) return null;
  return { id: match.id, name: match.variants?.[0]?.name ?? '' };
}

// ── Media folder ───────────────────────────────────────────────

/**
 * Ensure a "Generated Images" folder exists in the media library root.
 * Returns the folder's UUID.
 */
export async function ensureMediaFolder(token: string): Promise<string> {
  // Check if folder already exists
  const rootRes = await request('GET', '/umbraco/management/api/v1/tree/media/root?skip=0&take=100', null, token);
  const rootItems = JSON.parse(rootRes.body).items;
  const existing = rootItems.find((i: any) => i.variants?.[0]?.name === 'Generated Images');
  if (existing) return existing.id;

  // Create new folder
  const folderId = randomUUID();
  const payload = {
    id: folderId,
    mediaType: { id: FOLDER_MEDIA_TYPE_ID },
    parent: null,
    values: [],
    variants: [{ name: 'Generated Images', culture: null, segment: null }],
  };

  await request('POST', '/umbraco/management/api/v1/media', payload, token);
  return folderId;
}

// ── Image upload ───────────────────────────────────────────────

/**
 * Upload a PNG buffer to the Umbraco media library.
 *
 * Two-step process:
 * 1. Upload PNG as a temporary file
 * 2. Create an Image media item referencing the temporary file
 *
 * Returns the new media item's UUID.
 */
export async function uploadImage(
  token: string,
  folderId: string,
  fileName: string,
  pngBuffer: Buffer,
): Promise<string> {
  // Step 1: Upload temporary file
  const tempFileId = randomUUID();
  await uploadMultipart(
    '/umbraco/management/api/v1/temporary-file',
    { Id: tempFileId },
    'File',
    pngBuffer,
    fileName,
    token,
  );

  // Step 2: Create media item referencing the temporary file
  const mediaId = randomUUID();
  const payload = {
    id: mediaId,
    mediaType: { id: IMAGE_MEDIA_TYPE_ID },
    parent: { id: folderId },
    values: [
      {
        alias: 'umbracoFile',
        culture: null,
        segment: null,
        value: { temporaryFileId: tempFileId },
      },
    ],
    variants: [{ name: fileName, culture: null, segment: null }],
  };

  await request('POST', '/umbraco/management/api/v1/media', payload, token);
  return mediaId;
}

// ── Main image assignment ──────────────────────────────────────

/**
 * Check if a document already has a mainImage set.
 */
export async function hasMainImage(token: string, documentId: string): Promise<boolean> {
  const docRes = await request('GET', `/umbraco/management/api/v1/document/${documentId}`, null, token);
  const doc = JSON.parse(docRes.body);
  const mainImageValue = doc.values?.find((v: any) => v.alias === 'mainImage')?.value;
  return Array.isArray(mainImageValue) && mainImageValue.length > 0;
}

/**
 * Assign a media item as the article's mainImage.
 *
 * Reads the current document, sets/replaces the mainImage value in
 * MediaPicker3 format, and PUTs the full payload back.
 */
export async function assignMainImage(token: string, documentId: string, mediaId: string): Promise<void> {
  // Read current document
  const docRes = await request('GET', `/umbraco/management/api/v1/document/${documentId}`, null, token);
  const doc = JSON.parse(docRes.body);

  // Build MediaPicker3 value
  const mediaPicker3Value = [
    {
      key: randomUUID(),
      mediaKey: mediaId,
      crops: [],
      focalPoint: null,
    },
  ];

  // Update or add mainImage in values array
  const values = doc.values ?? [];
  const existingIdx = values.findIndex((v: any) => v.alias === 'mainImage');
  if (existingIdx >= 0) {
    values[existingIdx].value = mediaPicker3Value;
  } else {
    values.push({
      alias: 'mainImage',
      culture: null,
      segment: null,
      value: mediaPicker3Value,
    });
  }

  // Build update payload (remove read-only fields)
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

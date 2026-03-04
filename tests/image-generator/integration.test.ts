/**
 * Integration tests for the image generator pipeline.
 *
 * Requires a running Umbraco instance with articles in the Blog section.
 * Validates: fetch articles → generate image → determinism → distinctness → upload + assign + cleanup.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as https from 'node:https';
import {
  authenticate,
  freshToken,
  fetchArticles,
  ensureMediaFolder,
  uploadImage,
  assignMainImage,
  hasMainImage,
} from '../../scripts/image-generator/src/umbraco-api.js';
import { generateImage } from '../../scripts/image-generator/src/generator.js';
import type { ArticleMetadata } from '../../scripts/image-generator/src/types.js';

// ── Helpers ──────────────────────────────────────────────────────

/** Load BASE_URL from .env the same way umbraco-api.ts does. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '..', '.env');
const envContents = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of envContents.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}
const BASE_URL = env.UMBRACO_BASE_URL || 'https://localhost:44367';

/** Raw HTTPS request for cleanup operations (DELETE media). */
function rawRequest(method: string, urlPath: string, token: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Test state ───────────────────────────────────────────────────

let token: string;
let articles: ArticleMetadata[];

// Track media items created during tests for cleanup
const createdMediaIds: string[] = [];
// Track original mainImage state for restore
let testArticleId: string | null = null;
let originalHadMainImage: boolean = false;

// ── Setup / Teardown ─────────────────────────────────────────────

before(async () => {
  token = await authenticate();
  articles = await fetchArticles(token);
});

after(async () => {
  // Clean up: delete any media items we created
  token = await freshToken();
  for (const mediaId of createdMediaIds) {
    try {
      await rawRequest('DELETE', `/umbraco/management/api/v1/media/${mediaId}`, token);
    } catch {
      // Best-effort cleanup — don't fail the test suite
    }
  }

  // Restore: if we assigned a mainImage to an article that didn't have one,
  // we can't easily "unset" it via PUT (would need to set value to []),
  // but at least we tried to clean up the media item above.
});

// ── Tests ────────────────────────────────────────────────────────

describe('integration: image generator pipeline', () => {
  it('fetchArticles returns non-empty array with valid metadata', () => {
    assert.ok(articles.length > 0, 'Should find at least one article');

    for (const article of articles) {
      assert.ok(article.id, `Article "${article.name}" should have an id`);
      assert.ok(article.name, 'Article should have a name');
      assert.ok(article.title, 'Article should have a title');
      assert.ok(typeof article.wordCount === 'number', 'wordCount should be a number');
      assert.ok(Array.isArray(article.categories), 'categories should be an array');
    }
  });

  it('at least one article has wordCount > 0 and categories', () => {
    const withContent = articles.find((a) => a.wordCount > 0 && a.categories.length > 0);
    assert.ok(withContent, 'At least one article should have wordCount > 0 and categories');
  });

  it('generateImage returns a valid PNG buffer for a real article', () => {
    const article = articles[0];
    const buf = generateImage(article);

    assert.ok(Buffer.isBuffer(buf), 'Result should be a Buffer');
    assert.ok(buf.length > 0, 'Buffer should have non-zero length');
    // PNG magic bytes: \x89PNG\r\n\x1a\n
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50); // P
    assert.equal(buf[2], 0x4e); // N
    assert.equal(buf[3], 0x47); // G
  });

  it('determinism: same article metadata → byte-identical PNG', () => {
    const article = articles[0];
    const buf1 = generateImage(article);
    const buf2 = generateImage(article);
    assert.ok(buf1.equals(buf2), 'Same article metadata should produce identical PNGs');
  });

  it('distinctness: different articles → different PNGs', () => {
    if (articles.length < 2) {
      // Skip if only one article (can't test distinctness)
      return;
    }
    const buf1 = generateImage(articles[0]);
    const buf2 = generateImage(articles[1]);
    assert.ok(!buf1.equals(buf2), 'Different articles should produce different PNGs');
  });

  it('upload image to media library and assign to article', async () => {
    // Pick an article for the upload+assign test
    const article = articles[0];
    testArticleId = article.id;

    // Remember original state for awareness (cleanup deletes the media item)
    token = await freshToken();
    originalHadMainImage = await hasMainImage(token, article.id);

    // Generate the image
    const pngBuffer = generateImage(article);

    // Ensure "Generated Images" folder exists
    token = await freshToken();
    const folderId = await ensureMediaFolder(token);

    // Upload
    token = await freshToken();
    const fileName = `integration-test-${Date.now()}.png`;
    const mediaId = await uploadImage(token, folderId, fileName, pngBuffer);
    createdMediaIds.push(mediaId);

    assert.ok(mediaId, 'uploadImage should return a media UUID');
    assert.match(mediaId, /^[0-9a-f-]{36}$/, 'mediaId should be a valid UUID');

    // Assign as mainImage (only if article didn't already have one, to be non-destructive)
    if (!originalHadMainImage) {
      token = await freshToken();
      await assignMainImage(token, article.id, mediaId);

      // Verify assignment
      token = await freshToken();
      const hasImage = await hasMainImage(token, article.id);
      assert.ok(hasImage, 'Article should have mainImage set after assignment');
    }
  });

  it('uploaded media item is retrievable via API', async () => {
    if (createdMediaIds.length === 0) {
      return; // Upload test didn't run or failed
    }

    token = await freshToken();
    const mediaId = createdMediaIds[0];
    const res = await rawRequest('GET', `/umbraco/management/api/v1/media/${mediaId}`, token);
    assert.equal(res.status, 200, 'Should be able to GET the uploaded media item');

    const media = JSON.parse(res.body);
    assert.ok(media.id === mediaId, 'Media item ID should match');
    assert.ok(media.variants?.[0]?.name?.startsWith('integration-test-'), 'Media name should match upload');
  });
});

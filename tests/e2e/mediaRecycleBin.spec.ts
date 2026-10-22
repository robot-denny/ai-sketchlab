import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  TEST_FIXTURE_PREFIX,
  getMediaTypeIdByName,
  uploadTemporaryFile,
  createMediaFromTemporaryFile,
  getMediaPath,
  moveMediaToRecycleBin,
  restoreMediaFromRecycleBin,
  findMediaByNamePrefix,
  deleteMediaPermanently,
} from './_umbracoApi';

/**
 * Media recycle-bin protection: a media file that an editor moves to the
 * recycle bin must stop being served to anonymous visitors, and be served
 * again once it is restored.
 *
 * Umbraco 18 turns `EnableMediaRecycleBinProtection` on by default (a
 * middleware that blocks unauthenticated requests for recycle-bin media, plus
 * a `.deleted` suffix on the stored file). Umbraco 17 has it off, so on v17
 * this spec is RED at the "trashed → not served" assertion. That is expected;
 * it goes GREEN with the v18 bump. We deliberately don't set the config key:
 * the v18 default is the behavior being adopted.
 *
 * "Served" is what an anonymous visitor observes: HTTP 200 with image content.
 * No specific v18 status code is asserted (404 vs 403 etc. is an
 * implementation choice); only that the visitor no longer gets the image.
 */

const FIXTURE_LABEL = `${TEST_FIXTURE_PREFIX} Media RB`;

// A 1×1 transparent PNG — the smallest real image the Image media type accepts.
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
);

const BASE_URL = process.env.UMBRACO_URL || 'https://localhost:44367';

let mediaId: string | null = null;
let mediaPath = '';
let anonymous: APIRequestContext;

/** What an anonymous visitor sees when requesting the media URL. */
async function anonymousFetch(path: string) {
  // Cache-buster so no intermediate cache can answer for the server.
  const resp = await anonymous.get(`${path}?rb=${Date.now()}`, { maxRedirects: 0 });
  const contentType = resp.headers()['content-type'] ?? '';
  const served = resp.status() === 200 && contentType.startsWith('image/');
  return { status: resp.status(), contentType, served };
}

async function cleanUpFixtures() {
  for (const stale of await findMediaByNamePrefix(FIXTURE_LABEL)) {
    await deleteMediaPermanently(stale.id);
  }
}

test.describe('Media recycle-bin protection', () => {
  test.beforeAll(async ({ playwright }) => {
    // E2E rule #3: clear leftovers from a previous failed run before creating.
    await cleanUpFixtures();

    // A fresh context with no storageState → no backoffice cookies → anonymous.
    anonymous = await playwright.request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });

    const imageTypeId = await getMediaTypeIdByName('Image');
    const fileName = `e2e-media-rb-${Date.now()}.png`;
    const tempId = await uploadTemporaryFile(fileName, PNG_1X1, 'image/png');
    mediaId = await createMediaFromTemporaryFile({
      name: `${FIXTURE_LABEL} ${fileName}`,
      mediaTypeId: imageTypeId,
      temporaryFileId: tempId,
    });
    mediaPath = await getMediaPath(mediaId);
  });

  test.afterAll(async () => {
    // Mandatory, and runs even when the test fails mid-way (e.g. RED on v17
    // with the fixture still in the recycle bin).
    if (mediaId) await deleteMediaPermanently(mediaId);
    await cleanUpFixtures();
    await anonymous?.dispose();
  });

  test('trashed media is not served to anonymous visitors, and is served again once restored', async () => {
    const live = await anonymousFetch(mediaPath);
    console.log(`[media-rb] live:     ${mediaPath} → ${live.status} ${live.contentType}`);
    expect(live.served, `uploaded media should be served anonymously (got ${live.status} ${live.contentType})`).toBe(true);

    await moveMediaToRecycleBin(mediaId!);
    const trashed = await anonymousFetch(mediaPath);
    console.log(`[media-rb] trashed:  ${mediaPath} → ${trashed.status} ${trashed.contentType}`);
    expect(
      trashed.served,
      `trashed media should no longer be served to an anonymous visitor (got ${trashed.status} ${trashed.contentType})`
    ).toBe(false);

    await restoreMediaFromRecycleBin(mediaId!);
    // Restoring may change the stored file name back; re-read the URL.
    const restoredPath = await getMediaPath(mediaId!);
    const restored = await anonymousFetch(restoredPath);
    console.log(`[media-rb] restored: ${restoredPath} → ${restored.status} ${restored.contentType}`);
    expect(restored.served, `restored media should be served anonymously again (got ${restored.status} ${restored.contentType})`).toBe(true);
  });
});

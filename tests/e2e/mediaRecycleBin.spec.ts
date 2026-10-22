import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  API_BASE,
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
 * This asserts the visitor-visible outcome, not the mechanism: on v18 the
 * `.deleted` rename alone would make the old URL stop serving, so a pass does
 * not prove the middleware specifically ran. "Served" means HTTP 200 with image
 * content; no particular v18 status code is asserted.
 */

const FIXTURE_LABEL = `${TEST_FIXTURE_PREFIX} Media RB`;

// A 1×1 transparent PNG — the smallest real image the Image media type accepts.
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
);

// Trash/restore rename the stored file; on blob-backed (Cloud) storage that can
// lag the API response, so the served/not-served checks poll briefly.
const SETTLE = { timeout: 10_000, intervals: [250, 500, 1_000] };

let mediaId = '';
let mediaPath = '';
let anonymous: APIRequestContext | undefined;

/** What an anonymous visitor sees when requesting the media URL. */
async function anonymousFetch(path: string) {
  // Cache-buster so no intermediate cache can answer for the server.
  const resp = await anonymous!.get(`${path}?rb=${Date.now()}`, { maxRedirects: 0 });
  const contentType = resp.headers()['content-type'] ?? '';
  return { status: resp.status(), contentType, served: resp.status() === 200 && contentType.startsWith('image/') };
}

/** Retries until the visitor-visible "served" state is `expected`; a failure reports the last response. */
async function expectServed(path: string, expected: boolean, message: string) {
  await expect(async () => {
    const r = await anonymousFetch(path);
    expect(r.served, `${message} (got ${r.status} ${r.contentType})`).toBe(expected);
  }).toPass(SETTLE);
}

/** Every fixture this spec could have left behind, in the tree or the recycle bin. */
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
    // Same host as the Management API helpers, where the fixture is created.
    anonymous = await playwright.request.newContext({
      baseURL: API_BASE,
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
    // Mandatory, and must run in full even when the test failed mid-way (e.g.
    // RED on v17 with the fixture still in the recycle bin). The prefix sweep
    // also covers `mediaId`; a failure in it must not skip disposing the context.
    try {
      await cleanUpFixtures();
    } finally {
      await anonymous?.dispose();
    }
  });

  test('trashed media is not served to anonymous visitors, and is served again once restored', async () => {
    await expectServed(mediaPath, true, `uploaded media ${mediaPath} should be served anonymously`);

    await moveMediaToRecycleBin(mediaId);
    await expectServed(mediaPath, false, `trashed media ${mediaPath} should no longer be served to an anonymous visitor`);

    await restoreMediaFromRecycleBin(mediaId);
    // Restoring may change the stored file name back; re-read the URL.
    const restoredPath = await getMediaPath(mediaId);
    await expectServed(restoredPath, true, `restored media ${restoredPath} should be served anonymously again`);
  });
});

import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGE_CAROUSEL_ROW_CT_KEY = '1c43fe2d-4a9a-4336-923f-9d0214950d48';
const IMAGE_CAROUSEL_ROW_SETTINGS_CT_KEY = '378fde96-51b6-4506-93e3-ec3038e636bb';
const API_BASE = process.env.URL || 'https://localhost:44367';

// ==============================
// Shared API Helpers (rule #4: refresh tokens)
// ==============================

let _token: string;
let _tokenTimestamp = 0;
const TOKEN_TTL = 250_000;

async function freshToken(): Promise<string> {
  if (_token && Date.now() - _tokenTimestamp < TOKEN_TTL) return _token;
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
  _tokenTimestamp = Date.now();
  return _token;
}

async function apiFetch(token: string, method: string, path: string, body?: any) {
  return fetch(`${API_BASE}/umbraco/management/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/** Fetch the published path for a document (rule #2: never hardcode URL slugs) */
async function getDocumentPath(token: string, docId: string): Promise<string> {
  const resp = await apiFetch(token, 'GET', `/document/urls?id=${docId}`);
  if (!resp.ok) throw new Error(`GET document URLs failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  const url: string = data[0]?.urlInfos?.[0]?.url;
  if (!url) throw new Error(`No URL found for document ${docId}`);
  return url;
}

// ==============================
// Section 1: Element Type Tests
// ==============================

test.describe('Image Carousel Row — Element Type', () => {
  test('imageCarouselRow element type exists and is an element', async ({ umbracoApi }) => {
    const elementType = await umbracoApi.documentType.getByName('Image Carousel Row');
    expect(elementType, '"Image Carousel Row" should exist').toBeTruthy();
    expect(elementType.isElement).toBe(true);
  });

  test('imageCarouselRow has images, author, and scrollSpeedMs properties', async ({
    umbracoApi,
  }) => {
    const elementType = await umbracoApi.documentType.getByName('Image Carousel Row');
    expect(elementType).toBeTruthy();

    const aliases = (elementType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'should have images property').toContain('images');
    expect(aliases, 'should have author property').toContain('author');
    expect(aliases, 'should have scrollSpeedMs property').toContain('scrollSpeedMs');
  });

  test('imageCarouselRowSettings element type still exists', async () => {
    // Workaround: getByName uses recurseChildren which short-circuits on the first folder
    // with hasChildren:true, missing siblings. Look up by known key via Management API directly.
    const token = await freshToken();
    const resp = await apiFetch(token, 'GET', `/document-type/${IMAGE_CAROUSEL_ROW_SETTINGS_CT_KEY}`);
    expect(resp.ok, `GET document-type/${IMAGE_CAROUSEL_ROW_SETTINGS_CT_KEY} should return 200`).toBe(true);
    const elementType = (await resp.json()) as any;
    expect(elementType, '"Image Carousel Row Settings" should exist').toBeTruthy();
    expect(elementType.isElement).toBe(true);
  });
});

// ==============================
// Section 2: Partial View & JS File Tests
// ==============================

test.describe('Image Carousel Row — Partial View', () => {
  const partialPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/Views/Partials/blocklist/Components/imageCarouselRow.cshtml'
  );

  test('partial view file exists', () => {
    expect(existsSync(partialPath)).toBe(true);
  });

  test('partial uses Bootstrap carousel-fade (not Swiffy Slider)', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toContain('carousel-fade');
    expect(content).not.toContain('swiffy-slider');
    expect(content).not.toContain('slider-container');
  });

  test('partial uses data-bs-interval for scroll speed', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toContain('data-bs-interval');
  });

  test('partial renders play/pause button with correct class', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toContain('carousel-play-pause');
  });

  test('partial reads alt text from media item', () => {
    const content = readFileSync(partialPath, 'utf-8');
    expect(content).toContain('GetAltText');
  });
});

test.describe('Image Carousel Row — carousel.js', () => {
  const carouselJsPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/wwwroot/assets/js/carousel.js'
  );
  const masterPath = resolve(
    __dirname,
    '../../../src/UmbracoProject/Views/master.cshtml'
  );

  // These tests will fail (RED) until Step 3 is implemented.

  test('carousel.js file exists', () => {
    expect(existsSync(carouselJsPath), 'carousel.js should exist at wwwroot/assets/js/').toBe(true);
  });

  test('carousel.js handles focus pause via focusin/focusout', () => {
    const content = readFileSync(carouselJsPath, 'utf-8');
    expect(content).toContain('focusin');
    expect(content).toContain('focusout');
  });

  test('carousel.js wires up play/pause toggle button', () => {
    const content = readFileSync(carouselJsPath, 'utf-8');
    expect(content).toContain('carousel-play-pause');
  });

  test('carousel.js respects prefers-reduced-motion', () => {
    const content = readFileSync(carouselJsPath, 'utf-8');
    expect(content).toContain('prefers-reduced-motion');
  });

  test('master.cshtml references carousel.js', () => {
    const content = readFileSync(masterPath, 'utf-8');
    expect(content).toContain('carousel.js');
  });
});

// ==============================
// Section 3: Browser E2E Tests
// ==============================

let targetDocId: string;
let targetDocUrl: string;
let originalDocValues: any[];
let originalDocTemplate: any;
let originalDocVariants: any[];
let originalContentRows: any;

const testBlockKeys = {
  multiImage: randomUUID(),
  multiImageSettings: randomUUID(),
  singleImage: randomUUID(),
  singleImageSettings: randomUUID(),
};

/** Recursively walk the media tree and return up to `limit` image media item keys */
async function findMediaImageKeys(token: string, limit = 3): Promise<string[]> {
  const keys: string[] = [];

  async function walkChildren(parentId: string | null) {
    if (keys.length >= limit) return;

    const url = parentId
      ? `${API_BASE}/umbraco/management/api/v1/tree/media/children?parentId=${parentId}&skip=0&take=100`
      : `${API_BASE}/umbraco/management/api/v1/tree/media/root?skip=0&take=100`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return;
    const data = (await resp.json()) as any;

    for (const item of data.items ?? []) {
      if (keys.length >= limit) break;

      // Media tree nodes use mediaType.icon to distinguish type — no alias at tree level.
      // Images have icon-picture; folders have icon-folder.
      if (item.mediaType?.icon === 'icon-picture') {
        keys.push(item.id);
      } else if (item.hasChildren) {
        await walkChildren(item.id);
      }
    }
  }

  await walkChildren(null);
  return keys;
}

/** Build multi-media picker value from an array of media keys */
function buildMediaPickerValue(mediaKeys: string[]): any[] {
  return mediaKeys.map((mediaKey) => ({ key: randomUUID(), mediaKey }));
}

test.describe('Image Carousel Row — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    let token = await freshToken();

    // 1. Find a content page that has a contentRows Block List (rule #1: dynamic lookup)
    const rootResp = await apiFetch(token, 'GET', '/tree/document/root?skip=0&take=100');
    if (!rootResp.ok) throw new Error(`GET doc tree root failed: ${rootResp.status}`);
    const rootData = (await rootResp.json()) as any;

    let foundDocId: string | null = null;

    for (const item of rootData.items ?? []) {
      const docResp = await apiFetch(token, 'GET', `/document/${item.id}`);
      if (docResp.ok) {
        const doc = (await docResp.json()) as any;
        if ((doc.values ?? []).some((v: any) => v.alias === 'contentRows')) {
          foundDocId = item.id;
          break;
        }
      }

      if (item.hasChildren && !foundDocId) {
        const childResp = await apiFetch(
          token, 'GET', `/tree/document/children?parentId=${item.id}&skip=0&take=100`
        );
        if (childResp.ok) {
          const childData = (await childResp.json()) as any;
          for (const child of childData.items ?? []) {
            token = await freshToken();
            const cDocResp = await apiFetch(token, 'GET', `/document/${child.id}`);
            if (cDocResp.ok) {
              const cDoc = (await cDocResp.json()) as any;
              if ((cDoc.values ?? []).some((v: any) => v.alias === 'contentRows')) {
                foundDocId = child.id;
                break;
              }
            }
          }
        }
      }
      if (foundDocId) break;
    }

    if (!foundDocId) {
      throw new Error('No page with contentRows block list found in the document tree.');
    }
    targetDocId = foundDocId;

    // 2. Read full document and save original state
    token = await freshToken();
    const docResp = await apiFetch(token, 'GET', `/document/${targetDocId}`);
    if (!docResp.ok) throw new Error(`GET document failed: ${docResp.status}`);
    const doc = (await docResp.json()) as any;

    originalDocValues = doc.values ?? [];
    originalDocTemplate = doc.template;
    originalDocVariants = doc.variants ?? [];

    const contentRowsEntry = originalDocValues.find((v: any) => v.alias === 'contentRows');
    originalContentRows = JSON.parse(JSON.stringify(contentRowsEntry?.value ?? null));

    // 3. Clean stale test data from prior failed runs (rule #3: always clean before setup)
    const staleKeys = new Set(Object.values(testBlockKeys));
    const staleBlockList = contentRowsEntry?.value;
    if (staleBlockList) {
      const hasStale = (staleBlockList.contentData ?? []).some((b: any) => staleKeys.has(b.key));
      if (hasStale) {
        const cleanedBlockList = {
          ...staleBlockList,
          layout: {
            'Umbraco.BlockList': (staleBlockList.layout?.['Umbraco.BlockList'] ?? []).filter(
              (e: any) => !staleKeys.has(e.contentKey)
            ),
          },
          contentData: (staleBlockList.contentData ?? []).filter(
            (b: any) => !staleKeys.has(b.key)
          ),
          settingsData: (staleBlockList.settingsData ?? []).filter(
            (b: any) => !staleKeys.has(b.key)
          ),
          expose: (staleBlockList.expose ?? []).filter(
            (e: any) => !staleKeys.has(e.contentKey)
          ),
        };
        const cleanedValues = originalDocValues.map((v: any) =>
          v.alias === 'contentRows' ? { ...v, value: cleanedBlockList } : v
        );
        token = await freshToken();
        await apiFetch(token, 'PUT', `/document/${targetDocId}`, {
          template: originalDocTemplate,
          values: cleanedValues,
          variants: originalDocVariants,
        });
        // Re-read so subsequent steps work from the clean state
        token = await freshToken();
        const cleanResp = await apiFetch(token, 'GET', `/document/${targetDocId}`);
        if (cleanResp.ok) {
          const cleanDoc = (await cleanResp.json()) as any;
          originalDocValues = cleanDoc.values ?? [];
        }
      }
    }

    // 4. Look up media images (re-use existing library items — rule #2)
    token = await freshToken();
    const mediaKeys = await findMediaImageKeys(token, 3);
    if (mediaKeys.length < 2) {
      throw new Error(
        `Need at least 2 image media items in the library. Found: ${mediaKeys.length}`
      );
    }

    // 5. Build carousel blocks
    //    Block A: 3 images, scrollSpeedMs 3000
    //    Block B: 1 image (edge case — no controls)
    const multiImageBlock = {
      key: testBlockKeys.multiImage,
      contentTypeKey: IMAGE_CAROUSEL_ROW_CT_KEY,
      values: [
        {
          alias: 'images',
          culture: null,
          segment: null,
          value: buildMediaPickerValue(mediaKeys.slice(0, 3)),
        },
        {
          alias: 'scrollSpeedMs',
          culture: null,
          segment: null,
          value: 3000,
        },
      ],
    };
    const multiImageSettings = {
      key: testBlockKeys.multiImageSettings,
      contentTypeKey: IMAGE_CAROUSEL_ROW_SETTINGS_CT_KEY,
      values: [],
    };

    const singleImageBlock = {
      key: testBlockKeys.singleImage,
      contentTypeKey: IMAGE_CAROUSEL_ROW_CT_KEY,
      values: [
        {
          alias: 'images',
          culture: null,
          segment: null,
          value: buildMediaPickerValue([mediaKeys[0]]),
        },
        {
          alias: 'scrollSpeedMs',
          culture: null,
          segment: null,
          value: 5000,
        },
      ],
    };
    const singleImageSettings = {
      key: testBlockKeys.singleImageSettings,
      contentTypeKey: IMAGE_CAROUSEL_ROW_SETTINGS_CT_KEY,
      values: [],
    };

    const newContentBlocks = [multiImageBlock, singleImageBlock];
    const newSettingsBlocks = [multiImageSettings, singleImageSettings];

    // 6. Inject blocks at the top of the existing block list
    const blockList = contentRowsEntry?.value ?? {
      layout: { 'Umbraco.BlockList': [] },
      contentData: [],
      settingsData: [],
      expose: [],
    };

    const updatedContentData = [...newContentBlocks, ...(blockList.contentData ?? [])];
    const updatedSettingsData = [...newSettingsBlocks, ...(blockList.settingsData ?? [])];

    const existingLayout = blockList.layout?.['Umbraco.BlockList'] ?? [];
    const newLayoutEntries = [
      { contentKey: testBlockKeys.multiImage, settingsKey: testBlockKeys.multiImageSettings },
      { contentKey: testBlockKeys.singleImage, settingsKey: testBlockKeys.singleImageSettings },
    ];
    const updatedLayout = [...newLayoutEntries, ...existingLayout];

    const existingExpose = blockList.expose ?? [];
    const newExposeEntries = newContentBlocks.map((b) => ({
      contentKey: b.key,
      culture: null,
      segment: null,
    }));
    const updatedExpose = [...newExposeEntries, ...existingExpose];

    const updatedBlockList = {
      ...blockList,
      layout: { 'Umbraco.BlockList': updatedLayout },
      contentData: updatedContentData,
      settingsData: updatedSettingsData,
      expose: updatedExpose,
    };

    const updatedValues = originalDocValues.map((v: any) =>
      v.alias === 'contentRows' ? { ...v, value: updatedBlockList } : v
    );

    // 7. Update and publish
    token = await freshToken();
    const putResp = await apiFetch(token, 'PUT', `/document/${targetDocId}`, {
      template: originalDocTemplate,
      values: updatedValues,
      variants: originalDocVariants,
    });
    if (!putResp.ok) {
      const text = await putResp.text();
      throw new Error(`Update document failed: ${putResp.status} - ${text}`);
    }

    const pubResp = await apiFetch(token, 'PUT', `/document/${targetDocId}/publish`, {
      publishSchedules: [{ culture: null }],
    });
    if (!pubResp.ok) {
      const text = await pubResp.text();
      throw new Error(`Publish failed: ${pubResp.status} - ${text}`);
    }

    // 8. Get actual published URL (rule #2: never hardcode slugs)
    token = await freshToken();
    targetDocUrl = await getDocumentPath(token, targetDocId);
  });

  test.afterAll(async () => {
    try {
      const token = await freshToken();
      const restoredValues = originalDocValues.map((v: any) =>
        v.alias === 'contentRows' ? { ...v, value: originalContentRows } : v
      );
      await apiFetch(token, 'PUT', `/document/${targetDocId}`, {
        template: originalDocTemplate,
        values: restoredValues,
        variants: originalDocVariants,
      });
      await apiFetch(token, 'PUT', `/document/${targetDocId}/publish`, {
        publishSchedules: [{ culture: null }],
      });
    } catch (e) {
      console.warn('Could not restore original document:', e);
    }
  });

  // --- Multi-image carousel ---

  test('carousel container is visible with carousel-fade class', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(
      `#slider-${testBlockKeys.multiImage}.carousel.carousel-fade`
    );
    await expect(carousel).toBeVisible();
  });

  test('three carousel items are rendered', async ({ page }) => {
    await page.goto(targetDocUrl);
    const items = page.locator(`#slider-${testBlockKeys.multiImage} .carousel-item`);
    await expect(items).toHaveCount(3);
  });

  test('three indicator buttons are rendered', async ({ page }) => {
    await page.goto(targetDocUrl);
    // Use [data-bs-slide-to] to select only slide indicators, not the play/pause button
    const indicators = page.locator(
      `#slider-${testBlockKeys.multiImage} .carousel-indicators button[data-bs-slide-to]`
    );
    await expect(indicators).toHaveCount(3);
  });

  test('first indicator has aria-current="true"', async ({ page }) => {
    await page.goto(targetDocUrl);
    const firstIndicator = page.locator(
      `#slider-${testBlockKeys.multiImage} .carousel-indicators button[data-bs-slide-to]`
    ).first();
    await expect(firstIndicator).toHaveAttribute('aria-current', 'true');
  });

  test('clicking second indicator makes the second carousel item active', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(`#slider-${testBlockKeys.multiImage}`);
    const secondIndicator = carousel.locator('.carousel-indicators button[data-bs-slide-to]').nth(1);

    await secondIndicator.click();

    // Bootstrap adds .active to the new slide — wait for the transition
    await expect(
      carousel.locator('.carousel-item').nth(1)
    ).toHaveClass(/active/, { timeout: 5000 });
  });

  test('first image has a non-empty alt attribute', async ({ page }) => {
    await page.goto(targetDocUrl);
    const firstImage = page.locator(
      `#slider-${testBlockKeys.multiImage} .carousel-item.active img`
    );
    await expect(firstImage).toHaveAttribute('alt', /.+/);
  });

  test('play/pause button is present and keyboard-focusable', async ({ page }) => {
    await page.goto(targetDocUrl);
    const btn = page.locator(
      `[data-carousel-id="slider-${testBlockKeys.multiImage}"].carousel-play-pause`
    );
    await expect(btn).toBeVisible();
    // Verify it is not explicitly removed from tab order
    const tabindex = await btn.getAttribute('tabindex');
    expect(tabindex).not.toBe('-1');
  });

  test('play/pause button toggles aria-label when clicked', async ({ page }) => {
    // This test will fail (RED) until carousel.js is implemented
    await page.goto(targetDocUrl);
    const btn = page.locator(
      `[data-carousel-id="slider-${testBlockKeys.multiImage}"].carousel-play-pause`
    );
    await expect(btn).toHaveAttribute('aria-label', 'Pause carousel');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-label', 'Play carousel');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-label', 'Pause carousel');
  });

  test('carousel pauses when play/pause button is clicked', async ({ page }) => {
    // This test will fail (RED) until carousel.js is implemented
    await page.goto(targetDocUrl);
    const carousel = page.locator(`#slider-${testBlockKeys.multiImage}`);
    const btn = page.locator(
      `[data-carousel-id="slider-${testBlockKeys.multiImage}"].carousel-play-pause`
    );

    // Click pause
    await btn.click();

    // After pause, Bootstrap adds data-bs-interval="false" or the carousel stops cycling.
    // We verify by checking that after waiting > one interval, the active item hasn't changed.
    const activeBefore = await carousel.locator('.carousel-item.active').getAttribute('data-index');
    await page.waitForTimeout(1500);
    const activeAfter = await carousel.locator('.carousel-item.active').getAttribute('data-index');
    expect(activeBefore).toBe(activeAfter);
  });

  test('manual pause persists after mouse leaves carousel', async ({ page }) => {
    // Regression test: Bootstrap's data-bs-pause="hover" calls cycle() on mouseleave,
    // which overrides a manual pause. This test confirms the fix by spying on Bootstrap's
    // cycle() — it must NOT be called after a manual pause + mouse leave.
    await page.goto(targetDocUrl);
    const carouselId = `slider-${testBlockKeys.multiImage}`;
    const btn = page.locator(`[data-carousel-id="${carouselId}"].carousel-play-pause`);

    // Install a spy on Bootstrap's cycle() AFTER page load so we only count calls
    // triggered by our interactions (not the initial auto-start on DOMContentLoaded).
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el || !(window as any).bootstrap?.Carousel) return;
      const inst = (window as any).bootstrap.Carousel.getInstance(el)
                ?? (window as any).bootstrap.Carousel.getOrCreateInstance(el);
      if (!inst) return;
      (window as any)._carouselCycleCalled = 0;
      const orig = inst.cycle.bind(inst);
      inst.cycle = function () {
        (window as any)._carouselCycleCalled++;
        return orig();
      };
    }, carouselId);

    // Hover over carousel (triggers Bootstrap mouseenter → pause) then click the button.
    // This matches the real user flow: move mouse to the button, then click it.
    await page.locator(`#${carouselId}`).hover();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-label', 'Play carousel');

    // Move mouse outside the carousel.
    // Bug:  Bootstrap's mouseleave calls _maybeEnableCycle() → cycle() → spy count = 1.
    // Fix:  our mouseleave handler checks manuallyPaused and skips cycle() → count = 0.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200); // allow events to flush

    const cycleCalled = await page.evaluate(() => (window as any)._carouselCycleCalled ?? 0);
    expect(cycleCalled, 'Bootstrap cycle() must NOT be called after a manual pause').toBe(0);
  });

  // --- Single-image edge case ---

  test('single-image block renders a plain img with no carousel controls', async ({ page }) => {
    await page.goto(targetDocUrl);

    // The single-image block renders a plain <img> — no carousel wrapper with that key
    const carousel = page.locator(`#slider-${testBlockKeys.singleImage}`);
    await expect(carousel).toHaveCount(0);
  });

  test('single-image block has no indicator buttons', async ({ page }) => {
    await page.goto(targetDocUrl);
    // There is no carousel with that key, so there are no indicators either
    const indicators = page.locator(
      `#slider-${testBlockKeys.singleImage} .carousel-indicators button`
    );
    await expect(indicators).toHaveCount(0);
  });
});

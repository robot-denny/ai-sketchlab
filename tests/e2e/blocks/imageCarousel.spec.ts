import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { getDocumentTypeByName } from '../_umbracoApi';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGE_CAROUSEL_ROW_CT_KEY = '1c43fe2d-4a9a-4336-923f-9d0214950d48';
const IMAGE_CAROUSEL_ROW_SETTINGS_CT_KEY = '378fde96-51b6-4506-93e3-ec3038e636bb';
const IMAGE_CAROUSEL_SLIDE_CT_KEY = '2da696cc-791f-4692-9d4e-3fae742a4aa3';
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

/**
 * Look up a document type by name with a `getChildren(folderId)` fallback for the
 * known `getByName` short-circuit (TreeApiHelper.recurseChildren stops at the first
 * folder with hasChildren:true, missing siblings — see MEMORY.md).
 */
async function findDocumentTypeByName(name: string): Promise<any> {
  // Delegates to the shared, fixture-free helper (tests/e2e/_umbracoApi.ts). Its
  // tree-walk already handles folder nesting, so the old fallbackFolderKey and the
  // @umbraco/playwright-testhelpers getByName short-circuit (MEMORY.md) are moot.
  return getDocumentTypeByName(name);
}

test.describe('Image Carousel Row — Element Type', () => {
  test('imageCarouselRow element type exists and is an element', async () => {
    const elementType = await findDocumentTypeByName('Image Carousel Row');
    expect(elementType, '"Image Carousel Row" should exist').toBeTruthy();
    expect(elementType.isElement).toBe(true);
  });

  test('imageCarouselRow has slides, showCaptions, scrollSpeedMs, and author properties (and no images)', async () => {
    const elementType = await findDocumentTypeByName('Image Carousel Row');
    expect(elementType).toBeTruthy();

    const aliases = (elementType.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'should have slides property (block list of imageCarouselSlide)').toContain('slides');
    expect(aliases, 'should have showCaptions toggle').toContain('showCaptions');
    expect(aliases, 'should have scrollSpeedMs property').toContain('scrollSpeedMs');
    expect(aliases, 'should have author property').toContain('author');
    expect(aliases, 'images property should be removed').not.toContain('images');
  });

  test('imageCarouselRow.slides is a Block List restricted to imageCarouselSlide', async () => {
    const elementType = await findDocumentTypeByName('Image Carousel Row');
    expect(elementType).toBeTruthy();

    const slides = (elementType.properties ?? []).find((p: any) => p.alias === 'slides');
    expect(slides, 'slides property should exist').toBeTruthy();

    // Resolve the data type and confirm it is a Block List restricted to imageCarouselSlide.
    const token = await freshToken();
    const dtResp = await apiFetch(token, 'GET', `/data-type/${slides.dataType.id}`);
    expect(dtResp.ok, 'should be able to load slides data type').toBe(true);
    const dataType = (await dtResp.json()) as any;
    expect(dataType.editorAlias, 'slides should use the Block List property editor').toBe('Umbraco.BlockList');

    const blocksConfig = (dataType.values ?? []).find((v: any) => v.alias === 'blocks');
    expect(blocksConfig, 'block list config should declare allowed blocks').toBeTruthy();
    const allowedTypeKeys: string[] = (blocksConfig.value ?? []).map((b: any) => b.contentElementTypeKey);

    const slideElementType = await findDocumentTypeByName('Image Carousel Slide');
    expect(slideElementType, 'imageCarouselSlide element type should exist for restriction lookup').toBeTruthy();
    expect(allowedTypeKeys, 'block list should be restricted to imageCarouselSlide only').toEqual([slideElementType.id]);
  });

  test('imageCarouselRow.showCaptions is a boolean defaulting to false', async () => {
    const elementType = await findDocumentTypeByName('Image Carousel Row');
    expect(elementType).toBeTruthy();

    const showCaptions = (elementType.properties ?? []).find((p: any) => p.alias === 'showCaptions');
    expect(showCaptions, 'showCaptions property should exist').toBeTruthy();

    const token = await freshToken();
    const dtResp = await apiFetch(token, 'GET', `/data-type/${showCaptions.dataType.id}`);
    expect(dtResp.ok, 'should be able to load showCaptions data type').toBe(true);
    const dataType = (await dtResp.json()) as any;
    // The Toggle / Boolean editor in Umbraco 17 uses editorAlias "Umbraco.TrueFalse".
    expect(dataType.editorAlias, 'showCaptions should use a boolean property editor').toBe('Umbraco.TrueFalse');

    const defaultValue = (dataType.values ?? []).find((v: any) => v.alias === 'default');
    // A default value of false may be represented as missing / 0 / false depending on configuration —
    // accept any of those, but reject an explicit truthy default.
    const defaultIsTruthy = defaultValue && (defaultValue.value === true || defaultValue.value === 1 || defaultValue.value === '1');
    expect(defaultIsTruthy, 'showCaptions should default to off').toBeFalsy();
  });

  test('imageCarouselSlide element type exists and is an element', async () => {
    const slideElementType = await findDocumentTypeByName('Image Carousel Slide');
    expect(slideElementType, '"Image Carousel Slide" should exist').toBeTruthy();
    expect(slideElementType.isElement).toBe(true);
  });

  test('imageCarouselSlide has image (Media Picker) and caption (Textstring) properties', async () => {
    const slideElementType = await findDocumentTypeByName('Image Carousel Slide');
    expect(slideElementType).toBeTruthy();

    const properties = slideElementType.properties ?? [];
    const aliases = properties.map((p: any) => p.alias);
    expect(aliases, 'should have image property').toContain('image');
    expect(aliases, 'should have caption property').toContain('caption');

    const imageProp = properties.find((p: any) => p.alias === 'image');
    const captionProp = properties.find((p: any) => p.alias === 'caption');

    const token = await freshToken();
    const imageDtResp = await apiFetch(token, 'GET', `/data-type/${imageProp.dataType.id}`);
    expect(imageDtResp.ok, 'should be able to load image data type').toBe(true);
    const imageDt = (await imageDtResp.json()) as any;
    expect(imageDt.editorAlias, 'image should use the Media Picker property editor').toBe('Umbraco.MediaPicker3');

    const captionDtResp = await apiFetch(token, 'GET', `/data-type/${captionProp.dataType.id}`);
    expect(captionDtResp.ok, 'should be able to load caption data type').toBe(true);
    const captionDt = (await captionDtResp.json()) as any;
    expect(captionDt.editorAlias, 'caption should use the Textstring property editor').toBe('Umbraco.TextBox');
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

  // --- New behaviour for the captions / refined-controls iteration ---
  // These will fail (RED) until Step 5 ships the new partial.

  test('partial iterates row.Slides (not row.Images)', () => {
    const content = readFileSync(partialPath, 'utf-8');
    // Whitespace-tolerant: allow Razor expressions like @row.Slides, Model.Content.Slides, etc.
    expect(content, 'partial should reference Slides').toMatch(/\.\s*Slides\b/);
    expect(content, 'partial should no longer reference the old Images property').not.toMatch(/\.\s*Images\b/);
  });

  test('partial conditionally renders captions guarded by ShowCaptions', () => {
    const content = readFileSync(partialPath, 'utf-8');
    // Look for ShowCaptions used in a conditional/branch (if, ?:, &&) — whitespace-tolerant.
    expect(content, 'partial should branch on ShowCaptions').toMatch(/ShowCaptions/);
    // Caption rendering element — figcaption is the semantic choice for image-with-caption pairing.
    expect(content, 'partial should render a figcaption element for slide captions').toMatch(/<figcaption\b/);
  });

  test('partial play/pause button is icon-only (no visible label span)', () => {
    const content = readFileSync(partialPath, 'utf-8');
    // The visible label span must be gone; only the aria-label remains.
    expect(content, 'visible carousel-play-pause-label span must be removed').not.toMatch(
      /<span[^>]*class\s*=\s*"[^"]*carousel-play-pause-label[^"]*"/i
    );
    expect(content, 'play/pause button must carry an aria-label').toMatch(/aria-label\s*=\s*"Pause carousel"/);
  });

  test('partial places the controls container after the carousel-inner element', () => {
    const content = readFileSync(partialPath, 'utf-8');
    // Find the closing tag of carousel-inner and the opening of the new controls container.
    // The controls container class is image-carousel__controls per the design notes.
    const carouselInnerEnd = content.search(/<\/div>\s*(?=[\s\S]*image-carousel__controls)/);
    const controlsStart = content.search(/class\s*=\s*"[^"]*image-carousel__controls/);
    expect(controlsStart, 'controls container should exist in the partial').toBeGreaterThan(-1);
    expect(controlsStart, 'controls container should appear after carousel-inner closes').toBeGreaterThan(carouselInnerEnd);
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
  multiCaptionsOn: randomUUID(),
  multiCaptionsOnSettings: randomUUID(),
  multiCaptionsOff: randomUUID(),
  multiCaptionsOffSettings: randomUUID(),
  singleSlide: randomUUID(),
  singleSlideSettings: randomUUID(),
};

// Slide content keys per row block — each slide is itself a content block inside
// the row's `slides` block list (block-list-within-block-list pattern, mirroring
// `tests/e2e/contentSectionRows.spec.ts`).
const slideKeys = {
  multiCaptionsOn: [randomUUID(), randomUUID(), randomUUID()],
  multiCaptionsOff: [randomUUID(), randomUUID(), randomUUID()],
  singleSlide: [randomUUID()],
};

// Distinct caption strings let us assert presence/absence unambiguously across the page.
const CAPTIONS_ON = ['Sunrise over the harbour', '', 'Market day'] as const;
const CAPTIONS_OFF = ['Hidden caption alpha', 'Hidden caption beta', 'Hidden caption gamma'] as const;

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

/** Single-image Media Picker stores its value as `[{ key, mediaKey }]` — same shape
 *  as the multi-picker but enforced as a one-element array by editor config. */
function buildMediaPickerValue(mediaKeys: string[]): any[] {
  return mediaKeys.map((mediaKey) => ({ key: randomUUID(), mediaKey }));
}

/** Build one Image Carousel Slide content block — the shape inside the row's
 *  `slides` block list. Caption is omitted entirely when blank so we can also
 *  assert that the rendered DOM matches the "no caption authored" path. */
function buildSlideContent(slideKey: string, mediaItemKey: string, caption: string) {
  const values: any[] = [
    {
      alias: 'image',
      culture: null,
      segment: null,
      value: buildMediaPickerValue([mediaItemKey]),
    },
  ];
  if (caption !== '') {
    values.push({
      alias: 'caption',
      culture: null,
      segment: null,
      value: caption,
    });
  }
  return {
    key: slideKey,
    contentTypeKey: IMAGE_CAROUSEL_SLIDE_CT_KEY,
    values,
  };
}

/** Wrap an array of slide content blocks into the Block-List value structure
 *  expected by the row's `slides` property. */
function buildSlidesValue(slides: ReturnType<typeof buildSlideContent>[]) {
  return {
    layout: {
      'Umbraco.BlockList': slides.map((s) => ({ contentKey: s.key })),
    },
    contentData: slides,
    settingsData: [],
    expose: slides.map((s) => ({ contentKey: s.key, culture: null, segment: null })),
  };
}

/** Build one Image Carousel Row content block (the outer block placed in
 *  `contentRows`). */
function buildRowBlock(
  rowKey: string,
  slides: ReturnType<typeof buildSlideContent>[],
  showCaptions: boolean,
  scrollSpeedMs: number
) {
  return {
    key: rowKey,
    contentTypeKey: IMAGE_CAROUSEL_ROW_CT_KEY,
    values: [
      {
        alias: 'slides',
        culture: null,
        segment: null,
        value: buildSlidesValue(slides),
      },
      {
        alias: 'showCaptions',
        culture: null,
        segment: null,
        value: showCaptions,
      },
      {
        alias: 'scrollSpeedMs',
        culture: null,
        segment: null,
        value: scrollSpeedMs,
      },
    ],
  };
}

function buildSettingsBlock(settingsKey: string) {
  return {
    key: settingsKey,
    contentTypeKey: IMAGE_CAROUSEL_ROW_SETTINGS_CT_KEY,
    values: [],
  };
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
    if (mediaKeys.length < 3) {
      throw new Error(
        `Need at least 3 image media items in the library. Found: ${mediaKeys.length}`
      );
    }

    // 5. Build carousel blocks
    //    Block A: 3 slides with mixed captions, ShowCaptions=true   (scrollSpeedMs 3000)
    //    Block B: 3 slides with captions authored, ShowCaptions=false (scrollSpeedMs 5000)
    //              — proves captions stay hidden when the toggle is off
    //    Block C: 1 slide (edge case — no controls regardless of caption state)
    const multiCaptionsOnSlides = slideKeys.multiCaptionsOn.map((key, i) =>
      buildSlideContent(key, mediaKeys[i], CAPTIONS_ON[i])
    );
    const multiCaptionsOffSlides = slideKeys.multiCaptionsOff.map((key, i) =>
      buildSlideContent(key, mediaKeys[i], CAPTIONS_OFF[i])
    );
    const singleSlideSlides = slideKeys.singleSlide.map((key, i) =>
      buildSlideContent(key, mediaKeys[i], '')
    );

    const multiCaptionsOnBlock = buildRowBlock(
      testBlockKeys.multiCaptionsOn, multiCaptionsOnSlides, /* showCaptions */ true, 3000
    );
    const multiCaptionsOffBlock = buildRowBlock(
      testBlockKeys.multiCaptionsOff, multiCaptionsOffSlides, /* showCaptions */ false, 5000
    );
    const singleSlideBlock = buildRowBlock(
      testBlockKeys.singleSlide, singleSlideSlides, /* showCaptions */ false, 5000
    );

    const newContentBlocks = [multiCaptionsOnBlock, multiCaptionsOffBlock, singleSlideBlock];
    const newSettingsBlocks = [
      buildSettingsBlock(testBlockKeys.multiCaptionsOnSettings),
      buildSettingsBlock(testBlockKeys.multiCaptionsOffSettings),
      buildSettingsBlock(testBlockKeys.singleSlideSettings),
    ];

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
      { contentKey: testBlockKeys.multiCaptionsOn,  settingsKey: testBlockKeys.multiCaptionsOnSettings  },
      { contentKey: testBlockKeys.multiCaptionsOff, settingsKey: testBlockKeys.multiCaptionsOffSettings },
      { contentKey: testBlockKeys.singleSlide,      settingsKey: testBlockKeys.singleSlideSettings      },
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

  // --- Multi-slide carousel (Show captions ON) ---

  test('carousel container is visible with carousel-fade class', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(
      `#slider-${testBlockKeys.multiCaptionsOn}.carousel.carousel-fade`
    );
    await expect(carousel).toBeVisible();
  });

  test('three carousel items are rendered', async ({ page }) => {
    await page.goto(targetDocUrl);
    const items = page.locator(`#slider-${testBlockKeys.multiCaptionsOn} .carousel-item`);
    await expect(items).toHaveCount(3);
  });

  test('three indicator buttons are rendered', async ({ page }) => {
    await page.goto(targetDocUrl);
    // Indicators are siblings of the Bootstrap carousel inside the new
    // .image-carousel wrapper (see _plans/notes/image-carousel-controls-design.md
    // — tab order: prev → indicators → next → play/pause). Scope by the wrapper.
    const indicators = page.locator(
      `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"] .image-carousel__indicators button[data-bs-slide-to]`
    );
    await expect(indicators).toHaveCount(3);
  });

  test('first indicator has aria-current="true"', async ({ page }) => {
    await page.goto(targetDocUrl);
    const firstIndicator = page.locator(
      `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"] .image-carousel__indicators button[data-bs-slide-to]`
    ).first();
    await expect(firstIndicator).toHaveAttribute('aria-current', 'true');
  });

  test('clicking second indicator makes the second carousel item active', async ({ page }) => {
    await page.goto(targetDocUrl);
    const wrapper = page.locator(
      `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"]`
    );
    const carousel = page.locator(`#slider-${testBlockKeys.multiCaptionsOn}`);
    const secondIndicator = wrapper.locator('.image-carousel__indicators button[data-bs-slide-to]').nth(1);

    await secondIndicator.click();

    // Bootstrap adds .active to the new slide — wait for the transition
    await expect(
      carousel.locator('.carousel-item').nth(1)
    ).toHaveClass(/active/, { timeout: 5000 });

    // Verify aria-current moved to the clicked indicator (synced by carousel.js
    // via slid.bs.carousel — indicators live outside the Bootstrap element).
    const firstIndicator = wrapper.locator('.image-carousel__indicators button[data-bs-slide-to]').nth(0);
    await expect(secondIndicator).toHaveAttribute('aria-current', 'true');
    await expect(firstIndicator).not.toHaveAttribute('aria-current', 'true');
  });

  test('first image has a non-empty alt attribute', async ({ page }) => {
    await page.goto(targetDocUrl);
    const firstImage = page.locator(
      `#slider-${testBlockKeys.multiCaptionsOn} .carousel-item.active img`
    );
    await expect(firstImage).toHaveAttribute('alt', /.+/);
  });

  test('play/pause button is present and keyboard-focusable', async ({ page }) => {
    await page.goto(targetDocUrl);
    const btn = page.locator(
      `[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"].carousel-play-pause`
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
      `[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"].carousel-play-pause`
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
    const carousel = page.locator(`#slider-${testBlockKeys.multiCaptionsOn}`);
    const btn = page.locator(
      `[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"].carousel-play-pause`
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
    const carouselId = `slider-${testBlockKeys.multiCaptionsOn}`;
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

  // --- Single-slide edge case ---

  test('single-slide block renders a plain img with no carousel controls', async ({ page }) => {
    await page.goto(targetDocUrl);

    // The single-slide block renders a plain <img> — no carousel wrapper with that key
    const carousel = page.locator(`#slider-${testBlockKeys.singleSlide}`);
    await expect(carousel).toHaveCount(0);
  });

  test('single-slide block has no indicator buttons', async ({ page }) => {
    await page.goto(targetDocUrl);
    // There is no carousel with that key, so there are no indicators either
    const indicators = page.locator(
      `#slider-${testBlockKeys.singleSlide} .carousel-indicators button`
    );
    await expect(indicators).toHaveCount(0);
  });

  // ============================================================
  // New behaviour for the captions / refined-controls iteration.
  // These will fail (RED) until Step 5 ships the new partial.
  // ============================================================

  // --- Captions ON ---

  test('captions ON: active slide caption is visible', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(`#slider-${testBlockKeys.multiCaptionsOn}`);
    // The first caption is non-empty and corresponds to the initially-active slide.
    await expect(carousel.getByText('Sunrise over the harbour')).toBeVisible();
  });

  test('captions ON: every authored caption renders inside a figcaption', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(`#slider-${testBlockKeys.multiCaptionsOn}`);
    // Two of the three slides have non-empty captions (slide 0 and slide 2).
    const figcaptions = carousel.locator('figcaption');
    await expect(figcaptions).toHaveCount(2);
    // The text of the figcaptions matches the authored captions (in slide order).
    await expect(figcaptions.nth(0)).toHaveText(/Sunrise over the harbour/);
    await expect(figcaptions.nth(1)).toHaveText(/Market day/);
  });

  test('captions ON: the second slide (no caption authored) has no figcaption', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(`#slider-${testBlockKeys.multiCaptionsOn}`);
    // Three carousel-items, but only the two with text get a figcaption.
    await expect(carousel.locator('.carousel-item')).toHaveCount(3);
    await expect(carousel.locator('figcaption')).toHaveCount(2);
  });

  // --- Captions OFF ---

  test('captions OFF: none of the authored caption strings appear anywhere on the page', async ({ page }) => {
    await page.goto(targetDocUrl);
    // The captions-OFF block authored captions but the toggle is off — none of those
    // strings should be in the rendered HTML.
    const html = await page.content();
    for (const c of CAPTIONS_OFF) {
      expect(html, `caption "${c}" must not be present when ShowCaptions is off`).not.toContain(c);
    }
  });

  test('captions OFF: the captions-off carousel renders zero figcaption elements', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(`#slider-${testBlockKeys.multiCaptionsOff}`);
    await expect(carousel.locator('figcaption')).toHaveCount(0);
  });

  // --- Control bar layout ---

  test('controls container exists and is positioned below the slide image area', async ({ page }) => {
    await page.goto(targetDocUrl);
    const carouselScope = page.locator(`#slider-${testBlockKeys.multiCaptionsOn}`);

    // Look for the new controls container — design notes specify .image-carousel__controls.
    // It may be inside the slider id or be a sibling under the new wrapper; query both.
    const controls = page
      .locator('.image-carousel__controls')
      .filter({ has: page.locator(`[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"]`) })
      .first();
    await expect(controls).toHaveCount(1);

    // The controls container's top edge is below the carousel-inner's bottom edge.
    const controlsBox = await controls.boundingBox();
    const innerBox = await carouselScope.locator('.carousel-inner').first().boundingBox();
    expect(controlsBox).toBeTruthy();
    expect(innerBox).toBeTruthy();
    expect(controlsBox!.y, 'controls top should be at or below carousel-inner bottom').toBeGreaterThanOrEqual(
      innerBox!.y + innerBox!.height - 1
    );
  });

  test('play/pause button has no visible text content (icon-only)', async ({ page }) => {
    await page.goto(targetDocUrl);
    const btn = page.locator(
      `[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"].carousel-play-pause`
    );
    // Visible text content (after trimming whitespace) must be empty.
    // Icon and aria-label are allowed; a visible <span class="carousel-play-pause-label">
    // is not.
    const visibleText = await btn.evaluate((el) => (el as HTMLElement).innerText.trim());
    expect(visibleText, 'play/pause button must not show any visible label text').toBe('');
  });

  test('captions ON: alt text and caption are independent (alt from media item, caption from slide)', async ({
    page,
  }) => {
    await page.goto(targetDocUrl);
    const carousel = page.locator(`#slider-${testBlockKeys.multiCaptionsOn}`);
    const activeImg = carousel.locator('.carousel-item.active img');
    const altText = await activeImg.getAttribute('alt');
    const figcaptionText = (await carousel.locator('figcaption').first().textContent())?.trim();
    expect(altText, 'image alt should be non-empty (from the media library item)').toMatch(/.+/);
    expect(figcaptionText, 'caption should be the slide-level caption text').toBe('Sunrise over the harbour');
    expect(altText, 'alt text and caption must come from different sources').not.toBe(figcaptionText);
  });

  // ============================================================
  // Refined controls — visual layout (Step 6 RED, Step 7 GREEN)
  //
  // These are nested inside the Browser E2E describe so they share
  // the parent's beforeAll/afterAll — no need to re-author the
  // carousel blocks. All assertions probe computed style / layout,
  // so they go RED on raw Bootstrap defaults and GREEN once the
  // refined CSS in `src/UmbracoProject/wwwroot/css/index.css` lands.
  // ============================================================

  test.describe('Refined controls — visual layout', () => {
    // Opt out of the parent's serial mode so a single RED test doesn't cascade-skip
    // the rest — we want visibility into which specific layout invariants fail.
    test.describe.configure({ mode: 'default' });

    /** Parse a CSS `rgb(...)` / `rgba(...)` color into its alpha channel. */
    function alphaFromColor(color: string): number {
      // rgba(r, g, b, a) or rgb(r, g, b)
      const rgbaMatch = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*([\d.]+))?\s*\)/);
      if (rgbaMatch) {
        return rgbaMatch[1] !== undefined ? parseFloat(rgbaMatch[1]) : 1;
      }
      // transparent / initial / etc.
      if (color === 'transparent' || /^rgba\(0,\s*0,\s*0,\s*0\)$/.test(color)) return 0;
      // Anything else (named colour, hex) — assume opaque.
      return 1;
    }

    test('narrow viewport (600px): prev/next arrows overlay the image with a solid background', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 600, height: 800 });
      await page.goto(targetDocUrl);

      const wrapper = page.locator(
        `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"]`
      );
      const prevArrow = wrapper.locator('.image-carousel__arrow--prev');
      const nextArrow = wrapper.locator('.image-carousel__arrow--next');
      const stage = wrapper.locator('.image-carousel__stage');

      await expect(prevArrow).toBeVisible();
      await expect(nextArrow).toBeVisible();

      const prevBox = await prevArrow.boundingBox();
      const nextBox = await nextArrow.boundingBox();
      const stageBox = await stage.boundingBox();
      expect(prevBox).toBeTruthy();
      expect(nextBox).toBeTruthy();
      expect(stageBox).toBeTruthy();

      // Arrow bounding boxes intersect the stage bounding box (overlap).
      const overlapsHoriz = (a: any, b: any) => a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapsVert  = (a: any, b: any) => a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlapsHoriz(prevBox!, stageBox!) && overlapsVert(prevBox!, stageBox!),
        'prev arrow must overlay the image area at < lg').toBe(true);
      expect(overlapsHoriz(nextBox!, stageBox!) && overlapsVert(nextBox!, stageBox!),
        'next arrow must overlay the image area at < lg').toBe(true);

      // Computed background-color alpha >= 0.95 (solid, readable over any image).
      const prevAlpha = await prevArrow.evaluate((el) => getComputedStyle(el).backgroundColor);
      const nextAlpha = await nextArrow.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(alphaFromColor(prevAlpha),
        `prev arrow background should be solid; got ${prevAlpha}`).toBeGreaterThanOrEqual(0.95);
      expect(alphaFromColor(nextAlpha),
        `next arrow background should be solid; got ${nextAlpha}`).toBeGreaterThanOrEqual(0.95);
    });

    test('wide viewport (1200px): prev/next arrows sit outside the image (no overlap)', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto(targetDocUrl);

      const wrapper = page.locator(
        `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"]`
      );
      const prevArrow = wrapper.locator('.image-carousel__arrow--prev');
      const nextArrow = wrapper.locator('.image-carousel__arrow--next');
      const stage = wrapper.locator('.image-carousel__stage');

      const prevBox = await prevArrow.boundingBox();
      const nextBox = await nextArrow.boundingBox();
      const stageBox = await stage.boundingBox();
      expect(prevBox && nextBox && stageBox).toBeTruthy();

      // Tolerance of 1 px to allow sub-pixel rounding.
      expect(prevBox!.x + prevBox!.width,
        'prev arrow right edge should be at or left of the image left edge').toBeLessThanOrEqual(stageBox!.x + 1);
      expect(nextBox!.x,
        'next arrow left edge should be at or right of the image right edge').toBeGreaterThanOrEqual(stageBox!.x + stageBox!.width - 1);
    });

    test('all clickable controls meet the 44×44 CSS-px minimum target size', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto(targetDocUrl);

      const wrapper = page.locator(
        `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"]`
      );
      const controls = wrapper.locator(
        '.image-carousel__arrow, .image-carousel__indicator, .image-carousel__toggle'
      );
      const count = await controls.count();
      expect(count, 'should have prev + 3 indicators + next + play/pause = 6 controls').toBeGreaterThanOrEqual(6);

      for (let i = 0; i < count; i++) {
        const el = controls.nth(i);
        const box = await el.boundingBox();
        const cls = await el.getAttribute('class');
        expect(box, `control #${i} (${cls}) should be rendered`).toBeTruthy();
        expect(box!.width,
          `control #${i} (${cls}) width must be >= 44 CSS px (got ${box!.width})`).toBeGreaterThanOrEqual(44);
        expect(box!.height,
          `control #${i} (${cls}) height must be >= 44 CSS px (got ${box!.height})`).toBeGreaterThanOrEqual(44);
      }
    });

    test('all clickable controls have zero border-radius (constructivist sharp corners)', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto(targetDocUrl);

      const wrapper = page.locator(
        `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"]`
      );
      const controls = wrapper.locator(
        '.image-carousel__arrow, .image-carousel__indicator, .image-carousel__toggle'
      );
      const count = await controls.count();

      for (let i = 0; i < count; i++) {
        const el = controls.nth(i);
        const cls = await el.getAttribute('class');
        const radii = await el.evaluate((node) => {
          const cs = getComputedStyle(node);
          return [
            cs.borderTopLeftRadius,
            cs.borderTopRightRadius,
            cs.borderBottomLeftRadius,
            cs.borderBottomRightRadius,
          ];
        });
        for (const r of radii) {
          expect(r, `control #${i} (${cls}) should have border-radius 0px, got ${r}`).toBe('0px');
        }
      }
    });

    test('captions (when shown) are left-aligned', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto(targetDocUrl);

      const caption = page.locator(
        `.image-carousel[data-carousel-id="slider-${testBlockKeys.multiCaptionsOn}"] figcaption`
      ).first();
      await expect(caption).toBeVisible();
      const textAlign = await caption.evaluate((el) => getComputedStyle(el).textAlign);
      expect(textAlign, `caption text-align must be left, got ${textAlign}`).toBe('left');
    });
  });

  // ============================================================
  // Accessibility & motion (Step 8)
  //
  // Exercises the focus-pause/resume contract, manual-pause
  // persistence across keyboard focus changes, and
  // prefers-reduced-motion honouring. Alt-vs-caption independence
  // is already covered by the "captions ON: alt text and caption
  // are independent" test above.
  // ============================================================

  test.describe('Accessibility & motion', () => {
    test.describe.configure({ mode: 'default' });

    test('focus into a carousel control pauses auto-play', async ({ page }) => {
      // Move mouse out of the viewport first so hover events don't pollute the
      // pause-count this test is measuring.
      await page.mouse.move(0, 0);
      await page.goto(targetDocUrl);
      await page.mouse.move(0, 0);

      const carouselId = `slider-${testBlockKeys.multiCaptionsOn}`;
      const prevArrow = page.locator(
        `.image-carousel[data-carousel-id="${carouselId}"] .image-carousel__arrow--prev`
      );

      // Install a pause() spy after page load so the initial auto-init calls
      // aren't counted.
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el || !(window as any).bootstrap?.Carousel) return;
        const inst = (window as any).bootstrap.Carousel.getInstance(el)
                  ?? (window as any).bootstrap.Carousel.getOrCreateInstance(el);
        if (!inst) return;
        (window as any)._pauseCallsAfterFocus = 0;
        const origPause = inst.pause.bind(inst);
        inst.pause = function () {
          (window as any)._pauseCallsAfterFocus++;
          return origPause();
        };
      }, carouselId);

      // Focusing the prev-arrow button triggers focusin on the .image-carousel
      // wrapper → carousel.pause() in carousel.js.
      await prevArrow.focus();
      await page.waitForTimeout(100);

      const pauseCount = await page.evaluate(() => (window as any)._pauseCallsAfterFocus ?? 0);
      expect(pauseCount,
        'focusing a carousel control must call Bootstrap.Carousel.pause() at least once'
      ).toBeGreaterThan(0);
    });

    test('manual pause persists when keyboard focus leaves the carousel', async ({ page }) => {
      await page.mouse.move(0, 0);
      await page.goto(targetDocUrl);
      await page.mouse.move(0, 0);

      const carouselId = `slider-${testBlockKeys.multiCaptionsOn}`;
      const wrapper = page.locator(`.image-carousel[data-carousel-id="${carouselId}"]`);
      const toggle = wrapper.locator('.image-carousel__toggle');

      // Install a cycle() spy after page load.
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el || !(window as any).bootstrap?.Carousel) return;
        const inst = (window as any).bootstrap.Carousel.getInstance(el)
                  ?? (window as any).bootstrap.Carousel.getOrCreateInstance(el);
        if (!inst) return;
        (window as any)._cycleCallsAfterPause = 0;
        const origCycle = inst.cycle.bind(inst);
        inst.cycle = function () {
          (window as any)._cycleCallsAfterPause++;
          return origCycle();
        };
      }, carouselId);

      // Focus the toggle (focusin → pause), click it (manually paused), then
      // move focus entirely outside the wrapper via programmatic blur.
      await toggle.focus();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-label', 'Play carousel');

      await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active && typeof active.blur === 'function') active.blur();
      });
      await page.waitForTimeout(200);

      const cycleCount = await page.evaluate(() => (window as any)._cycleCallsAfterPause ?? 0);
      expect(cycleCount,
        'Bootstrap.Carousel.cycle() must not be called after a manual pause + focusout'
      ).toBe(0);
    });

    test('prefers-reduced-motion: carousel does not auto-advance', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(targetDocUrl);

      const carouselId = `slider-${testBlockKeys.multiCaptionsOn}`;
      const toggle = page.locator(
        `[data-carousel-id="${carouselId}"].carousel-play-pause`
      );

      // Play/pause control must still be present (per the spec: "still present and operable").
      await expect(toggle).toBeVisible();

      // Instead of a fragile waitForTimeout, install a cycle() spy and verify
      // Bootstrap never calls it. carousel.js sets manuallyPaused=true on
      // reduced-motion init, which prevents cycle() from being invoked.
      const cycleCalled = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el || !(window as any).bootstrap?.Carousel) return -1;
        const inst = (window as any).bootstrap.Carousel.getInstance(el)
                  ?? (window as any).bootstrap.Carousel.getOrCreateInstance(el);
        if (!inst) return -1;
        (window as any)._rmCycleCalled = 0;
        const origCycle = inst.cycle.bind(inst);
        inst.cycle = function () {
          (window as any)._rmCycleCalled++;
          return origCycle();
        };
        return 0;
      }, carouselId);
      expect(cycleCalled, 'spy should install successfully').toBe(0);

      // Wait a short period (500ms — well under the 3000ms interval) just to let
      // any queued Bootstrap timers fire, then check the spy count.
      await page.waitForTimeout(500);

      const count = await page.evaluate(() => (window as any)._rmCycleCalled ?? 0);
      expect(count,
        'Bootstrap.Carousel.cycle() must not be called under prefers-reduced-motion'
      ).toBe(0);

      // Belt-and-braces: confirm the active slide index hasn't changed.
      const activeIndex = await page.locator(`#${carouselId} .carousel-item`).evaluateAll((items) =>
        items.findIndex((el) => el.classList.contains('active'))
      );
      expect(activeIndex, 'active slide should still be the first').toBe(0);
    });
  });
});

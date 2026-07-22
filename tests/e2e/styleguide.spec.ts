import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { randomUUID } from 'crypto';
import {
  apiFetch,
  collectContentNodesByDocType,
  freshToken,
  getDataTypeByName,
  getDocumentTypeByName,
  tryGetDocumentPath as getDocumentPath,
} from './_umbracoApi';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Consolidated-guides retarget (Step 5 of _plans/consolidated-guides.md).
//
// The Styleguide moved off the legacy root-level `styleGuidePage` doc type onto
// the consolidated `guidePage` doc type at /guides/styleguide. This spec:
//   - asserts the `guidePage` SCHEMA (GREEN now — shipped in Step 1): SEO Controls
//     + Guide Visibility Controls compositions, a Block Grid `body`, and NO
//     section-navigation surface.
//   - asserts the canonical /guides/styleguide CONTENT/RENDER (RED until Step 6
//     authors the page — beforeAll fails with a clear "not found" content-absence
//     reason, NOT a harness error).
//   - self-contained TOC fixtures that create + publish their own throwaway
//     `guidePage` nodes (GREEN now — independent of Step 6): TOC derivation,
//     the ">1 section" rule, and duplicate-title anchor uniqueness (review
//     carry-over (f)).
// ---------------------------------------------------------------------------

// ==============================
// Shared lookups (collectContentNodesByDocType + getDocumentPath are the
// nullable-path helpers imported from ./_umbracoApi)
// ==============================

/**
 * Resolve the canonical Styleguide guidePage URL. Enumerates every `guidePage`
 * node and returns the one whose published URL ends with the decided
 * `/guides/styleguide` path (Rule #1/#2: dynamic id + slug lookup — the URL is a
 * product decision, the node id is not hardcoded). Returns null when the node
 * does not yet exist (Step 6), producing a clean content-absence RED.
 */
async function getStyleguideUrl(): Promise<string | null> {
  const guidePageId = (await getDocumentTypeByName('Guide Page'))?.id;
  if (!guidePageId) return null;
  const nodes = await collectContentNodesByDocType(guidePageId);
  for (const node of nodes) {
    const url = await getDocumentPath(node.id);
    if (url && /\/guides\/styleguide\/?$/.test(url)) return url;
  }
  return null;
}

// ==============================
// Section 1 — Schema (GREEN now — Step 1)
// ==============================

test.describe('Guide Page — Document Type', () => {
  test('guidePage composes SEO Controls + Guide Visibility Controls and nothing section-nav', async () => {
    const docType = await getDocumentTypeByName('Guide Page');
    expect(docType, '"Guide Page" doc type should exist').toBeTruthy();
    expect(docType.alias).toBe('guidePage');
    // Consolidated guides are children of Guides — never a site root.
    expect(docType.allowedAsRoot ?? false).toBe(false);

    // Resolve composition ids by name (resilient to per-environment GUIDs).
    const seoId = (await getDocumentTypeByName('SEO Controls'))?.id;
    const guideVisId = (await getDocumentTypeByName('Guide Visibility Controls'))?.id;
    const sectionNavId = (await getDocumentTypeByName('Section Navigation Controls'))?.id;
    const legacyVisId = (await getDocumentTypeByName('Visibility Controls'))?.id;
    expect(seoId, '"SEO Controls" composition should exist').toBeTruthy();
    expect(guideVisId, '"Guide Visibility Controls" composition should exist').toBeTruthy();

    const compositionIds: string[] = (docType.compositions ?? []).map(
      (c: any) => c.documentType?.id
    );
    expect(compositionIds, 'must compose SEO Controls').toContain(seoId);
    expect(compositionIds, 'must compose Guide Visibility Controls').toContain(guideVisId);

    // Must NOT compose the section-nav-bearing compositions.
    if (sectionNavId) {
      expect(compositionIds, 'must NOT compose Section Navigation Controls').not.toContain(
        sectionNavId
      );
    }
    if (legacyVisId) {
      expect(
        compositionIds,
        'must NOT compose legacy Visibility Controls (carries showSectionNavigation)'
      ).not.toContain(legacyVisId);
    }

    // Belt-and-suspenders: no section-nav property anywhere (own + each composition).
    const allAliases = new Set<string>(
      (docType.properties ?? []).map((p: any) => p.alias)
    );
    for (const compId of compositionIds) {
      const resp = await apiFetch('GET', `/document-type/${compId}`);
      if (!resp.ok) continue;
      const comp = (await resp.json()) as any;
      for (const p of comp.properties ?? []) allAliases.add(p.alias);
    }
    expect(allAliases.has('showSectionNavigation'), 'no showSectionNavigation property').toBe(false);
    expect(allAliases.has('hideFromSectionNavigation'), 'no hideFromSectionNavigation property').toBe(false);
  });

  test('guidePage body is a Block Grid property', async () => {
    const docType = await getDocumentTypeByName('Guide Page');
    const body = (docType.properties ?? []).find((p: any) => p.alias === 'body');
    expect(body, 'guidePage must have a "body" property').toBeTruthy();

    const dataTypeResp = await apiFetch('GET', `/data-type/${body.dataType.id}`);
    expect(dataTypeResp.ok, 'body data type GET succeeds').toBeTruthy();
    const dataType = (await dataTypeResp.json()) as any;
    expect(dataType.editorAlias, 'body must be a Block Grid').toBe('Umbraco.BlockGrid');
  });

  test('[BlockGrid] Guide Body root offers only guideSection', async () => {
    const dt = await getDataTypeByName('[BlockGrid] Guide Body');
    expect(dt, '"[BlockGrid] Guide Body" data type should exist').toBeTruthy();
    const blocksValue = (dt.values ?? []).find((v: any) => v.alias === 'blocks');
    const blocks: any[] = blocksValue?.value ?? [];
    const rootBlocks = blocks.filter((b: any) => b.allowAtRoot === true);
    expect(rootBlocks.length, 'exactly one root block (guideSection)').toBe(1);

    const guideSection = await getDocumentTypeByName('Guide Section');
    expect(guideSection, '"Guide Section" element type should exist').toBeTruthy();
    expect(guideSection.isElement, '"Guide Section" must be an element type').toBe(true);
    // The single root block's element-type key is the Guide Section element type.
    expect(rootBlocks[0].contentElementTypeKey).toBe(guideSection.id);

    const aliases = (guideSection.properties ?? []).map((p: any) => p.alias);
    expect(aliases, 'guideSection must include sectionTitle').toContain('sectionTitle');
    const sectionTitle = (guideSection.properties ?? []).find(
      (p: any) => p.alias === 'sectionTitle'
    );
    expect(sectionTitle?.validation?.mandatory ?? false, 'sectionTitle is mandatory').toBe(true);
  });

  test('Three programmatic block element types exist with heading + intro', async () => {
    for (const name of [
      'Color Palette Block',
      'Typography Showcase Block',
      'General Elements Block',
    ]) {
      const dt = await getDocumentTypeByName(name);
      expect(dt, `"${name}" element type should exist`).toBeTruthy();
      expect(dt.isElement, `"${name}" must be an element type`).toBe(true);
      const aliases = (dt.properties ?? []).map((p: any) => p.alias);
      expect(aliases, `"${name}" must include heading`).toContain('heading');
      expect(aliases, `"${name}" must include intro`).toContain('intro');
    }
  });
});

// ==============================
// Section 2 — Canonical page presence + brand fundamentals
// (RED until Step 6 authors /guides/styleguide)
// ==============================

test.describe('Style Guide — canonical page (RED until Step 6)', () => {
  let styleguideUrl: string;

  test.beforeAll(async () => {
    const url = await getStyleguideUrl();
    expect(
      url,
      'A guidePage published at /guides/styleguide must exist (authored in Step 6)'
    ).toBeTruthy();
    styleguideUrl = url!;
  });

  test('Styleguide page is reachable and hidden from top navigation', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.site-nav').getByRole('link', { name: /style ?guide/i })
    ).toHaveCount(0);

    const res = await page.goto(styleguideUrl);
    expect(res?.status()).toBe(200);
  });

  test('Color palette renders one swatch per annotation with token / value / role', async ({
    page,
  }) => {
    await page.goto(styleguideUrl);

    const swatches = page.locator('[data-styleguide="swatch"]');
    await expect(swatches).not.toHaveCount(0);

    const accent = page.locator('[data-styleguide-token="--accent-primary"]');
    await expect(accent).toBeVisible();
    await expect(accent.locator('[data-styleguide="value"]')).toHaveText(/#C23D2E/i);
    await expect(accent.locator('[data-styleguide="role"]')).toHaveText('Primary action / signal red');

    // Spacing tokens must NOT be surfaced as colour swatches.
    await expect(page.locator('[data-styleguide-token="--space-md"]')).toHaveCount(0);
  });

  test('Each programmatic block renders its editable heading', async ({ page }) => {
    await page.goto(styleguideUrl);
    for (const alias of [
      'colorPaletteBlock',
      'typographyShowcaseBlock',
      'generalElementsBlock',
    ]) {
      const block = page.locator(`[data-block-alias="${alias}"]`);
      await expect(block, `${alias} must render`).toBeVisible();
      const heading = block.locator('h1, h2, h3, h4, h5, h6').first();
      await expect(heading).toBeVisible();
      await expect(heading).not.toHaveText('');
    }
  });

  test('Typography block shows h1–h6 plus the five editor classes', async ({ page }) => {
    await page.goto(styleguideUrl);
    const block = page.locator('[data-block-alias="typographyShowcaseBlock"]');
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      await expect(block.locator(tag).first()).toBeVisible();
    }
    for (const cls of ['lead', 'overline', 'blockquote', 'caption', 'pull-quote', 'pull-quote-accent']) {
      await expect(block.locator(`.${cls}`).first()).toBeVisible();
    }
  });

  test('General elements block includes link, button, lists, table, inputs', async ({
    page,
  }) => {
    await page.goto(styleguideUrl);
    const block = page.locator('[data-block-alias="generalElementsBlock"]');
    for (const sel of [
      'a',
      'button',
      'ul',
      'ol',
      'table',
      'input[type="text"]',
      'input[type="email"]',
      'textarea',
    ]) {
      await expect(block.locator(sel).first()).toBeVisible();
    }
  });

  test('Left-column TOC has one anchor per section, each resolving to an on-page id', async ({
    page,
  }) => {
    await page.goto(styleguideUrl);
    const anchors = page.locator('.styleguide__nav a');
    const count = await anchors.count();
    expect(count, 'TOC should list at least one section').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await anchors.nth(i).getAttribute('href');
      expect(href, `TOC anchor ${i} must have an in-page href`).toMatch(/^#.+/);
      const id = href!.slice(1);
      // Exactly one on-page element carries the target id.
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  });
});

// ==============================
// Section 3 — Self-contained TOC fixtures (GREEN now — independent of Step 6)
// ==============================

const FIXTURE_PREFIX = 'E2E-Guide-Fixture';

let GUIDE_PAGE_DT!: string;
let GUIDE_PAGE_TEMPLATE!: string;
let GUIDE_SECTION_ET!: string;
let GUIDES_PARENT_ID!: string;

function makeGridLayoutItem(contentKey: string) {
  return {
    $type: 'BlockGridLayoutItem',
    contentUdi: null,
    settingsUdi: null,
    contentKey,
    settingsKey: null,
    columnSpan: 12,
    rowSpan: 1,
    areas: [],
  };
}

/** Build a Block Grid `body` value made of title-only guideSection blocks. */
function buildGuideBody(titles: string[]) {
  const contentData = titles.map((title) => ({
    contentTypeKey: GUIDE_SECTION_ET,
    key: randomUUID(),
    values: [{ alias: 'sectionTitle', culture: null, segment: null, value: title }],
  }));
  return {
    layout: { 'Umbraco.BlockGrid': contentData.map((c) => makeGridLayoutItem(c.key)) },
    contentData,
    settingsData: [],
    expose: contentData.map((c) => ({ contentKey: c.key, culture: null, segment: null })),
  };
}

async function createGuidePageFixture(name: string, titles: string[]): Promise<string> {
  const id = randomUUID();
  const createResp = await apiFetch('POST', '/document', {
    id,
    parent: { id: GUIDES_PARENT_ID },
    documentType: { id: GUIDE_PAGE_DT },
    template: { id: GUIDE_PAGE_TEMPLATE },
    values: [
      {
        editorAlias: 'Umbraco.BlockGrid',
        culture: null,
        segment: null,
        alias: 'body',
        value: buildGuideBody(titles),
      },
      {
        // Keep throwaway fixtures out of /sitemap.xml for the run's duration.
        editorAlias: 'Umbraco.TrueFalse',
        culture: null,
        segment: null,
        alias: 'hideFromXMLSitemap',
        value: true,
      },
    ],
    variants: [{ culture: null, segment: null, name }],
  });
  if (!createResp.ok) {
    throw new Error(`POST fixture "${name}" failed: ${createResp.status} - ${await createResp.text()}`);
  }
  const pubResp = await apiFetch('PUT', `/document/${id}/publish`, {
    publishSchedules: [{ culture: null }],
  });
  if (!pubResp.ok) {
    throw new Error(`Publish fixture "${name}" failed: ${pubResp.status} - ${await pubResp.text()}`);
  }
  const url = await getDocumentPath(id);
  if (!url) throw new Error(`No URL resolved for fixture "${name}"`);
  return url;
}

/** Delete any leftover fixture guidePages under Guides before creating fresh ones (Rule #3). */
async function cleanStaleFixtures() {
  const resp = await apiFetch(
    'GET',
    `/tree/document/children?parentId=${GUIDES_PARENT_ID}&skip=0&take=100`
  );
  if (!resp.ok) return;
  const data = (await resp.json()) as any;
  for (const item of data.items ?? []) {
    const name = item.variants?.[0]?.name ?? '';
    if (name.startsWith(FIXTURE_PREFIX)) {
      const del = await apiFetch('DELETE', `/document/${item.id}`);
      if (!del.ok) {
        // Surface a stuck delete instead of silently re-attempting it every run.
        console.warn(`cleanStaleFixtures: DELETE ${item.id} ("${name}") failed: ${del.status}`);
      }
    }
  }
}

test.describe('Guide Page — TOC (self-contained fixtures)', () => {
  test.describe.configure({ mode: 'serial' });

  let multiUrl: string;
  let singleUrl: string;
  let dupUrl: string;

  test.beforeAll(async () => {
    // Fail fast with a clear auth error before the tree walk (apiFetch self-refreshes).
    await freshToken();
    const guidePageDt = await getDocumentTypeByName('Guide Page');
    if (!guidePageDt) throw new Error('"Guide Page" doc type not found — Step 1 must be shipped.');
    GUIDE_PAGE_DT = guidePageDt.id;
    GUIDE_PAGE_TEMPLATE = guidePageDt.allowedTemplates?.[0]?.id;
    if (!GUIDE_PAGE_TEMPLATE) {
      throw new Error('"Guide Page" has no allowed template — Step 2 must link the guidePage template.');
    }

    const guideSection = await getDocumentTypeByName('Guide Section');
    if (!guideSection) throw new Error('"Guide Section" element type not found — Step 1 must be shipped.');
    GUIDE_SECTION_ET = guideSection.id;

    const guidesDt = await getDocumentTypeByName('Guides');
    if (!guidesDt) throw new Error('"Guides" doc type not found.');
    const guidesNodes = await collectContentNodesByDocType(guidesDt.id);
    if (guidesNodes.length === 0) throw new Error('No published "Guides" content node found.');
    GUIDES_PARENT_ID = guidesNodes[0].id;

    await cleanStaleFixtures();

    multiUrl = await createGuidePageFixture(`${FIXTURE_PREFIX} Multi`, [
      'Alpha Section',
      'Beta Section',
    ]);
    singleUrl = await createGuidePageFixture(`${FIXTURE_PREFIX} Single`, ['Solo Section']);
    dupUrl = await createGuidePageFixture(`${FIXTURE_PREFIX} Dupes`, ['Examples', 'Examples']);
  });

  test.afterAll(async () => {
    if (!GUIDES_PARENT_ID) return;
    await cleanStaleFixtures();
  });

  test('A multi-section guide derives one TOC anchor per section, each resolving to a section id', async ({
    page,
  }) => {
    await page.goto(multiUrl);
    const anchors = page.locator('.styleguide__nav a');
    await expect(anchors).toHaveCount(2);

    const hrefs = await anchors.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? '')
    );
    expect(hrefs).toEqual(['#alpha-section', '#beta-section']);

    // Each anchor resolves to exactly one on-page section id.
    for (const href of hrefs) {
      await expect(page.locator(`section[id="${href.slice(1)}"]`)).toHaveCount(1);
    }

    // Section headings render the titles.
    await expect(
      page.locator('#alpha-section .section-row__title')
    ).toHaveText('Alpha Section');
    await expect(
      page.locator('#beta-section .section-row__title')
    ).toHaveText('Beta Section');
  });

  test('A single-section guide renders no TOC (nav only appears with >1 section)', async ({
    page,
  }) => {
    await page.goto(singleUrl);
    await expect(page.locator('#solo-section')).toHaveCount(1);
    await expect(page.locator('.styleguide__nav')).toHaveCount(0);
  });

  test('Duplicate section titles get distinct anchors, each resolving to exactly one id', async ({
    page,
  }) => {
    await page.goto(dupUrl);

    // Two sections both titled "Examples" → distinct de-duped ids.
    const sectionIds = await page
      .locator('section.styleguide__section-anchor')
      .evaluateAll((els) => els.map((e) => e.id));
    expect(sectionIds).toEqual(['examples', 'examples-2']);

    const anchors = page.locator('.styleguide__nav a');
    await expect(anchors).toHaveCount(2);
    const hrefs = await anchors.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? '')
    );
    expect(hrefs).toEqual(['#examples', '#examples-2']);

    // Every TOC href resolves to exactly one on-page id (no collision).
    for (const href of hrefs) {
      await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1);
    }
  });
});

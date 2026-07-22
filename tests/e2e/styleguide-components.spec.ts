import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import {
  apiFetch,
  collectContentNodesByDocType,
  freshToken,
  getDocumentTypeByName,
  tryGetDocumentPath as getDocumentPath,
} from './_umbracoApi';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Consolidated-guides retarget (Step 5 of _plans/consolidated-guides.md).
//
// The Component Guide moved off the legacy `content`-page-under-styleguide at
// /styleguide/components onto the consolidated `guidePage` doc type at
// /guides/component-guide. The legacy `/styleguide/components` URL now 301s here
// (verified in guide-redirects.spec.ts).
//
// APPROACH: read-mostly (per the Step 5 behavioural envelope). The canonical
// Component Guide is authored in Step 6 (MCP), NOT here — this spec does not
// reproduce that content. It looks the published node up dynamically and asserts
// the render contract Step 6 must satisfy, so every content/browser assertion is
// expected RED (clean "page not found" content-absence) until Step 6 lands.
//
// CONTRACT for Step 6 (what these assertions expect the Component Guide to be):
//   - a `guidePage` published at /guides/component-guide, hidden from top nav;
//   - a multi-section body → a left-column TOC (.styleguide__nav) is rendered;
//   - every section (.styleguide__section-anchor) contains a rich-text
//     description (.richtext);
//   - where a how-to guide exists for a showcased block, the section links to it
//     (an <a href="/guides/…">); every such in-app /guides/ link resolves (no
//     broken links).
// ---------------------------------------------------------------------------

// collectContentNodesByDocType + getDocumentPath (the nullable variant) are imported
// from ./_umbracoApi — see that file for the implementations.

/**
 * Resolve the canonical Component Guide URL: the `guidePage` whose published URL
 * ends with the decided `/guides/component-guide` path (Rule #1/#2). Returns null
 * when the node does not yet exist (Step 6) → clean content-absence RED.
 */
async function getComponentGuideUrl(): Promise<string | null> {
  const guidePageId = (await getDocumentTypeByName('Guide Page'))?.id;
  if (!guidePageId) return null;
  const nodes = await collectContentNodesByDocType(guidePageId);
  for (const node of nodes) {
    const url = await getDocumentPath(node.id);
    if (url && /\/guides\/component-guide\/?$/.test(url)) return url;
  }
  return null;
}

test.describe('Component Guide — canonical page (RED until Step 6)', () => {
  test.describe.configure({ mode: 'serial' });

  let componentGuideUrl: string;

  test.beforeAll(async () => {
    // Fail fast with a clear auth error before the lookups (apiFetch self-refreshes).
    await freshToken();
    const url = await getComponentGuideUrl();
    expect(
      url,
      'A guidePage published at /guides/component-guide must exist (authored in Step 6)'
    ).toBeTruthy();
    componentGuideUrl = url!;
  });

  test('Component Guide is reachable at /guides/component-guide', async ({ page }) => {
    expect(componentGuideUrl).toMatch(/\/guides\/component-guide\/?$/);
    const res = await page.goto(componentGuideUrl);
    expect(res?.status()).toBe(200);
  });

  test('Component Guide is hidden from the top navigation', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.site-nav').getByRole('link', { name: /component/i })
    ).toHaveCount(0);
  });

  test('Component Guide renders a left-column TOC (multi-section)', async ({ page }) => {
    await page.goto(componentGuideUrl);
    const anchors = page.locator('.styleguide__nav a');
    const count = await anchors.count();
    expect(count, 'multi-section Component Guide should render a TOC').toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      const href = await anchors.nth(i).getAttribute('href');
      expect(href).toMatch(/^#.+/);
      await expect(page.locator(`[id="${href!.slice(1)}"]`)).toHaveCount(1);
    }
  });

  test('Every showcase section carries a rich-text description', async ({ page }) => {
    await page.goto(componentGuideUrl);
    const sections = page.locator('section.styleguide__section-anchor');
    const count = await sections.count();
    expect(count, 'Component Guide should have showcase sections').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(
        sections.nth(i).locator('.richtext').first(),
        `section ${i} must include a rich-text description`
      ).toBeVisible();
    }
  });

  test('Links to how-to guides where one exists, and no /guides link is broken', async ({
    page,
    request,
  }) => {
    await page.goto(componentGuideUrl);

    // In-app guide links (exclude in-page TOC anchors, which start with '#').
    const hrefs = await page
      .locator('section.styleguide__section-anchor a[href^="/guides/"]')
      .evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? '')
      );
    const uniqueHrefs = [...new Set(hrefs)].filter((h) => h && h !== componentGuideUrl);

    // At least one section links to a how-to guide (e.g. the Alert Banner how-to,
    // which is generated by the guide-generator CLI).
    expect(
      uniqueHrefs.length,
      'at least one section should link to a how-to guide'
    ).toBeGreaterThan(0);

    // No broken links: every /guides/ link resolves to a success status (2xx),
    // not just "not 404" — a 500/403 is broken too.
    for (const href of uniqueHrefs) {
      const resp = await request.get(href, { maxRedirects: 5 });
      expect(resp.ok(), `link ${href} should resolve (2xx, not an error status)`).toBeTruthy();
    }
  });
});

/**
 * Card link semantics — article-grid-card accessible-link contract (FR5).
 *
 * Asserts the inclusive-components card pattern
 * (https://inclusive-components.design/cards/): each `.article-grid-card`
 * exposes EXACTLY ONE focusable link with a non-empty accessible name, and no
 * focusable element sits inside an `aria-hidden="true"` subtree.
 *
 * RED before Step 3: today the card renders TWO links to the same URL — the
 * `<h3 class="card-title">` link plus a `.card-thumb` wrapper `<a aria-hidden="true">`
 * that is both focusable AND aria-hidden (axe `aria-hidden-focus`) and has no
 * accessible name (axe `link-name`). GREEN after the thumbnail `<a>` becomes a
 * non-interactive `<div>` and the title link gets a full-card `::after` overlay.
 *
 * Resilience (CLAUDE.md "E2E Test Resilience Rules"): the grid page (Home) is
 * looked up dynamically via the Management API (rules #1/#2 — no hardcoded
 * UUIDs or slugs); the token/lookup helpers come from tests/e2e/_umbracoApi.ts
 * (apiFetch auto-refreshes per rule #4). Assertions prefer role/computed
 * accessibility queries over brittle DOM/text matching (rules #5/#6).
 */

import { expect, type Page } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';

import { apiFetch, findHomeDocId, getDocumentPath } from '../_umbracoApi';

// ==============================
// Grid-page discovery (rule #1/#2: no hardcoded UUIDs/slugs)
// Token handling lives in _umbracoApi (apiFetch auto-refreshes — rule #4).
// ==============================

/** Navigate to `url` and report whether it renders the `.article-grid-card` grid. */
async function pageRendersGrid(page: Page, url: string): Promise<boolean> {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => {});
  return (await page.locator('.article-grid-card').count()) > 0;
}

/**
 * Return the published URL of the first page whose RENDERED body contains the
 * `.article-grid-card` grid, leaving `page` navigated to that URL. Home is
 * checked first (it usually hosts the grid) so the common case costs ONE
 * navigation; only if Home lacks the grid do we BFS the document tree. The
 * grid only renders when the latest-articles block is in "grid" displayMode,
 * so we detect it by fetching candidates rather than assuming a slug like "/blog".
 */
async function findGridPageUrl(page: Page, homeId: string): Promise<string> {
  // Fast path: Home first — avoids walking the whole tree in the common case.
  const homeUrl = await getDocumentPath(homeId);
  if (await pageRendersGrid(page, homeUrl)) return homeUrl;

  // Fallback: BFS the tree for the first published page that renders the grid.
  const queue: string[] = [homeId];
  const seen = new Set<string>();
  const candidates: string[] = [];
  let guard = 0;

  while (queue.length && guard < 200) {
    guard++;
    const parentId = queue.shift()!;
    if (seen.has(parentId)) continue;
    seen.add(parentId);

    const childResp = await apiFetch(
      'GET',
      `/tree/document/children?parentId=${parentId}&skip=0&take=100`
    );
    if (!childResp.ok) continue;
    const childData = (await childResp.json()) as any;
    for (const item of childData.items ?? []) {
      const variant = item.variants?.[0] ?? {};
      if ((variant.state ?? '').toLowerCase() === 'published') candidates.push(item.id);
      if (item.hasChildren) queue.push(item.id);
    }
  }

  for (const id of candidates) {
    let url: string;
    try {
      url = await getDocumentPath(id);
    } catch {
      continue;
    }
    if (await pageRendersGrid(page, url)) return url;
  }

  throw new Error('No published page rendering the .article-grid-card grid was found');
}

// ==============================
// Card link semantics
// ==============================

test.describe('Accessibility — article-card link semantics (FR5)', () => {
  test('each card exposes exactly one focusable, named link and no focusable node inside an aria-hidden subtree', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });

    const homeId = await findHomeDocId();
    // findGridPageUrl leaves `page` navigated to the resolved grid URL — no
    // second goto needed (it already loaded the page to detect the grid).
    await findGridPageUrl(page, homeId);

    const cards = page.locator('.article-grid-card');
    const cardCount = await cards.count();
    expect(cardCount, 'expected at least one .article-grid-card in the grid').toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);

      // Exactly one <a> per card (the title link; the overlay covers the card).
      const links = card.locator('a');
      expect(
        await links.count(),
        `card #${i + 1} should expose exactly one link`
      ).toBe(1);

      // That link has a non-empty accessible name. Use Playwright's accessible-name
      // computation (the AT-equivalent tree) rather than reading textContent, so the
      // assertion can't be fooled by whitespace-only text or an aria-labelledby/alt
      // name that textContent wouldn't see.
      const link = links.first();
      await expect(
        link,
        `card #${i + 1} link should have a non-empty accessible name`
      ).toHaveAccessibleName(/.+/);

      // No focusable element lives inside an aria-hidden="true" subtree.
      const hiddenFocusable = card.locator(
        '[aria-hidden="true"] a, [aria-hidden="true"] button, [aria-hidden="true"] [tabindex]'
      );
      expect(
        await hiddenFocusable.count(),
        `card #${i + 1} should have no focusable element inside an aria-hidden subtree`
      ).toBe(0);
    }
  });
});

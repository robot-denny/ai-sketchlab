/**
 * Article card imageless placeholder — behavioral + accessibility E2E (RED for Step 2).
 *
 * The shared article card (Views/Partials/v2/_ArticleCard.cshtml) renders an
 * `<img>` inside `.card-thumb` only when the article has a `mainImage`; otherwise
 * the thumb is a bare `--surface-tertiary` box. This spec pins the intended
 * behavior once the decorative CSS placeholder lands (Step 2):
 *
 *   (a) a card for an article with NO featured image renders a
 *       `.card-thumb__placeholder[aria-hidden="true"]` element and NO `<img>`
 *       inside `.card-thumb`;
 *   (b) a card WITH a featured image renders the `<img>` and NO placeholder;
 *   (c) every card still exposes exactly one accessible link (the existing
 *       inclusive-components one-link-per-card contract — see
 *       tests/e2e/accessibility/cardLinks.spec.ts).
 *
 * RED before Step 2: the placeholder element does not exist yet, so assertion
 * (a) — placeholder present on the imageless card — fails. (b) and (c) already
 * hold today and guard against a regression when the placeholder is added.
 *
 * Fixtures (no imageless published article exists on the demo site — every
 * sampled article carries a mainImage), so this spec authors its own, mirroring
 * articleCardMetaDescription.spec.ts:
 *   - "[E2E] ACP Test No Image"   : subtitle, no mainImage  → placeholder card
 *   - "[E2E] ACP Test With Image" : subtitle + mainImage    → image card
 * Both are future-dated (2099) so they sort to the top of the ArticleDate-desc
 * archive and land on page 1 (size 12). Created, published, asserted, cleaned up.
 *
 * Resilience (CLAUDE.md "E2E Test Resilience Rules" + docs/e2e-testing.md):
 * doc types, the Article List page, an author, an Image media node, and the
 * published URL are all discovered dynamically via the Management API (no
 * hardcoded UUIDs/slugs); apiFetch auto-refreshes the client_credentials token
 * (rule #4); stale fixtures from prior runs are swept before setup (rule #3).
 */

import { randomUUID } from 'node:crypto';

import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';

import { apiFetch, getDocumentPath, TEST_FIXTURE_PREFIX } from './_umbracoApi';

// Module-level state shared across the serial browser tests (rule #1: dynamic lookups)
let articleListId: string;
let articleListUrl: string;
let articleDocTypeId: string;
let articleTemplateId: string | undefined;
let firstAuthorId: string | undefined;
let imageMediaId: string;
const createdArticleIds: string[] = [];

const ARTICLE_NO_IMAGE_NAME = `${TEST_FIXTURE_PREFIX} ACP Test No Image`;
const ARTICLE_WITH_IMAGE_NAME = `${TEST_FIXTURE_PREFIX} ACP Test With Image`;
const STALE_NAME_PREFIX = `${TEST_FIXTURE_PREFIX} ACP Test`;
const SUBTITLE = 'ACP placeholder fixture subtitle';

/** Walk the media tree for the first Image-type media node (rule #1: no hardcoded UUIDs). */
async function findImageMediaId(): Promise<string> {
  async function walk(parentId: string | null): Promise<string | null> {
    const path = parentId
      ? `/tree/media/children?parentId=${parentId}&skip=0&take=100`
      : '/tree/media/root?skip=0&take=100';
    const resp = await apiFetch('GET', path);
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    const items: any[] = data.items ?? [];
    // Media tree nodes expose mediaType.icon (not .alias) to distinguish type —
    // 'icon-picture' is the Image media type (see ellaBlockAttribution.spec.ts).
    // Prefer an Image at this level before descending, so we don't recurse needlessly.
    const image = items.find((it) => it.mediaType?.icon === 'icon-picture');
    if (image) return image.id;
    for (const it of items) {
      if (it.hasChildren) {
        const found = await walk(it.id);
        if (found) return found;
      }
    }
    return null;
  }
  const id = await walk(null);
  if (!id) {
    throw new Error(
      'No Image-type media node found to attach as a mainImage fixture. ' +
        'The demo site is expected to have at least one Image media item.'
    );
  }
  return id;
}

test.describe('Article card imageless placeholder — Browser E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // 1. Look up Article List + Article doc type IDs (rule #1) via the Pages folder.
    const dtRootResp = await apiFetch('GET', '/tree/document-type/root?skip=0&take=100');
    if (!dtRootResp.ok) throw new Error(`GET doc type tree root failed: ${dtRootResp.status}`);
    const dtRootData = (await dtRootResp.json()) as any;

    const pagesFolder = (dtRootData.items ?? []).find((d: any) => d.name === 'Pages');
    if (!pagesFolder) throw new Error('"Pages" folder not found in doc type tree root');

    const pagesChildrenResp = await apiFetch(
      'GET',
      `/tree/document-type/children?parentId=${pagesFolder.id}&skip=0&take=100`
    );
    if (!pagesChildrenResp.ok)
      throw new Error(`GET Pages children failed: ${pagesChildrenResp.status}`);
    const pagesItems: any[] = ((await pagesChildrenResp.json()) as any).items ?? [];

    const articleListDtNode = pagesItems.find((d: any) => d.name === 'Article List');
    if (!articleListDtNode) throw new Error('"Article List" document type not found');

    const articleDtNode = pagesItems.find((d: any) => d.name === 'Article');
    if (!articleDtNode) throw new Error('"Article" document type not found');
    articleDocTypeId = articleDtNode.id;

    const articleDt = (await (
      await apiFetch('GET', `/document-type/${articleDtNode.id}`)
    ).json()) as any;
    articleTemplateId = articleDt.allowedTemplates?.[0]?.id;

    // 2. Walk the document tree for the Article List page + an Author (rule #1).
    const docRootResp = await apiFetch('GET', '/tree/document/root?skip=0&take=100');
    if (!docRootResp.ok) throw new Error(`GET document tree root failed: ${docRootResp.status}`);
    const docRootData = (await docRootResp.json()) as any;

    let foundNode: any = null;
    for (const item of docRootData.items ?? []) {
      if (item.documentType?.id === articleListDtNode.id) {
        foundNode = item;
        break;
      }
      if (item.hasChildren) {
        const childResp = await apiFetch(
          'GET',
          `/tree/document/children?parentId=${item.id}&skip=0&take=100`
        );
        if (childResp.ok) {
          const childData = (await childResp.json()) as any;
          for (const child of childData.items ?? []) {
            if (child.documentType?.id === articleListDtNode.id && !foundNode) {
              foundNode = child;
            }
            const childName: string = child.variants?.[0]?.name ?? child.name ?? '';
            if (childName === 'Authors' && child.hasChildren && !firstAuthorId) {
              const authChildResp = await apiFetch(
                'GET',
                `/tree/document/children?parentId=${child.id}&skip=0&take=5`
              );
              if (authChildResp.ok) {
                const authData = (await authChildResp.json()) as any;
                const firstAuthor = (authData.items ?? [])[0];
                if (firstAuthor) firstAuthorId = firstAuthor.id;
              }
            }
          }
        }
        if (foundNode) break;
      }
    }
    if (!foundNode) {
      throw new Error(
        'No Article List page found in the document tree. ' +
          'The demo site must have an Article List page configured.'
      );
    }
    articleListId = foundNode.id;

    // 3. Discover an Image media node for the "with image" fixture (rule #1).
    imageMediaId = await findImageMediaId();

    // 4. Clean stale "ACP Test" articles from prior runs (rule #3).
    const childrenResp = await apiFetch(
      'GET',
      `/tree/document/children?parentId=${articleListId}&skip=0&take=100`
    );
    if (childrenResp.ok) {
      const childrenData = (await childrenResp.json()) as any;
      for (const child of childrenData.items ?? []) {
        const childName: string = child.variants?.[0]?.name ?? child.name ?? '';
        if (childName.startsWith(STALE_NAME_PREFIX)) {
          await apiFetch('DELETE', `/document/${child.id}`);
        }
      }
    }

    const authorValue = firstAuthorId
      ? [{ type: 'document', unique: firstAuthorId }]
      : undefined;
    const mainImageValue = [
      {
        key: randomUUID(),
        mediaKey: imageMediaId,
        mediaTypeAlias: 'Image',
        crops: [],
        focalPoint: null,
      },
    ];

    // 5a. Article WITHOUT a mainImage — should render the decorative placeholder.
    const noImgResp = await apiFetch('POST', '/document', {
      documentType: { id: articleDocTypeId },
      parent: { id: articleListId },
      ...(articleTemplateId ? { template: { id: articleTemplateId } } : {}),
      values: [
        { alias: 'articleDate', culture: null, segment: null, value: '2099-06-02 00:00:00' },
        { alias: 'subtitle', culture: null, segment: null, value: SUBTITLE },
        // intentionally NO mainImage
        ...(authorValue
          ? [{ alias: 'author', culture: null, segment: null, value: authorValue }]
          : []),
      ],
      variants: [{ culture: null, segment: null, name: ARTICLE_NO_IMAGE_NAME }],
    });
    if (!noImgResp.ok) {
      throw new Error(
        `Create "${ARTICLE_NO_IMAGE_NAME}" failed: ${noImgResp.status} - ${await noImgResp.text()}`
      );
    }
    createdArticleIds.push((noImgResp.headers.get('Location') || '').split('/').pop()!);

    // 5b. Article WITH a mainImage — should render <img>, no placeholder.
    const withImgResp = await apiFetch('POST', '/document', {
      documentType: { id: articleDocTypeId },
      parent: { id: articleListId },
      ...(articleTemplateId ? { template: { id: articleTemplateId } } : {}),
      values: [
        { alias: 'articleDate', culture: null, segment: null, value: '2099-06-01 00:00:00' },
        { alias: 'subtitle', culture: null, segment: null, value: SUBTITLE },
        { alias: 'mainImage', culture: null, segment: null, value: mainImageValue },
        ...(authorValue
          ? [{ alias: 'author', culture: null, segment: null, value: authorValue }]
          : []),
      ],
      variants: [{ culture: null, segment: null, name: ARTICLE_WITH_IMAGE_NAME }],
    });
    if (!withImgResp.ok) {
      throw new Error(
        `Create "${ARTICLE_WITH_IMAGE_NAME}" failed: ${withImgResp.status} - ${await withImgResp.text()}`
      );
    }
    createdArticleIds.push((withImgResp.headers.get('Location') || '').split('/').pop()!);

    // 6. Publish both fixtures.
    for (const id of createdArticleIds) {
      const pubResp = await apiFetch('PUT', `/document/${id}/publish`, {
        publishSchedules: [{ culture: null }],
      });
      if (!pubResp.ok) {
        console.warn(`Publish article ${id} failed: ${pubResp.status} - ${await pubResp.text()}`);
      }
    }

    // 7. Resolve the article list URL (rule #2: never hardcode slugs).
    articleListUrl = await getDocumentPath(articleListId);
  });

  test.afterAll(async () => {
    for (const id of [...createdArticleIds].reverse()) {
      try {
        await apiFetch('DELETE', `/document/${id}`);
      } catch {
        /* best-effort cleanup */
      }
    }
  });

  test('imageless article card renders the decorative placeholder and no <img>', async ({
    page,
  }) => {
    await page.goto(articleListUrl);
    await page.waitForLoadState('networkidle').catch(() => {});

    const card = page
      .locator('.article-grid-card')
      .filter({ has: page.locator('.card-title', { hasText: ARTICLE_NO_IMAGE_NAME }) });
    await expect(card).toBeVisible();

    // The decorative placeholder is present and hidden from assistive tech.
    const placeholder = card.locator('.card-thumb .card-thumb__placeholder[aria-hidden="true"]');
    await expect(
      placeholder,
      'imageless card should render a .card-thumb__placeholder[aria-hidden="true"]'
    ).toHaveCount(1);

    // No <img> inside the thumb for an article with no featured image.
    await expect(
      card.locator('.card-thumb img'),
      'imageless card should not render an <img> inside .card-thumb'
    ).toHaveCount(0);
  });

  test('article with a featured image renders the <img> and no placeholder', async ({
    page,
  }) => {
    await page.goto(articleListUrl);
    await page.waitForLoadState('networkidle').catch(() => {});

    const card = page
      .locator('.article-grid-card')
      .filter({ has: page.locator('.card-title', { hasText: ARTICLE_WITH_IMAGE_NAME }) });
    await expect(card).toBeVisible();

    await expect(
      card.locator('.card-thumb img'),
      'image card should render an <img> inside .card-thumb'
    ).toHaveCount(1);

    await expect(
      card.locator('.card-thumb__placeholder'),
      'image card should NOT render a placeholder'
    ).toHaveCount(0);
  });

  test('every card still exposes exactly one accessible link', async ({ page }) => {
    await page.goto(articleListUrl);
    await page.waitForLoadState('networkidle').catch(() => {});

    const cards = page.locator('.article-grid-card');
    const cardCount = await cards.count();
    expect(cardCount, 'expected at least one .article-grid-card in the archive').toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);

      const links = card.locator('a');
      expect(await links.count(), `card #${i + 1} should expose exactly one link`).toBe(1);

      await expect(
        links.first(),
        `card #${i + 1} link should have a non-empty accessible name`
      ).toHaveAccessibleName(/.+/);

      // The placeholder (added in Step 2) must stay out of the a11y tree — no
      // focusable node inside an aria-hidden subtree (matches cardLinks.spec.ts).
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

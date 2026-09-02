import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { randomUUID } from 'crypto';
import { apiFetch, freshToken, TEST_FIXTURE_PREFIX, tryGetDocumentPath } from '../_umbracoApi';
import { waitForWebfonts } from '../_helpers';
import {
  readSpellDeck,
  slugOf,
  treeChildren,
  type SpellCardFacts,
  type SpellStackFacts,
} from '../_spellDeckFixture';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Spell Card Deck — structural render (Step 5 of _work/shipped/spell-cards/plan.md).
//
// SCOPE. Step 5 ships the block VIEW only: no stylesheet, no JavaScript. So this
// spec asserts what the server sends and nothing else — which stacks are listed,
// which panel is open on arrival, how a panel sections its cards, and which
// optional regions are omitted. Flip behaviour, stack switching, the carousel and
// the URL hash are Steps 6-9 and are deliberately NOT asserted here.
//
// WHY textContent, NOT role queries, for the closed panels. All four panels are
// server-rendered and the three that are not the default-open stack carry
// `hidden`, so they are outside the accessibility tree. `getByRole()` cannot see
// them. Playwright's `toHaveText`/`toContainText` read `textContent`, which can,
// so the closed panels are asserted through those.
//
// EXPECTED VALUES ARE SOURCED INDEPENDENTLY of the view. Stack names, slugs and
// per-section card counts come from the Management API tree; the sigil ids come
// from the design reference's own sigil table
// (_work/shipped/spell-cards/assets/design-v5/README-round-2.md → "Sigil assignment").
// Nothing here re-implements the view's resolution to predict its own answer.
// ---------------------------------------------------------------------------

const FIXTURE_PREFIX = `${TEST_FIXTURE_PREFIX} SpellCard`;

/** Pack key → sprite symbol id. Transcribed from the design reference, not from the view. */
const PACK_SIGIL: Record<string, string> = {
  core: 'sig-spellbook',
  'umbraco-17': 'sig-umbraco17',
  'umbraco-cloud': 'sig-cloud',
  dotnet: 'sig-dotnet',
};

/** Every reference in every pack wears the same static tome (README-round-3 §4). */
const REFERENCE_SIGIL = 'sig-tome';

let spellbookUrl: string;
let stacks: SpellStackFacts[] = [];
let coreStackId = '';
let spellDocTypeId = '';

/** Delete leftover fixture cards under the Core stack before creating fresh ones. */
async function cleanStaleFixtures() {
  if (!coreStackId) return;
  for (const item of await treeChildren(coreStackId)) {
    const name = item.variants?.[0]?.name ?? '';
    if (name.startsWith(FIXTURE_PREFIX)) {
      const del = await apiFetch('DELETE', `/document/${item.id}`);
      if (!del.ok) {
        console.warn(`cleanStaleFixtures: DELETE ${item.id} ("${name}") failed: ${del.status}`);
      }
    }
  }
}

test.beforeAll(async () => {
  // Fail fast with a clear auth error before the tree walk.
  await freshToken();

  const deck = await readSpellDeck();
  spellbookUrl = deck.spellbookUrl;
  stacks = deck.stacks;
  spellDocTypeId = deck.docTypeIds.spell;
  coreStackId = stacks.find((st) => st.pack === 'core')?.id ?? '';

  if (stacks.length === 0) {
    throw new Error('Spellbook page has no stack children — Step 3 must be shipped.');
  }

  await cleanStaleFixtures();
});

// ==============================
// Section 1 — the stack row
// ==============================

test.describe('Spell Card Deck — the stack row', () => {
  test('lists every stack with its name and its card count', async ({ page }) => {
    await page.goto(spellbookUrl);

    const row = page.getByRole('group', { name: 'Card stacks' });
    await expect(row.getByRole('button')).toHaveCount(stacks.length);

    for (const stack of stacks) {
      const total = stack.spells.length + stack.references.length;
      const button = row.locator(`button[data-stack="${stack.slug}"]`);
      await expect(button, `a stack button for "${stack.name}"`).toHaveCount(1);
      await expect(button).toContainText(stack.name);
      await expect(button).toContainText(`${total} cards`);
    }
  });

});

// ==============================
// Section 2 — panels: one open, the rest rendered but hidden
// ==============================

test.describe('Spell Card Deck — panel disclosure on arrival', () => {
  test('the default stack panel is open and every other panel is rendered but hidden', async ({
    page,
  }) => {
    await page.goto(spellbookUrl);

    const core = stacks.find((s) => s.pack === 'core')!;

    await expect(page.locator(`#spell-deck-panel-${core.slug}`)).toBeVisible();
    await expect(page.locator(`button[data-stack="${core.slug}"]`)).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    for (const stack of stacks.filter((s) => s.slug !== core.slug)) {
      const panel = page.locator(`#spell-deck-panel-${stack.slug}`);
      // Rendered server-side (so a flip survives a stack round-trip later)…
      await expect(panel, `${stack.name} panel is in the DOM`).toHaveCount(1);
      // …but closed.
      await expect(panel, `${stack.name} panel is closed on arrival`).toBeHidden();
      await expect(page.locator(`button[data-stack="${stack.slug}"]`)).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    }
  });

  test('each stack button points at the panel it controls', async ({ page }) => {
    await page.goto(spellbookUrl);
    for (const stack of stacks) {
      await expect(page.locator(`button[data-stack="${stack.slug}"]`)).toHaveAttribute(
        'aria-controls',
        `spell-deck-panel-${stack.slug}`
      );
    }
  });
});

// ==============================
// Section 3 — sections inside a panel
// ==============================

test.describe('Spell Card Deck — sections', () => {
  test('the Core panel heads a Spells section then a References section', async ({ page }) => {
    await page.goto(spellbookUrl);
    const core = stacks.find((s) => s.pack === 'core')!;

    // Preconditions: this test is only meaningful for a stack holding both kinds.
    expect(core.spells.length, 'Core holds at least one spell').toBeGreaterThan(0);
    expect(core.references.length, 'Core holds at least one reference').toBeGreaterThan(0);

    const panel = page.locator(`#spell-deck-panel-${core.slug}`);
    await expect(panel.locator('h4')).toHaveText(['Spells', 'References']);

    await expect(panel.locator('[data-section="spells"] button[data-card]')).toHaveCount(
      core.spells.length
    );
    await expect(panel.locator('[data-section="references"] button[data-card]')).toHaveCount(
      core.references.length
    );
  });

  test('a references-only stack renders a References section and no Spells section', async ({
    page,
  }) => {
    const dotnet = stacks.find((s) => s.pack === 'dotnet');
    expect(dotnet, 'a "dotnet" stack should exist').toBeTruthy();
    expect(dotnet!.spells.length, 'the dotnet stack holds no spells').toBe(0);
    expect(dotnet!.references.length, 'the dotnet stack holds references').toBeGreaterThan(0);

    await page.goto(spellbookUrl);
    // Closed panel → textContent, not the accessibility tree (see header note).
    await expect(page.locator(`#spell-deck-panel-${dotnet!.slug} h4`)).toHaveText(['References']);
  });
});

// ==============================
// Section 4 — optional regions on the reverse
// ==============================

test.describe('Spell Card Deck — optional card fields', () => {
  test('a card with no "Watch for" value renders no Watch for label, while one with a value does', async ({
    page,
  }) => {
    const core = stacks.find((s) => s.pack === 'core')!;
    const allCards = [...core.spells, ...core.references];
    const withWatch = allCards.find((c) => c.watch.trim().length > 0);
    const withoutWatch = allCards.find((c) => c.watch.trim().length === 0);
    expect(withWatch, 'Core should hold at least one card with a Watch for value').toBeTruthy();
    expect(withoutWatch, 'Core should hold at least one card with no Watch for value').toBeTruthy();

    await page.goto(spellbookUrl);

    // Contrast case: the label and its value both render when the field is set.
    const present = page.locator(`[data-card="${withWatch!.slug}"]`);
    await expect(present).toContainText('Watch for');
    await expect(present).toContainText(withWatch!.watch.slice(0, 40));

    // The regression: no label, and nothing rendered in its place.
    const absent = page.locator(`[data-card="${withoutWatch!.slug}"]`);
    await expect(absent, `"${withoutWatch!.name}" has no Watch for value`).not.toContainText(
      'Watch for'
    );
  });
});

// ==============================
// Section 5 — the face tells a spell from a reference
// ==============================

test.describe('Spell Card Deck — card faces', () => {
  test('a spell face and a reference face differ in kind badge and in sigil', async ({ page }) => {
    const core = stacks.find((s) => s.pack === 'core')!;
    const spell = core.spells[0];
    const reference = core.references[0];
    expect(spell, 'Core should hold at least one spell').toBeTruthy();
    expect(reference, 'Core should hold at least one reference').toBeTruthy();

    await page.goto(spellbookUrl);

    const spellFace = page.locator(`[data-card="${spell.slug}"] .spell-card__face`);
    const referenceFace = page.locator(`[data-card="${reference.slug}"] .spell-card__face`);

    await expect(spellFace).toContainText('Spell');
    await expect(referenceFace).toContainText('Reference');

    // Every reference in every pack wears the shared tome; a spell never does.
    await expect(referenceFace.locator('use')).toHaveAttribute('href', `#${REFERENCE_SIGIL}`);
    const spellHref = await spellFace.locator('use').getAttribute('href');
    expect(spellHref, 'a spell wears its own mark, not the tome').not.toBe(`#${REFERENCE_SIGIL}`);
  });

  test('a spell wears the mark its editor chose', async ({ page }) => {
    const core = stacks.find((s) => s.pack === 'core')!;
    const marked = core.spells.find((s) => s.mark.length > 0);
    expect(marked, 'Core should hold at least one spell with a chosen mark').toBeTruthy();

    await page.goto(spellbookUrl);
    await expect(
      page.locator(`[data-card="${marked!.slug}"] .spell-card__face use`)
    ).toHaveAttribute('href', `#sig-${marked!.mark}`);
  });
});

// ==============================
// Section 6 — the pack-sigil fallback (self-contained fixture)
//
// Step 3 set a mark on every authored spell, so nothing in the real content
// exercises the blank-mark path. This creates its own throwaway spell under
// Core, asserts, and deletes it — the fixture pattern from styleguide.spec.ts.
// ==============================

test.describe('Spell Card Deck — a spell with no mark falls back to its pack sigil', () => {
  test.describe.configure({ mode: 'serial' });

  let fixtureId = '';
  let fixtureSlug = '';

  test.beforeAll(async () => {
    if (!coreStackId) throw new Error('No "core" stack found — cannot anchor the fixture.');
    await cleanStaleFixtures();

    fixtureId = randomUUID();
    const name = `${FIXTURE_PREFIX} Unmarked`;
    const createResp = await apiFetch('POST', '/document', {
      id: fixtureId,
      parent: { id: coreStackId },
      documentType: { id: spellDocTypeId },
      template: null,
      values: [
        { editorAlias: 'Umbraco.TextBox', culture: null, segment: null, alias: 'cardTitle', value: '/unmarked' },
        {
          editorAlias: 'Umbraco.TextArea',
          culture: null,
          segment: null,
          alias: 'cardDoes',
          value: 'A throwaway spell with no mark chosen, so the deck must reach for its pack sigil.',
        },
        { editorAlias: 'Umbraco.TextBox', culture: null, segment: null, alias: 'cardCast', value: '/unmarked' },
        // cardMark deliberately absent — that absence is the behaviour under test.
      ],
      variants: [{ culture: null, segment: null, name }],
    });
    if (!createResp.ok) {
      throw new Error(`POST fixture spell failed: ${createResp.status} - ${await createResp.text()}`);
    }
    const pubResp = await apiFetch('PUT', `/document/${fixtureId}/publish`, {
      publishSchedules: [{ culture: null }],
    });
    if (!pubResp.ok) {
      throw new Error(`Publish fixture spell failed: ${pubResp.status} - ${await pubResp.text()}`);
    }
    const url = await tryGetDocumentPath(fixtureId);
    if (!url) throw new Error('Fixture spell has no published URL.');
    fixtureSlug = slugOf(url);
  });

  test.afterAll(async () => {
    await cleanStaleFixtures();
  });

  test('renders the Core pack sigil rather than an empty use', async ({ page }) => {
    await page.goto(spellbookUrl);

    const use = page.locator(`[data-card="${fixtureSlug}"] .spell-card__face use`);
    await expect(use, 'the unmarked spell still draws a mark').toHaveCount(1);
    await expect(use).toHaveAttribute('href', `#${PACK_SIGIL.core}`);
  });
});

// ==============================
// Section 7 — equal height within a section, and nothing clipped (Step 6)
//
// This is the one criterion the design's own mechanism could not hold — the
// prototype ESTIMATED a card's height from its text length — so it earns a real
// measurement rather than a screenshot. The shipped mechanism is
// `grid-auto-rows: 1fr` on the section grid with both faces in ONE grid cell, so
// the cell measures the taller face and the track equalises the section.
//
// Heights are read from the browser, never predicted here: the assertion is that
// the numbers AGREE, not that they equal some value this file computed.
// ==============================

interface CardBox {
  card: string;
  offsetHeight: number;
  scrollHeight: number;
  reverseLength: number;
}

/** Measure every card button in one section of the open panel. */
async function measureSection(page: any, slug: string, section: string): Promise<CardBox[]> {
  return page
    .locator(`#spell-deck-panel-${slug} [data-section="${section}"] button.spell-card`)
    .evaluateAll((els: Element[]) =>
      els.map((el) => ({
        card: el.getAttribute('data-card') ?? '',
        offsetHeight: (el as HTMLElement).offsetHeight,
        scrollHeight: el.scrollHeight,
        reverseLength: (el.querySelector('.spell-card__reverse')?.textContent ?? '').length,
      }))
    );
}

test.describe('Spell Card Deck — equal height within a section', () => {
  test('every spell is one height, every reference is one height, and no card clips its content', async ({
    page,
  }) => {
    const core = stacks.find((s) => s.pack === 'core')!;
    // Preconditions: the assertion is only meaningful with several cards of
    // genuinely unequal content in each section.
    expect(core.spells.length, 'Core holds several spells').toBeGreaterThan(1);
    expect(core.references.length, 'Core holds several references').toBeGreaterThan(1);

    // Wide enough to be in grid mode, not the <700px carousel.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(spellbookUrl);
    // Same reason as the 320px clipping test: the no-clip assertion below
    // compares a box to its own text, so the real face must be in play.
    await waitForWebfonts(page);

    const spells = await measureSection(page, core.slug, 'spells');
    const references = await measureSection(page, core.slug, 'references');
    expect(spells.length).toBe(core.spells.length);
    expect(references.length).toBe(core.references.length);

    // Every spell card is the same height as every other spell card.
    const spellHeights = [...new Set(spells.map((c) => c.offsetHeight))];
    expect(
      spellHeights,
      `spell heights should agree, got ${JSON.stringify(spells.map((c) => [c.card, c.offsetHeight]))}`
    ).toHaveLength(1);
    expect(spellHeights[0], 'a spell card has a real height').toBeGreaterThan(100);

    // …and every reference card the same as every other reference card. The two
    // groups deliberately need NOT match, so nothing compares them.
    const referenceHeights = [...new Set(references.map((c) => c.offsetHeight))];
    expect(
      referenceHeights,
      `reference heights should agree, got ${JSON.stringify(references.map((c) => [c.card, c.offsetHeight]))}`
    ).toHaveLength(1);
    expect(referenceHeights[0], 'a reference card has a real height').toBeGreaterThan(100);

    // Nothing is clipped or spilled (AC 14 / AC 18).
    for (const box of [...spells, ...references]) {
      expect(
        box.scrollHeight,
        `"${box.card}" fits its box (scroll ${box.scrollHeight} vs offset ${box.offsetHeight})`
      ).toBeLessThanOrEqual(box.offsetHeight);
    }
  });

  test('the card with the most to say still fits once it is turned', async ({ page }) => {
    const core = stacks.find((s) => s.pack === 'core')!;

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(spellbookUrl);

    const spells = await measureSection(page, core.slug, 'spells');
    const longest = spells.reduce((a, b) => (b.reverseLength > a.reverseLength ? b : a));

    // Turning a card is `aria-pressed` — the state the deck's script will set in
    // Step 7 and the state the stylesheet already answers. Set it directly here so
    // the stylesheet is what is under test, not the script that does not exist yet.
    await page.locator(`button.spell-card[data-card="${longest.card}"]`).evaluate((el: Element) => {
      el.setAttribute('aria-pressed', 'true');
    });

    const turned = await measureSection(page, core.slug, 'spells');
    for (const box of turned) {
      expect(
        box.scrollHeight,
        `"${box.card}" fits its box while "${longest.card}" is turned`
      ).toBeLessThanOrEqual(box.offsetHeight);
    }
    // Turning a card changes no measurement — the box already sized to the taller face.
    const turnedHeights = [...new Set(turned.map((c) => c.offsetHeight))];
    expect(turnedHeights, 'the section stays one height while a card is turned').toHaveLength(1);
  });
});

// ==============================
// Section 8 — the sitemap stops at the stacks (Step 10)
//
// This is a CONTENT-STATE regression guard, not a schema one, and that is why it
// earns a test. `IsVisible()` returns TRUE when `umbracoNaviHide` is absent, and
// the two card document types deliberately do not compose Visibility Controls —
// so nothing structural keeps thirty card URLs out of `/sitemap.xml`. What keeps
// them out is the tick on the four stack nodes, which the sitemap partial then
// never descends past. A fifth pack added later without that tick would silently
// leak its cards; this assertion turns that silence into a failing test.
//
// The Spellbook page itself is asserted PRESENT in the same test. Without that
// control, a sitemap that had broken altogether — empty, 500, renamed — would
// satisfy "contains no card URL" perfectly.
// ==============================

test.describe('Spell Card Deck — the sitemap', () => {
  test('lists the Spellbook page and neither its stacks nor its cards', async ({ page }) => {
    const resp = await page.request.get('/sitemap.xml');
    expect(resp.ok(), '/sitemap.xml should be served').toBeTruthy();
    const xml = await resp.text();

    // Every <loc> the sitemap actually emits, reduced to a path.
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
      try {
        return new URL(m[1]).pathname;
      } catch {
        return m[1];
      }
    });
    expect(locs.length, 'the sitemap lists pages at all').toBeGreaterThan(1);

    // Control: the one node in this subtree that MUST be listed.
    expect(
      locs.map((p) => p.replace(/\/$/, '')),
      'the Spellbook page itself is in the sitemap'
    ).toContain(new URL(spellbookUrl, 'https://localhost').pathname.replace(/\/$/, ''));

    // The guard: no stack, and no card beneath one.
    const hidden = await Promise.all(
      stacks.flatMap((stack) => [
        (async () => ({ label: `stack "${stack.name}"`, path: await tryGetDocumentPath(stack.id) }))(),
        ...[...stack.spells, ...stack.references].map(async (card) => ({
          label: `card "${card.name}" under "${stack.name}"`,
          path: await tryGetDocumentPath(card.id),
        })),
      ])
    );
    // The floor is the real roster, derived from the fixture — not a token
    // "more than nothing". A guard that would still pass having checked five of
    // thirty-four URLs is not guarding the thing it claims to.
    const expectedHidden = stacks.length + stacks.reduce((n, s) => n + s.spells.length + s.references.length, 0);
    expect(
      hidden.length,
      `every stack and card is checked (${expectedHidden} nodes)`
    ).toBe(expectedHidden);

    const listed = new Set(locs.map((p) => p.replace(/\/$/, '')));
    for (const node of hidden) {
      if (!node.path) continue; // Unpublished: it could not be in the sitemap anyway.
      const path = new URL(node.path, 'https://localhost').pathname.replace(/\/$/, '');
      expect(listed.has(path), `${node.label} (${path}) must not be in the sitemap`).toBe(false);
    }
  });
});

import { expect } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { randomUUID } from 'crypto';
import {
  apiFetch,
  collectContentNodesByDocType,
  freshToken,
  getDocumentTypeByName,
  TEST_FIXTURE_PREFIX,
  tryGetDocumentPath,
} from '../_umbracoApi';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Spell Card Deck — structural render (Step 5 of _work/spell-cards/plan.md).
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
// (_work/spell-cards/assets/design-v5/README-round-2.md → "Sigil assignment").
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

interface CardFacts {
  id: string;
  name: string;
  slug: string;
  isSpell: boolean;
  mark: string;
  watch: string;
}

interface StackFacts {
  id: string;
  name: string;
  slug: string;
  pack: string;
  spells: CardFacts[];
  references: CardFacts[];
}

let spellbookUrl: string;
let stacks: StackFacts[] = [];
let coreStackId = '';
let spellDocTypeId = '';

/** Last non-empty path segment of a published URL — the node's slug. */
function slugOf(url: string): string {
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/** Read one document's stored property values as a flat alias → value map. */
async function documentValues(id: string): Promise<Record<string, any>> {
  const resp = await apiFetch('GET', `/document/${id}`);
  if (!resp.ok) throw new Error(`GET /document/${id} failed: ${resp.status}`);
  const doc = (await resp.json()) as any;
  const map: Record<string, any> = {};
  for (const v of doc.values ?? []) map[v.alias] = v.value;
  return map;
}

/**
 * A flexible dropdown stores a single-element array (`["explore"]`). Flatten it
 * so the test compares against the key an editor actually picked.
 */
function firstOf(value: any): string {
  if (Array.isArray(value)) return value.length ? String(value[0]) : '';
  return value == null ? '' : String(value);
}

async function treeChildren(parentId: string): Promise<any[]> {
  const resp = await apiFetch('GET', `/tree/document/children?parentId=${parentId}&skip=0&take=100`);
  if (!resp.ok) throw new Error(`GET children of ${parentId} failed: ${resp.status}`);
  return ((await resp.json()) as any).items ?? [];
}

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

  const spellbookDt = await getDocumentTypeByName('Spellbook');
  const stackDt = await getDocumentTypeByName('Spell Card Stack');
  const spellDt = await getDocumentTypeByName('Spell');
  const referenceDt = await getDocumentTypeByName('Reference');
  if (!spellbookDt || !stackDt || !spellDt || !referenceDt) {
    throw new Error('Spell-card document types not found — Step 2 must be shipped.');
  }
  spellDocTypeId = spellDt.id;

  const spellbookNodes = await collectContentNodesByDocType(spellbookDt.id);
  if (spellbookNodes.length === 0) throw new Error('No published Spellbook page — Step 3 must be shipped.');
  const url = await tryGetDocumentPath(spellbookNodes[0].id);
  if (!url) throw new Error('Spellbook page has no published URL.');
  spellbookUrl = url;

  stacks = [];
  for (const stackItem of await treeChildren(spellbookNodes[0].id)) {
    if (stackItem.documentType?.id !== stackDt.id) continue;
    const stackUrl = await tryGetDocumentPath(stackItem.id);
    if (!stackUrl) throw new Error(`Stack "${stackItem.variants?.[0]?.name}" has no published URL.`);
    const stackValues = await documentValues(stackItem.id);

    const spells: CardFacts[] = [];
    const references: CardFacts[] = [];
    for (const cardItem of await treeChildren(stackItem.id)) {
      const isSpell = cardItem.documentType?.id === spellDt.id;
      const isReference = cardItem.documentType?.id === referenceDt.id;
      if (!isSpell && !isReference) continue;
      const cardUrl = await tryGetDocumentPath(cardItem.id);
      if (!cardUrl) continue;
      const values = await documentValues(cardItem.id);
      const facts: CardFacts = {
        id: cardItem.id,
        name: cardItem.variants?.[0]?.name ?? '',
        slug: slugOf(cardUrl),
        isSpell,
        mark: firstOf(values.cardMark),
        watch: firstOf(values.cardWatchFor),
      };
      (isSpell ? spells : references).push(facts);
    }

    stacks.push({
      id: stackItem.id,
      name: stackItem.variants?.[0]?.name ?? '',
      slug: slugOf(stackUrl),
      pack: String(stackValues.stackPack ?? ''),
      spells,
      references,
    });
  }

  if (stacks.length === 0) throw new Error('Spellbook page has no stack children — Step 3 must be shipped.');
  coreStackId = stacks.find((s) => s.pack === 'core')?.id ?? '';
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

import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { freshToken } from '../_umbracoApi';
import {
  readSpellDeck,
  type SpellCardFacts,
  type SpellStackFacts,
} from '../_spellDeckFixture';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Spell Card Deck — deck state (Step 7 of _work/spell-cards/plan.md).
//
// SCOPE. Three behaviours, and nothing else: single-open stacks, per-card flip,
// and the panel's "show all backs" toggle. The URL hash is Step 8 and the
// narrow-viewport carousel is Step 9; neither is asserted here, and the prev /
// next arrows staying inert is correct at this point.
//
// WHAT COUNTS AS "TURNED". Both faces of a card are always in layout — that is
// what gives the card its content-driven height (Step 6) — so a turned card is
// not something `toBeVisible()` can see. What a visitor actually perceives is
// the button's pressed state, the accessible name it reports, and which face
// assistive tech is allowed to read. Those are what this spec asserts.
//
// EXPECTED VALUES ARE SOURCED FROM THE CONTENT TREE, not from the view or from
// the script: stack slugs, which stack is the "core" pack, and how many cards a
// stack holds all come from the Management API. Card copy that the test does
// compare against is read off the page at rest first, so the assertion is that
// the wording CHANGED, not that it equals a string this file predicted.
// ---------------------------------------------------------------------------

let spellbookUrl: string;
let stacks: SpellStackFacts[] = [];

test.beforeAll(async () => {
  await freshToken();
  const deck = await readSpellDeck();
  spellbookUrl = deck.spellbookUrl;
  stacks = deck.stacks;
  if (stacks.length === 0) {
    throw new Error('Spellbook page has no stack children — Step 3 must be shipped.');
  }
});

/** The stack whose pack key is `pack`, failing loudly if the content has moved on. */
function stackByPack(pack: string): SpellStackFacts {
  const found = stacks.find((s) => s.pack === pack);
  expect(found, `a "${pack}" stack should exist in the content tree`).toBeTruthy();
  return found!;
}

const stackButton = (page: Page, slug: string): Locator =>
  page.locator(`.spell-deck button[data-stack="${slug}"]`);

const panel = (page: Page, slug: string): Locator => page.locator(`#spell-deck-panel-${slug}`);

/** A card button, scoped to its own panel — slugs are only unique among siblings. */
const card = (page: Page, stackSlug: string, cardSlug: string): Locator =>
  panel(page, stackSlug).locator(`button.spell-card[data-card="${cardSlug}"]`);

/** A card the visitor can see the details of: pressed, reverse readable, face not. */
async function expectTurned(cardEl: Locator, turned: boolean) {
  await expect(cardEl).toHaveAttribute('aria-pressed', turned ? 'true' : 'false');
  const face = cardEl.locator('.spell-card__face');
  const reverse = cardEl.locator('.spell-card__reverse');
  if (turned) {
    await expect(face, 'the front is hidden from assistive tech once turned').toHaveAttribute(
      'aria-hidden',
      'true'
    );
    await expect(reverse, 'the details become readable once turned').not.toHaveAttribute(
      'aria-hidden',
      'true'
    );
  } else {
    await expect(face, 'the front is readable at rest').not.toHaveAttribute('aria-hidden', 'true');
    await expect(reverse, 'the details are hidden from assistive tech at rest').toHaveAttribute(
      'aria-hidden',
      'true'
    );
  }
}

// ==============================
// Section 1 — one stack open at a time
// ==============================

test.describe('Spell Card Deck — stack disclosure', () => {
  test('arrives with the default stack open and its cards on screen', async ({ page }) => {
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    await expect(panel(page, core.slug)).toBeVisible();
    await expect(stackButton(page, core.slug)).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page, core.slug).locator('button.spell-card')).toHaveCount(
      core.spells.length + core.references.length
    );
    await expect(panel(page, core.slug).locator('button.spell-card').first()).toBeVisible();
  });

  test('opening another stack closes the one that was open, and focus stays on the stack', async ({
    page,
  }) => {
    const core = stackByPack('core');
    const other = stackByPack('umbraco-17');
    await page.goto(spellbookUrl);

    await stackButton(page, other.slug).click();

    await expect(panel(page, other.slug)).toBeVisible();
    await expect(panel(page, other.slug).locator('button.spell-card').first()).toBeVisible();
    await expect(stackButton(page, other.slug)).toHaveAttribute('aria-expanded', 'true');

    await expect(panel(page, core.slug)).toBeHidden();
    await expect(panel(page, core.slug).locator('button.spell-card').first()).toBeHidden();
    await expect(stackButton(page, core.slug)).toHaveAttribute('aria-expanded', 'false');

    // The button is the disclosure; nothing steals focus into the panel it opened.
    await expect(stackButton(page, other.slug)).toBeFocused();
  });

  test('activating the open stack closes it, leaving the row of stacks intact', async ({ page }) => {
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    await stackButton(page, core.slug).click();

    await expect(panel(page, core.slug)).toBeHidden();
    await expect(stackButton(page, core.slug)).toHaveAttribute('aria-expanded', 'false');
    await expect(stackButton(page, core.slug)).toBeFocused();

    // Every stack is still offered, and not one card is on screen.
    const row = page.getByRole('group', { name: 'Card stacks' });
    await expect(row.getByRole('button')).toHaveCount(stacks.length);
    await expect(page.locator('.spell-deck button[data-card]:visible')).toHaveCount(0);
  });

  test('closing from inside the panel returns focus to the stack it belongs to', async ({ page }) => {
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    // The Close stack button lives inside the region that is about to be hidden,
    // so without an explicit return the browser force-blurs to <body> and a
    // keyboard or screen-reader user loses their place entirely.
    await panel(page, core.slug).locator('button[data-action="close-stack"]').click();

    await expect(panel(page, core.slug)).toBeHidden();
    await expect(stackButton(page, core.slug)).toBeFocused();
  });

  test('switching stacks with focus inside the outgoing panel hands focus to the new stack', async ({
    page,
  }) => {
    // The outgoing panel is about to be hidden. If focus is on something inside
    // it, the browser force-blurs to <body> with no announcement and a
    // screen-reader user loses their place.
    const from = stackByPack('core');
    const to = stackByPack('dotnet');

    await page.goto(spellbookUrl);
    await expect(panel(page, from.slug)).toBeVisible();

    const cardInOutgoing = panel(page, from.slug).locator('button.spell-card').first();
    await cardInOutgoing.focus();
    await expect(cardInOutgoing).toBeFocused();

    await stackButton(page, to.slug).click();

    await expect(panel(page, from.slug)).toBeHidden();
    await expect(panel(page, to.slug)).toBeVisible();
    await expect(
      stackButton(page, to.slug),
      'focus lands on the stack just opened, never on <body>'
    ).toBeFocused();
  });
});

// ==============================
// Section 2 — turning a card
// ==============================

test.describe('Spell Card Deck — turning a card', () => {
  test('turning one card shows its details and leaves its neighbour on its front', async ({
    page,
  }) => {
    const core = stackByPack('core');
    expect(core.spells.length, 'Core holds at least two spells').toBeGreaterThan(1);
    const turned = core.spells.find((c) => c.slug === 'plan') ?? core.spells[0];
    const untouched = core.spells.find((c) => c.slug !== turned.slug)!;

    await page.goto(spellbookUrl);

    const target = card(page, core.slug, turned.slug);
    const restName = (await target.getAttribute('aria-label')) ?? '';
    // The title printed on the front of the card — read off the page, so the
    // assertion below does not depend on how the label is assembled.
    const title = ((await target.locator('.spell-card__face-title').textContent()) ?? '').trim();
    expect(restName, 'a card names itself before it is turned').not.toBe('');
    expect(title, 'the card prints a title on its front').not.toBe('');

    await expectTurned(target, false);
    await target.click();
    await expectTurned(target, true);

    // The accessible name now says the card is showing its details, and no longer
    // invites the visitor to turn it to read them.
    const turnedName = (await target.getAttribute('aria-label')) ?? '';
    expect(turnedName, 'the name changes when the card turns').not.toBe(restName);
    expect(turnedName, 'the card still names itself').toContain(title);
    expect(turnedName.toLowerCase(), 'the name says the details are showing').toMatch(
      /showing its details/
    );

    // Its neighbour is untouched.
    await expectTurned(card(page, core.slug, untouched.slug), false);
    await expect(card(page, core.slug, untouched.slug)).toHaveAttribute('aria-label', /Activate/);
  });

  test('a turned card is still turned after a round-trip through another stack', async ({ page }) => {
    const core = stackByPack('core');
    const other = stackByPack('dotnet');
    const turned = core.spells.find((c) => c.slug === 'plan') ?? core.spells[0];

    await page.goto(spellbookUrl);

    await card(page, core.slug, turned.slug).click();
    await expectTurned(card(page, core.slug, turned.slug), true);

    await stackButton(page, other.slug).click();
    await expect(panel(page, other.slug)).toBeVisible();

    await stackButton(page, core.slug).click();
    await expect(panel(page, core.slug)).toBeVisible();

    await expectTurned(card(page, core.slug, turned.slug), true);
  });
});

// ==============================
// Section 3 — turning the whole stack
// ==============================

test.describe('Spell Card Deck — show all backs', () => {
  test('turns every card in the open stack and inverts its own label', async ({ page }) => {
    const stack = stackByPack('dotnet');
    const total = stack.spells.length + stack.references.length;
    expect(total, 'the dotnet stack holds cards to turn').toBeGreaterThan(0);

    await page.goto(spellbookUrl);
    await stackButton(page, stack.slug).click();
    await expect(panel(page, stack.slug)).toBeVisible();

    const toggle = panel(page, stack.slug).locator('button[data-action="flip-all"]');
    const restLabel = ((await toggle.textContent()) ?? '').trim();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();

    const cards = panel(page, stack.slug).locator('button.spell-card');
    await expect(cards).toHaveCount(total);
    await expect(cards.and(page.locator('[aria-pressed="true"]'))).toHaveCount(total);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    const turnedLabel = ((await toggle.textContent()) ?? '').trim();
    expect(turnedLabel, 'the control now offers the other direction').not.toBe(restLabel);
    expect(turnedLabel.toLowerCase(), 'the control offers the fronts back').toMatch(/front/);

    // …and turns them all back.
    await toggle.click();
    await expect(cards.and(page.locator('[aria-pressed="true"]'))).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(((await toggle.textContent()) ?? '').trim()).toBe(restLabel);
  });

  test('the toggle reports the stack it is actually in, not the last button pressed', async ({
    page,
  }) => {
    // The regression: the toggle used to derive its state from its own last
    // click. Turn one card by hand AFTER a bulk turn and the panel sits at
    // n-1 of n while the toggle still announces "show the fronts" — telling a
    // screen-reader user every card is turned when one is not.
    const stack = stackByPack('dotnet');
    const total = stack.spells.length + stack.references.length;
    expect(total, 'this test needs a stack of at least two cards').toBeGreaterThan(1);

    await page.goto(spellbookUrl);
    await stackButton(page, stack.slug).click();

    const scope = panel(page, stack.slug);
    const toggle = scope.locator('button[data-action="flip-all"]');
    const cards = scope.locator('button.spell-card');
    const turnedCards = cards.and(page.locator('[aria-pressed="true"]'));
    const restLabel = ((await toggle.textContent()) ?? '').trim();
    const one = cards.first();

    // One card turned by hand: the panel is mixed, so the toggle must still
    // offer to turn the rest — not claim the stack is already turned.
    await one.click();
    await expect(turnedCards).toHaveCount(1);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(((await toggle.textContent()) ?? '').trim()).toBe(restLabel);

    // Bulk turn from that mixed state reaches all of them.
    await toggle.click();
    await expect(turnedCards).toHaveCount(total);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // …and turning a single card back drops the toggle out of "all turned".
    await one.click();
    await expect(turnedCards).toHaveCount(total - 1);
    await expect(toggle, 'the toggle follows the cards, not its own history').toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(((await toggle.textContent()) ?? '').trim()).toBe(restLabel);
  });

  test('announces a bulk turn, which moves no focus and would otherwise be silent', async ({
    page,
  }) => {
    const stack = stackByPack('dotnet');
    await page.goto(spellbookUrl);
    await stackButton(page, stack.slug).click();

    const scope = panel(page, stack.slug);
    const toggle = scope.locator('button[data-action="flip-all"]');
    const status = scope.locator('[data-flip-all-status]');

    // Empty at render: a live region has to be in the DOM before the update for
    // the update to be announced at all.
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveText('');

    await toggle.click();
    await expect(status).not.toHaveText('');
    const turnedMessage = ((await status.textContent()) ?? '').trim();

    await toggle.click();
    const frontsMessage = ((await status.textContent()) ?? '').trim();
    expect(frontsMessage, 'the two directions read differently').not.toBe(turnedMessage);

    // Focus stays on the toggle — which is why the announcement is needed.
    await expect(toggle).toBeFocused();
  });
});

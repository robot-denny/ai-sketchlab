import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import dotenv from 'dotenv';

import { freshToken } from '../_umbracoApi';
import {
  documentValues,
  pickSpell,
  readSpellDeck,
  type SpellStackFacts,
} from '../_spellDeckFixture';

dotenv.config();

// ---------------------------------------------------------------------------
// Spell Card Deck — the accessibility contract (Step 10 of
// _work/spell-cards/plan.md).
//
// The four earlier deck specs assert what the deck DOES. This one asserts what
// somebody who cannot see it, or cannot use a mouse, or has asked the OS for
// less motion, actually gets: where focus is, what the accessibility tree is
// offered, what each control is called, and that every state change still
// happens when nothing is allowed to move.
//
// THREE THINGS HERE ARE DELIBERATE AND MUST BE ASSERTED, NOT ASSUMED:
//
//  1. FOCUS STAYS ON THE STACK BUTTON when a panel opens. The intuitive
//     alternative — moving focus into the panel — is wrong here: the button is
//     the disclosure, the panel follows it in DOM order, and a panel taller
//     than the viewport scrolled to its own top drags the focused button off
//     screen. Focus RETURNS to the stack button when the panel closes, because
//     the "Close stack" control sits inside the region being hidden and would
//     otherwise force-blur to <body> with nothing announced.
//  2. ONLY THE FACING SIDE IS IN THE ACCESSIBILITY TREE. Both faces are always
//     in layout (that is what equalises the card heights), so `aria-hidden` is
//     the only thing stopping a screen reader reading a card twice. It swaps on
//     every flip.
//  3. NOTHING MOVES UNDER REDUCED MOTION, BUT EVERYTHING STILL CHANGES. The
//     site's global reset (styles.css) collapses `animation-duration` to
//     `0.01ms !important` rather than disabling animation, so "no motion" here
//     is carried by the deck's own rules — `--sig-play: paused`, `animation:
//     none` on the panel, `transition: none` on the flip — each of which this
//     spec measures directly, alongside proof the state changed anyway.
//
// WHY `--sig-play` IS WHAT THE SIGIL ASSERTIONS READ. Every sigil is a `<use>`
// of a sprite `<symbol>`, and the shapes that actually animate live in that
// `<use>`'s shadow tree: `getComputedStyle` cannot reach them and
// `document.getAnimations()` does not report them (verified — it returns only
// the sprite's own paused definitions). The custom property on the CONSUMING
// `<svg>` is the single value that crosses into the shadow tree and decides
// whether the mark runs, so it is both the mechanism and the only observable.
//
// EXPECTED VALUES ARE SOURCED INDEPENDENTLY: stacks, cards and card titles come
// from the Management API via the shared fixture, never from the rendered page.
//
// REDUCED MOTION IS EMULATED WITH `page.emulateMedia()`, NOT
// `test.use({ reducedMotion })` — the latter does not reach the `page` fixture
// supplied by @umbraco/playwright-testhelpers (verified in Step 8: `matchMedia`
// still reported false inside the page).
// ---------------------------------------------------------------------------

/**
 * axe rule families this spec gates on, scoped to `.spell-deck`.
 *
 * Following the discipline in tests/e2e/accessibility/axe.spec.ts: a named list
 * rather than the full rule set, so a pre-existing violation somewhere else on
 * the page cannot gate deck work — and `.include('.spell-deck')` so even a
 * violation in the page header is out of scope. These are the families the
 * deck's own contract can actually break: the ARIA it writes by hand, the
 * accessible name on every icon-only or state-carrying button, the
 * button-inside-button hazard of a card built from nested elements, and the
 * heading rungs of a panel-inside-section-inside-page.
 *
 * `color-contrast` IS DELIBERATELY ABSENT, and adding it would be worse than
 * leaving it out. Scoped to `.spell-deck` on the real page it reports 0
 * violations and 222 of 223 nodes INCOMPLETE: axe cannot resolve the deck's
 * layered near-black planes, so it is not measuring contrast here — it is
 * declining to. Gating on it would buy a permanently green check that proves
 * nothing. Contrast on this component is verified by computing the ratios
 * directly (that is how the 2.47:1 caption and the 4.49:1 Core badge were found
 * and fixed), and it stays a review responsibility rather than a test one. The
 * same behaviour is documented for the site-wide scan in axe.spec.ts.
 */
const DECK_RULES = [
  'aria-allowed-attr',
  'aria-allowed-role',
  'aria-hidden-focus',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'aria-roles',
  'aria-toggle-field-name',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'button-name',
  'empty-heading',
  'heading-order',
  'nested-interactive',
];

/** How many Tab presses a keyboard walk will spend before giving up. */
const MAX_TABS = 120;

let spellbookUrl: string;
let stacks: SpellStackFacts[] = [];

/** The stack that is NOT open on arrival — the one a keyboard walk must open. */
function closedStack(): SpellStackFacts {
  return stacks.find((s) => s.pack === 'umbraco-17') ?? stacks[1];
}

function coreStack(): SpellStackFacts {
  return stacks.find((s) => s.pack === 'core') ?? stacks[0];
}

/** Selector-ish description of whatever currently holds focus. */
async function focusedCard(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute('data-card') ?? null;
  });
}

async function focusedStack(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.classList.contains('spell-deck__stack') ? el.getAttribute('data-stack') : null;
  });
}

/**
 * Press Tab until `probe` reports the thing we are walking to, and fail loudly
 * with what focus landed on instead. Nothing is focused programmatically: the
 * point of the walk is that the control is REACHABLE by keyboard, which
 * `locator.focus()` would quietly assume.
 */
async function tabUntil(
  page: Page,
  probe: (page: Page) => Promise<string | null>,
  wanted: string,
  what: string
): Promise<void> {
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    if ((await probe(page)) === wanted) return;
  }
  const landed = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? `${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 40)}"` : 'null';
  });
  throw new Error(`Tabbed ${MAX_TABS} times without reaching ${what}; focus rests on ${landed}`);
}

/** The title the view puts on a card — `cardTitle`, falling back to the node name. */
async function titleOf(card: { id: string; name: string }): Promise<string> {
  const values = await documentValues(card.id);
  const title = String(values.cardTitle ?? '').trim();
  return title.length ? title : card.name;
}

test.beforeAll(async () => {
  await freshToken();
  const deck = await readSpellDeck();
  spellbookUrl = deck.spellbookUrl;
  stacks = deck.stacks;
  if (stacks.length < 2) {
    throw new Error('The deck needs at least two stacks for the disclosure assertions.');
  }
});

// ==============================
// Section 1 — the keyboard walk
// ==============================

test.describe('Spell Card Deck — keyboard', () => {
  test('a keyboard reaches a closed stack, opens it, and keeps focus on the stack button', async ({
    page,
  }) => {
    const target = closedStack();
    await page.goto(spellbookUrl);

    const button = page.locator(`.spell-deck__stack[data-stack="${target.slug}"]`);
    const panel = page.locator(`#spell-deck-panel-${target.slug}`);
    await expect(panel, 'the target stack starts closed').toBeHidden();

    await tabUntil(page, focusedStack, target.slug, `the "${target.name}" stack button`);
    await page.keyboard.press('Enter');

    // The state change the visitor asked for…
    await expect(panel, 'the stack opens').toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    // …and the deliberate decision: focus does NOT follow the panel.
    await expect(button, 'focus stays on the stack button that opened the panel').toBeFocused();
  });

  test('closing a stack from inside the panel hands focus back to its stack button', async ({
    page,
  }) => {
    const target = closedStack();
    await page.goto(spellbookUrl);

    const button = page.locator(`.spell-deck__stack[data-stack="${target.slug}"]`);
    const panel = page.locator(`#spell-deck-panel-${target.slug}`);

    await tabUntil(page, focusedStack, target.slug, `the "${target.name}" stack button`);
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();

    // The close control sits INSIDE the region about to be hidden, so focus has
    // nowhere to fall unless the deck hands it back.
    await panel.locator('[data-action="close-stack"]').click();

    await expect(panel, 'the stack closes').toBeHidden();
    await expect(button, 'focus returns to the stack button, not to <body>').toBeFocused();
  });

  test('a card reached by keyboard turns in place and keeps focus', async ({ page }) => {
    const stack = coreStack();
    const card = pickSpell(stack, 'code-review');
    await page.goto(spellbookUrl);

    const button = page.locator(
      `#spell-deck-panel-${stack.slug} .spell-card[data-card="${card.slug}"]`
    );
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await tabUntil(page, focusedCard, card.slug, `the "${card.name}" card`);
    await page.keyboard.press('Enter');

    await expect(button, 'the card turns').toHaveAttribute('aria-pressed', 'true');
    await expect(button, 'focus does not move: the button IS the card').toBeFocused();
  });
});

// ==============================
// Section 2 — what the accessibility tree is offered
// ==============================

test.describe('Spell Card Deck — the accessibility tree', () => {
  test('only the facing side of a card is exposed', async ({ page }) => {
    const stack = coreStack();
    const card = pickSpell(stack, 'code-review');
    await page.goto(spellbookUrl);

    const button = page.locator(
      `#spell-deck-panel-${stack.slug} .spell-card[data-card="${card.slug}"]`
    );
    const face = button.locator('.spell-card__face');
    const reverse = button.locator('.spell-card__reverse');

    // At rest: the front is readable, the reverse is not.
    await expect(face, 'the front is offered at rest').not.toHaveAttribute('aria-hidden', 'true');
    await expect(reverse, 'the reverse is withheld at rest').toHaveAttribute('aria-hidden', 'true');

    await button.click();

    // Turned: exactly the other way round. Both faces stay in layout, so this
    // attribute is the only thing that stops the card being read twice.
    await expect(face, 'the front is withheld once turned').toHaveAttribute('aria-hidden', 'true');
    await expect(reverse, 'the reverse is offered once turned').not.toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  test("a card's accessible name states its name, its kind and how to turn it — and changes when turned", async ({
    page,
  }) => {
    const stack = coreStack();
    const spell = pickSpell(stack, 'code-review');
    const reference = stack.references[0];
    expect(reference, 'the Core stack holds at least one reference').toBeTruthy();

    const spellTitle = await titleOf(spell);
    const referenceTitle = await titleOf(reference);

    await page.goto(spellbookUrl);
    const panel = page.locator(`#spell-deck-panel-${stack.slug}`);
    const spellButton = panel.locator(`.spell-card[data-card="${spell.slug}"]`);
    const referenceButton = panel.locator(`.spell-card[data-card="${reference.slug}"]`);

    const restingName = (await spellButton.getAttribute('aria-label')) ?? '';
    // Its name…
    expect(restingName, 'the name carries the card title').toContain(spellTitle);
    // …its kind…
    expect(restingName, 'the name says it is a spell').toMatch(/spell/i);
    // …and how to turn it.
    expect(restingName, 'the name says what activating does').toMatch(/turn/i);

    // The kind is really the card's kind, not a constant.
    const referenceName = (await referenceButton.getAttribute('aria-label')) ?? '';
    expect(referenceName, 'the name carries the reference title').toContain(referenceTitle);
    expect(referenceName, 'a reference is named a reference').toMatch(/reference/i);

    await spellButton.click();

    const turnedName = (await spellButton.getAttribute('aria-label')) ?? '';
    expect(turnedName, 'the name changes when the card is turned').not.toBe(restingName);
    expect(turnedName, 'the turned card is still identified by its title').toContain(spellTitle);
    expect(turnedName, 'the turned card offers the way back').toMatch(/back/i);

    // Playwright's own name computation agrees — i.e. this really is the
    // accessible name and not merely an attribute that happens to be set.
    await expect(spellButton).toHaveAccessibleName(turnedName);
  });

  test('each carousel arrow is named, and names the section it scrolls', async ({ page }) => {
    const stack = coreStack();
    // The arrows only exist as controls below the stylesheet's 700px breakpoint.
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(spellbookUrl);

    const section = page.locator(`#spell-deck-panel-${stack.slug} [data-section="spells"]`);
    const arrows = section.locator('.spell-deck__nav');
    await expect(arrows).toHaveCount(2);

    for (const arrow of await arrows.all()) {
      const name = await arrow.evaluate((el) => el.textContent ?? '');
      expect(name.trim(), 'the chevron is drawn, not written — no text to name it').toBe('');
      await expect(arrow, 'an icon-only arrow still has an accessible name').not.toHaveAccessibleName(
        ''
      );
    }

    // The two arrows are told apart, and both say which section they move.
    await expect(section.locator('.spell-deck__nav[data-scroll="prev"]')).toHaveAccessibleName(
      /spells/i
    );
    await expect(section.locator('.spell-deck__nav[data-scroll="next"]')).toHaveAccessibleName(
      /spells/i
    );
    const prevName = await section
      .locator('.spell-deck__nav[data-scroll="prev"]')
      .getAttribute('aria-label');
    const nextName = await section
      .locator('.spell-deck__nav[data-scroll="next"]')
      .getAttribute('aria-label');
    expect(prevName, 'back and forward are distinguishable by name').not.toBe(nextName);
  });

  test('the flip-all toggle reports the state of the cards it controls', async ({ page }) => {
    const stack = coreStack();
    await page.goto(spellbookUrl);

    const panel = page.locator(`#spell-deck-panel-${stack.slug}`);
    const toggle = panel.locator('[data-action="flip-all"]');
    const status = panel.locator('[data-flip-all-status]');

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Assert the MECHANISM, not only the symptom. Text changing is what a sighted
    // reader gets for free; what makes the change reach a screen reader is the
    // live region itself. Swap this <p> for a plain one and the text would still
    // change, this test would still pass, and the announcement would be dead.
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status, 'nothing has happened yet, so nothing is announced').toHaveText('');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Focus stays on the toggle, so the live region is the only thing that can
    // tell a screen reader the grid below was rewritten.
    await expect(status).not.toHaveText('');

    // Turning ONE card back means the panel is no longer all-backs, and the
    // toggle must say so — it derives its state from the cards, not from its
    // own last click.
    await panel.locator('.spell-card').first().click();
    await expect(
      toggle,
      'the toggle re-derives its state after a single card is turned back'
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

// ==============================
// Section 3 — axe, scoped to the deck
// ==============================

test.describe('Spell Card Deck — axe', () => {
  async function scanDeck(page: Page, label: string) {
    const results = await new AxeBuilder({ page })
      .include('.spell-deck')
      .withRules(DECK_RULES)
      .analyze();

    const ids = results.violations.map((v: { id: string }) => v.id);
    for (const v of results.violations) {
      console.log(`[axe deck ${label}]   ${v.id} x${v.nodes.length} — ${v.help}`);
      for (const node of v.nodes) console.log(`[axe deck ${label}]     ${node.html.slice(0, 200)}`);
    }
    expect(results.violations, `axe violations on the deck (${label}): ${JSON.stringify(ids)}`).toEqual(
      []
    );
  }

  test('the deck with a stack open has no violations', async ({ page }) => {
    const stack = coreStack();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(spellbookUrl);
    await expect(page.locator(`#spell-deck-panel-${stack.slug}`)).toBeVisible();
    await scanDeck(page, 'stack open');
  });

  test('the deck with a card turned has no violations', async ({ page }) => {
    const stack = coreStack();
    const card = pickSpell(stack, 'code-review');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(spellbookUrl);
    await page
      .locator(`#spell-deck-panel-${stack.slug} .spell-card[data-card="${card.slug}"]`)
      .click();
    await scanDeck(page, 'card turned');
  });

  test('the deck below the breakpoint, where the carousel arrows appear, has no violations', async ({
    page,
  }) => {
    // The two scans above run wide, where the arrows are hidden by CSS. Narrow is
    // a materially different DOM to axe: two more live buttons per section, sat
    // beside the card buttons. That adjacency is where a `nested-interactive` or
    // `button-name` regression would most plausibly land, and it is the one state
    // the wide scans can never see.
    const stack = coreStack();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(spellbookUrl);
    await expect(page.locator(`#spell-deck-panel-${stack.slug}`)).toBeVisible();
    await expect(
      page.locator(`#spell-deck-panel-${stack.slug} .spell-deck__nav`).first(),
      'the arrows are on screen at this width, so axe is scanning them'
    ).toBeVisible();
    await scanDeck(page, 'narrow, arrows visible');
  });
});

// ==============================
// Section 4 — reduced motion: everything changes, nothing moves
// ==============================

/** The gate value that reaches a `<use>` shadow tree — see the header. */
async function sigPlay(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--sig-play').trim());
}

test.describe('Spell Card Deck — reduced motion', () => {
  test('a stack opens and a card turns with nothing animating', async ({ page }) => {
    const target = closedStack();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(spellbookUrl);

    // Precondition — the emulation actually reached the page. `test.use({
    // reducedMotion })` does NOT, which is why this is emulateMedia.
    expect(
      await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      'the page sees the reduced-motion preference'
    ).toBe(true);

    // ---- every state change still happens ----
    const button = page.locator(`.spell-deck__stack[data-stack="${target.slug}"]`);
    const panel = page.locator(`#spell-deck-panel-${target.slug}`);
    await button.click();
    await expect(panel, 'the stack still opens').toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    const card = panel.locator('.spell-card').first();
    await card.click();
    await expect(card, 'the card still turns').toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('.spell-card__face'), 'the front is still withheld').toHaveAttribute(
      'aria-hidden',
      'true'
    );
    await expect(
      card.locator('.spell-card__reverse'),
      'the reverse is still offered'
    ).not.toHaveAttribute('aria-hidden', 'true');

    // ---- and nothing moves ----

    // The panel does not animate in. `animation-name: none` is what carries
    // this: the site's global reset only COLLAPSES the duration, so a deck that
    // relied on the reset alone would still run the keyframes.
    await expect(panel).toHaveCSS('animation-name', 'none');

    // The flip has no transition at all, for the same reason.
    await expect(panel.locator('.spell-card__inner').first()).toHaveCSS(
      'transition-property',
      'none'
    );

    // No sigil runs — not on the open stack tile, and not on a spell card,
    // which are the only two places motion is ever lifted.
    expect(
      await sigPlay(page, `.spell-deck__stack[data-stack="${target.slug}"] .spell-sigil`),
      'the open stack tile’s mark is paused'
    ).toBe('paused');
    expect(
      await sigPlay(page, `#spell-deck-panel-${target.slug} .spell-card--spell .spell-sigil`),
      'a spell’s mark is paused'
    ).toBe('paused');
  });

  test('with motion allowed the same marks do run — so the assertions above discriminate', async ({
    page,
  }) => {
    const stack = coreStack();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(spellbookUrl);

    expect(
      await sigPlay(page, `.spell-deck__stack[data-stack="${stack.slug}"] .spell-sigil`),
      'the open stack tile’s mark runs when motion is allowed'
    ).toBe('running');
    expect(
      await sigPlay(page, `#spell-deck-panel-${stack.slug} .spell-card--spell .spell-sigil`),
      'a spell’s mark runs when motion is allowed'
    ).toBe('running');
    await expect(page.locator(`#spell-deck-panel-${stack.slug} .spell-card__inner`).first()).toHaveCSS(
      'transition-property',
      'transform'
    );
  });
});

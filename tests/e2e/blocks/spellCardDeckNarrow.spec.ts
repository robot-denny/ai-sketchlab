import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { freshToken } from '../_umbracoApi';
import { readSpellDeck, type SpellStackFacts } from '../_spellDeckFixture';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Spell Card Deck — the narrow-viewport carousel (Step 9 of
// _work/spell-cards/plan.md).
//
// SCOPE. What a section's cards do on a phone: one horizontally scrollable,
// snapped row instead of a long single column, driven by the prev/next arrows
// Step 5 emitted and Step 6 styled. Above the single 700px breakpoint the same
// row is a grid and the arrows are gone. Nothing else about the deck is
// re-asserted here — single-open stacks are Step 7's spec, deep links are
// Step 8's.
//
// WHAT "ONE PRESS ADVANCES ONE CARD" IS MEASURED AGAINST. The expected distance
// is READ OFF THE PAGE at assertion time — the rendered width of the row's first
// card plus the row's own computed `column-gap` — never a literal. The card is
// `clamp(240px, 82vw, 360px)` wide, so a hardcoded number would encode one
// viewport and silently stop meaning anything at another. Sourcing it from the
// DOM is also what makes the assertion independent of the implementation, which
// measures the same two things through a different path.
//
// WHY EVERY SCROLL ASSERTION SETTLES FIRST. `scrollBy` is smooth, so `scrollLeft`
// read straight after a click is a frame partway through an animation. Worse,
// Playwright's auto-retrying assertions will happily pass on that intermediate
// frame and never notice the row kept moving. `settledScrollLeft()` waits for the
// value to stop changing, so every measurement below is of the position the
// visitor is actually left in. Step 8 shipped a test that passed against a broken
// implementation for exactly this reason.
//
// TWO DIFFERENT "NOTHING HAPPENS" CASES, AND THEY ARE NOT THE SAME BUG.
//   * At either end of a row that CAN scroll, both arrows stay ENABLED and the
//     press is a harmless no-op — the browser clamps `scrollLeft`. Disabling at
//     the ends would mean recomputing on every scroll event for a signal the row
//     already gives the visitor.
//   * A section that cannot scroll AT ALL — one card — DISABLES both arrows,
//     because a live control that can never do anything is a different and worse
//     thing than a control that is momentarily at a limit. `umbraco-cloud` is the
//     live fixture: one spell and one reference, so both its sections hold
//     exactly one card.
//
// EXPECTED VALUES COME FROM THE CONTENT TREE. Stack slugs are read from the
// Management API through the shared fixture, so a content edit cannot turn a
// carousel test red without a carousel change.
// ---------------------------------------------------------------------------

const PHONE = { width: 390, height: 844 };
const SMALL_PHONE = { width: 320, height: 780 };
const DESKTOP = { width: 1200, height: 900 };

/** The one layout breakpoint in spell-cards.css. Below it, carousel; at or above it, grid. */
const GRID_BREAKPOINT = 700;

let spellbookUrl: string;
let stacks: SpellStackFacts[] = [];

test.beforeAll(async () => {
  await freshToken();
  const deck = await readSpellDeck();
  spellbookUrl = deck.spellbookUrl;
  stacks = deck.stacks;
  if (stacks.length < 2) {
    throw new Error('The carousel spec needs at least two stacks — Step 3 must be shipped.');
  }
});

function stackByPack(pack: string): SpellStackFacts {
  const found = stacks.find((s) => s.pack === pack);
  expect(found, `a "${pack}" stack should exist in the content tree`).toBeTruthy();
  return found!;
}

const stackButton = (page: Page, slug: string): Locator =>
  page.locator(`.spell-deck button[data-stack="${slug}"]`);

const panel = (page: Page, slug: string): Locator => page.locator(`#spell-deck-panel-${slug}`);

const section = (page: Page, slug: string, kind: 'spells' | 'references'): Locator =>
  panel(page, slug).locator(`.spell-deck__section[data-section="${kind}"]`);

const cardRow = (page: Page, slug: string, kind: 'spells' | 'references'): Locator =>
  section(page, slug, kind).locator('.spell-deck__card-row');

const navButton = (
  page: Page,
  slug: string,
  kind: 'spells' | 'references',
  dir: 'prev' | 'next'
): Locator => section(page, slug, kind).locator(`.spell-deck__nav[data-scroll="${dir}"]`);

/** Fail the test on any uncaught page error, so "throws nothing" is a real claim. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/**
 * `scrollLeft` once it has stopped moving. See the header: a smooth scroll makes
 * every immediate read a lie, and an auto-retrying assertion will believe it.
 */
async function settledScrollLeft(row: Locator): Promise<number> {
  return row.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        let last = el.scrollLeft;
        let still = 0;
        const tick = () => {
          if (el.scrollLeft === last) still += 1;
          else {
            still = 0;
            last = el.scrollLeft;
          }
          if (still >= 5) resolve(el.scrollLeft);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })
  );
}

interface ScrollByCall {
  behavior: string;
  left: number;
}

/**
 * Record every `scrollBy` the page asks for, with the distance and the behaviour
 * it requested. Installed before any script runs.
 *
 * NEEDED BECAUSE THE SETTLED POSITION CANNOT SEE A SMALL ERROR. The row is
 * `scroll-snap-type: x mandatory`, so the browser pulls any landing within half a
 * card onto the nearest snap point — which quietly repairs a request that was
 * short by the gap. The settled-position assertions are still the ones that
 * matter to a visitor; this is what holds the implementation to measuring rather
 * than guessing. Same technique the Step 8 spec uses for `scrollIntoView`, and
 * for the same reason: the request leaves no other trace.
 */
async function recordScrollBy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__deckScrollBys = [];
    const native = Element.prototype.scrollBy;
    Element.prototype.scrollBy = function (this: Element, arg?: any) {
      (window as any).__deckScrollBys.push({
        behavior: arg && typeof arg === 'object' ? String(arg.behavior) : String(arg),
        left: arg && typeof arg === 'object' ? Number(arg.left) : NaN,
      });
      return (native as any).apply(this, arguments as any);
    };
  });
}

async function scrollByCalls(page: Page): Promise<ScrollByCall[]> {
  return (await page.evaluate(() => (window as any).__deckScrollBys ?? [])) as ScrollByCall[];
}

interface RowMetrics {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  gap: number;
  firstCardWidth: number;
  cardWidths: number[];
  cardTops: number[];
  cardLefts: number[];
  rowLeft: number;
}

async function rowMetrics(row: Locator): Promise<RowMetrics> {
  return row.evaluate((el) => {
    const items = Array.from(el.querySelectorAll('.spell-deck__card-item')) as HTMLElement[];
    const rects = items.map((i) => i.getBoundingClientRect());
    const gap = parseFloat(getComputedStyle(el).columnGap);
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollLeft: el.scrollLeft,
      gap: Number.isNaN(gap) ? 0 : gap,
      firstCardWidth: rects.length ? rects[0].width : 0,
      cardWidths: rects.map((r) => r.width),
      cardTops: rects.map((r) => Math.round(r.top + el.scrollTop)),
      cardLefts: rects.map((r) => r.left),
      rowLeft: el.getBoundingClientRect().left,
    };
  });
}

// ==============================
// Section 1 — a phone gets one scrollable row
// ==============================

test.describe('Spell Card Deck — the card row on a phone', () => {
  test.use({ viewport: PHONE });

  test('the open stack shows its spells as one scrollable row, arrows and all', async ({ page }) => {
    const core = stackByPack('core');
    await page.goto(spellbookUrl);
    await expect(panel(page, core.slug)).toBeVisible();

    const row = cardRow(page, core.slug, 'spells');
    const m = await rowMetrics(row);

    expect(m.cardWidths.length, 'Core holds several spells to scroll through').toBeGreaterThan(2);

    // ONE row, not a stack: every card shares a top edge.
    expect(new Set(m.cardTops).size, 'all the cards sit on one line').toBe(1);

    // …and that line is longer than the screen, so there is somewhere to go.
    expect(m.scrollWidth, 'the row overflows its own box').toBeGreaterThan(m.clientWidth);

    // AC 21: the card floor is a viewport unit, so nothing can exceed the screen.
    for (const w of m.cardWidths) {
      expect(w, 'no card is wider than the viewport').toBeLessThanOrEqual(PHONE.width);
    }

    await expect(navButton(page, core.slug, 'spells', 'prev')).toBeVisible();
    await expect(navButton(page, core.slug, 'spells', 'next')).toBeVisible();
  });

  test('one press of next advances exactly one card', async ({ page }) => {
    const core = stackByPack('core');
    await recordScrollBy(page);
    await page.goto(spellbookUrl);
    const row = cardRow(page, core.slug, 'spells');

    const before = await rowMetrics(row);
    const startedAt = await settledScrollLeft(row);
    // Expected distance read off the page, not written down: card width + gap.
    const expected = before.firstCardWidth + before.gap;
    expect(expected, 'a card and a gap are both measurable').toBeGreaterThan(0);

    // Where the second card sits before the press — it is the one that should
    // come to rest where the first card is now.
    const secondCardOffset = before.cardLefts[1] - before.cardLefts[0];

    await navButton(page, core.slug, 'spells', 'next').click();
    const landedAt = await settledScrollLeft(row);

    expect(
      Math.abs(landedAt - startedAt - expected),
      `one press moves one card width plus the gap (${expected}px), not ${landedAt - startedAt}px`
    ).toBeLessThanOrEqual(2);

    // The visitor-visible half of the same claim: card two is now where card one was.
    const after = await rowMetrics(row);
    expect(
      Math.abs(after.cardLefts[1] - (before.cardLefts[0] + (secondCardOffset - expected))),
      'the second card comes to rest at the row start'
    ).toBeLessThanOrEqual(2);

    // AND THE DISTANCE THE PRESS ASKED FOR, which the two assertions above
    // cannot see. `scroll-snap-type: x mandatory` pulls any landing within half
    // a card of a snap point onto it, so the settled position stays correct even
    // if the requested distance is wrong by, say, the gap — verified by mutation:
    // dropping the gap from the implementation left both assertions above green.
    // Snapping is a safety net, not the contract. The contract is "measured, not
    // guessed", and the request is the only place it is observable.
    const asks = await scrollByCalls(page);
    expect(asks.length, 'the press asked the row to scroll exactly once').toBe(1);
    expect(
      Math.abs(asks[0].left - expected),
      `the press asked for one card width plus the gap (${expected}px), not ${asks[0].left}px`
    ).toBeLessThanOrEqual(1);
  });

  test('a press at the far end moves nothing, throws nothing, and stays enabled', async ({
    page,
  }) => {
    const core = stackByPack('core');
    const errors = watchForErrors(page);
    await page.goto(spellbookUrl);
    const row = cardRow(page, core.slug, 'spells');

    await row.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const atEnd = await settledScrollLeft(row);
    expect(atEnd, 'the row really did travel to its end').toBeGreaterThan(0);

    const next = navButton(page, core.slug, 'spells', 'next');
    // No disabled state at the ends — the browser clamping the scroll is the
    // whole mechanism, and the row itself is the signal to the visitor.
    await expect(next).toBeEnabled();
    await next.click();

    expect(
      Math.abs((await settledScrollLeft(row)) - atEnd),
      'a press past the last card goes nowhere'
    ).toBeLessThanOrEqual(1);
    expect(errors, 'and raises nothing').toEqual([]);
    await expect(next, 'and the control is still live').toBeEnabled();
  });

  test('a press at the first card moves nothing, throws nothing, and stays enabled', async ({
    page,
  }) => {
    const core = stackByPack('core');
    const errors = watchForErrors(page);
    await page.goto(spellbookUrl);
    const row = cardRow(page, core.slug, 'spells');

    const atStart = await settledScrollLeft(row);

    const prev = navButton(page, core.slug, 'spells', 'prev');
    await expect(prev).toBeEnabled();
    await prev.click();

    expect(
      Math.abs((await settledScrollLeft(row)) - atStart),
      'a press before the first card goes nowhere'
    ).toBeLessThanOrEqual(1);
    expect(errors, 'and raises nothing').toEqual([]);
    await expect(prev, 'and the control is still live').toBeEnabled();
  });

  test('the arrows honour a reduced-motion preference, and still advance one card', async ({
    page,
  }) => {
    // Behaviour 7 reuses behaviour 6's WATCHED preference rather than sampling
    // `matchMedia` a second time. Smooth-versus-instant is negotiated inside the
    // browser and leaves no other trace, so the request itself is recorded —
    // the same technique the Step 8 spec uses for `scrollIntoView`.
    //
    // Emulated here rather than through `test.use({ reducedMotion })`, which the
    // testhelpers' own `page` fixture does not carry through.
    const core = stackByPack('core');
    await recordScrollBy(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(spellbookUrl);

    const row = cardRow(page, core.slug, 'spells');
    const before = await rowMetrics(row);
    const startedAt = await settledScrollLeft(row);

    await navButton(page, core.slug, 'spells', 'next').click();
    const landedAt = await settledScrollLeft(row);

    const calls = await scrollByCalls(page);
    expect(calls.length, 'the press asked the row to scroll').toBe(1);
    expect(calls[0].behavior, 'and asked for it instantly').toBe('auto');

    // The state change still happens — only the animation is dropped.
    expect(
      Math.abs(landedAt - startedAt - (before.firstCardWidth + before.gap)),
      'reduced motion still advances exactly one card'
    ).toBeLessThanOrEqual(2);
  });

  test('a section holding a single card disables both its arrows', async ({ page }) => {
    // Being at an end is momentary; having nowhere to go at all is permanent,
    // and offering a live control for it is what the Step 6 review flagged.
    const single = stackByPack('umbraco-cloud');
    expect(single.spells.length, 'the umbraco-cloud fixture holds one spell').toBe(1);
    expect(single.references.length, 'and one reference').toBe(1);

    await page.goto(spellbookUrl);
    await stackButton(page, single.slug).click();
    await expect(panel(page, single.slug)).toBeVisible();

    for (const kind of ['spells', 'references'] as const) {
      const m = await rowMetrics(cardRow(page, single.slug, kind));
      expect(m.cardWidths.length, `the ${kind} section holds one card`).toBe(1);
      // "Cannot scroll" is measured in CARDS, not in pixels. A single 82vw card
      // in a container narrower than the viewport leaves a couple of dozen
      // pixels of slack, so `scrollWidth > clientWidth` is TRUE here and is not
      // the question — there is still no second card to advance to.
      expect(
        m.scrollWidth - m.clientWidth,
        `the ${kind} row holds less than one card of travel`
      ).toBeLessThan(m.firstCardWidth);
      await expect(navButton(page, single.slug, kind, 'prev')).toBeDisabled();
      await expect(navButton(page, single.slug, kind, 'next')).toBeDisabled();
    }

    // …while a section that CAN scroll keeps both of its arrows live.
    const core = stackByPack('core');
    await stackButton(page, core.slug).click();
    await expect(panel(page, core.slug)).toBeVisible();
    await expect(navButton(page, core.slug, 'spells', 'prev')).toBeEnabled();
    await expect(navButton(page, core.slug, 'spells', 'next')).toBeEnabled();
  });

  test('the arrow keeps focus across the press, so it can be pressed again', async ({ page }) => {
    // The arrows are a repeatable control: a keyboard user presses next several
    // times in a row. The row scrolls beneath them, and the nav is a DOM sibling
    // AFTER the row rather than inside it, so nothing should move the arrow or
    // take focus off it — but that is a guarantee worth pinning, not assuming.
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    const next = navButton(page, core.slug, 'spells', 'next');
    const row = cardRow(page, core.slug, 'spells');

    await next.focus();
    await page.keyboard.press('Enter');
    await settledScrollLeft(row);

    await expect(next, 'focus stays on the arrow that was pressed').toBeFocused();
    await expect(next, 'and the arrow is still on screen to press again').toBeInViewport();

    // Pressing again from the keyboard advances a second time, which is only
    // possible because focus never left.
    const before = await settledScrollLeft(row);
    await page.keyboard.press('Enter');
    const after = await settledScrollLeft(row);
    expect(after, 'a second keyboard press advances again').toBeGreaterThan(before);
  });

  test('scrolling the row changes nothing about the cards themselves', async ({ page }) => {
    // A library carousel would manage `aria-hidden`, `tabindex` or `inert` on
    // off-screen slides. This one must not: every card already carries a
    // per-face `aria-hidden` contract, and a second system writing that
    // attribute on the same subtree is how those contracts get broken.
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    const snapshot = () =>
      page.locator(`#spell-deck-panel-${core.slug} [data-section="spells"] .spell-card`).evaluateAll(
        (els) =>
          els.map((el) => ({
            card: el.getAttribute('data-card'),
            pressed: el.getAttribute('aria-pressed'),
            hidden: el.getAttribute('aria-hidden'),
            tabIndex: (el as HTMLElement).tabIndex,
            inert: el.hasAttribute('inert'),
            faceHidden: el.querySelector('.spell-card__face')?.getAttribute('aria-hidden') ?? null,
            reverseHidden:
              el.querySelector('.spell-card__reverse')?.getAttribute('aria-hidden') ?? null,
          }))
      );

    const before = await snapshot();
    expect(before.length, 'Core holds spells to scroll past').toBeGreaterThan(1);

    const row = cardRow(page, core.slug, 'spells');
    await navButton(page, core.slug, 'spells', 'next').click();
    await settledScrollLeft(row);
    await navButton(page, core.slug, 'spells', 'next').click();
    await settledScrollLeft(row);

    expect(await snapshot(), 'every card reads the same after scrolling past it').toEqual(before);
  });
});

// ==============================
// Section 2 — above the breakpoint there is no carousel
// ==============================

test.describe('Spell Card Deck — the same row on a desktop', () => {
  test.use({ viewport: DESKTOP });

  test('the cards are a grid and no carousel control is offered', async ({ page }) => {
    expect(DESKTOP.width, 'this viewport is above the one breakpoint').toBeGreaterThanOrEqual(
      GRID_BREAKPOINT
    );
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    const row = cardRow(page, core.slug, 'spells');
    const m = await rowMetrics(row);

    // A grid wraps; the carousel row does not.
    expect(new Set(m.cardTops).size, 'the cards wrap onto more than one line').toBeGreaterThan(1);
    expect(m.scrollWidth, 'and nothing scrolls sideways').toBeLessThanOrEqual(m.clientWidth + 1);

    await expect(navButton(page, core.slug, 'spells', 'prev')).toBeHidden();
    await expect(navButton(page, core.slug, 'spells', 'next')).toBeHidden();
    await expect(navButton(page, core.slug, 'references', 'prev')).toBeHidden();
    await expect(navButton(page, core.slug, 'references', 'next')).toBeHidden();
  });
});

// ==============================
// Section 3 — the narrowest screen the deck claims to support
// ==============================

test.describe('Spell Card Deck — 320px', () => {
  test.use({ viewport: SMALL_PHONE });

  test('the stack row still shows two stacks per line', async ({ page }) => {
    // AC 20: the row's floor is a percentage, not a flat 176px, precisely so it
    // cannot silently collapse to one-up on a small phone.
    await page.goto(spellbookUrl);

    // Columns, not tops: the open stack LIFTS a few pixels, so two tiles on the
    // same line do not share a `top`. Their left edges are what the grid decides.
    const lefts = await page
      .locator('.spell-deck__row .spell-deck__stack')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));

    expect(lefts.length, 'four stacks are on the page').toBe(4);
    const perColumn = new Map<number, number>();
    for (const l of lefts) perColumn.set(l, (perColumn.get(l) ?? 0) + 1);
    expect(perColumn.size, 'the row is two columns wide, not one').toBe(2);
    for (const [, count] of perColumn) {
      expect(count, 'so four stacks make two lines of two').toBe(2);
    }
  });

  test('a flipped card shows its whole reverse without clipping', async ({ page }) => {
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    const card = panel(page, core.slug).locator('button.spell-card').first();
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');

    const box = await card.evaluate((el) => {
      const reverse = el.querySelector('.spell-card__reverse') as HTMLElement;
      const cardRect = el.getBoundingClientRect();
      const revRect = reverse.getBoundingClientRect();
      return {
        cardWidth: cardRect.width,
        cardScrollHeight: el.scrollHeight,
        cardOffsetHeight: (el as HTMLElement).offsetHeight,
        revWidth: revRect.width,
        revHeight: revRect.height,
        revScrollHeight: reverse.scrollHeight,
        revOverflowBottom: revRect.bottom - cardRect.bottom,
        revOverflowRight: revRect.right - cardRect.right,
      };
    });

    expect(box.revWidth, 'the reverse is laid out').toBeGreaterThan(0);
    expect(box.cardWidth, 'the card fits the screen').toBeLessThanOrEqual(SMALL_PHONE.width);
    expect(box.cardScrollHeight, 'the card is tall enough for the face it is showing')
      .toBeLessThanOrEqual(box.cardOffsetHeight + 1);
    expect(box.revScrollHeight, 'and the reverse itself is not scrolling inside it')
      .toBeLessThanOrEqual(Math.ceil(box.revHeight) + 1);
    // 2px, not 0: the faces share one grid cell and their edges land on
    // sub-pixel boundaries at this width. Real clipping is what the two
    // scrollHeight assertions above catch.
    expect(box.revOverflowBottom, 'nothing spills out of the bottom').toBeLessThanOrEqual(2);
    expect(box.revOverflowRight, 'nothing spills out of the side').toBeLessThanOrEqual(2);
  });
});

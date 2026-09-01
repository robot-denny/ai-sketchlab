import { expect, type Locator, type Page } from '@playwright/test';
import { test } from '@umbraco/playwright-testhelpers';
import { freshToken } from '../_umbracoApi';
import { pickSpell, readSpellDeck, type SpellStackFacts } from '../_spellDeckFixture';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Spell Card Deck — deep links and scroll-into-view (Step 8 of
// _work/spell-cards/plan.md).
//
// SCOPE. What the URL says about the deck, what a pasted URL restores, and
// whether the thing the link names ends up on screen. Single-open stacks,
// per-card flip and flip-all are Step 7's spec and are only used here as the
// actions that move the URL; the narrow-viewport carousel is Step 9 and the
// prev/next arrows staying inert is still correct.
//
// THE HASH IS NAMESPACED — `#deck/<stack>` and `#deck/<stack>/<card>`. The
// `deck/` prefix is load-bearing: this repo emits slugified in-page anchors on
// guide and styleguide pages, and a bare `#core` could collide with one. These
// tests assert the whole hash, prefix included, for that reason.
//
// WHY history.length IS ASSERTED. The rule is `replaceState`, never
// `pushState` — thirty flips must not fill the back button. "The back button
// still works" is not observable from inside one page, but the entry count is,
// and it is exactly what a swap to `pushState` would move.
//
// HOW "SCROLLED INTO VIEW" IS ASSERTED. Two ways, because they answer
// different questions. Whether the target ends up on screen is asserted with
// `toBeInViewport()` — that is the visitor-visible outcome. Which *behavior*
// the scroll asked for is asserted from a recording of the `scrollIntoView`
// calls, because smooth-versus-instant is negotiated inside the browser and
// leaves no other trace; the reduced-motion branch has no observable surface
// otherwise.
//
// EXPECTED VALUES COME FROM THE CONTENT TREE. Stack slugs and card slugs are
// read from the Management API through the shared fixture, so a content edit
// cannot turn a link test red without a link change. The one string this file
// does invent is a deliberately ABSENT key, and it asserts its absence first.
// ---------------------------------------------------------------------------

let spellbookUrl: string;
let stacks: SpellStackFacts[] = [];

test.beforeAll(async () => {
  await freshToken();
  const deck = await readSpellDeck();
  spellbookUrl = deck.spellbookUrl;
  stacks = deck.stacks;
  if (stacks.length < 2) {
    throw new Error('The deep-link spec needs at least two stacks — Step 3 must be shipped.');
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

const card = (page: Page, stackSlug: string, cardSlug: string): Locator =>
  panel(page, stackSlug).locator(`button.spell-card[data-card="${cardSlug}"]`);

/** The fragment of the current URL, `#` included — '' when there is none. */
function hashOf(page: Page): string {
  const url = new URL(page.url());
  return url.hash;
}

/** Fail the test on any uncaught page error, so "does not error" is a real claim. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

interface ScrollCall {
  behavior: string;
  stack: string | null;
  card: string | null;
}

/**
 * Record every `scrollIntoView` the page makes, with the behaviour it asked
 * for. Installed before any script runs so the deck's own load-time scroll is
 * captured. The native call still happens — the page really does scroll.
 */
async function recordScrolls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: ScrollCall[] = [];
    (window as any).__deckScrolls = calls;
    const native = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, arg?: any) {
      calls.push({
        behavior: arg && typeof arg === 'object' ? String(arg.behavior) : String(arg),
        stack: this.getAttribute ? this.getAttribute('data-stack') : null,
        card: this.getAttribute ? this.getAttribute('data-card') : null,
      });
      return (native as any).apply(this, arguments as any);
    };
  });
}

async function scrollCalls(page: Page): Promise<ScrollCall[]> {
  return (await page.evaluate(() => (window as any).__deckScrolls ?? [])) as ScrollCall[];
}

// ==============================
// Section 1 — the URL follows what the visitor does
// ==============================

test.describe('Spell Card Deck — the URL follows the deck', () => {
  test('opening a stack names it in the URL and brings its panel into view', async ({ page }) => {
    const other = stackByPack('umbraco-17');
    await recordScrolls(page);
    await page.goto(spellbookUrl);

    await stackButton(page, other.slug).click();

    await expect(panel(page, other.slug)).toBeVisible();
    expect(hashOf(page)).toBe(`#deck/${other.slug}`);
    await expect(panel(page, other.slug)).toBeInViewport();

    const calls = await scrollCalls(page);
    expect(
      calls.some((c) => c.stack === other.slug),
      'opening a stack scrolls its own panel, not something else'
    ).toBe(true);
  });

  test('turning a card names it in the URL, and turning it back drops it', async ({ page }) => {
    const core = stackByPack('core');
    const target = pickSpell(core, 'code-review');

    await page.goto(spellbookUrl);
    const cardEl = card(page, core.slug, target.slug);

    await cardEl.click();
    await expect(cardEl).toHaveAttribute('aria-pressed', 'true');
    expect(hashOf(page)).toBe(`#deck/${core.slug}/${target.slug}`);

    // The hash carries ONE card, so it names the card the visitor last turned
    // face-up. Turning that card back leaves nothing for it to name.
    await cardEl.click();
    await expect(cardEl).toHaveAttribute('aria-pressed', 'false');
    expect(hashOf(page)).toBe(`#deck/${core.slug}`);
  });

  test('the hash names the card most recently turned face-up', async ({ page }) => {
    const core = stackByPack('core');
    expect(core.spells.length, 'Core holds at least two spells').toBeGreaterThan(1);
    const first = core.spells[0];
    const second = core.spells[1];

    await page.goto(spellbookUrl);

    await card(page, core.slug, first.slug).click();
    expect(hashOf(page)).toBe(`#deck/${core.slug}/${first.slug}`);

    await card(page, core.slug, second.slug).click();
    expect(hashOf(page)).toBe(`#deck/${core.slug}/${second.slug}`);

    // Both are still turned — the hash is a pointer to the last one opened,
    // not a record of the panel.
    await expect(card(page, core.slug, first.slug)).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, core.slug, second.slug)).toHaveAttribute('aria-pressed', 'true');
  });

  test('turning the whole stack names the stack, since no one card is meant', async ({ page }) => {
    const stack = stackByPack('dotnet');
    await page.goto(spellbookUrl);
    await stackButton(page, stack.slug).click();
    expect(hashOf(page)).toBe(`#deck/${stack.slug}`);

    await panel(page, stack.slug).locator('button[data-action="flip-all"]').click();
    expect(hashOf(page)).toBe(`#deck/${stack.slug}`);
  });

  test('closing the open stack leaves the bare deck hash and nothing open', async ({ page }) => {
    const core = stackByPack('core');
    await page.goto(spellbookUrl);

    await panel(page, core.slug).locator('button[data-action="close-stack"]').click();

    await expect(panel(page, core.slug)).toBeHidden();
    expect(hashOf(page)).toBe('#deck');
    await expect(page.locator('.spell-deck .spell-deck__panel:visible')).toHaveCount(0);
  });

  test('a deck full of flips does not fill the back button', async ({ page }) => {
    // Every hash write must be a replaceState. This is the assertion that
    // fails the moment someone reaches for pushState instead.
    const core = stackByPack('core');
    const other = stackByPack('dotnet');
    const toFlip = core.spells.slice(0, 5);
    expect(toFlip.length, 'Core has cards to flip').toBeGreaterThan(1);

    await page.goto(spellbookUrl);
    const before = await page.evaluate(() => history.length);
    const urlBefore = page.url();

    for (const c of toFlip) {
      await card(page, core.slug, c.slug).click();
      await expect(card(page, core.slug, c.slug)).toHaveAttribute('aria-pressed', 'true');
    }
    await stackButton(page, other.slug).click();
    await expect(panel(page, other.slug)).toBeVisible();
    await panel(page, other.slug).locator('button[data-action="close-stack"]').click();
    await expect(panel(page, other.slug)).toBeHidden();

    // The writes really happened — otherwise the count below proves nothing.
    expect(page.url(), 'the URL moved during those seven actions').not.toBe(urlBefore);
    expect(hashOf(page)).toBe('#deck');

    const after = await page.evaluate(() => history.length);
    expect(after, 'seven deck actions added no history entries').toBe(before);
  });
});

// ==============================
// Section 2 — a pasted link restores the deck
// ==============================

test.describe('Spell Card Deck — arriving on a link', () => {
  test('a link to a card opens its stack, turns that card and scrolls it into view', async ({
    page,
  }) => {
    const core = stackByPack('core');
    const target = pickSpell(core, 'code-review');
    const errors = watchForErrors(page);
    await recordScrolls(page);

    await page.goto(`${spellbookUrl}#deck/${core.slug}/${target.slug}`);

    const cardEl = card(page, core.slug, target.slug);
    await expect(panel(page, core.slug)).toBeVisible();
    await expect(stackButton(page, core.slug)).toHaveAttribute('aria-expanded', 'true');
    await expect(cardEl).toHaveAttribute('aria-pressed', 'true');
    await expect(cardEl.locator('.spell-card__reverse')).not.toHaveAttribute('aria-hidden', 'true');

    // The thing the link names is what the visitor is looking at.
    await expect(cardEl).toBeInViewport({ ratio: 0.5 });

    // …and only that card was turned.
    await expect(
      panel(page, core.slug).locator('button.spell-card[aria-pressed="true"]')
    ).toHaveCount(1);
    expect(errors, 'a deep link raises no page error').toEqual([]);
  });

  test('a link to a stack opens it and brings the panel into view', async ({ page }) => {
    const target = stackByPack('umbraco-cloud');
    const core = stackByPack('core');
    await recordScrolls(page);

    await page.goto(`${spellbookUrl}#deck/${target.slug}`);

    await expect(panel(page, target.slug)).toBeVisible();
    await expect(panel(page, core.slug)).toBeHidden();
    await expect(panel(page, target.slug)).toBeInViewport();
    await expect(
      panel(page, target.slug).locator('button.spell-card[aria-pressed="true"]')
    ).toHaveCount(0);
  });

  test('a link to an unknown stack leaves the default stack open and raises no error', async ({
    page,
  }) => {
    const core = stackByPack('core');
    const absent = 'sitecore';
    expect(
      stacks.some((s) => s.slug === absent),
      `"${absent}" must not be a real stack for this test to mean anything`
    ).toBe(false);
    const errors = watchForErrors(page);

    await page.goto(`${spellbookUrl}#deck/${absent}`);

    await expect(panel(page, core.slug), 'the server-rendered default stands').toBeVisible();
    await expect(stackButton(page, core.slug)).toHaveAttribute('aria-expanded', 'true');
    expect(errors, 'an unknown stack key is ignored, not thrown on').toEqual([]);
  });

  test('a link to an unknown card still opens the stack, every card on its front', async ({
    page,
  }) => {
    const core = stackByPack('core');
    const absent = 'not-a-card';
    expect(
      [...core.spells, ...core.references].some((c) => c.slug === absent),
      `"${absent}" must not be a real card for this test to mean anything`
    ).toBe(false);
    const errors = watchForErrors(page);

    await page.goto(`${spellbookUrl}#deck/${core.slug}/${absent}`);

    await expect(panel(page, core.slug)).toBeVisible();
    await expect(
      panel(page, core.slug).locator('button.spell-card[aria-pressed="true"]'),
      'an unknown card key turns nothing'
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the bare deck hash arrives with nothing open — the round trip of closing', async ({
    page,
  }) => {
    const core = stackByPack('core');
    await page.goto(`${spellbookUrl}#deck`);

    await expect(panel(page, core.slug)).toBeHidden();
    await expect(page.locator('.spell-deck .spell-deck__panel:visible')).toHaveCount(0);
    await expect(stackButton(page, core.slug)).toHaveAttribute('aria-expanded', 'false');
  });

  test('a hash change opens what it names without turning back what the visitor turned', async ({
    page,
  }) => {
    // Back / forward and an edited fragment both arrive as `hashchange`. The
    // hash can only carry one card, so treating it as a complete description
    // of the panel would destroy state the visitor built by hand.
    const core = stackByPack('core');
    const other = stackByPack('dotnet');
    const byHand = core.spells[0];
    const named = core.spells[1];

    await page.goto(spellbookUrl);
    await card(page, core.slug, byHand.slug).click();
    await expect(card(page, core.slug, byHand.slug)).toHaveAttribute('aria-pressed', 'true');

    await page.evaluate((h) => {
      window.location.hash = h;
    }, `deck/${other.slug}`);
    await expect(panel(page, other.slug)).toBeVisible();
    await expect(panel(page, core.slug)).toBeHidden();

    await page.evaluate((h) => {
      window.location.hash = h;
    }, `deck/${core.slug}/${named.slug}`);

    await expect(panel(page, core.slug)).toBeVisible();
    await expect(card(page, core.slug, named.slug)).toHaveAttribute('aria-pressed', 'true');
    await expect(
      card(page, core.slug, byHand.slug),
      'the card the visitor turned by hand survives a hash change'
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

// ==============================
// Section 3 — motion
// ==============================

test.describe('Spell Card Deck — scroll motion', () => {
  test('scrolls smoothly by default', async ({ page }) => {
    const target = stackByPack('umbraco-17');
    await recordScrolls(page);
    await page.goto(spellbookUrl);

    await stackButton(page, target.slug).click();
    await expect(panel(page, target.slug)).toBeInViewport();

    const calls = await scrollCalls(page);
    expect(calls.length, 'opening a stack scrolls').toBeGreaterThan(0);
    expect(calls[calls.length - 1].behavior).toBe('smooth');
  });

  test('scrolls instantly when the visitor has asked for less motion', async ({ page }) => {
    // Emulated here rather than through `test.use({ reducedMotion })`, which the
    // testhelpers' own `page` fixture does not carry through — verified: the
    // media query still reported `false` inside the page.
    const core = stackByPack('core');
    const target = pickSpell(core, 'code-review');
    await recordScrolls(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto(`${spellbookUrl}#deck/${core.slug}/${target.slug}`);
    await expect(card(page, core.slug, target.slug)).toBeInViewport({ ratio: 0.5 });

    const calls = await scrollCalls(page);
    expect(calls.length, 'a deep link still scrolls').toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.behavior, 'no smooth scrolling under a reduced-motion preference').toBe('auto');
    }
  });

  test('honours a motion preference switched on after the page loaded', async ({ page }) => {
    // The preference is watched, not sampled once at init — an OS-level change
    // mid-session has to reach the next scroll.
    const first = stackByPack('umbraco-17');
    const second = stackByPack('dotnet');
    await recordScrolls(page);
    await page.goto(spellbookUrl);

    await stackButton(page, first.slug).click();
    await expect(panel(page, first.slug)).toBeInViewport();
    expect((await scrollCalls(page)).pop()?.behavior).toBe('smooth');

    await page.emulateMedia({ reducedMotion: 'reduce' });

    await stackButton(page, second.slug).click();
    await expect(panel(page, second.slug)).toBeInViewport();
    expect(
      (await scrollCalls(page)).pop()?.behavior,
      'the next scroll after the preference changes is instant'
    ).toBe('auto');
  });
});

// ==============================
// Regressions this step introduced and the review caught
// ==============================

/**
 * How much of the focused element is on screen, AFTER the scroll has settled.
 *
 * The settle is the whole point. `toBeInViewport()` retries until it passes, so
 * asserting it straight after a click succeeds on the frame before a smooth
 * scroll has carried the button away — the assertion is true, briefly, and then
 * stops being true. Waiting for scrollY to stop moving is what makes this
 * measure the state the visitor is actually left in.
 */
async function focusVisibilityAfterScroll(page: Page): Promise<number> {
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        let last = window.scrollY;
        let still = 0;
        const tick = () => {
          if (window.scrollY === last) still += 1;
          else { still = 0; last = window.scrollY; }
          if (still >= 3) resolve(true);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    undefined,
    { timeout: 5000 }
  );
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return -1;
    const r = el.getBoundingClientRect();
    if (!r.height) return -1;
    const shown = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    return shown / r.height;
  });
}

test.describe('Spell Card Deck — the control you just used stays on screen', () => {
  // Not Core: Core is already the open stack on arrival, so activating it never
  // scrolls far enough to expose the bug. A stack further down the row, whose
  // panel is taller than the viewport, is where a panel-anchored scroll drags
  // the focused button off screen entirely (WCAG 2.4.7).
  test('opening a stack leaves the focused button on screen', async ({ page }) => {
    const stack = stackByPack('dotnet');
    await page.goto(spellbookUrl);

    await stackButton(page, stack.slug).click();
    await expect(panel(page, stack.slug)).toBeVisible();
    await expect(stackButton(page, stack.slug)).toBeFocused();

    const shown = await focusVisibilityAfterScroll(page);
    expect(shown, 'most of the focused button is still on screen once the scroll settles')
      .toBeGreaterThan(0.5);
  });

  test('closing a stack leaves the focused button on screen', async ({ page }) => {
    const stack = stackByPack('umbraco-17');
    await page.goto(spellbookUrl);

    await stackButton(page, stack.slug).click();
    await expect(panel(page, stack.slug)).toBeVisible();
    await stackButton(page, stack.slug).click();
    await expect(panel(page, stack.slug)).toBeHidden();

    const shown = await focusVisibilityAfterScroll(page);
    expect(shown, 'the button that closed the stack is still on screen').toBeGreaterThan(0.5);
  });
});

test.describe('Spell Card Deck — a fragment that goes away', () => {
  test('going back past a deck hash closes the deck, so the URL and the page agree', async ({
    page,
  }) => {
    const core = stackByPack('core');
    const target = pickSpell(core, 'code-review');

    await page.goto(spellbookUrl);
    // A real push, which is what an edited URL bar or an in-page anchor produces.
    // The deck's own writes are replaceState and never land in history.
    await page.evaluate((h) => {
      window.location.hash = h;
    }, `deck/${core.slug}/${target.slug}`);
    await expect(card(page, core.slug, target.slug)).toHaveAttribute('aria-pressed', 'true');

    await page.goBack();

    expect(new URL(page.url()).hash, 'the fragment is gone').toBe('');
    await expect(
      panel(page, core.slug),
      'and the deck agrees with it rather than staying open'
    ).toBeHidden();
    await expect(stackButton(page, core.slug)).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Spell Card Deck — a fragment nobody could have meant', () => {
  const MALFORMED = [
    { hash: '#deck/x%22%5D', why: 'a quote would close the attribute selector early' },
    { hash: '#deck/core/%', why: 'a bare percent is not decodable' },
    { hash: '#deck/core/a%22%5D', why: 'the same quote in the card segment' },
  ];

  for (const { hash, why } of MALFORMED) {
    test(`${hash} is ignored rather than thrown on — ${why}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto(spellbookUrl + hash);

      expect(errors, 'a pasted link must never throw').toEqual([]);
      // The deck still works: the server-rendered default is untouched and the
      // row is still live.
      await expect(page.locator('.spell-deck__panel:not([hidden])')).toHaveCount(1);
    });
  }
});

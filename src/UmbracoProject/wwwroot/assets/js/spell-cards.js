/**
 * spell-cards.js — Deck state for the Spell Card Deck block.
 *
 * Behaviours:
 *  1. Single-open stacks — activating a closed stack opens it and closes the one
 *     that was open; activating the open stack closes it and leaves the row of
 *     stacks alone. `aria-expanded` on the stack button and `hidden` on its panel
 *     both track that state.
 *  2. Focus discipline — focus stays on the stack button that was activated and
 *     never moves into the panel (the button is the disclosure, and the panel
 *     follows it in DOM order, so a screen reader reaches it on the next read).
 *     The panel's own "Close stack" button lives INSIDE the region that is about
 *     to be re-hidden, so it must hand focus back to its stack button explicitly
 *     — otherwise the browser force-blurs to <body> with no announcement.
 *  3. Per-card flip — a card button toggles `aria-pressed`, swaps `aria-hidden`
 *     between its two faces so assistive tech never reads both, and rewrites its
 *     accessible name to say the details are showing. Focus does not move: the
 *     button IS the card.
 *  4. Flip all — the panel header's toggle turns every card in that stack and
 *     inverts its own label. Focus does not move.
 *  5. Deep links — the deck's state lives in a NAMESPACED hash, `#deck/<stack>`
 *     and `#deck/<stack>/<card>`. A fragment never reaches the server, so it
 *     cannot create a crawlable duplicate of the host page, cannot interact with
 *     the URL Tracker's 301 rules, and cannot be mistaken for a server-read param
 *     like the `?page=` used elsewhere in this repo. The `deck/` prefix is not
 *     decoration: this repo emits slugified in-page anchors on guide and
 *     styleguide pages, and the deck is a block that may one day sit on one — a
 *     bare `#core` could collide with a TOC anchor, and no slugified heading
 *     anchor ever contains `/`. Writes always go through `history.replaceState`,
 *     NEVER `pushState`: thirty flips must not fill the back button. Read on load
 *     and on `hashchange`, so a pasted link and browser back/forward both work.
 *  6. Scroll on open — opening a stack brings its panel into view, and arriving
 *     on a link brings the thing the link names into view. This is the one place
 *     the script does something other than set an attribute, and the one place a
 *     `prefers-reduced-motion` listener is needed: `scrollIntoView` picks
 *     `'smooth'` or `'auto'` in JavaScript, and the global CSS motion reset
 *     cannot reach it. The preference is watched, not sampled once, so a mid-
 *     session OS change is honoured — the same pattern as carousel.js.
 *  7. The narrow-viewport carousel — below the stylesheet's one 700px
 *     breakpoint a section's cards are a scroll-snap row, and the prev/next
 *     arrows advance it by exactly one card. THE DISTANCE IS MEASURED, NOT
 *     GUESSED: the rendered width of the row's first card plus the row's own
 *     computed column gap, read at click time. The card is
 *     `clamp(240px, 82vw, 360px)`, so any constant here would be correct at one
 *     viewport and wrong at every other. `scrollBy` picks its behaviour from the
 *     same watched preference as behaviour 6.
 *
 *     NOT A CAROUSEL LIBRARY. Neither of the repo's two carousels fits: Swiffy
 *     Slider is scroll-snap based but dormant, and Bootstrap 5 Carousel is a
 *     different interaction model — autoplay is wrong on a reading surface, it
 *     would need destroying and re-initialising on every crossing of a
 *     breakpoint the design crosses by changing `display` alone, and it manages
 *     focus and `aria-hidden` on off-screen slides, which would fight the
 *     per-face `aria-hidden` contract every card here already carries. Two
 *     systems toggling `aria-hidden` on one subtree is a hazard, not a saving.
 *     What is reused is carousel.js's CONVENTIONS — the live reduced-motion
 *     listener, `aria-label` as the whole accessible name of an icon-only
 *     button, its naming style — not the library.
 *
 *     TWO DIFFERENT "NOTHING HAPPENS" CASES, RESOLVED DIFFERENTLY:
 *       * AT EITHER END of a row that CAN scroll, both arrows stay ENABLED. The
 *         browser clamps `scrollLeft`, so the press is a harmless no-op, and
 *         disabling on reaching an end would mean recomputing on every scroll
 *         event for a signal the row already gives the visitor.
 *       * A SECTION THAT CANNOT SCROLL AT ALL — one card, so there is no second
 *         card to advance to — gets `disabled` on both arrows. A live control
 *         that can never do anything is a different and worse thing than a
 *         control momentarily at a limit. `umbraco-cloud` is the live case: one
 *         spell and one reference, so both its sections hold exactly one card.
 *
 * FOUR RULINGS THE HASH NEEDED, BECAUSE IT CARRIES LESS THAN THE DECK HOLDS:
 *   * WHICH CARD IT NAMES. The one the visitor last turned FACE-UP. Turn a
 *     second card and the hash moves to it; turning ANY card back down clears
 *     the card segment to `#deck/<stack>`, even if a different card is still
 *     turned — checking whether the one turned down was the named one would mean
 *     tracking which card that was, and this file keeps no such record. A bulk
 *     flip-all names no single card, so it writes the stack alone. The hash is a
 *     pointer to the last thing opened, not a record of the panel.
 *   * A `hashchange` IS NOT DESTRUCTIVE — for a hash that NAMES something. It
 *     opens the stack it names and turns the card it names face-up, and it turns
 *     NOTHING back: one card in the hash cannot describe a panel of sixteen, so
 *     reading it as a complete description would throw away state the visitor
 *     built by hand. A fragment that has been CLEARED is different, and does
 *     close the deck — Back past a hash must not leave the address bar and the
 *     page disagreeing.
 *   * WHAT GETS SCROLLED IS WHATEVER HOLDS FOCUS. Opening a stack by click
 *     scrolls the BUTTON to the top of the viewport, not the panel: the button
 *     is what focus is on, and scrolling a taller-than-the-viewport panel to its
 *     own top drags that button off screen and takes a keyboard user's focus
 *     ring with it. The panel follows the row in DOM order, so anchoring the
 *     button at the top brings the panel up behind it. On the load path nothing
 *     holds focus, so there the LINK'S OWN TARGET is scrolled — a card `center`
 *     (arrive with its context around it), a stack `nearest` (move as little as
 *     the visitor needs).
 *   * THE HASH IS ONLY WRITTEN IN RESPONSE TO AN ACTION. Loading the page bare
 *     leaves the URL bare, and an unrecognised key is ignored rather than
 *     silently rewritten — an unknown stack leaves the server-rendered default
 *     open, an unknown card still opens its stack with every card on its front.
 *
 * CONSTRAINT THIS ACCEPTS: one deck per page. Two decks would share the hash.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO:
 *   * No bookkeeping for "a flip survives a stack round-trip". All four panels
 *     are server-rendered and closing one only sets `hidden`, so the DOM never
 *     goes away and per-card state persists for free.
 *   * No styles, classes or transforms. The whole visual turn, the panel reveal
 *     and their reduced-motion handling live in spell-cards.css and key off the
 *     attributes set here — `aria-pressed` on a card, `aria-expanded` on a stack.
 *     There is also no height measurement: `grid-auto-rows: 1fr` equalises the
 *     cards in CSS, and a JS fallback would fight it. `scrollIntoView` and
 *     `scrollBy` are the only exceptions, and they are scrolls, not styles. The
 *     carousel adds no class and no transform either: which layout a card row is
 *     in is the stylesheet's 700px media query alone, and this file never asks.
 */

(function () {
  'use strict';

  /**
   * The label the flip-all toggle wears while the cards are turned. Its RESTING
   * label is not duplicated here — it is read off the button the view rendered.
   */
  var SHOW_FRONTS_LABEL = 'Show all fronts';

  /**
   * The namespace every deck fragment carries. See behaviour 5 in the header for
   * why a bare `#<stack-slug>` is not safe on a page that also emits heading
   * anchors.
   */
  var HASH_PREFIX = 'deck';

  /** One card and its caption — the unit the carousel advances by. */
  var CARD_ITEM = '.spell-deck__card-item';

  var HASH_LEAD = /^#/;
  /** The alphabet the view's SafeKey emits — see safeSegment(). */
  var SAFE_SLUG = /^[a-z0-9-]+$/;

  /**
   * Whether the visitor has asked for less motion. WATCHED, not sampled once —
   * an OS preference flipped mid-session must reach the next scroll. Same shape
   * as carousel.js, which is the house pattern for this.
   *
   * Declared here but WIRED in initSpellDecks(), after the early return: this
   * script loads on every page of the site, and a page with no deck should not
   * be left holding a media-query listener it will never read. The cost today is
   * a fraction of a millisecond — the point is that the early return stays the
   * first thing that happens, so it is still true when something more expensive
   * is added here later.
   */
  var prefersReducedMotion = false;

  function watchReducedMotion() {
    if (!window.matchMedia) return;
    var query = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = query.matches;
    if (query.addEventListener) {
      query.addEventListener('change', function (e) {
        prefersReducedMotion = e.matches;
      });
    }
  }

  /**
   * Bring an element into view. `block` is 'nearest' for a panel (move as little
   * as the visitor needs) and 'center' for a card (arrive with its neighbours
   * around it); `inline: 'nearest'` keeps the narrow-viewport card row from
   * sliding sideways as a side effect.
   */
  function scrollIntoViewport(el, block) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: block,
      inline: 'nearest'
    });
  }

  /**
   * Advance one card row by exactly one card, forward (`dir` 1) or back (-1).
   *
   * The distance is MEASURED at click time, never written down: the rendered
   * width of the row's first card plus the row's own computed column gap. The
   * card is `clamp(240px, 82vw, 360px)` and the gap is a stylesheet value, so a
   * constant here would be right at one viewport and wrong at every other, and
   * would go stale the day either number changes in CSS.
   *
   * At either end the browser clamps `scrollLeft` and the press does nothing —
   * deliberately, and it is why the arrows carry no disabled state at the ends.
   */
  function scrollSection(row, dir) {
    if (!row || typeof row.scrollBy !== 'function') return;
    var item = row.querySelector(CARD_ITEM);
    if (!item) return;

    var gap = parseFloat(window.getComputedStyle(row).columnGap);
    if (isNaN(gap)) gap = 0; // `normal` on a non-grid, non-flex row.
    var step = item.getBoundingClientRect().width + gap;
    if (!step) return;

    row.scrollBy({
      left: dir * step,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  /**
   * Enable or disable one section's arrows, from what the row can actually do.
   *
   * TRAVEL IS COUNTED IN CARDS, NOT PIXELS. A single card is `82vw` inside a
   * container narrower than the viewport, so a one-card row overflows by a few
   * dozen pixels and `scrollWidth > clientWidth` is TRUE for it — that test
   * alone would leave both arrows live on a section with nowhere to go. What
   * makes a row scrollable is a second card to reach.
   *
   * A CLOSED PANEL IS NOT MEASURABLE. `hidden` means `display: none`, so every
   * dimension reads zero; measuring then would disable the arrows of every stack
   * that merely happens to be shut. Bail instead and re-derive when it opens.
   */
  function canSectionScroll(section) {
    var row = section.row;
    if (!row.clientWidth) return null; // Closed panel: not measurable, leave alone.
    return row.querySelectorAll(CARD_ITEM).length > 1 && row.scrollWidth - row.clientWidth > 1;
  }

  /**
   * Sync every section's arrows in ONE pass: read all the geometry first, then
   * write all the `disabled` flags. Reading and writing per section in turn
   * makes the browser re-flush layout before each following read, and the whole
   * point of doing this in a rAF is to pay for layout once.
   */
  function syncSections(sections) {
    var states = [];
    for (var i = 0; i < sections.length; i++) {
      states.push(canSectionScroll(sections[i]));
    }
    for (var j = 0; j < sections.length; j++) {
      if (states[j] === null) continue;
      var disabled = !states[j];
      sections[j].navs.forEach(function (btn) {
        btn.disabled = disabled;
      });
    }
  }

  /**
   * The deck state the current fragment describes, or null when the fragment is
   * absent or belongs to somebody else (a TOC anchor on a host page — leave it
   * alone rather than treating it as a deck instruction).
   *
   * `{ stack: '', card: '' }` is the meaningful empty case: a bare `#deck`, i.e.
   * "nothing open", which is exactly what closing every stack writes.
   */
  function parseHash() {
    var raw = (window.location.hash || '').replace(HASH_LEAD, '');
    if (!raw) return null;
    var parts = raw.split('/');
    if (parts[0] !== HASH_PREFIX) return null;

    var stack = safeSegment(parts[1]);
    var card = safeSegment(parts[2]);

    // A segment that was PRESENT but unusable is an unrecognised key, and the
    // rule for those is "leave the server-rendered default alone". Only a
    // segment that was genuinely ABSENT means the bare `#deck` that closes
    // everything — so the two must not both arrive here as ''.
    if (parts[1] && !stack) return null;
    if (parts[2] && !card) return null;

    return { stack: stack, card: card };
  }

  /**
   * One segment of the fragment, reduced to something safe to put in a selector.
   *
   * The fragment is the only visitor-authored input this script touches; every
   * other slug it handles was read off server-rendered markup, where the view's
   * own SafeKey already reduced it to [a-z0-9-]. So hold the fragment to that
   * same alphabet, and treat anything else as absent. Two real crashes otherwise:
   * a `"` closes the attribute selector early and querySelector throws
   * SyntaxError, and a stray `%` makes decodeURIComponent throw URIError. Both
   * would break the deep link on a pasted or mangled link while the page looked
   * fine — and both contradict this file's own rule that an unrecognised key is
   * ignored rather than thrown on.
   */
  function safeSegment(raw) {
    if (!raw) return '';
    var decoded;
    try {
      decoded = decodeURIComponent(raw);
    } catch (e) {
      return '';
    }
    return SAFE_SLUG.test(decoded) ? decoded : '';
  }

  /**
   * Record the deck's state in the URL. ALWAYS `replaceState` — `pushState`
   * would leave a back button holding one entry per flip, and assigning to
   * `location.hash` pushes too.
   */
  function writeHash(stackSlug, cardSlug) {
    if (!window.history || !window.history.replaceState) return;
    var hash = '#' + HASH_PREFIX;
    if (stackSlug) {
      hash += '/' + stackSlug;
      if (cardSlug) hash += '/' + cardSlug;
    }
    if (window.location.hash === hash) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
  }

  function isPressed(el) {
    return el.getAttribute('aria-pressed') === 'true';
  }

  /**
   * The accessible name for a turned card, DERIVED from the resting name the view
   * rendered rather than rebuilt from scratch — so a copy change in the view
   * cannot silently desync the two halves of the label.
   *
   * The resting name is "<title> — <Kind> card. <instruction>"; keep everything up
   * to the last sentence break (the card's identity) and swap the instruction.
   */
  function detailsName(restName) {
    var split = restName.lastIndexOf('. ');
    var subject = split >= 0 ? restName.slice(0, split + 1) : restName;
    return subject + ' Showing its details. Activate to turn the card back.';
  }

  /** Hide an element from assistive tech, or stop hiding it. */
  function setHiddenFromAT(el, hidden) {
    if (!el) return;
    if (hidden) {
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('aria-hidden');
    }
  }

  function initDeck(deck) {
    var stackButtons = deck.querySelectorAll('.spell-deck__stack[data-stack]');
    var panels = deck.querySelectorAll('.spell-deck__panel[data-stack]');
    if (!stackButtons.length || !panels.length) return;

    /**
     * Every card row in this deck with a pair of arrows, filled in as the panels
     * are wired below. Held so a stack opening — or the window resizing — can
     * re-derive which of those arrows can still do anything.
     */
    var sections = [];
    var navSyncQueued = false;

    /**
     * Re-derive every measurable section's arrow state, ONE FRAME LATER.
     *
     * Deferred on purpose. Both callers do layout-affecting work in the same
     * tick — opening a stack unhides a panel and then smooth-scrolls it into
     * view; a resize is a storm of them — and reading `scrollWidth` alongside
     * that would force a second synchronous layout pass on the very rows being
     * animated. The frame also debounces the resize to one pass per paint.
     */
    function syncSectionNavs() {
      if (!window.requestAnimationFrame) {
        syncSections(sections);
        return;
      }
      if (navSyncQueued) return;
      navSyncQueued = true;
      window.requestAnimationFrame(function () {
        navSyncQueued = false;
        syncSections(sections);
      });
    }

    /** Open exactly one stack, or pass null to close them all. */
    function showStack(slug) {
      stackButtons.forEach(function (btn) {
        btn.setAttribute(
          'aria-expanded',
          btn.getAttribute('data-stack') === slug ? 'true' : 'false'
        );
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-stack') !== slug;
      });
      // The panel that just became visible is measurable for the first time.
      syncSectionNavs();
    }

    function panelFor(slug) {
      return deck.querySelector('.spell-deck__panel[data-stack="' + slug + '"]');
    }

    function cardFor(stackSlug, cardSlug) {
      var panel = panelFor(stackSlug);
      return panel ? panel.querySelector('.spell-card[data-card="' + cardSlug + '"]') : null;
    }

    /**
     * Per-stack turners, filled in as the panels are wired below, so a deep link
     * can turn a card through the SAME path a click takes rather than reaching in
     * and setting attributes itself. A map of functions, not of state: nothing
     * about which card is turned is stored anywhere but the DOM.
     */
    var turnCardIn = {};

    // ------------------------------------------------------------------
    // 1. The stack row
    // ------------------------------------------------------------------
    stackButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        var slug = btn.getAttribute('data-stack');
        showStack(isOpen ? null : slug);
        btn.focus();

        if (isOpen) {
          writeHash('', '');
        } else {
          writeHash(slug, '');
          // Scroll the BUTTON, not the panel. The button is what holds focus, and
          // a panel taller than the viewport scrolled to its own top drags the
          // focused button off the screen entirely — a keyboard user loses their
          // focus ring on the commonest interaction in the deck (WCAG 2.4.7).
          // Anchoring the button at the top of the viewport keeps the ring visible
          // AND brings the panel into view, because the panel follows the row in
          // DOM order and fills everything below it.
          scrollIntoViewport(btn, 'start');
        }
      });
    });

    // ------------------------------------------------------------------
    // 2. Inside each panel: the cards, the flip-all toggle, the close button
    // ------------------------------------------------------------------
    panels.forEach(function (panel) {
      var slug = panel.getAttribute('data-stack');
      var cards = panel.querySelectorAll('.spell-card[data-card]');
      var flipAll = panel.querySelector('[data-action="flip-all"]');
      var closeBtn = panel.querySelector('[data-action="close-stack"]');

      // Collected so the flip-all toggle can turn every card through the same
      // path a single click takes — one definition of "turned", not two.
      var turners = [];

      // The resting label is the view's copy; read it rather than restate it.
      var restLabel = flipAll ? flipAll.textContent : '';
      var status = panel.querySelector('[data-flip-all-status]');

      // The toggle's own state is DERIVED from the cards it controls, never from
      // its own last click. Deriving it from its own state goes stale the moment a
      // card is turned individually afterwards: the panel sits at fifteen-of-
      // sixteen while the toggle still announces "Show all fronts", i.e. claims a
      // state the panel is not in. Re-derived after every turn, bulk or single, so
      // it cannot drift — and with no stored map, which the design forbids because
      // the DOM is already the state.
      function syncFlipAll() {
        if (!flipAll) return;
        var allTurned = cards.length > 0;
        for (var i = 0; i < cards.length; i++) {
          if (!isPressed(cards[i])) { allTurned = false; break; }
        }
        flipAll.setAttribute('aria-pressed', allTurned ? 'true' : 'false');
        flipAll.textContent = allTurned ? SHOW_FRONTS_LABEL : restLabel;
      }

      // Card slug → its turn function, so a deep link reaches the one definition
      // of "turned" instead of writing attributes of its own.
      var turnBySlug = {};

      cards.forEach(function (card) {
        var restName = card.getAttribute('aria-label') || '';
        var turnedName = detailsName(restName);
        var face = card.querySelector('.spell-card__face');
        var reverse = card.querySelector('.spell-card__reverse');

        function turn(turned) {
          card.setAttribute('aria-pressed', turned ? 'true' : 'false');
          card.setAttribute('aria-label', turned ? turnedName : restName);
          setHiddenFromAT(face, turned);
          setHiddenFromAT(reverse, !turned);
        }

        turners.push(turn);
        turnBySlug[card.getAttribute('data-card')] = turn;

        card.addEventListener('click', function () {
          var turned = !isPressed(card);
          turn(turned);
          syncFlipAll();
          // The hash names the card just turned face-up; turning one back leaves
          // it nothing to name, so it falls to the stack.
          writeHash(slug, turned ? card.getAttribute('data-card') : '');
        });
      });

      turnCardIn[slug] = function (cardSlug) {
        var turn = turnBySlug[cardSlug];
        if (!turn) return false;
        turn(true);
        syncFlipAll();
        return true;
      };

      if (flipAll) {
        flipAll.addEventListener('click', function () {
          var showBacks = !isPressed(flipAll);
          turners.forEach(function (turn) {
            turn(showBacks);
          });
          syncFlipAll();

          // A bulk turn means no single card, so the hash names the stack alone.
          writeHash(slug, '');

          // Focus stays on the toggle, so without this a screen reader hears only
          // the button's own new label — nothing says the grid below was rewritten.
          if (status) {
            var count = turners.length === 1 ? '1 card' : turners.length + ' cards';
            status.textContent = showBacks
              ? 'Showing details for all ' + count + '.'
              : 'Showing fronts for all ' + count + '.';
          }
        });
      }

      // ----------------------------------------------------------------
      // The carousel arrows, one pair per section. Nothing here touches focus
      // or `aria-hidden` on an off-screen card: each card already carries a
      // per-face `aria-hidden` contract, and a second system writing that
      // attribute on the same subtree is how those contracts get broken.
      // ----------------------------------------------------------------
      panel.querySelectorAll('.spell-deck__section').forEach(function (sectionEl) {
        var row = sectionEl.querySelector('.spell-deck__card-row');
        var navs = sectionEl.querySelectorAll('.spell-deck__nav[data-scroll]');
        if (!row || !navs.length) return;

        sections.push({ row: row, navs: navs });

        navs.forEach(function (btn) {
          btn.addEventListener('click', function () {
            scrollSection(row, btn.getAttribute('data-scroll') === 'prev' ? -1 : 1);
          });
        });
      });

      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          showStack(null);
          writeHash('', '');
          // This button is about to be inside a hidden region: hand focus to the
          // stack it belongs to, or it falls to <body> unannounced.
          var owner = deck.querySelector('.spell-deck__stack[data-stack="' + slug + '"]');
          if (owner) owner.focus();
        });
      }
    });

    // The stack that is open on arrival is measurable now; the other three are
    // not, and are re-derived when they open. A resize crosses the stylesheet's
    // 700px breakpoint in both directions, which is exactly when a row stops or
    // starts being able to scroll.
    syncSectionNavs();
    window.addEventListener('resize', syncSectionNavs);

    // ------------------------------------------------------------------
    // 3. The fragment: read on load, and again whenever it changes
    // ------------------------------------------------------------------

    /**
     * Bring the deck to the state the fragment describes. Additive by design —
     * see the header's ruling on `hashchange`: it opens and turns, and never
     * turns anything back.
     *
     * `onLoad` marks the one-time call at start-up. It defers the scroll by a
     * frame, because at DOMContentLoaded the page above
     * the deck may not have settled, so a scroll measured now can land in the
     * wrong place; one frame later it cannot.
     */
    function applyHash(onLoad) {
      var target = parseHash();
      if (!target) {
        // Nothing here for us. On LOAD that means "leave the server-rendered
        // default alone". On a NAVIGATION it means the fragment was cleared —
        // Back past a hash, or an edited URL bar — and that is a real
        // destination: leaving the deck open would put the address bar and the
        // page in open disagreement, which reads as the deck ignoring the
        // visitor. Somebody else's anchor still returns early either way,
        // because parseHash only yields non-null for our own prefix.
        if (!onLoad && !window.location.hash) showStack(null);
        return;
      }

      if (!target.stack) {
        // A bare `#deck` — the state closing every stack writes, restored.
        showStack(null);
        return;
      }

      var panel = panelFor(target.stack);
      if (!panel) return; // Unknown stack: the server-rendered default stands.

      showStack(target.stack);

      var cardEl = target.card ? cardFor(target.stack, target.card) : null;
      if (cardEl && !isPressed(cardEl) && turnCardIn[target.stack]) {
        turnCardIn[target.stack](target.card);
      }

      // An unknown card key falls back to its stack rather than scrolling to
      // nothing.
      var scrollTarget = cardEl || panel;
      var block = cardEl ? 'center' : 'nearest';
      if (onLoad && window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
          scrollIntoViewport(scrollTarget, block);
        });
      } else {
        scrollIntoViewport(scrollTarget, block);
      }
    }

    // `replaceState` does not fire this, so what arrives here is a real
    // navigation: back / forward, an edited fragment, or an in-page link.
    window.addEventListener('hashchange', function () {
      applyHash(false);
    });

    applyHash(true);
  }

  function initSpellDecks() {
    var decks = document.querySelectorAll('.spell-deck');
    if (!decks.length) return;
    watchReducedMotion();
    decks.forEach(function (deck) {
      initDeck(deck);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpellDecks);
  } else {
    initSpellDecks();
  }
})();

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
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO:
 *   * No bookkeeping for "a flip survives a stack round-trip". All four panels
 *     are server-rendered and closing one only sets `hidden`, so the DOM never
 *     goes away and per-card state persists for free.
 *   * No styles, classes or transforms. The whole visual turn, the panel reveal
 *     and their reduced-motion handling live in spell-cards.css and key off the
 *     attributes set here — `aria-pressed` on a card, `aria-expanded` on a stack.
 *     There is also no height measurement: `grid-auto-rows: 1fr` equalises the
 *     cards in CSS, and a JS fallback would fight it.
 *
 * NOT HERE YET: the URL hash and scroll-into-view (Step 8) and the narrow-viewport
 * carousel behind the prev/next arrows (Step 9) of _work/spell-cards/plan.md.
 */

(function () {
  'use strict';

  /**
   * The label the flip-all toggle wears while the cards are turned. Its RESTING
   * label is not duplicated here — it is read off the button the view rendered.
   */
  var SHOW_FRONTS_LABEL = 'Show all fronts';

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
    }

    // ------------------------------------------------------------------
    // 1. The stack row
    // ------------------------------------------------------------------
    stackButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        showStack(isOpen ? null : btn.getAttribute('data-stack'));
        // Focus stays where the visitor put it, on both the open and close paths.
        btn.focus();
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

        card.addEventListener('click', function () {
          turn(!isPressed(card));
          syncFlipAll();
        });
      });

      if (flipAll) {
        flipAll.addEventListener('click', function () {
          var showBacks = !isPressed(flipAll);
          turners.forEach(function (turn) {
            turn(showBacks);
          });
          syncFlipAll();

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

      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          showStack(null);
          // This button is about to be inside a hidden region: hand focus to the
          // stack it belongs to, or it falls to <body> unannounced.
          var owner = deck.querySelector('.spell-deck__stack[data-stack="' + slug + '"]');
          if (owner) owner.focus();
        });
      }
    });
  }

  function initSpellDecks() {
    var decks = document.querySelectorAll('.spell-deck');
    if (!decks.length) return;
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

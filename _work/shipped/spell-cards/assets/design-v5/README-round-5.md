# Handoff: Cantrip spell cards — round 5 (equal heights, wider cards, carousel arrows)

Read `README.md`, `README-round-2.md`, `README-round-3.md`, `README-round-4.md` first. All remain
accurate. Round 5 changes three things on top of round 4's fluid layout: cards are now **equal height
within a section**, the card is **wider** (352→400px), and a narrow-screen **carousel gets prev/next
arrows**. `Spell Cards Narrow.dc.html` (the static reference) was not regenerated this round — treat
its numeric layout figures as round 4, superseded by the mechanism changes below.

## 1. Equal height within a section, not across the page

Round 4 gave every card its own height, estimated from its own content — reducing dead space per
card, but meaning two adjacent cards in the same row could differ noticeably. On request, height is
now a **group property**: every spell card in an open stack is the same height, every reference card
is the same height, and the two don't have to match each other.

Mechanism: `estimateCardHeight(u)` (a pure function of one unit's text — `does`, `watch`, `modes`,
`cast`/`triggers`, `needs`, `leaves`, `holds`) is called once per unit when a section's list is built.
The **section takes the tallest estimate in its own list** and passes that single number down to
every `card()` call in the section:

```js
const groupH = list.length ? Math.max.apply(null, list.map(u => this.estimateCardHeight(u))) : 560;
cards: list.map((u, i) => this.card(u, i, list.length, p, openKey, artMode, valueSplit, hostClass, groupH))
```

`card()` no longer computes its own height — `cardH` is a parameter now, not a local calculation.

**Known tradeoff, not a defect.** The shortest card in a section carries dead space at the bottom to
match the tallest. In the current roster, Core's `/commit-message` (586px of estimated content) sits
in the same box as `/spec` (640px) once grouped. This is the cost of "equal within a group" by
definition — flag it if the empty space reads as a mistake once real content is in place per card.

## 2. Card widened 352 → 400px

Every `cqi`-based clamp on the card (frame insets, corner marks, interior padding, sigil size,
placeholder size) was recomputed against the new 400px base so the same visual proportions hold at
full size. The pattern is unchanged from round 4 — `clamp(min px, N cqi, max px)`, where N is
`max / 4.00` instead of `max / 3.52`. The card grid's column minimum and the card-item's `max-width`
moved from 352px to 400px to match.

**The estimate range moved with it.** Because a wider card wraps text to fewer lines, the height
formula's constants dropped (base 480→440, multiplier 0.58→0.5, ceiling 700→640, floor 520→480) to
reflect less wrapping at the new width. Several of the roster's longer units (`/spec`, `/feature`,
`/code-review`, `/retrofit`, `/update-toolkit`, and Core's `reviewer-discipline`) still hit the new
640px ceiling on their own — widening will not visibly shrink those specific cards until their body
copy is edited; it mainly helps the mid-length ones.

**Still capped at the viewport.** The carousel item's width is `clamp(240px, 82vw, 360px)` — a vw
floor, not a fixed px floor, so the card can never exceed the viewport on a phone narrower than
360÷0.82 ≈ 439px. The grid mode caps at `min(400px, 100%)`, so a card never exceeds its container
either. Per the request, width is bounded by the viewport in both modes; only the design maximum
changed.

## 3. Carousel prev/next arrows

Each section's card row now has a `.carousel-nav` row beneath it: two 44×44px outline buttons, each
holding a small CSS-drawn chevron (two borders on a rotated square — the same geometric-mark language
as the card's own corner accents), not a Unicode arrow or an icon font. The design system's
iconography rule explicitly excludes Unicode-arrow buttons and icon fonts; this keeps the same
constraint.

- **Visible only in carousel mode.** `.carousel-nav { display: flex; … }` by default, `display: none`
  in the same `@media (min-width: 700px)` rule that switches `.card-row` back to a grid — so the
  arrows disappear exactly when the row stops scrolling, with no separate breakpoint to keep in sync.
- **Scroll amount is measured, not guessed.** `scrollSection(key, dir)` reads the actual rendered
  width of the row's first `.card-item` at click time and scrolls by that plus the 20px gap — so it
  advances exactly one card regardless of viewport width.
- **No disabled state at the ends.** Both arrows are always enabled; scrolling past either end is a
  no-op (the browser clamps `scrollLeft` on its own). Add `disabled` state from `scrollLeft`/
  `scrollWidth` if a visual "no more cards" signal is wanted — not built this round.
- **Wiring.** Each section gets a `rowRef` (a callback ref stored on `this.rowRefs`, keyed by
  `<packKey>-<sectionKind>`) and `onPrev`/`onNext` handlers built alongside its `cards` array in the
  same `SECTIONS.map` pass that now also computes `groupH`.

## What did not change

Everything not named above: the flip mechanics, the selection signals from round 3, the paper-edge
deck, the pack accent triples, all sigils, the type system, the root-size media query, the container-
query scaling technique itself (only the numbers moved), radius 0, the URL state, and
`prefers-reduced-motion` behaviour.

## Still open

Scroll-on-open (flagged since round 3) remains unimplemented. The static narrow-screen reference
(`Spell Cards Narrow.dc.html`) reflects round 4's proportions and card heights, not this round's —
regenerate it before handing it out on its own if the 400px card and equal-height grouping need to be
visible in a static reference too.

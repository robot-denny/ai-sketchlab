# Spec for spell-cards

> This spec captures initial requirements and design rationale. For **current system
> behavior**, see the doc named on the **Work type** line below — a new feature doc for a new
> capability, an existing feature doc for a change, or a `docs/` runbook for a fix.

branch: `claude/feature/spell-cards`
design reference (if any): `assets/design-v5/` — prototype `Spell Cards.dc.html` plus five cumulative
handoffs (round 1 `README.md`, round 2 stacks, round 3 selection/depth/colour/sigils, round 4
responsive, round 5 equal heights/wider card/carousel arrows). Read in order; each supersedes named
sections of the last. The prototype is **fluid**, so narrow layouts are inspected by resizing it rather
than from a separate file — rounds 4 and 5 refer to a companion `Spell Cards Narrow.dc.html`, which was
dropped from this bundle because it was frozen at round 4's card width and per-card heights and would
mislead anyone building to it. Those references, and one link inside the prototype, are historical.
Revision prompt that produced rounds 2–3 at `notes/design-revision-prompt.md` · discovery at
`discovery.md`

**Work type**: new-capability
**Feature doc**: spell-card-deck

## Summary

A browsable deck on the AI Sketch Lab site that answers **"what can I do with Cantrip?"** for someone
new to the toolkit. The toolkit's units are presented as cards grouped into four **stacks** — one per
installable pack. A visitor sees every stack at once, opens one to reveal its cards, and flips a card
to read what that unit does, when to reach for it, and the one thing newcomers get wrong.

The deck is a **reading surface**: no sign-in, no saved state, nothing written back. Its audiences are
Diagram teammates adopting Cantrip, attendees of an upcoming conference talk, and people who find the
project on their own. Every word on every card is controlled by a content editor.

## Functional Requirements

- A visitor arriving at the spellbook page sees an introduction and **all four stacks at once**,
  without having to scroll to learn how many there are.
- Each stack shows its own name, art, and card count, and looks like a stack — several cards resting
  under the top one.
- Opening a stack reveals its cards in a panel below the row: complete, no paging, no horizontal
  scrolling. **At most one stack is open**; one is open on arrival; activating the open stack closes it
  and returns the visitor to the row alone.
- **The open stack is unmistakable.** It is the only stack carrying its pack's accent, the only one
  whose art is at full ink, and the only one whose art moves.
- Within an open stack, cards are **grouped by kind** — spells first, then references — under their own
  headings. Section order is fixed; card order within a section follows the editor's arrangement.
- **A card's front tells a visitor at a glance whether it is a spell or a reference.**
- Activating a card flips it to reveal its detail. Flips are independent per card and **persist while
  the visitor is on the page**, including across closing and reopening a stack.
- A visitor can **flip every card in the open stack at once**, and return them all to their fronts.
- A **content editor** controls all card and stack text, and orders cards within a stack. Editors never
  choose colours or art — those follow from the pack.
- **Adding a new pack is a content operation** apart from its one commissioned pack sigil and its
  accent entry; it needs no schema change and no page rebuild.
- Any card detail an editor leaves empty is **omitted** rather than rendered as an empty row or label.
- A visitor can **link to a particular stack**, and to a particular card, and have the deck arrive in
  that state.
- The deck is placed on the page as a **block**, so it can later appear on other pages.
- The whole deck is operable by keyboard, usable with a screen reader, and honours a visitor's
  reduced-motion preference.

## Design Reference

- **Source**: `assets/design-v5/` in this bundle. A design reference authored in HTML against a bespoke
  runtime — **not production code to port**. Markup and CSS are to be authored fresh against this
  project's Razor / Bootstrap 5 / `typography.css` conventions. The prototype's logic is a data and
  state model, not an implementation.
- **Component name**: spell card deck (stack row, stack panel, card front, card reverse)
- **Read the three handoffs in order.** Round 2 replaces round 1's sigil assignment, content model,
  state management and prototype props; round 3 replaces round 2's stack layer table, sigil assignment,
  and the face's kind rule.

### Settled by the design — carry over unchanged

- **Four stacks**: `Core` (16) · `umbraco-17` (9) · `umbraco-cloud` (2) · `dotnet` (3). A five-stack
  variant is wired as a prototype prop only; it is not the production shape.
- **Stack tile** holds `aspect-ratio: 224/404` capped at `max-width: 224px`, in a grid of
  `repeat(auto-fit, minmax(min(176px, 45%), 1fr))` — so a fifth through eighth pack **wraps onto a
  second row at the same size** rather than re-laying out the first four. Growth is a wrap, not a
  redesign.
- **The stack row keeps two columns at every width down to 320px.** The floor is a *percentage*, not a
  pixel value, and the reason is worth preserving: a flat 176px floor plus the 26px gap exceeds the
  ~290–350px of content left inside a phone gutter, so a pixel floor would silently collapse the row
  to one-up on every phone.
- **Fluidity is container-driven, not breakpoint-driven.** Tiles and cards are
  `container-type: inline-size`, and every interior offset — frame insets, corner marks, padding,
  sigil size, the open strip, base rule, pointer — is a `clamp(min, N cqi, max)` resolving against the
  component's *own* rendered width. A component therefore scales identically in a four-up desktop row
  and a one-up phone column, with no viewport check in its own styles.
- **Two real media queries only**: root font-size 18px → 17px below a 400px viewport (which pulls every
  rem step down at once), and the 700px switch described below.
- **Card base width is 400px** (widened from 352px in round 5), with every `cqi` clamp recomputed
  against it so proportions hold. Grid columns are `minmax(min(400px, 100%), 1fr)`; carousel items are
  `clamp(240px, 82vw, 360px)` — a viewport floor, so a card can never exceed the viewport on a narrow
  phone.
- **One breakpoint at 700px** switches the card row between carousel and grid, and hides the carousel
  arrows in the *same* rule — so there is no second breakpoint to keep in sync.
- **Carousel arrows** are two 44×44px outline buttons holding CSS-drawn chevrons (two borders on a
  rotated square — the card's own geometric-mark language), deliberately **not** Unicode arrows or an
  icon font, per the design system's iconography rule. Scroll distance is *measured* from the first
  item's rendered width at click time, so one press advances exactly one card at any viewport.
- **Interactive controls keep a 44px minimum hit height at every width.** The panel header's count and
  buttons wrap onto their own row rather than compressing.
- **Page gutter** is `clamp(36px, 7vw, 64px) clamp(16px, 5vw, 40px)`; the reverse's stat grid falls to
  one column under roughly a 261px card.
- **Deck depth** is three warm paper edges stepping down-and-right, not dark planes. Depth is the
  motif, not a quantity read: a two-card stack and a sixteen-card stack show the same three edges, and
  the count is stated in words.
- **Open-stack signalling** is carried on one element across seven axes — accent strip, corner mark,
  base rule, pointer, sigil ink and motion, plane value, and lift.
- **Pack accent is a triple**, not one colour: `accentInk` (on the page), `accentDark` (on the near-
  black plane), `onAccent` (text on the accent). Every value clears 4.5:1 on its own background. A
  fixed list — **never a colour picker**, because two of the three exist only to hold contrast.
- **Sigils**: one drawn sigil per spell (fourteen exist), one shared `sig-tome` for every reference in
  every pack, and one pack sigil per stack face — twenty `<symbol>` definitions, 15KB in total, each
  7–15 primitives with no gradients or filters. The *drawings* carry over unchanged. **How a card
  acquires one does not** — the design's lookup-by-slug is superseded; see Deliberate deviations.
  A spell with no mark assigned still falls back to its pack's.
- **Kind is carried by four axes** on the face — sigil, plane value, title typeface, badge treatment —
  of which the sigil reads first and from furthest away. Spells wear their invocation in mono on the
  deepest plane with a filled badge; references wear their name in the display face on a raised plane
  with an outlined badge.
- **Reverse layout**, field order, and the stat-block treatment.
- **Flip**: `rotateY` 0→180°, 550ms, both faces sharing one box.
- Every colour and type value maps to an **existing token** in `typography.css` / `tokens-extras.css`;
  all confirmed present, including the `--dc-*` planes. Two accents were corrected for contrast in
  round 3 — `umbraco-cloud` off stone (2.3:1, failed as text and as a border) and `dotnet` off ochre
  (outside the design system) onto the system's bronze.
- Radius 0 everywhere; one shadow value; art animates only in the imagery layer.

### Build notes the design records from its own build

These cost time if rediscovered. Honour them.

- **`perspective` must sit on a plain `<div>` inside the card button, not on the button itself.** A
  button host flattens the 3D context in Chrome, and both faces then render as mirrored 2D layers with
  `backface-visibility` doing nothing.
- **`currentColor` is the only channel that reaches a `<use>` shadow tree.** Neither a CSS custom
  property nor `fill` on the consuming `<svg>` crosses it. Structure is literal `#F0EDE8`; the single
  accent shape is `fill="currentColor"`; the consuming `<svg>` sets `color`.
- The `--sig-play` motion gate has three documented cascade traps (gate declared after every
  `animation` shorthand; explicit resting values rather than `var()` fallback; scope the sprite's
  paused default by id, not by attribute).
- **Flip and `currentColor` tinting render incorrectly in DOM-cloning screenshot tools** — backs appear
  mirrored and face-up, accent shapes appear black. Judge both in a real browser.

### Deliberate deviations from the design reference

- **Card height is equal within a section and driven by real content** — see Decisions, item 4. The
  *behaviour* is the design's; the *mechanism* is not.
- **Sigil assignment becomes an editor field** rather than the design's slug lookup — see Decisions,
  item 10. The *geometry* stays in code exactly as designed; only how a card acquires it changes.

All deviations should be reflected back into the design reference rather than left to disagree with
what ships — see Open Questions, item 2.

## Decisions

Settled during spec review. Recorded here so `/plan` does not reopen them.

1. **Four stacks.** `Core` merges the old spellbook and reference groups into one stack of 16 with two
   sections. Four matches what a person installs, keeps signal red to `Core` alone, and stops two of
   five stacks rendering a single section — which would make the section headings read as decoration.
2. **One page, not a route per stack.** The deck is a single page whose URL updates as the visitor
   opens a stack or flips a card, so both are linkable without a page load between stacks.
3. **Card-level linking is in scope.** The design already models it and the incremental effort over
   stack-level linking is small. Drop it only if it proves otherwise.
4. **Card height is equal within a section and measured from real content, not estimated.** Every
   spell card in an open stack shares one height; every reference card shares another; the two need not
   match. This supersedes the original fixed 690px, and removes the field-cap fragility height used to
   depend on — editors can no longer break the layout by writing long.

   **The mechanism deliberately departs from the design.** Round 5 computes height in JavaScript from a
   character count (`440 + textLen * 0.5`, clamped 480–640) and applies it as a fixed pixel height onto
   faces that are `position: absolute; overflow: hidden`. Content exceeding the estimate is therefore
   **silently clipped**, which acceptance criterion 14 forbids — and round 5 already records six units
   saturating the ceiling on their own, so the clamp is binding rather than measuring. The estimate is
   also stale after a window resize, being computed at render.

   Instead: a section is a grid with `grid-auto-rows: 1fr` so every row equalises to the tallest real
   content in that section; both card faces occupy one grid cell (`grid-area: 1 / 1`) rather than being
   absolutely positioned, so the card's height is the natural maximum of its two faces; and in carousel
   mode the flex row's `align-items: stretch` equalises for free. `container-type` and every `cqi`
   clamp are kept for interior scaling, which is width-driven and unaffected. `estimateCardHeight`
   disappears.

   **Two honest costs.** A single outlier card makes every row in its section tall — that is what
   "equal within a group" means, but it may read worse than the estimate did, and the fallback if so is
   per-row equality (plain grid behaviour, less dead space, adjacent rows differing). And
   `grid-auto-rows: 1fr` in an auto-height grid **needs a short spike to confirm** before the approach
   is committed to.
5. **No uploadable art this increment.** The fourteen spell sigils, the shared reference sigil, and the
   four pack sigils ship as site-supplied art. This sidesteps the stored-XSS surface entirely, since
   inlined editor-uploaded SVG would need sanitising. The art slot and its monogram fallback stay in
   the model for later.
6. **Cards are excluded from site navigation but allowed in site search**, and live under a `Cantrip`
   folder in the content tree.
7. **Stacks ship in this increment**, not as a fast follow.
8. **The deck is built as a block** available in the block editor, even though only the spellbook page
   places one now. Placing it elsewhere is a later increment; nothing here should make that harder.
9. **Drift against Cantrip's published unit roster stays out of scope.** A missing card is silent.
10. **Sigil geometry lives in code; sigil assignment lives in content.** The marks ship as a sprite
    partial in the template — editors never author drawing instructions, which keeps the
    stored-cross-site-scripting surface closed for the same reason as Decision 5. What becomes content
    is *which* mark a spell card wears: an explicit selection from the fixed list of marks the site
    ships. This replaces the design's lookup-by-slug, which had two silent failure modes — a new card
    quietly inheriting its pack's mark with nothing in the backoffice saying its own art was missing,
    and **a rename silently reverting a card's art** because the lookup key was the thing being
    renamed. Adding a *new* mark stays a developer task (someone draws and commits the SVG), so
    carrying a schema change alongside costs nothing that deploy was not already paying.
    **References are excluded**: every reference in every pack wears the shared tome, because that is
    the kind signal that makes a sixteen-card grid readable, and an editor override would weaken the
    one axis doing that work.
11. **`Core` is the default open stack**, set as a property rather than fixed in the view.
12. **The conference is not a scope constraint.** Scope is decided on merit; no work is cut or rushed
    to meet a date.
13. **The narrow-screen carousel is in this increment**, reversing the earlier deferral, and is built
    as a **native scroll-snap row** rather than on an existing carousel library.

    The repo holds two carousels and neither fits. *Swiffy Slider* is scroll-snap based and so
    architecturally identical to the design, but it is dormant — referenced only in a comment in
    `blocks.css`, used by no view. *Bootstrap 5 Carousel* with
    [carousel.js](../../src/UmbracoProject/wwwroot/assets/js/carousel.js) is the living convention but a
    different interaction model: discrete slides with autoplay, where the design wants a swipeable row
    showing the next card partially. Three things decide it — autoplay is wrong on a reading surface;
    Bootstrap would need destroy-and-reinitialise on every 700px crossing, where the design's row
    becomes a grid by changing `display` alone; and Bootstrap manages focus and `aria-hidden` on
    off-screen slides, which would fight the per-face `aria-hidden` and `aria-pressed` contract each
    card already carries. Two systems toggling `aria-hidden` on one subtree is a hazard, not a saving.

    **What is reused is the conventions, not the library**: `carousel.js`'s reduced-motion handling that
    reacts to live OS preference changes, aria-label-as-accessible-name on icon-only buttons, and the
    `image-carousel__*` naming style. The mechanism itself is roughly fifteen lines of CSS and one
    `scrollBy` handler.
14. **Opening a stack scrolls its panel into view**, and so does arriving on a link to a stack or card.
    The design has flagged this since round 3 and left it unbuilt through round 5. It matters most on a
    phone, where the panel sits below the fold — and most of all for a shared link, where the visitor
    would otherwise land looking at a row of stacks with no sign that anything opened. Scrolling
    respects a reduced-motion preference.

## Possible Edge Cases

- A stack holding **only references** (`dotnet`) — renders one section, with no empty "Spells" heading.
- A **two-card stack** (`umbraco-cloud`) — same three depth edges as a sixteen-card stack.
- The **largest stack** (`Core`, 16) — the panel is the same three columns, with more rows.
- A card with no `Watch for`, no `Modes`, or no footer — those regions vanish cleanly.
- A card whose text runs long — with dynamic height the card grows; its row grows with it.
- A **stack with no art set** — falls back to the pack monogram.
- A **spell with no drawn sigil** (a new spell added before art is commissioned) — falls back to its
  pack's sigil rather than rendering empty.
- A visitor with **reduced motion** — no sigil movement, no panel reveal animation, no flip animation;
  state still changes.
- A **screen reader user** meeting a card: both faces are in the page whichever is showing, so the
  hidden one must be hidden from assistive tech too.
- A **new unit published upstream in Cantrip** with no card here — the deck renders normally and says
  nothing. Accepted; drift detection is deferred.
- A link to a **stack or card that does not exist** — the deck still renders; an unknown stack leaves
  the default open, an unknown card still opens its stack.
- **All stacks closed** — a real state, reachable by activating the open stack, and the one a reader
  returns to.
- **A section holding one unusually long card** — every row in that section grows to match it, so the
  shorter cards carry dead space at the bottom. Inherent to equal-within-a-group; worth a look once
  real content is in.
- **`Core`'s 16 cards on a phone** — one column, and a long swipe or scroll even as a carousel.
- **The narrowest supported width, 320px** — two stacks still per row, card still inside the viewport,
  the reverse's stat grid down to one column.
- **A section with a single card** — the carousel has nothing to advance to; both controls are no-ops
  rather than errors.

## Acceptance Criteria

1. A visitor sees all four stacks, each with its name, art, and card count, without scrolling past the
   deck on a desktop viewport.
2. At most one stack is open; one is open on arrival; opening another closes the previous; activating
   the open stack closes it and leaves the row alone.
3. A visitor can tell which stack is open without scrolling to the panel.
4. An open stack shows all of its cards, grouped into spells then references under their own headings,
   with no empty heading for a kind the stack does not hold.
5. A visitor can tell a spell card from a reference card by looking at its front.
6. Flipping a card reveals its detail; flips are independent per card and survive closing and
   reopening a stack.
7. A visitor can flip every card in the open stack at once and return them all to their fronts.
8. A content editor can change any text on any card or stack, and reorder cards within a stack, and see
   the change without a developer.
9. A content editor can add a new pack as a content operation — no schema change and no page rebuild —
   given its sigil and accent entry exist.
10. A card detail left empty is absent from the card — no empty row, label, or gap.
11. A stack has its own link, and a card has its own link that arrives flipped; an unknown link
    degrades rather than breaking.
12. Every deck interaction is reachable and operable by keyboard, and a screen reader is offered only
    the content currently facing the visitor.
13. With reduced motion requested, nothing animates — not the sigils, the panel, or the flip — while
    every state change still happens.
14. A card's content is never clipped or spilled, whatever an editor writes and whatever the viewport.
15. The deck is available as a block in the block editor.
16. A content editor can choose which mark a spell card wears, from the marks the site ships, and
    cannot supply drawing instructions of their own.
17. Renaming a card never changes the mark it wears.
18. Within an open stack, every spell card is the same height and every reference card is the same
    height, and that height is set by the longest card actually present.
19. On a narrow screen the cards become a swipeable row with previous and next controls; one press
    advances exactly one card. On a wide screen they are a grid and those controls are absent.
20. The stack row shows at least two stacks per row at every width down to 320px.
21. No card is ever wider than the screen it is on.
22. Opening a stack brings its cards into view, and so does arriving on a link to a stack or a card.

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria using Example Mapping. Each Rule maps
to an acceptance criterion; scenarios use concrete examples. These get verified and refined
after implementation — the feature doc holds the verified version.

### Rule: A visitor sees the whole toolkit at once before opening anything

```scenario
Scenario: Arriving at the spellbook page
  Given the deck holds the stacks "Core", "umbraco-17", "umbraco-cloud" and "dotnet"
  When a visitor opens the spellbook page on a desktop screen
  Then they see all four stacks without scrolling
  And each stack shows its name, its art and its card count
  And the "Core" stack shows "16 cards"
  And the "umbraco-cloud" stack shows "2 cards"
```

### Rule: At most one stack is open, and the visitor can close it

```scenario
Scenario: A stack is already open on arrival
  When a visitor opens the spellbook page
  Then the "Core" stack is open
  And its cards are visible

Scenario: Opening a second stack closes the first
  Given the "Core" stack is open
  When the visitor opens the "umbraco-17" stack
  Then the "umbraco-17" cards are visible
  And the "Core" cards are no longer visible

Scenario: Closing the open stack returns to the row
  Given the "Core" stack is open
  When the visitor activates the "Core" stack again
  Then no cards are visible
  And all four stacks are still shown
```

### Rule: The open stack is unmistakable

```scenario
Scenario: Telling the open stack from the closed ones
  Given the "umbraco-17" stack is open
  When a visitor looks at the row of stacks
  Then the "umbraco-17" stack is marked as open
  And it is the only stack showing its pack's colour
  And it is the only stack whose art is moving
```

### Rule: An open stack groups spells then references, and shows no empty grouping

```scenario
Scenario: A stack holding both kinds
  Given the "umbraco-17" stack holds 3 spells and 6 references
  When a visitor opens it
  Then they see a "Spells" heading above 3 cards
  And below them a "References" heading above 6 cards

Scenario: A stack holding only references
  Given the "dotnet" stack holds "dotnet-conventions", "dotnet-review-rules" and "codebase-audit"
  And none of them is a spell
  When a visitor opens the "dotnet" stack
  Then they see a "References" heading above 3 cards
  And no "Spells" heading appears
```

### Rule: A card's front says whether it is a spell or a reference

```scenario
Scenario: Telling a spell from a reference at a glance
  Given the "Core" stack is open
  When a visitor looks at the front of the "/plan" card and the front of the "workflow" card
  Then "/plan" is presented as an invocation, with its own drawn mark
  And "workflow" is presented as a name, with the shared reference mark
  And each card front states its kind
```

### Rule: A card flips independently, and stays as the reader left it

```scenario
Scenario: Flipping one card
  Given the "Core" stack is open
  When a visitor flips the "/plan" card
  Then they read what /plan does, what it needs, what it leaves behind, and what to watch for
  And the "/spec" card still shows its front

Scenario: A flipped card is still flipped when the reader comes back
  Given a visitor has flipped the "/plan" card
  When they open the "dotnet" stack and then reopen "Core"
  Then the "/plan" card is still showing its details
```

### Rule: A visitor can turn the whole open stack at once

```scenario
Scenario: Showing every back in a stack
  Given the "dotnet" stack is open and all 3 cards show their fronts
  When the visitor chooses to show all backs
  Then all 3 cards show their details
  And the same control now offers to show the fronts again
```

### Rule: A content editor owns every word on the deck

```scenario
Scenario: Correcting a card's wording
  Given a card for "/commit-message" exists in the "Core" stack
  When a content editor changes its "watch for" text and publishes
  Then a visitor flipping that card reads the new text
  And no developer was involved

Scenario: Reordering cards within a stack
  Given the "Core" stack lists "/explore" before "/spec"
  When a content editor moves "/spec" above "/explore" and publishes
  Then a visitor opening the "Core" stack sees "/spec" first among the spells
```

### Rule: Adding a pack is a content operation

```scenario
Scenario: Adding the Optimizely pack
  Given the deck holds four stacks
  And an "optimizely" mark and colour have been added to the site's artwork
  When a content editor adds an "optimizely" stack with two cards and publishes
  Then a visitor sees five stacks
  And the row wraps rather than resizing the existing four
  And the "optimizely" stack opens to show its two cards
```

### Rule: Empty details are omitted, not shown blank

```scenario
Scenario: A card with nothing to watch for
  Given the "umbraco-deploy-facts" card has no "watch for" text
  When a visitor flips it
  Then no "watch for" region appears on the card
  And the card shows no empty row or stray label
```

### Rule: Stacks and cards are linkable, and bad links degrade

```scenario
Scenario: Sharing a link to one card
  Given a visitor has flipped the "/code-review" card in the "Core" stack
  When they copy the page link and open it in a new window
  Then the deck appears with the "Core" stack open
  And the "/code-review" card showing its details
  And that card scrolled into view

Scenario: A link to a stack that no longer exists
  Given a link points to a "sitecore" stack that is not in the deck
  When a visitor opens that link
  Then the deck appears with the default stack open
```

### Rule: The deck is operable without a mouse, and reads correctly to a screen reader

```scenario
Scenario: Opening a stack and flipping a card by keyboard
  Given a visitor is navigating by keyboard
  When they move focus to the "umbraco-17" stack and activate it
  Then the stack opens
  And focus stays on the stack they activated
  And they can then reach a card and activate it to flip it

Scenario: A screen reader is offered only the facing side
  Given the "/plan" card is showing its front
  When a screen reader reads the card
  Then it announces the card name, its kind, and how to turn it
  And it does not read the detail on the reverse
```

### Rule: Reduced motion stops all movement

```scenario
Scenario: A visitor who has asked for reduced motion
  Given a visitor's system requests reduced motion
  When they open the spellbook page, open a stack and flip a card
  Then no card or stack art moves
  And the stack panel appears without animating
  And the card changes face without animating
```

### Rule: Card content is never clipped

```scenario
Scenario: An editor writes past the intended length
  Given a card's "does" text is written at three times its intended length
  When a visitor flips that card
  Then the card's content is fully readable
  And it does not spill outside the card or hide behind its edge
  And the other cards in that row match its height
```

### Rule: The deck can be placed on a page

```scenario
Scenario: Placing the deck
  Given a content editor is building a page
  When they add the spell card deck to it and publish
  Then a visitor sees the deck on that page
```

### Rule: An editor chooses a spell's mark from the marks the site ships

```scenario
Scenario: Choosing a different mark for a spell
  Given the "/guide" card wears the mark drawn for it
  When a content editor chooses the "/spec" mark for it instead and publishes
  Then a visitor opening that stack sees the "/spec" mark on the "/guide" card

Scenario: An editor cannot supply their own drawing
  Given a content editor is editing a spell card
  When they look for a way to set its mark
  Then they can only choose from the marks the site ships
  And there is nowhere to paste drawing instructions

Scenario: A reference card always wears the shared mark
  Given a content editor is editing the "umbraco-deploy-facts" reference card
  Then no choice of mark is offered
  And a visitor sees the shared reference mark on it
```

### Rule: Renaming a card never changes its mark

```scenario
Scenario: Renaming a spell card
  Given the "/check-uda" card wears the mark drawn for it
  When a content editor renames it to "/check-schema" and publishes
  Then a visitor still sees the same mark on that card
```

### Rule: Cards are equal height within their section, sized by the longest one present

```scenario
Scenario: Spells and references sized independently
  Given the "umbraco-17" stack is open
  And "/block" carries much more detail than "/guide"
  When a visitor looks at the spells
  Then every spell card is the same height
  And that height fits "/block" without cutting anything off
  And the reference cards below are sized to the longest reference, not to the spells

Scenario: An editor lengthens the longest card
  Given every spell card in the "dotnet" stack is the same height
  When a content editor doubles the "does" text on one of them and publishes
  Then all the spell cards in that stack grow to match it
  And no card's content is cut off
```

### Rule: On a narrow screen the cards become a swipeable row

```scenario
Scenario: Swiping through a stack on a phone
  Given a visitor is on a 390px-wide screen
  And the "Core" stack is open
  When they look at the spells
  Then the cards are laid out in a single swipeable row
  And a previous and a next control are shown
  And no card is wider than the screen

Scenario: Advancing one card at a time
  Given a visitor on a phone is looking at the first spell card
  When they press next
  Then the row moves on by exactly one card

Scenario: The controls go away on a wide screen
  Given a visitor is on a 1200px-wide screen
  When they open a stack
  Then the cards are laid out as a grid
  And no previous or next control is shown

Scenario: Pressing next at the end of a row
  Given a visitor on a phone is looking at the last card in a section
  When they press next
  Then nothing moves
  And nothing breaks
```

### Rule: Opening a stack brings its cards into view

```scenario
Scenario: Opening a stack on a phone
  Given a visitor is on a 390px-wide screen
  And the panel sits below what they can see
  When they open the "umbraco-17" stack
  Then its cards are scrolled into view

Scenario: Arriving on a shared link
  Given a link points to the "/code-review" card in the "Core" stack
  When a visitor opens that link
  Then the "Core" stack is open
  And the "/code-review" card is in view, showing its details
```

### Rule: The deck stays usable at the narrowest supported width

```scenario
Scenario: The deck at 320px
  Given a visitor is on a 320px-wide screen
  When they open the spellbook page
  Then the stacks are still laid out two to a row
  And opening one still shows its cards
  And flipping a card still shows its details in full
```

## Open Questions

1. **Does `Core`'s 16 cards in one phone column want a per-section collapse**, or is the carousel
   enough on its own? Undecided by the design, and only answerable against the built thing.
2. **Do the two deviations go back to the design as a round 6?** The reference now disagrees with what
   will ship in two places — the equal-height *mechanism* (Decision 4 keeps the behaviour, replaces the
   character-count estimate with CSS) and sigil assignment (Decision 10). A short round 6 keeps the
   reference truthful; the alternative is accepting this spec as the authority where they conflict,
   which the Deliberate deviations section already states.
3. **Is `sigilMotion` a real CMS setting on the deck?** The design intends it as one — `continuous` /
   `hover` / `off` — but it is not yet in the content model or the acceptance criteria. --we can move this to a future increment, so plan this iteration in a way that anticipates it later.
4. **Hash or query string for URL state?** **Deferred to `/plan` deliberately** — it is an
   implementation choice, not a product one. The design models `#core/code-review` and notes that
   `?stack=core&card=code-review` maps one-to-one. It interacts with how the block is placed and
   whether the surrounding page re-renders, which planning is better placed to weigh.

5. **Does `grid-auto-rows: 1fr` behave as expected in an auto-height grid?** Decision 4 rests on it. A
   short spike settles it before the approach is committed to, and the fallback (per-row equality) is
   already named.

Closed during spec review, recorded here so they are not reopened: swappable sigil geometry from the
backoffice (→ Decision 10 — geometry stays in code, assignment becomes a selector), the default open
stack (→ Decision 11), the conference as a scope constraint (→ Decision 12), the narrow-screen
treatment and whether the carousel is deferred (→ Decision 13 and design rounds 4–5, which specify the
responsive mechanism in full).

## Testing Guidelines

Meaningful tests for the cases below, without going too heavy:

- **End-to-end, the behaviours a visitor depends on**: one stack open on arrival; opening a second
  closes the first; closing the open one returns to the row; an open stack shows the right card count
  grouped into the right sections; a flip reveals the reverse and leaves neighbours alone; a flipped
  card survives a stack round-trip; a stack link and a card link both arrive in the right state; an
  unknown link degrades.
- **The three cases most likely to regress silently**: a references-only stack rendering no empty
  "Spells" heading; an empty optional detail leaving no stray label or gap; and a spell with no drawn
  sigil falling back rather than rendering empty. All three are invisible until a real card hits them.
- **Keyboard path**: reach a stack, open it, reach a card, flip it — without a mouse. Assert focus
  *stays* on the stack button when it opens, since that is a deliberate design decision and the
  intuitive alternative is wrong.
- **Reduced motion**: with the preference set, nothing animates and every state change still happens.
- **Narrow viewports, which are now in scope**: at 390px the cards are a swipeable row with controls
  and no card exceeds the viewport; at 1200px they are a grid with no controls; at 320px the stack row
  still shows two per row. The switch is one breakpoint, so these are cheap to assert.
- **Equal height within a section** — assert that every spell card in a stack reports the same height
  and that the tallest one's content is not clipped. This is the criterion the design's own mechanism
  could not hold, so it deserves a real assertion rather than a screenshot.
- **Carousel advance** — one press moves exactly one card, and a press at either end is a no-op.
- **Visual**: one screenshot of the resting stack row and one of the `Core` stack open, **at real card
  counts** — sample-size content is precisely what hid the scale problem in the first design round —
  plus one at phone width, since that layout is now specified rather than emergent.
- **Judge the flip and the sigil tinting in a real browser.** The design records that both render
  incorrectly under DOM-cloning screenshot tools; a captured image showing mirrored backs or black
  accent shapes is a tooling artefact, not a defect.
- Follow the project's existing screenshot-baseline discipline; do not regenerate baselines to make a
  diff pass.
- Content-shaped assertions (does a card exist, is its text right) are **content**, not behaviour —
  cover the rendering rules, not the 30 cards' wording.

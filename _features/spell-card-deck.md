# Feature: Spell Card Deck

> **Draft** — These scenarios have not yet been verified against an implementation. They will be
> refined during planning and verified after implementation.

A browsable deck on the site that answers "what can I do with Cantrip?" for someone new to the
toolkit. Cards are grouped into four stacks — one per installable pack — and a visitor sees every
stack at once, opens one, and flips its cards to read what each unit does, when to reach for it, and
the one thing newcomers get wrong. It is a reading surface: no sign-in, nothing saved, nothing written
back.

**Source**: `_work/spell-cards/spec.md`
**Last verified**: — (draft, not yet implemented)

---

## Increments

The per-feature mini-roadmap: shipped increments, planned increments, and parking-lot ideas.
Newest planned items first. When an item ships, flip the checkbox and point it at the archived
increment.

- [ ] Spell card deck — stacks, cards, flip, linking, editor-controlled content, and the narrow-screen
      carousel (`_work/spell-cards/spec.md`, plan at `_work/spell-cards/plan.md`)
- [ ] Migrate stacks and cards from content-tree nodes to **Umbraco 18 Elements** when the site moves
      to 18. Elements live in a Library rather than the content tree, are not routable and carry no
      template — which is what this data always wanted to be. Would delete the card redirect template,
      the stack visibility ticks, and most of the reason the `spellbook` document type exists. Two
      questions to settle then: whether a Library supports editor-controlled ordering (if not, invert
      the relationship so a stack holds an Element Picker of its cards and picker order is the order),
      and whether elements are indexed for site search (if not, "cards are searchable" must be
      re-decided — which also removes the only reason the redirect template exists). (no spec yet)
- [ ] Per-section collapse for the largest stack on a phone, if the carousel proves insufficient
      (no spec yet)
- [ ] Drift detection against Cantrip's published unit roster — deliberately deferred; a missing card
      is currently silent (no spec yet)
- [ ] A visual mark picker in the backoffice, replacing the plain selector — shows the drawing rather
      than its name (no spec yet)
- [ ] Curated deck placement on the Cantrip promotional page (no spec yet)
- [ ] Print sheet — the card geometry is already close to a 2.5×3.5 cut card (no spec yet)

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion the scenarios prove.
Use concrete values (Specification by Example) and business language (Ubiquitous Language). See
the `bdd-principles` skill for guidance.

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
```

```scenario
Scenario: Opening a second stack closes the first
  Given the "Core" stack is open
  When the visitor opens the "umbraco-17" stack
  Then the "umbraco-17" cards are visible
  And the "Core" cards are no longer visible
```

```scenario
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
```

```scenario
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
```

```scenario
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
```

```scenario
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

> **Operator note — tick the two visibility boxes on a new stack.** A stack node must have
> **Hide From Search** (`umbracoNaviHide`) and **Hide From Section Navigation** ticked. This is not
> cosmetic: card nodes deliberately carry no visibility properties of their own, and Umbraco treats an
> absent property as *visible*, so the only thing keeping a pack's cards out of the XML sitemap is the
> tick on their parent stack — the sitemap stops descending at a hidden node. A new pack added without
> it silently publishes a dead sitemap URL per card. Despite its label, `umbracoNaviHide` does not
> affect site search here, so ticking it leaves the cards searchable, which is intended. An automated
> check asserts no stack or card URL appears in `/sitemap.xml`.

### Rule: Stacks and cards are linkable

```scenario
Scenario: Sharing a link to one card
  Given a visitor has flipped the "/code-review" card in the "Core" stack
  When they copy the page link and open it in a new window
  Then the deck appears with the "Core" stack open
  And the "/code-review" card showing its details
  And that card scrolled into view
```

### Rule: The deck is operable without a mouse, and reads correctly to a screen reader

```scenario
Scenario: Opening a stack and flipping a card by keyboard
  Given a visitor is navigating by keyboard
  When they move focus to the "umbraco-17" stack and activate it
  Then the stack opens
  And focus stays on the stack they activated
  And they can then reach a card and activate it to flip it
```

```scenario
Scenario: A screen reader is offered only the facing side
  Given the "/plan" card is showing its front
  When a screen reader reads the card
  Then it announces the card name, its kind, and how to turn it
  And it does not read the detail on the reverse
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
```

```scenario
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
```

```scenario
Scenario: Advancing one card at a time
  Given a visitor on a phone is looking at the first spell card
  When they press next
  Then the row moves on by exactly one card
```

```scenario
Scenario: The controls go away on a wide screen
  Given a visitor is on a 1200px-wide screen
  When they open a stack
  Then the cards are laid out as a grid
  And no previous or next control is shown
```

### Rule: Opening a stack brings its cards into view

```scenario
Scenario: Opening a stack on a phone
  Given a visitor is on a 390px-wide screen
  And the panel sits below what they can see
  When they open the "umbraco-17" stack
  Then its cards are scrolled into view
```

```scenario
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

### Rule: Reduced motion stops all movement

```scenario
Scenario: A visitor who has asked for reduced motion
  Given a visitor's system requests reduced motion
  When they open the spellbook page, open a stack and flip a card
  Then no card or stack art moves
  And the stack panel appears without animating
  And the card changes face without animating
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
```

```scenario
Scenario: An editor cannot supply their own drawing
  Given a content editor is editing a spell card
  When they look for a way to set its mark
  Then they can only choose from the marks the site ships
  And there is nowhere to paste drawing instructions
```

```scenario
Scenario: A reference card always wears the shared mark
  Given a content editor is editing the "umbraco-deploy-facts" reference card
  Then no choice of mark is offered
  And a visitor sees the shared reference mark on it
```

---

## Edge Cases

### Rule: Empty details are omitted, not shown blank

```scenario
Scenario: A card with nothing to watch for
  Given the "umbraco-deploy-facts" card has no "watch for" text
  When a visitor flips it
  Then no "watch for" region appears on the card
  And the card shows no empty row or stray label
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

### Rule: A bad link degrades rather than breaking

```scenario
Scenario: A link to a stack that no longer exists
  Given a link points to a "sitecore" stack that is not in the deck
  When a visitor opens that link
  Then the deck appears with the default stack open
```

### Rule: Missing art falls back rather than rendering empty

```scenario
Scenario: A spell with no mark assigned
  Given a card for "/styleguide" has been added to the "umbraco-17" stack
  And no mark has been chosen for it
  When a visitor opens that stack
  Then the "/styleguide" card shows the umbraco-17 pack mark
  And the card is otherwise complete
```

### Rule: Renaming a card never changes its mark

```scenario
Scenario: Renaming a spell card
  Given the "/check-uda" card wears the mark drawn for it
  When a content editor renames it to "/check-schema" and publishes
  Then a visitor still sees the same mark on that card
```

```scenario
Scenario: A stack with no art set
  Given the "dotnet" stack has no art set
  When a visitor views the deck
  Then the stack shows its monogram instead
```

### Rule: A carousel with nothing to advance to is inert, not broken

```scenario
Scenario: Pressing next at the end of a row
  Given a visitor on a phone is looking at the last card in a section
  When they press next
  Then nothing moves
  And nothing breaks
```

### Rule: A small stack still reads as a stack

```scenario
Scenario: A stack holding only two cards
  Given the "umbraco-cloud" stack holds 2 cards
  When a visitor views the deck
  Then it shows the same depth as the sixteen-card stack
  And its count is stated as "2 cards"
```

### Rule: A unit published in Cantrip with no card here is silent

```scenario
Scenario: The toolkit gains a spell the deck does not know about
  Given Cantrip publishes a new spell called "/styleguide"
  And no card has been added for it
  When a visitor opens the deck
  Then the deck renders normally without that card
  And nothing reports the omission
```

<!-- The last scenario documents an accepted limitation, not a desired behavior. Drift detection is
     deliberately out of the first increment — see the Increments list above. -->

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Arriving at the spellbook page | — | Not covered |
| A stack is already open on arrival | — | Not covered |
| Opening a second stack closes the first | — | Not covered |
| Closing the open stack returns to the row | — | Not covered |
| Telling the open stack from the closed ones | — | Not covered |
| A stack holding both kinds | — | Not covered |
| A stack holding only references | — | Not covered |
| Telling a spell from a reference at a glance | — | Not covered |
| Flipping one card | — | Not covered |
| A flipped card is still flipped when the reader comes back | — | Not covered |
| Showing every back in a stack | — | Not covered |
| Correcting a card's wording | — | Not covered |
| Reordering cards within a stack | — | Not covered |
| Adding the Optimizely pack | — | Not covered |
| Sharing a link to one card | — | Not covered |
| Opening a stack and flipping a card by keyboard | — | Not covered |
| A screen reader is offered only the facing side | — | Not covered |
| Spells and references sized independently | — | Not covered |
| An editor lengthens the longest card | — | Not covered |
| Swiping through a stack on a phone | — | Not covered |
| Advancing one card at a time | — | Not covered |
| The controls go away on a wide screen | — | Not covered |
| Opening a stack on a phone | — | Not covered |
| Arriving on a shared link | — | Not covered |
| The deck at 320px | — | Not covered |
| Pressing next at the end of a row | — | Not covered |
| A visitor who has asked for reduced motion | — | Not covered |
| The deck can be placed on a page | — | Not covered |
| Choosing a different mark for a spell | — | Not covered |
| An editor cannot supply their own drawing | — | Not covered |
| A reference card always wears the shared mark | — | Not covered |
| Renaming a spell card | — | Not covered |
| A card with nothing to watch for | — | Not covered |
| An editor writes past the intended length | — | Not covered |
| A link to a stack that no longer exists | — | Not covered |
| A spell with no mark assigned | — | Not covered |
| A stack with no art set | — | Not covered |
| A stack holding only two cards | — | Not covered |
| The toolkit gains a spell the deck does not know about | — | Not covered |

---

## Revision Notes

- 2026-08-31: Draft scenarios from initial spec
- 2026-08-31: Reconciled against design v3 (four stacks, per-spell sigils, pack accent triples) and
  the spec-review decisions — flip state now persists across a stack round-trip, focus stays on the
  stack button when it opens, the all-closed state is supported, "show all backs" and card-level
  linking added, card height is dynamic
- 2026-09-01: Mark assignment moved from an implicit slug lookup to an explicit editor selection from
  the marks the site ships — closes the silent-rename failure, and keeps drawing instructions out of
  editor hands. References are excluded; the shared reference mark is the kind signal.
- 2026-09-01: Reconciled against design rounds 4–5. Narrow screens are now in scope rather than
  deferred: the cards become a native scroll-snap carousel under 700px with measured prev/next
  controls. Card height is equal within a section, driven by real content rather than a character-count
  estimate. Card base width 352 → 400px. Scroll-on-open is in scope, so an opened or linked stack
  brings its cards into view rather than leaving the visitor on the row.

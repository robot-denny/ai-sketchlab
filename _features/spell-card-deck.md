# Feature: Spell Card Deck

A browsable deck on the site that answers "what can I do with Cantrip?" for someone new to the
toolkit. Cards are grouped into four stacks — one per installable pack — and a visitor sees every
stack at once, opens one, and flips its cards to read what each unit does, when to reach for it, and
the one thing newcomers get wrong. It is a reading surface: no sign-in, nothing saved, nothing written
back.

**Source**: `_work/shipped/spell-cards/spec.md` · plan `_work/shipped/spell-cards/plan.md`
**Last verified**: 2026-09-02 — roster re-checked against Cantrip's published `docs/spell-cards.md`
(32 units); card fields compared field-by-field against the rendered page.

---

## Increments

The per-feature mini-roadmap: shipped increments, planned increments, and parking-lot ideas.
Newest planned items first. When an item ships, flip the checkbox and point it at the archived
increment.

- [x] Spell card deck — stacks, cards, flip, linking, editor-controlled content, and the narrow-screen
      carousel. Shipped 2026-09-01 across ten steps — spec, plan, discovery and the design reference
      archived at `_work/shipped/spell-cards/`.
- [x] Roster refreshed to Cantrip's 32-unit snapshot (2026-09-02) — the toolkit had grown two
      spells since the deck shipped, and, as the parked drift-detection item below predicted,
      nothing noticed. Added the `/testify` card to **Core** (between `/retrofit` and `/setup`)
      and `/styleguide` to **umbraco-17** (between `/guide` and `/umbraco-edit`), with their two
      `<symbol>` marks in `_SpellSigils.cshtml` and their keys in the `cardMark` dropdown. Every
      pre-existing card already matched the new snapshot, so nothing else was edited.
- [ ] Migrate stacks and cards from content-tree nodes to **Umbraco 18 Elements** when the site moves
      to 18. Elements live in a Library rather than the content tree, are not routable and carry no
      template — which is what this data always wanted to be. Would delete the card redirect template,
      the stack visibility ticks, and most of the reason the `spellbook` document type exists. Two
      questions to settle then: whether a Library supports editor-controlled ordering (if not, invert
      the relationship so a stack holds an Element Picker of its cards and picker order is the order),
      and whether elements are indexed for site search (if not, "cards are searchable" must be
      re-decided — which also removes the only reason the redirect template exists). (no spec yet)
- [x] ~~Per-section collapse for the largest stack on a phone, if the carousel proves insufficient~~
      — **not needed; answered by looking, at 390×844, once the carousel shipped (Open Question 1 of
      `_work/shipped/spell-cards/spec.md`).** Measured with Core open: the panel is **2205px, about 2.6 phone
      screens**, and the whole page **4139px, about 4.9**. Sixteen cards stacked vertically would have
      been roughly four times that; the carousel is what already collapsed them. Adding a per-section
      collapse would put a second interaction in front of the content on a surface whose entire job is
      browsing, to save vertical space that has already been saved. The two sections are also
      self-limiting: Core's ten spells are ten presses, its six references six, and each card's caption
      already numbers it (`01`, `02`, …) against the section count in the header, so a reader knows
      where they are.
      **And the carousel collapses without concealing.** That is the distinction that settles it: a
      per-section collapse would make the references something a visitor has to *ask* for, when the
      whole point of showing spells and references together is that a reader discovers the references
      they did not know to look for. The carousel already accommodates the small screen — it just does
      it by moving the cards sideways rather than by hiding them.
- [ ] **The narrow-viewport card gets no peek, and is clipped by 15–23px** — found while answering the
      question above, and it is a **stylesheet** matter, not a script one. `.spell-deck__card-item` is
      `clamp(240px, 82vw, 360px)`, but the deck's content column at those widths is only about `79vw`
      minus the row's 5px padding. Measured card width vs. visible row width: **320px → 262.4 in 239,
      360px → 295.2 in 275, 390px → 319.8 in 302, 430px → 352.6 in 338**. So on every real phone the
      current card overflows the scrollport by 15–23px and the next card sits 35–43px *beyond* the
      right edge — a full-bleed slide, not the design's "next card peeks in". The intended peek only
      appears from roughly 470px up, where the `360px` ceiling takes over (57px of peek at 540px, 200px
      at 699px). The row's `mask-image` fade softens the clipped edge into a "there is more" cue, which
      is why this reads as a design miss rather than a bug, but the card's right frame border is lost.
      The fix is one number in `spell-cards.css` — a `vw` figure that leaves room for the 20px gap plus
      a visible sliver — and it wants judging by eye against the design, so it is not a blind edit.
      (no spec yet)
- [ ] **Test-suite tidying, deferred from the Step 10 review** — three Minor items, none of which
      guard a live defect, all verified green at the time: a `stackByPack(stacks, pack)` helper in
      `tests/e2e/_spellDeckFixture.ts` to replace the `stacks.find(s => s.pack === 'core')` idiom now
      repeated about ten times across four specs; a light structural loop asserting every card's
      accessible name carries its title, its kind and the turn affordance, where today one spell and
      one reference are sampled; and keyboard activation for the flip-all toggle, which is the one
      control in its spec exercised only by `.click()`. (no spec yet)
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
  And the "Core" stack shows "17 cards"
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
  Given the "umbraco-17" stack holds 4 spells and 6 references
  When a visitor opens it
  Then they see a "Spells" heading above 4 cards
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

### Rule: The URL says what the deck is showing

```scenario
Scenario: Opening a stack names it
  Given a visitor is on the spellbook page
  When they open the "umbraco-17" stack
  Then the address bar names that stack
```

```scenario
Scenario: The URL names the card most recently turned face-up
  Given a visitor has turned the "/plan" card
  When they then turn the "/spec" card
  Then the address bar names "/spec"
  And when they turn "/spec" back down, the address bar names the stack alone
```

```scenario
Scenario: Turning the whole stack names no single card
  Given the "dotnet" stack is open
  When a visitor turns every card at once
  Then the address bar names the stack, because no one card is meant
```

```scenario
Scenario: Browsing the deck does not fill the back button
  Given a visitor opens two stacks and turns six cards
  When they press the browser's back button once
  Then they leave the spellbook page
  And they do not step back through each turn
```

```scenario
Scenario: Going back past a deck link closes the deck
  Given a visitor followed a link to the "/code-review" card
  When they press back
  Then the address bar no longer names anything
  And the deck agrees with it: no stack is open
```

### Rule: A link a visitor did not mean is ignored, never fatal

```scenario
Scenario: A link carrying characters no card could have
  Given a link's card name contains a quotation mark
  When a visitor opens it
  Then the deck renders normally with its default stack open
  And nothing on the page reports an error
```

### Rule: The control a visitor just used stays where they can see it

```scenario
Scenario: Opening a stack lower down the row
  Given a visitor is on a laptop screen
  When they open a stack whose cards fill more than the screen
  Then the stack they activated is still on screen
  And their keyboard focus is still on it
```

```scenario
Scenario: Pressing a carousel arrow twice
  Given a visitor on a phone has pressed "next"
  When they press "next" again from the keyboard
  Then the row advances a second time
  Because focus never left the arrow
```

### Rule: Cards and stacks stay out of the sitemap while staying findable in search

```scenario
Scenario: What the sitemap offers a search engine
  Given the deck holds four stacks and thirty cards
  When a search engine reads the site's sitemap
  Then it finds the spellbook page
  And it finds neither the stacks nor the cards
```

```scenario
Scenario: Finding a card through site search
  Given a visitor searches for a phrase written on the "/explore" card
  When they look at the results
  Then that card is among them
  And following it takes them to the deck with that card turned
```

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
  Given a card for "/unmarked" has been added to the "umbraco-17" stack
  And no mark has been chosen for it
  When a visitor opens that stack
  Then the "/unmarked" card shows the umbraco-17 pack mark
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
  And both controls are still offered
```

```scenario
Scenario: A section that holds a single card
  Given a visitor on a phone opens the "umbraco-cloud" stack
  And its spells section holds one card
  When they look at that section's previous and next controls
  Then neither can be activated
  And neither can be reached by keyboard
```

Being at an end and having nowhere to go are not the same thing, and they are answered
differently. A row that *can* scroll keeps both controls live at either end: the press is a
harmless no-op, and the row itself already tells the visitor there is nothing further. A section
holding one card can never advance, so offering a live control there would promise something that
will never happen.

An inert arrow also *looks* inert: it renders at reduced opacity with a default cursor, and it no
longer responds to hover. That half matters as much as the programmatic half — assistive tech and
keyboard users were always served correctly, because the control leaves the tab order and announces
as unavailable, but a sighted mouse user would otherwise see a live-looking control that does
nothing.

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

**47 of 55 scenarios covered** by 69 tests across five behavioural specs plus the
screenshot spec. The uncovered rows are deliberate, and each says why: content operations are
content rather than behaviour, two rules are enforced by the schema or by the shape of the data
rather than by anything a visitor can do, and one is an accepted limitation.

| Scenario | Test File | Status |
|----------|-----------|--------|
| Arriving at the spellbook page | `tests/e2e/blocks/spellCardDeck.spec.ts:92` | Covered |
| A stack is already open on arrival | `tests/e2e/blocks/spellCardDeckState.spec.ts:91` | Covered |
| Opening a second stack closes the first | `tests/e2e/blocks/spellCardDeckState.spec.ts:103` | Covered |
| Closing the open stack returns to the row | `tests/e2e/blocks/spellCardDeckState.spec.ts:124` | Covered |
| Telling the open stack from the closed ones | `tests/e2e/pages/spellbook.screenshot.spec.ts:72`, `tests/e2e/pages/spellbook.screenshot.spec.ts:90` | Covered (visual — baselines pending CI) |
| A stack holding both kinds | `tests/e2e/blocks/spellCardDeck.spec.ts:156` | Covered |
| A stack holding only references | `tests/e2e/blocks/spellCardDeck.spec.ts:175` | Covered |
| Telling a spell from a reference at a glance | `tests/e2e/blocks/spellCardDeck.spec.ts:224` | Covered |
| Flipping one card | `tests/e2e/blocks/spellCardDeckState.spec.ts:185` | Covered |
| A flipped card is still flipped when the reader comes back | `tests/e2e/blocks/spellCardDeckState.spec.ts:221` | Covered |
| Showing every back in a stack | `tests/e2e/blocks/spellCardDeckState.spec.ts:246` | Covered |
| The toggle reports the cards, not its own last press | `tests/e2e/blocks/spellCardDeckState.spec.ts:277` | Covered |
| A bulk turn is announced | `tests/e2e/blocks/spellCardDeckState.spec.ts:320` | Covered |
| Correcting a card's wording | — | Not covered — content, not behaviour |
| Reordering cards within a stack | — | Not covered — content, not behaviour |
| Adding the Optimizely pack | — | Not covered — content operation |
| Opening a stack names it | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:122` | Covered |
| The URL names the card most recently turned face-up | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:140`, `tests/e2e/blocks/spellCardDeckLinks.spec.ts:158` | Covered |
| Turning the whole stack names no single card | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:178` | Covered |
| Browsing the deck does not fill the back button | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:199` | Covered |
| Going back past a deck link closes the deck | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:492` | Covered |
| A link carrying characters no card could have | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:525` | Covered |
| Opening a stack lower down the row | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:464`, `tests/e2e/blocks/spellCardDeckLinks.spec.ts:477` | Covered |
| Pressing a carousel arrow twice | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:391` | Covered |
| What the sitemap offers a search engine | `tests/e2e/blocks/spellCardDeck.spec.ts:448` | Covered |
| Finding a card through site search | — | Not covered — verified by hand when the content shipped, and again 2026-09-02 for `/testify` and `/styleguide` |
| Sharing a link to one card | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:234`, `tests/e2e/blocks/spellCardDeckLinks.spec.ts:260` | Covered |
| Opening a stack and flipping a card by keyboard | `tests/e2e/accessibility/spellCardDeck.spec.ts:177`, `tests/e2e/accessibility/spellCardDeck.spec.ts:219` | Covered |
| A screen reader is offered only the facing side | `tests/e2e/accessibility/spellCardDeck.spec.ts:242` | Covered |
| A card names itself, its kind and how to turn it | `tests/e2e/accessibility/spellCardDeck.spec.ts:268` | Covered |
| Each carousel arrow names the section it scrolls | `tests/e2e/accessibility/spellCardDeck.spec.ts:309` | Covered |
| Spells and references sized independently | `tests/e2e/blocks/spellCardDeck.spec.ts:358` | Covered |
| An editor lengthens the longest card | `tests/e2e/blocks/spellCardDeck.spec.ts:402` | Covered |
| Swiping through a stack on a phone | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:203` | Covered |
| Advancing one card at a time | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:228` | Covered |
| The controls go away on a wide screen | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:460` | Covered |
| Scrolling the row changes nothing about the cards | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:417` | Covered |
| Opening a stack on a phone | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:122` | Covered |
| Arriving on a shared link | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:234` | Covered |
| The deck at 320px | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:488`, `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:508` | Covered |
| A visitor who has asked for reduced motion | `tests/e2e/accessibility/spellCardDeck.spec.ts:451`, `tests/e2e/accessibility/spellCardDeck.spec.ts:508` | Covered |
| The deck can be placed on a page | `tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs` | Covered — palette membership is a build gate |
| Choosing a different mark for a spell | `tests/e2e/blocks/spellCardDeck.spec.ts:245` | Covered |
| An editor cannot supply their own drawing | — | Not covered — enforced by the schema, not by behaviour |
| A reference card always wears the shared mark | `tests/e2e/blocks/spellCardDeck.spec.ts:224` | Covered |
| Renaming a spell card | — | Not covered — structural: the mark is a stored value, not a lookup |
| A card with nothing to watch for | `tests/e2e/blocks/spellCardDeck.spec.ts:194` | Covered |
| An editor writes past the intended length | `tests/e2e/blocks/spellCardDeck.spec.ts:402` | Covered |
| A link to a stack that no longer exists | `tests/e2e/blocks/spellCardDeckLinks.spec.ts:275`, `tests/e2e/blocks/spellCardDeckLinks.spec.ts:293` | Covered |
| A spell with no mark assigned | `tests/e2e/blocks/spellCardDeck.spec.ts:314` | Covered |
| A stack with no art set | — | Not covered — no stack currently lacks a pack key |
| Pressing next at the end of a row | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:274`, `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:302` | Covered |
| A section that holds a single card | `tests/e2e/blocks/spellCardDeckNarrow.spec.ts:357` | Covered |
| A stack holding only two cards | `tests/e2e/blocks/spellCardDeck.spec.ts:92` | Covered |
| The toolkit gains a spell the deck does not know about | — | Not covered — accepted limitation, drift detection deferred |

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
- 2026-09-01: **Verified against the shipped implementation.** Draft banner removed; every scenario
  checked against the code and against 69 passing tests, and the coverage table filled with real
  paths and line numbers. Four Rules added for behaviour the draft never described but the build
  settled: what the URL says and what Back does with it, that a malformed link degrades rather than
  throwing, that the control a visitor just used stays on screen, and that stacks and cards stay out
  of the sitemap while remaining findable in site search. Three things the build decided that the
  draft could not: **equal height is measured across a whole section**, not per row — a spike
  confirmed `grid-auto-rows: 1fr` resolves every row to the tallest real content; **the deck assumes
  one deck per page**, since a second would share the URL fragment; and **Core's sixteen cards do not
  want a per-section collapse** (see Increments). The note about carousel arrows being visually
  indistinguishable when disabled is retired — they now render inert and stop responding to hover.
- 2026-09-01: Reconciled against design rounds 4–5. Narrow screens are now in scope rather than
  deferred: the cards become a native scroll-snap carousel under 700px with measured prev/next
  controls. Card height is equal within a section, driven by real content rather than a character-count
  estimate. Card base width 352 → 400px. Scroll-on-open is in scope, so an opened or linked stack
  brings its cards into view rather than leaving the visitor on the row.

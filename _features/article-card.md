# Feature: Article Card

The article card is the shared tile that represents an article wherever articles are listed —
the blog landing page, author pages, topic/tag listings, search results, and the "latest
articles" block's grid mode (which reuses the same card). This doc captures the card's observable
behavior.

> Some behaviors below were **reverse-engineered from the implementation** (via `/feature`
> from-code) and do not yet have a dedicated automated test — the Test Coverage table marks which
> scenarios are verified by a test and which are code-derived-but-untested.

**Source**: `_work/placeholder-graphics-imageless-cards/spec.md` (imageless-placeholder increment);
remaining behaviors backfilled from implementation (2026-08-04).
**Last verified**: 2026-08-04

---

## Increments

- [ ] Placeholder graphics for imageless article cards (`_work/placeholder-graphics-imageless-cards/spec.md`)

---

## Behaviors

Scenarios are grouped by Rule — the business rule each proves. Concrete values (Specification by
Example), business language (Ubiquitous Language). See the `bdd-principles` skill.

### Rule: Every card links to its article

```scenario
Scenario: A visitor clicks through to the article
  Given the article "Notes on Constructivism" appears as a card
  When a visitor activates the card
  Then they are taken to that article's page
```

### Rule: A card shows the article's featured image, or a branded placeholder when there is none

```scenario
Scenario: A card with a featured image shows it
  Given the article "Colour and Light" has a featured image
  When a visitor views a grid that includes it
  Then the card shows the featured image
```

```scenario
Scenario: A card with no featured image shows a branded placeholder
  Given the article "Notes on Constructivism" has no featured image
  When a visitor views a grid that includes it
  Then the card shows a branded placeholder where the image would be
  And the placeholder fills the same space a featured image would occupy
```

### Rule: The placeholder appears wherever article cards appear

```scenario
Scenario: Imageless article on an author's page
  Given the author "Ada" has written "Notes on Constructivism", which has no featured image
  When a visitor opens Ada's author page
  Then the card for "Notes on Constructivism" shows the branded placeholder
```

```scenario
Scenario: Imageless article in search results
  Given "Notes on Constructivism" has no featured image
  When a visitor searches for "constructivism" and sees it in the results
  Then its result card shows the branded placeholder
```

### Rule: A card shows the publication date and an estimated reading time

```scenario
Scenario: A card shows the date and reading time together
  Given the article "Notes on Constructivism" is dated 4 August 2026 and reads in about 5 minutes
  When a visitor views its card
  Then the card shows "Aug 4, 2026 · 5 min read"
```

```scenario
Scenario: A card with a date but no reading time shows just the date
  Given an article dated 1 June 2099 whose body is too short to estimate a reading time
  When a visitor views its card
  Then the card shows "Jun 1, 2099" with no separator after it
```

### Rule: A card shows a short teaser, preferring the article's meta description

```scenario
Scenario: The teaser prefers the meta description
  Given the article has meta description "A field guide to angular light" and subtitle "On seeing"
  When a visitor views its card
  Then the card's teaser reads "A field guide to angular light"
```

```scenario
Scenario: The teaser falls back to the subtitle
  Given the article has no meta description but the subtitle "On seeing"
  When a visitor views its card
  Then the card's teaser reads "On seeing"
```

### Rule: A card credits its author(s)

```scenario
Scenario: A single author is credited
  Given the article is written by "Ada Lovelace"
  When a visitor views its card
  Then the card shows "Posted by Ada Lovelace"
```

```scenario
Scenario: Multiple authors are credited together
  Given the article is written by "Ada Lovelace" and "Alan Turing"
  When a visitor views its card
  Then the card shows "Posted by Ada Lovelace, Alan Turing"
```

---

## Edge Cases

### Rule: The card's thumbnail is decorative for assistive technology

```scenario
Scenario: A screen-reader visitor encounters a card
  Given a visitor using a screen reader browses a list of article cards
  When they move through a card
  Then they hear exactly one link — the article title
  And the thumbnail (image or placeholder) announces nothing, being outside the reading order
```

### Rule: A card falls back to the article's name when it has no title

```scenario
Scenario: An article with a blank title field
  Given an article whose title field is blank but whose name is "Untitled Draft"
  When a visitor views its card
  Then the card's heading reads "Untitled Draft"
```

### Rule: A card omits the parts it has nothing to show

```scenario
Scenario: No date-and-reading-time line when neither exists
  Given an article with no date and no estimable reading time
  When a visitor views its card
  Then the card shows no date/reading-time line
```

```scenario
Scenario: No teaser when meta description and subtitle are both blank
  Given an article with no meta description and no subtitle
  When a visitor views its card
  Then the card shows no teaser line
```

```scenario
Scenario: No byline when the article has no author
  Given an article with no author set
  When a visitor views its card
  Then the card shows no "Posted by" line
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Every card links to its article | `tests/e2e/accessibility/cardLinks.spec.ts:95` | Covered |
| Card shows the featured image when set | `tests/e2e/articleCardPlaceholder.spec.ts:298` | Covered |
| Imageless card shows the branded placeholder | `tests/e2e/articleCardPlaceholder.spec.ts:273` | Covered |
| Placeholder appears wherever cards appear | `tests/e2e/articleCardPlaceholder.spec.ts:273` | Covered — one shared partial, asserted on the archive grid |
| Teaser prefers the meta description | `tests/e2e/articleCardMetaDescription.spec.ts:338` | Covered |
| Teaser falls back to the subtitle | `tests/e2e/articleCardMetaDescription.spec.ts:352` | Covered |
| Thumbnail is decorative (one accessible link) | `tests/e2e/articleCardPlaceholder.spec.ts:320`; `cardLinks.spec.ts:95` | Covered |
| Card matches the visual identity (placeholder) | — | Manual — not pixel-locked (baseline deferred; verified by eye) |
| Card shows date + estimated reading time | — | Not covered (code-derived) |
| Card credits its author(s) | — | Not covered (code-derived) |
| Heading falls back to the article name | — | Not covered (code-derived) |
| Card omits absent date/teaser/byline lines | — | Not covered (code-derived) |

---

## Revision Notes

- 2026-08-03: Draft scenarios from the imageless-placeholder spec (doc named at area level so it
  can grow to hold the card's other behaviors)
- 2026-08-04: Verified the placeholder behavior against implementation + E2E; Draft banner removed.
  Corrected the visual scenario to the dark constructivist mark (the spec had said "stone"). Pixel
  baseline deferred — the placeholder's look is verified by eye (see the spec's Testing Guidelines).
- 2026-08-04: Backfilled the card's full behavior (featured image, date + estimated reading time,
  teaser with meta-description-over-subtitle preference, author byline, title→name fallback, and the
  omit-when-absent rules) by reverse-engineering the implementation via `/feature` from-code. The
  date/reading-time, byline, and fallback rules have no dedicated test yet — see coverage. Flagged an
  orphaned `.article-grid-card__no-image` CSS rule and a stale view comment as Open Issues.
- 2026-08-04: Resolved both Open Issues — removed the orphaned `.article-grid-card__no-image` CSS
  rule (no view emitted it) and corrected the stale reading-time comment in the card view.

# Feature: Article Card

> **Draft** — These scenarios have not yet been verified against an implementation. They will be
> refined during planning and verified after implementation.

The article card is the shared tile that represents an article wherever articles are listed —
the blog landing page, author pages, topic/tag listings, search results, and related-article
widgets. This doc captures the card's observable behavior.

> **Scope note:** This doc was seeded by the *imageless-placeholder* increment, so only that
> behavior is documented so far. The card's other behaviors (byline, reading time, hover,
> responsive layout) exist in code but are not yet documented — a `/feature` from-code backfill
> candidate.

**Source**: `_work/placeholder-graphics-imageless-cards/spec.md`
**Last verified**: not yet verified (draft)

---

## Increments

- [ ] Placeholder graphics for imageless article cards (`_work/placeholder-graphics-imageless-cards/spec.md`, no plan yet)

---

## Behaviors

Scenarios are grouped by Rule — the business rule the scenarios prove. Use concrete values
(Specification by Example) and business language (Ubiquitous Language). See the `bdd-principles`
skill for guidance.

### Rule: Imageless article cards show a branded placeholder

```scenario
Scenario: A visitor sees a placeholder for an article with no featured image
  Given the blog landing page lists articles
  And the article "Notes on Constructivism" has no featured image
  When a visitor opens the blog landing page
  Then the card for "Notes on Constructivism" shows a branded placeholder where the image would be
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

### Rule: Articles with a featured image are unchanged

```scenario
Scenario: A visitor sees the real image for an article that has one
  Given the article "Colour and Light" has a featured image
  When a visitor views a grid that includes it
  Then the card shows the featured image
  And no placeholder is shown
```

### Rule: The placeholder matches the site's visual identity

```scenario
Scenario: A visitor sees an on-brand placeholder
  Given an article card with no featured image is shown
  Then the placeholder has square corners, not rounded ones
  And it uses the site's warm near-black and stone palette rather than a generic grey box
```

---

## Edge Cases

### Rule: The placeholder is decorative for assistive technology

```scenario
Scenario: A screen-reader visitor encounters an imageless card
  Given a visitor using a screen reader browses the blog landing page
  And "Notes on Constructivism" has no featured image
  When they move through the card for that article
  Then they hear exactly one link — the article title
  And the placeholder announces nothing, because it is not in the reading order
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Placeholder shown for imageless card | — | Not covered |
| Placeholder appears across card locations | — | Not covered |
| Real image unchanged when present | — | Not covered |
| Placeholder decorative for screen readers | — | Not covered |
| Placeholder matches visual identity | — | Not covered |

---

## Revision Notes

- 2026-08-03: Draft scenarios from the imageless-placeholder spec (doc named at area level so it
  can grow to hold the card's other behaviors)

# Spec for placeholder-graphics-imageless-cards

> This spec captures initial requirements and design rationale. For **current system
> behavior**, see the doc named on the **Work type** line below — a new feature doc for a new
> capability, an existing feature doc for a change, or a `docs/` runbook for a fix.

branch: claude/feature/placeholder-graphics-imageless-cards
design reference (if any): docs/design-system.md (Dark Constructivism × Human Signal)

**Work type**: new-capability
<!--
  No existing capability doc owns article-card rendering (the component exists in code but is
  undocumented), so change-to had no doc to fold into and fix-infra is wrong (standing,
  visitor-observable behavior). Classified new-capability — but the feature doc is named at
  AREA level (`article-card`), not behavior level, so it is the same doc a documented repo would
  already have, with this increment's placeholder behavior as its first Rule. The card's other
  (undocumented) behaviors are a `/feature` from-code backfill candidate.
-->

## Summary

When an article has no featured image, its card in an article grid currently shows an **empty
thumbnail box**. This capability fills that space with a **branded placeholder** so imageless
cards look intentional and on-brand, without requiring a content editor to supply an image.
The placeholder appears everywhere article cards appear, matches the site's visual identity,
and is purely decorative for assistive technology.

## Functional Requirements

- When an article card would render with no featured image, a branded placeholder is shown in
  the thumbnail area instead of empty space.
- The placeholder appears **wherever the article card appears** — blog landing, author detail,
  topic/tag listings, search results, and related-article widgets — because they share one card.
- The placeholder occupies the **same space and shape** a featured image would.
- The placeholder is **decorative**: a screen-reader user experiences the card exactly as today
  — one accessible link (the article title) and nothing extra announced.
- When an article **does** have a featured image, nothing changes — the image renders as before.
- The placeholder reads as a deliberate design element, visually distinct from a real photo but
  not jarring.

## Design Reference (only if one exists)

- Source: `docs/design-system.md`
- Component name: `article-grid-card` → the `.card-thumb` region
- Key visual constraints: zero border-radius (constructivist sharp corners); warm near-black /
  stone palette; signal red used sparingly; must not compete visually with the card title, which
  is the readable focal element.

## Possible Edge Cases

- An article **has** an image reference but the image fails to load at runtime (missing media
  binary) — distinct from "no image assigned"; likely out of scope for this increment.
- Very small (mobile) viewports — the placeholder must scale to the card's thumbnail aspect ratio.
- Several imageless cards in one grid — placeholders should not read as broken repetition
  (consistent-by-design or varied-per-article; see Open Questions).
- Cards on a light surface vs a dark surface — the placeholder must sit well on both.
- Reduced-motion and no-JavaScript visitors — the placeholder must not depend on motion or script.

## Acceptance Criteria

- **AC1** — A visitor viewing an article grid sees a branded placeholder in place of the
  thumbnail for any article that has no featured image.
- **AC2** — The placeholder appears wherever article cards appear, not on one page only.
- **AC3** — An article that has a featured image renders that image unchanged, with no placeholder.
- **AC4** — The placeholder is decorative: a screen-reader user experiences the card the same as
  today (exactly one announced link, no extra announced content).
- **AC5** — The placeholder matches the site's visual identity (square corners, warm palette,
  design-system tokens).

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria using Example Mapping. Each Rule maps
to an acceptance criterion; scenarios use concrete examples. These get verified and refined
after implementation — the feature doc holds the verified version.

### Rule: Imageless article cards show a branded placeholder (AC1)

```scenario
Scenario: A visitor sees a placeholder for an article with no featured image
  Given the blog landing page lists articles
  And the article "Notes on Constructivism" has no featured image
  When a visitor opens the blog landing page
  Then the card for "Notes on Constructivism" shows a branded placeholder where the image would be
  And the placeholder fills the same space a featured image would occupy
```

### Rule: The placeholder appears wherever article cards appear (AC2)

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

### Rule: Articles with a featured image are unchanged (AC3)

```scenario
Scenario: A visitor sees the real image for an article that has one
  Given the article "Colour and Light" has a featured image
  When a visitor views a grid that includes it
  Then the card shows the featured image
  And no placeholder is shown
```

### Rule: The placeholder is decorative for assistive technology (AC4)

```scenario
Scenario: A screen-reader visitor encounters an imageless card
  Given a visitor using a screen reader browses the blog landing page
  And "Notes on Constructivism" has no featured image
  When they move through the card for that article
  Then they hear exactly one link — the article title
  And the placeholder announces nothing, because it is not in the reading order
```

### Rule: The placeholder matches the site's visual identity (AC5)

```scenario
Scenario: A visitor sees an on-brand placeholder
  Given an article card with no featured image is shown
  Then the placeholder has square corners, not rounded ones
  And it uses the site's warm near-black and stone palette rather than a generic grey box
```

## Open Questions

- **Placeholder design** — a deterministic, CSS-only graphic derived from the article (e.g. a
  title-seeded geometric pattern or monogram, zero runtime cost, no media asset) **vs** reusing
  the existing flow-field image generator to pre-produce a real image (richer, but heavier and it
  creates media records). Owner / design-system decision.
- **Variation vs consistency** — should each imageless card's placeholder differ (seeded by the
  article, so a grid of them looks varied) or be one consistent mark?
- **Runtime broken images** — is "image assigned but binary missing" in scope, or only "no image
  assigned"? Recommendation: only "no image assigned" for this increment.
- **Capability-doc granularity** — the placeholder is a facet of the article card, so it is
  documented as a Rule inside the area-level `_features/article-card.md` (not a standalone
  behavior doc). The card's other behaviors (byline, reading time, hover, responsive) exist in
  code but are undocumented — a `/feature` from-code backfill candidate.

## Testing Guidelines

Meaningful tests for the cases below, without going too heavy:

- A behavioral check that an imageless card renders the placeholder element, and a card **with**
  an image does **not** (AC1, AC3).
- An accessibility assertion that the card still exposes exactly one accessible link and the
  placeholder is absent from the accessibility tree (AC4).
- One screenshot baseline for the placeholder (Linux-only baseline per repo convention), masking
  any non-deterministic region.
- Keep coverage light — one or two behavioral specs, not the same assertion duplicated per page.

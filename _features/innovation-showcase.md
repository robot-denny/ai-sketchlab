# Feature: Innovation Experiments Landing Page

> **Draft** — These scenarios have not yet been verified against an implementation. They will be refined during planning and verified after implementation.

A standalone landing page at `/experiments` that tells the story of the seven capabilities this Umbraco site has unlocked — the feature-shipping pipeline, custom slash commands, in-CMS AI, human + AI co-writing, AI-driven CMS operations, metadata-driven featured images, and algorithmic art. The page doubles as a "show and share" prop for an upcoming Umbraco developer meet-up and as the project's first production use of Block Grid layout, demonstrating areas, multi-column rows, and nested grids that other Block-List-only pages can learn from.

**Source spec**: `_specs/innovation-showcase.md`
**Last verified**: —

---

## Increments

- [ ] 2026-05-13 — v1: seven-pillar Experiments landing page on Block Grid, with hero, closing CTA, and bespoke `pillarSection` / `featureCard` / `commandBadge` / `statCallout` / `pullQuoteBlock` / `embeddedSketch` / `timelineRow` element types. Registered against any Block Grid property on the site (general abstraction). (spec: `_specs/innovation-showcase.md`)
- [ ] Future: editor "pillar template" picker so editors can drop a pre-arranged pillar (header + body + media) in one click (no spec yet)
- [ ] Future: a second landing page that re-uses `pillarSection` on a different topic, once the abstraction is battle-tested

---

## Behaviors

Scenarios are grouped by Rule — the business rule or acceptance criterion that the scenarios prove. Use concrete values (Specification by Example) and business language (Ubiquitous Language). See `.claude/skills/BDD.md` for guidance.

### Rule: The showcase page presents seven pillars from hero to closing CTA

```scenario
Scenario: A visitor lands on the showcase page
  Given the Experiments Landing Page has been published at /experiments
  When a visitor opens https://ai-sketchlab.dev/experiments
  Then the visitor sees a full-bleed hero with the headline "What this Umbraco site has unlocked"
  And the visitor sees seven pillars in order, each numbered 1 to 7
  And the visitor sees a closing band with a single primary CTA labelled "See the full capability tracker"
  And the CTA links to /capabilities
```

```scenario
Scenario: Each pillar carries a distinct headline
  Given the visitor is on /experiments
  When the visitor scrolls through the page
  Then the visitor sees pillar headlines in this order:
    "A repeatable way to ship features",
    "Custom commands that compress hours into one step",
    "AI sits inside the editing experience",
    "Human and AI, co-writing transparently",
    "The AI assistant can act on the CMS",
    "Featured images that match the article",
    "Generative art for decorative visuals"
```

### Rule: The page is built with Block Grid and demonstrates its core features

```scenario
Scenario: The page uses Block Grid
  Given a CMS editor opens the Experiments Landing Page in the backoffice
  When the editor opens the body editor
  Then the editor sees a Block Grid editor with a 12-column grid
  And the editor does not see a Block List editor on the page
```

```scenario
Scenario: A pillar uses areas to combine header, body and media
  Given the CMS editor is editing the "AI sits inside the editing experience" pillar
  When the editor inspects the pillar block
  Then the editor sees three named areas: "header", "body", and "media"
  And the "body" area accepts Rich Text, Feature Card, and Pull Quote blocks
  And the "media" area accepts Image blocks only
```

```scenario
Scenario: A pillar uses a nested grid
  Given the CMS editor is editing the "Custom commands" pillar
  When the editor inspects the body area
  Then the editor sees a row of three Feature Card blocks arranged side by side at column spans 4, 4, 4
```

### Rule: A CMS editor can edit every piece of copy on the page from the backoffice

```scenario
Scenario: Editor changes the hero headline
  Given a CMS editor is editing the Experiments Landing Page
  When the editor changes the hero headline from "What this Umbraco site has unlocked" to "What we built"
  And the editor saves and publishes the page
  Then a visitor opening /experiments sees the new headline "What we built" in the hero
```

```scenario
Scenario: Editor updates a stat callout
  Given a CMS editor is editing the orchestration pillar
  When the editor changes the stat figure from "every article" to "127 articles"
  And the editor saves and publishes
  Then a visitor sees the figure "127 articles" rendered in the pillar's stat callout
```

### Rule: A CMS editor can restructure the pillars without breaking the page

```scenario
Scenario: Editor reorders two pillars
  Given a CMS editor is viewing the Block Grid editor for the Experiments Landing Page
  When the editor drags pillar 6 above pillar 5
  And the editor saves and publishes
  Then a visitor sees the pillar previously labelled 6 appear before the pillar previously labelled 5
  And the page layout, surface alternation, and typography remain coherent
```

```scenario
Scenario: Editor removes a pillar
  Given the Experiments Landing Page has seven pillars
  When the CMS editor deletes pillar 4
  And the editor saves and publishes
  Then a visitor sees six pillars on the page
  And the remaining pillars still display in a readable rhythm
```

### Rule: The showcase blocks render in both editors from one shared view (pillarSection excepted)

```scenario
Scenario: A showcase block reused on a Block List page renders the same as on the grid
  Given the showcase blocks (featureCard, commandBadge, statCallout, pullQuoteBlock, embeddedSketch, timelineRow, showcaseHero) each have a single view at Views/Partials/blocks/Components/{alias}.cshtml
  When one of them is placed in a Block List rather than the Experiments Block Grid
  Then it renders identically in both editors
  And no editor-specific duplicate view exists for it
```

```scenario
Scenario: pillarSection stays grid-only because it uses Block Grid areas
  Given pillarSection combines named header/body/media areas that only Block Grid provides
  When a CMS editor opens a Block List body
  Then pillarSection is not offered in the Block List palette
  And its view remains at Views/Partials/blockgrid/Components/pillarSection.cshtml
```

### Rule: The page uses the Dark Constructivism × Human Signal design system

```scenario
Scenario: One pillar uses the signal-red accent surface
  Given a visitor is on /experiments
  When the visitor scrolls to the pillar marked as the "accent" tone
  Then the pillar's background colour is the project's signal red token
  And the pillar's text is rendered in the warm off-white token
  And the pillar has no rounded corners
```

```scenario
Scenario: The page does not inherit Bootstrap defaults
  Given the showcase page has been rendered
  When the rendered CSS for buttons and cards is inspected
  Then no element on the page uses #005E70 teal, #8859b6 purple, or border-radius greater than 0
```

### Rule: The page is responsive from desktop to small mobile

```scenario
Scenario: Multi-column rows stack on a small viewport
  Given a visitor opens /experiments on a viewport 390px wide
  When the page renders
  Then every multi-column pillar row stacks vertically
  And the pull quote becomes full-width with a left-border accent
  And no horizontal scroll appears
```

```scenario
Scenario: The page is legible at tablet width
  Given a visitor opens /experiments on a viewport 768px wide
  When the page renders
  Then card grids render at 2 columns
  And pillar header / body / media areas remain visible without overlap
```

### Rule: The algorithmic-art pillar respects reduced motion and degrades gracefully

```scenario
Scenario: A visitor with reduced-motion preference reaches the algorithmic-art pillar
  Given a visitor has set their OS to prefer reduced motion
  When the visitor scrolls to the "Generative art for decorative visuals" pillar
  Then the visitor sees the static poster image instead of an animated sketch
  And no animation plays
```

```scenario
Scenario: The sketch iframe fails to load
  Given the sketch HTML at the configured URL is unavailable
  When a visitor scrolls to the algorithmic-art pillar
  Then the visitor sees the poster image in place of the sketch
  And no error message is shown to the visitor
```

### Rule: The page passes the three-reviewer code review

```scenario
Scenario: Running /code-review on the showcase work
  Given the Experiments Landing Page implementation is complete
  When a developer runs /code-review on uncommitted changes
  Then the accessibility reviewer reports no new HIGH or CRITICAL findings
  And the code-quality reviewer reports no new HIGH or CRITICAL findings
  And the perf reviewer reports no new HIGH or CRITICAL findings
```

### Rule: Asset placeholders are documented and the page ships structurally complete

```scenario
Scenario: The page ships with placeholder assets in place
  Given the implementation has been deployed before final assets are produced
  When a visitor opens /experiments
  Then the visitor sees a structurally complete page
  And every media slot displays either the final asset or a clearly-labelled placeholder image
  And replacing a placeholder media item in the backoffice updates the page with no developer involvement
```

### Rule: The page is reachable from the main site navigation

```scenario
Scenario: Visitor finds the page from the top nav
  Given the Experiments Landing Page is published and not hidden from top navigation
  When a visitor opens any page on the site
  Then the top navigation contains a link labelled "Experiments"
  And the link points to /experiments
```

### Rule: The new schema deploys cleanly

```scenario
Scenario: Running /check-uda before pushing
  Given the new Experiments Landing Page document type, element types and data types have been created and saved
  When a developer runs /check-uda
  Then the report shows no conflicts at LOW, MEDIUM, HIGH, or CRITICAL severity
  And no built-in entity drift is introduced by the new schema
```

---

## Edge Cases

### Rule: Editor structural changes never crash the page

```scenario
Scenario: Editor leaves the embedded sketch URL empty
  Given the algorithmic-art pillar has been edited
  When the editor clears the sketch URL field but leaves the poster image
  And the editor publishes the page
  Then a visitor sees the poster image in the pillar's media slot
  And no iframe is mounted in the DOM
```

```scenario
Scenario: Editor adds an eighth pillar
  Given the Experiments Landing Page has seven pillars
  When the CMS editor adds an eighth pillar and publishes
  Then a visitor sees eight pillars
  And surface alternation between primary and secondary continues without two adjacent pillars sharing a surface tone
```

---

## Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| A visitor lands on the showcase page | `tests/e2e/experiments/experiments.spec.ts` | Not covered |
| Each pillar carries a distinct headline | `tests/e2e/experiments/experiments.spec.ts` | Not covered |
| The page uses Block Grid (backoffice) | `tests/e2e/experiments/experiments.blockgrid.spec.ts` | Not covered |
| A pillar uses areas to combine header, body and media | `tests/e2e/experiments/experiments.blockgrid.spec.ts` | Not covered |
| A pillar uses a nested grid | `tests/e2e/experiments/experiments.blockgrid.spec.ts` | Not covered |
| Editor changes the hero headline | `tests/e2e/experiments/experiments.blockgrid.spec.ts` | Not covered |
| Editor updates a stat callout | `tests/e2e/experiments/experiments.blockgrid.spec.ts` | Not covered |
| Editor reorders two pillars | `tests/e2e/experiments/experiments.blockgrid.spec.ts` | Not covered |
| Editor removes a pillar | `tests/e2e/experiments/experiments.blockgrid.spec.ts` | Not covered |
| One pillar uses the signal-red accent surface | `tests/e2e/experiments/experiments.designSystem.spec.ts` | Not covered |
| The page does not inherit Bootstrap defaults | `tests/e2e/experiments/experiments.designSystem.spec.ts` | Not covered |
| Multi-column rows stack on a small viewport | `tests/e2e/experiments/experiments.responsive.spec.ts` | Not covered |
| The page is legible at tablet width | `tests/e2e/experiments/experiments.responsive.spec.ts` | Not covered |
| Visitor with reduced-motion preference | `tests/e2e/experiments/experiments.reducedMotion.spec.ts` | Not covered |
| The sketch iframe fails to load | `tests/e2e/experiments/experiments.reducedMotion.spec.ts` | Not covered |
| /code-review pass on showcase work | — | Not covered (manual gate) |
| Page ships with placeholder assets | `tests/e2e/experiments/experiments.spec.ts` | Not covered |
| Visitor finds the page from the top nav | `tests/e2e/experiments/experiments.spec.ts` | Not covered |
| /check-uda before pushing | — | Not covered (manual gate) |
| Editor leaves the embedded sketch URL empty | `tests/e2e/experiments/experiments.reducedMotion.spec.ts` | Not covered |
| Editor adds an eighth pillar | `tests/e2e/experiments/experiments.spec.ts` | Not covered |
| A showcase block reused on a Block List page renders the same as on the grid | [BlockRenderCoverageTests.cs](../tests/UmbracoProject.Tests/BlockRenderCoverageTests.cs), [blockParity.spec.ts](../tests/e2e/blocks/blockParity.spec.ts) | Covered |
| pillarSection stays grid-only because it uses Block Grid areas | [blockParity.spec.ts](../tests/e2e/blocks/blockParity.spec.ts) (pillarSection not in Block List) | Covered |

---

## Revision Notes

- 2026-05-13: Draft scenarios from initial spec
- 2026-07-16: Block editor parity. The showcase blocks (featureCard, commandBadge, statCallout, pullQuoteBlock, embeddedSketch, timelineRow, showcaseHero) now render from **one shared, editor-agnostic view** at `Views/Partials/blocks/Components/{alias}.cshtml` and are available in both Block List and Block Grid by default (palette membership is admin-discretionary, parity is the default). **`pillarSection` stays grid-only** — it uses Block Grid areas and keeps its view at `blockgrid/Components/pillarSection.cshtml`; nested sub-lists stay parent-scoped. Content blocks are now offered in the Experiments grid too. Added a Rule + two coverage rows. Cross-cutting change — convention in CLAUDE.md → *Block / component rendering & parity*; spec/plan archived under `_specs/shipped/` and `_plans/shipped/block-editor-parity-and-reuse-readiness.md`. (This doc remains a Draft — the page-behavior scenarios above are still unverified against an implementation.)

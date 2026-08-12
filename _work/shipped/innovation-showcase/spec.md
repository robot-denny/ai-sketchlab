# Spec for innovation-showcase

> This spec captures initial requirements and design rationale. For **current system behavior**, see `_features/innovation-showcase.md`.

branch: claude/feature/innovation-showcase
figma_component (if used): —

## Summary

A standalone landing page that doubles as (a) a "show and share" prop for the upcoming Umbraco developer meet-up and (b) the project's first production use of **Block Grid** layout (the rest of the site is Block List). It tells the story of the seven distinct capabilities this site has unlocked — repeatable feature workflow, custom slash commands, AI inside the CMS, human+AI co-authorship, AI-driven content operations, metadata-driven image generation, and algorithmic art — using a multi-column, area-nested grid layout that flexes what Block Grid can do.

The page lives at `/experiments` (nav label: **Experiments**), follows the **Dark Constructivism × Human Signal** design system already documented in [_specs/design-system.md](_specs/design-system.md), and is editable end-to-end by CMS editors (no copy is hard-coded in Razor).

## Functional Requirements

### Content & narrative

- A new top-level page at `/experiments`, reachable directly by URL and from the main site navigation under the label **Experiments**.
- The page's narrative is structured as **one pillar per capability**, in this order:
  1. **A repeatable way to ship features** — the spec → plan → test-first build → behavior doc → review pipeline. Nine shipped features as evidence.
  2. **Custom commands that compress hours of work into one step** — `/spec`, `/plan`, `/block`, `/feature`, `/code-review`, `/check-uda`, `/cms-image`, `/guide`, `/umbraco-edit`. The three-reviewer code review pass is the standout.
  3. **AI sits inside the editing experience** — agents with distinct personas, in-place prompts (summarize, alt text), brand-voice contexts, semantic search.
  4. **Human + AI co-writing, transparently** — the "Ella" persona, per-block AI attribution, disclosure-by-default editorial stance.
  5. **The AI assistant can act on the CMS, not just suggest** — bulk SEO across every article, new content types created via chat, every block and feature documented as a how-to guide, publish/unpublish/move/restore from chat.
  6. **Featured images that match the article** — flow-field generation seeded from article metadata, palettes managed as CMS content.
  7. **Generative art for decorative visuals** — interactive p5.js compositions for purely decorative moments.
- Open and close the page with a **hero band** ("What this Umbraco site has unlocked") and a **closing band** (a short "what's next" line + a single primary CTA pointing at the internal Capabilities tracker for visitors who want the long-form list).
- Visitor-facing copy uses plain language. No "MCP", "Management API", "OAuth", ".uda", "embeddings", "RED→GREEN", etc. Capability first; technique second only when it adds meaning.

### Block Grid layout & demonstration goals

- The page must use **`Umbraco.BlockGrid`** as the body editor (not Block List), with a 12-column grid.
- The layout must visibly demonstrate each of these Block Grid features so it doubles as a reference example:
  - **Full-bleed sections** (hero, closing band).
  - **Multi-column rows** at varying spans (e.g. 8/4 split for the workflow pillar, 6/6 for the co-writing pillar, 4/4/4 for the command grid).
  - **Areas inside a parent block** (a `Pillar Section` block with `header`, `body`, and `media` areas, where each area allows different child block types).
  - **Nested grids** (a card grid inside a pillar's `body` area).
  - **Reuse of existing element types** — at least the Rich Text and Image blocks should also be allowed inside pillar areas so editors can drop ad-hoc explainer content alongside the new bespoke blocks.
- Responsive collapse: every multi-column row stacks vertically below the Bootstrap `lg` breakpoint (992px) and remains readable at 390px.

### New block element types

To support the page without bloating the schema, introduce a small set of bespoke element types. Each is reusable on future pages.

| Element type | Purpose | Notable fields |
|---|---|---|
| `showcaseHero` | Page-opening band. Full-bleed dark imagery + warm overlay text. | `eyebrow`, `headline` (h1), `subhead`, `backgroundImage` (media picker), optional `accentMark` (string for a small monospaced label) |
| `pillarSection` | Parent block that frames one capability. Uses Block Grid **areas**: `header` (eyebrow + h2 + lede), `body` (free-form blocks), `media` (image / sketch embed / generated image). | `pillarNumber` (1–7), `tone` (light / dark / accent dropdown to control surface), `anchorId` (slug for in-page links) |
| `featureCard` | Single capability card in a multi-card row. | `eyebrow`, `title`, `body` (short rich text), optional `icon` (string token), optional `link` |
| `commandBadge` | A `/slash-command` chip with a one-line description. | `commandName` (e.g. `/code-review`), `oneLiner`, optional `meta` (e.g. "runs three reviewers in parallel") |
| `statCallout` | A single large number + caption + supporting line. | `figure` (string — e.g. "9", "115", "3×"), `unit` (e.g. "features shipped"), `supporting` (one short sentence) |
| `pullQuoteBlock` | Editorial pull quote with attribution. Used for the Ella pillar and at least once elsewhere. | `quote`, `attribution`, `attributionRole` (e.g. "AI persona, contributing author"), `tone` (light / dark) |
| `embeddedSketch` | Iframe or `<canvas>`-host slot for the algorithmic-art piece. Falls back gracefully to a static PNG poster. | `sketchUrl` (string — relative path to a sketch HTML), `posterImage` (media picker — required), `caption`, `reducedMotionPoster` (always shows poster under `prefers-reduced-motion`) |
| `timelineRow` | A single row in a horizontal "shipped features" timeline. | `date` (date), `featureName`, `oneLiner`, optional `link` |

Existing element types (`richTextRow`, `imageRow`, `iconLinkRow`, `alertBanner`) must remain allowed inside pillar `body` areas so editors stay flexible.

### Document type

- New document type **`Experiments Landing Page`** (alias `experimentsLandingPage`), hidden from `articleList`-style listings.
- Allowed under **Home** as a single child page; route segment `experiments`.
- Composes **Visibility Controls**, **Page Head Pattern Controls**, **SEO**, and **Section Navigation Controls** to inherit the standard chrome. The page-content template does **not** render the section-nav sidebar — this is a landing page using the full viewport width for design.
- Single content property: `body` (Block Grid, 12 columns).

### Visual design (per design-system.md)

- **Hero**: full-bleed dark surface (`--surface-dark` with `--surface-overlay`), Cormorant headline at weight 600, warm off-white text (`--text-on-dark`), generous vertical padding (`--space-2xl` top/bottom). Optional small monospaced "accent mark" rendered in IBM Plex Mono, signal-red dot or wedge as nod to the constructivist tradition.
- **Pillar sections** alternate between `--surface-primary` (warm paper white) and `--surface-secondary` (warm stone) so the eye gets rhythm without horizontal rules.
- **One pillar** uses the **accent variant** (`--accent-primary` background, `--text-on-dark` text) for emphasis — most likely Pillar 5 (the orchestration / "act on the CMS" pillar) because it carries the strongest "what this unlocks" message.
- **Sharp corners** throughout (`border-radius: 0`).
- **Card grid** uses the existing card rhythm: no shadow at rest, subtle elevation on hover, 3 columns at `lg`, 2 at `md`, 1 at `sm`, gap of `--space-lg`.
- **Pull quote** floats into the left margin on desktop (`margin-left: -2rem`); on mobile becomes full-width with a left-border accent.
- **Stat callouts** use Cormorant for the figure at very large size, Source Sans 3 for the supporting copy. Signal red allowed for the figure on dark surfaces, warm bronze on light.
- **Embedded sketch** sits in the `media` area of the algorithmic-art pillar, framed by the constructivist near-black, with the static poster image preloaded.
- **Closing band**: full-bleed `--surface-dark`, single primary CTA button (signal red, sharp corners, uppercase Source Sans 3) → `/capabilities`.

### Editor experience

- Block Grid editor must show meaningful **labels** for each block so the page is legible in the backoffice (use Umbraco's "Label" setting per element type, referencing key fields).
- `pillarSection` should display its `headline` and `pillarNumber` as the label, e.g. *"3 — AI sits inside the editing experience"*.
- Area constraints must be configured so editors can't accidentally drop a `showcaseHero` inside a pillar's `media` area, etc.
- The page is shipped pre-populated with all seven pillars and the hero/closing bands, written in the plain-language voice from the chat thread. Editors can refine copy but should not need to assemble the structure from scratch.

### Accessibility

- Headings form a single coherent outline: h1 (hero), h2 per pillar, h3 inside cards / sub-sections. No skipped levels.
- All decorative imagery (hero background, embedded sketch poster) carries empty `alt=""` when present; meaningful imagery (e.g. an example generated featured image) carries descriptive alt text supplied by the editor.
- `prefers-reduced-motion`: the embedded sketch displays its poster image instead of running.
- Color contrast: every text/surface pairing meets WCAG AA per the tokens in design-system.md.
- Focus-visible: every link and button on the page has a visible focus ring (existing site-wide treatment).
- The page must pass the `/code-review` accessibility pass with no new HIGH or CRITICAL findings.

### Performance

- Above-the-fold hero image is preloaded; below-the-fold imagery is lazy-loaded.
- The embedded p5.js sketch only initializes when its container scrolls into view (IntersectionObserver). It also pauses when scrolled out.
- No new render-blocking CSS or JS at the page level — bespoke block CSS lives in component-scoped files appended to the existing pipeline.

### Asset placeholders

These need editor-supplied assets before launch. Each is captured in the spec as a named placeholder so the implementation can ship structurally complete with stand-ins:

- **`hero-background.png`** — Dark Constructivism canvas, 16:9 minimum 2400×1350. Generate via the existing `/canvas-design` skill using the `radical-android-2026-04-09-philosophy.md` brief; or via the `/cms-image` flow-field generator with a "showcase" palette.
- **`workflow-diagram.svg`** — Five-stage horizontal diagram of the spec → plan → block → feature → review pipeline. Inline SVG preferred so colors track CSS tokens. *I will provide a one-page sketch brief; you procure or commission.*
- **`example-generated-featured-image.png`** — One real featured image produced by the article-metadata generator, captioned with the article it was generated for. *Pull from an existing article on the site; no new asset needed.*
- **Ella portrait** — *Already exists.* Reuse the portrait currently rendered on Ella's Author page (lives in the media library). No new asset needed; the implementation should reference the same Umbraco media item via media picker rather than re-uploading.
- **`algorithmic-art-sketch.html`** — Self-contained interactive p5.js sketch (output of the `/algorithmic-art` skill), hosted under `wwwroot/experiments/sketches/`. *I will provide the brief; you generate via the skill.*
- **`algorithmic-art-poster.png`** — Static PNG export of the same sketch, for `prefers-reduced-motion` and SSR fallback. *Captured from the sketch's download button.*
- **`code-review-screenshot.png`** *(optional, nice-to-have)* — Screenshot of a `/code-review` run in the IDE, lightly redacted. Used in the pillar 2 media slot.

## Figma Design Reference

None — design is driven by [_specs/design-system.md](_specs/design-system.md) and the constructivist canvas brief.

## Possible Edge Cases

- **Editor reorders pillars**: page must still read coherently. Pillar numbers come from the block's own `pillarNumber` field, not the loop index, so editors who reorder need to renumber. (Acceptable: the field is editorial, not auto-computed.)
- **Editor adds an 8th or 9th pillar**: design should not break. Surface alternation continues; accent-variant pillar (red) remains a single chosen pillar.
- **Editor leaves the embedded sketch URL empty**: block renders the poster image only, no iframe attempted.
- **`prefers-reduced-motion`**: all decorative motion (sketch, any hover scale effects, section reveal animations) is suppressed.
- **Mobile (390px)**: every multi-column row stacks; pull quote loses the negative-margin float and gets a left-border accent instead; stat callout figures scale down but remain at least 64px tall.
- **No JavaScript / iframe blocked**: the algorithmic-art pillar renders the poster image only, still legible.
- **Accent-variant pillar with no media**: still readable; the body area expands to the full width.
- **Sketch fails to load** (network error): the poster image stays in place; no error UI surfaces to the visitor.
- **Backoffice preview**: every new element type renders something sensible in the Block Grid editor preview (a label + a few key fields).
- **`/check-uda`** must report no conflicts after the new doc type and data types ship.

## Acceptance Criteria

1. A visitor can navigate to `/experiments` and see a single, coherent page that opens with a full-bleed hero, presents seven distinct pillars of capability, and closes with a CTA to the Capabilities page.
2. The page is built using Umbraco Block Grid (not Block List) with a 12-column grid and uses areas, multi-column rows, and nested grids at least once each.
3. A CMS editor can edit the hero copy, each pillar's content, the pull quote, the stat callouts, and the closing band entirely from the backoffice without touching code.
4. A CMS editor can add a new pillar, reorder pillars, or remove a pillar from the backoffice and the page remains visually coherent.
5. The page uses the project's Dark Constructivism × Human Signal design tokens — no Bootstrap-default colors, no rounded corners, no purple links — and at least one pillar uses the signal-red accent surface.
6. The page renders correctly at 1440px, 768px, and 390px viewports; every multi-column row stacks below `lg`.
7. The algorithmic-art pillar renders its interactive sketch when the visitor reaches it; under `prefers-reduced-motion` or when the iframe fails to load, it shows the static poster image instead.
8. The page passes a `/code-review` pass with no new HIGH or CRITICAL findings from any of the three reviewers (accessibility, code quality, performance).
9. Asset placeholders are named, sized, and documented in the spec; the page ships structurally complete with stand-ins so real assets can be swapped in without further dev work.
10. The page is reachable from the main site navigation as **Experiments**.
11. `/check-uda` reports no schema conflicts after the new document type, element types, and data types are deployed.

## Scenarios (Draft)

Drafted via Example Mapping: each acceptance criterion becomes a Rule; scenarios use concrete values and the project's ubiquitous language ("visitor", "CMS editor", "page", "pillar", "block"). These will be refined and verified after implementation.

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

## Resolved Decisions

(Captured from the original Open Questions; resolved before planning.)

- **Page label in top nav**: **Experiments**. Route segment `experiments`.
- **Accent-variant pillar**: Pillar 5 (the orchestration / "the AI can act on the CMS" pillar) carries the signal-red surface.
- **Embedded sketch hosting**: static under `wwwroot/experiments/sketches/`, same-origin (no external iframe).
- **Section navigation sidebar**: not rendered on this page. The landing page uses the full viewport width for design and composition.
- **`pillarSection` reuse**: registered against any Block Grid property on the site (not scoped to Experiments Landing Page).
- **Ella portrait asset**: already exists in the media library — used on the Author page. Reuse the same media item; do not generate or upload a new one.
- **Reading-time helper**: not used on this page (landing page, not an article).
- **XML sitemap**: included (discoverable).
- **Block Grid column count**: 12 (standard).

## Testing Guidelines

Create test files under `tests/e2e/experiments/` for the new feature. Cover, without going too heavy:

- **`experiments.spec.ts`** — visitor-facing rendering: page loads, hero headline visible, all seven pillars present in order, closing CTA links to `/capabilities`, main-nav "Experiments" link is present and clickable.
- **`experiments.responsive.spec.ts`** — viewport snapshots at 1440, 768, 390: no horizontal scroll, multi-column rows stack at `<lg`, pull quote falls back from negative-margin float to left-border treatment.
- **`experiments.blockgrid.spec.ts`** — backoffice: create a transient Showcase page via Management API, confirm Block Grid editor opens (not Block List), confirm a Pillar block exposes three named areas (`header`, `body`, `media`), confirm allowed children per area, then tear down.
- **`experiments.reducedMotion.spec.ts`** — set `prefers-reduced-motion: reduce`, navigate to `/experiments`, confirm the algorithmic-art pillar renders the poster image and no `<iframe>` is mounted (or, if mounted, the sketch is paused).
- **`experiments.designSystem.spec.ts`** — render audit: assert no element on the page uses the inherited Bootstrap palette tokens (`#005E70`, `#8859b6`, `border-radius >= 0.375rem`) — use a regex CSS check against computed styles for sampled elements rather than asserting on raw CSS file content.

Resilience rules from CLAUDE.md apply: never hardcode Umbraco UUIDs, never hardcode URL slugs (fetch from API), clean stale test data in `beforeAll`, re-acquire tokens between phases, use regex for any string assertions, prefer browser assertions over file-content assertions.

# Living Style Guide — Phase 0 Discovery Notes

**Date:** 2026-04-29
**Status:** Pre-spec discovery only. No code changes, no commits, no spec/plan files.
**Purpose:** Surface the inputs and open architectural decisions for a `/styleguide` page (brand summary + colors + typography + general elements) plus a separate `/components` page.

---

## Three decisions to make before drafting the spec

### Decision 1 — Colors source-of-truth

| Option | Pros | Cons |
|---|---|---|
| **CSS-first** (single source — parse `tokens-extras.css` at build/render to populate the page) | Auto-updates when CSS changes. Single source of truth. Matches the typography section's "real classes drive real rendering" pattern. | Needs a parsing step (build-time script or runtime regex over the file) and a rendering convention. CSS comments are the only place to put the human-friendly caption ("primary action / signal red") — fragile if anyone reorders the file. |
| **CMS-first** (palette modeled as repeatable property — author types name, hex, caption per swatch) | Simplest render (just iterate a list). Captions are first-class. Editorially flexible. | Two sources to keep in sync — CMS palette can drift from CSS. Defeats the "self-updating" goal. |
| **Hybrid** (swatches rendered from CSS variables via JS / runtime computed-style; captions/groupings live in CMS) | Color values stay tied to CSS. Captions stay editor-friendly. | Most moving parts. Need to agree on a registry of "which tokens to show" — and that registry has to live somewhere. |

**My read of the tradeoff:** CSS-first wins if we accept a small "inline metadata" convention (e.g. `/* @swatch: name: "Signal Red", role: "primary action" */` markers above each `--accent-*` line, parsed by a partial). The TipTap dropdown already uses the exact same convention (`/**umb_name:foo*/` markers) — so the pattern is already in the codebase. Hybrid adds complexity without removing the registry problem.

**Flagging — your call.**

### Decision 2 — TipTap dropdown gap scope

**The gap is far bigger than "missing a few classes."** [dropdownStyles.css](src/UmbracoProject/wwwroot/css/dropdownStyles.css) currently contains only `h2`, `h3`, `h4` size overrides — **zero** Package C typographic classes are exposed to authors. The class-picker dropdown is functionally empty of brand styles.

| Option | Reasoning |
|---|---|
| **In-scope** for the styleguide spec | The styleguide is supposed to render real classes. If the dropdown doesn't expose them, authors can't apply them in rich text — so the typography section becomes documentation for capabilities that aren't reachable. Tightly coupled deliverable. |
| **Separate prerequisite spec** (small, ships first) | Cleaner scope. The styleguide can document "available editor classes" against whatever's exposed today; the dropdown work is its own atomic change with its own QA path (test in TipTap, not just CSS). |

**My read:** they're causally coupled (styleguide is meaningless without exposed classes) but mechanically independent (dropdown fix is a 1-file CSS change + a TipTap re-test, no Razor/CMS work). Splitting them keeps each spec tight. **Flagging — your call.**

### Decision 3 — Block Grid commitment for /components

The investigation is unambiguous: **a /components reference page does not need Block Grid.** Block Grid earns its complexity when editors need to compose 2D layouts with column/row spans and named areas. A reference page is a linear catalog — one block per row, label above, example below. Block List does that natively.

| Option | Tradeoff |
|---|---|
| **Use Block List** (honest fit) | Simple, ships fast. Doesn't exercise Block Grid (the secondary "test it out" goal). |
| **Use Block Grid anyway** (force fit to exercise it) | Exercises Block Grid mechanics (areas, span configuration, row layout config) but adds editorial complexity that won't reflect any real-world page on this site. The team's first hands-on with Block Grid would be on a use case that doesn't need it. |
| **Use Block List for /components, find a different home for Block Grid trial** | Honest fit for /components + leaves the Block Grid test for a layout that actually wants 2D composition (e.g. a future campaign landing page). Two specs instead of one. |

**My read:** option 3. Block Grid deserves a trial run on a layout where 2D composition is the actual point — forcing it into a list-of-blocks reference page would cement the wrong mental model. **Flagging — your call.**

---

## Audit 0a — Brand material inventory

| Path | Covers | Status | Feed brand-summary section? |
|---|---|---|---|
| [docs/brand.md](docs/brand.md) | Voice pillars (Dennis + Ella personas), ethical posture, visual intent, tone boundaries | **Canonical** — self-described as "north-star" | **Yes — anchor.** Brand summary text should derive from this. |
| [docs/context.md](docs/context.md) | Author personas, multi-author dialogue concept, content strategy | **Canonical** — operational context | **Yes — supplementary.** Use for the human–AI collaboration framing. |
| [_specs/design-system.md](_specs/design-system.md) | Dark Constructivism visual language, type system rationale, palette philosophy, motion language | **Canonical** — comprehensive design system reference | **Yes — visual identity rationale.** "Evocative vocabulary" section especially. |
| [_design-system-handoff/HANDOFF.md](_design-system-handoff/HANDOFF.md) | Package A foundation, install steps, CSS file structure | Transitional | No — implementation scaffolding |
| [_design-system-handoff/MASTHEAD-DECISION.md](_design-system-handoff/MASTHEAD-DECISION.md) | Article masthead model | Transitional (self-marks superseded) | No |
| [_design-system-handoff/CLEAN-BLOG-INVENTORY.md](_design-system-handoff/CLEAN-BLOG-INVENTORY.md) | Clean Blog CSS audit (pre-rollout) | Transitional | No |
| [_design-system-handoff/README-PACKAGE-B.md](_design-system-handoff/README-PACKAGE-B.md) | Razor partials inventory, Package B wiring | Transitional | No |

**Net:** brand summary is sourced from `docs/brand.md` + `docs/context.md` + the brand-intent passages of `_specs/design-system.md`. Handoff docs are excluded.

**Editability:** brand summary text should be CMS-editable rich text (per criteria) — pre-seeded from these sources at the time of authoring, but not auto-synced (these are markdown docs, not data).

---

## Audit 0b — Design system tokens

**Token files** (in load order — see [site.cshtml](src/UmbracoProject/Views/site.cshtml) or `_Layout.cshtml`):
- [wwwroot/css/typography.css](src/UmbracoProject/wwwroot/css/typography.css) — typeface stacks, classes
- [wwwroot/css/tokens-extras.css](src/UmbracoProject/wwwroot/css/tokens-extras.css) — semantic tokens (text/surface/accent/status/border/spacing/motion)
- [wwwroot/css/site-chrome.css](src/UmbracoProject/wwwroot/css/site-chrome.css) — chrome utilities + Bootstrap aliases

### Tokens grouped by semantic role

| Group | Tokens |
|---|---|
| **Typeface stack** | `--font-display` (Cormorant Garamond), `--font-body` (Source Sans 3), `--font-mono` (IBM Plex Mono) |
| **Text** | `--text-primary` `--text-secondary` `--text-tertiary` `--text-on-dark` `--text-on-dark-secondary` |
| **Surface** | `--surface-primary` `--surface-secondary` `--surface-tertiary` `--surface-dark` `--surface-dark-elevated` `--surface-overlay` |
| **Accent** | `--accent-primary` `--accent-primary-hover` `--accent-primary-subtle` `--accent-primary-light` `--accent-secondary` `--accent-secondary-hover` `--accent-tertiary` |
| **Status** | `--status-success` `--status-warning` `--status-error` `--status-info` |
| **Border** | `--border-light` `--border-medium` `--border-dark` `--border-accent` |
| **Spacing** | `--space-xs` (4) `--space-sm` (8) `--space-md` (16) `--space-lg` (32) `--space-xl` (64) `--space-2xl` (128) — px values |
| **Motion** | `--ease-micro` (150ms) `--ease-standard` (250ms) `--ease-emphasis` (350ms) |
| **Dark Constructivism (imagery)** | `--dc-obsidian` `--dc-anthracite` `--dc-graphite` `--dc-charcoal` `--dc-slate` `--dc-signal` |
| **Pattern URLs** | `--pattern-stochastic` `--pattern-woven-dark` `--pattern-scatter` `--pattern-scatter-dark` |
| **Bootstrap aliases** | `--bs-body-color` `--bs-body-bg` `--bs-primary` `--bs-teal` `--bs-gray-{100,200,300}` `--bs-light` `--bs-dark` `--site-link-color` `--site-link-hover-color` |

**Two-system note:** Bootstrap tokens are kept for legacy components but shadowed by the semantic design system tokens. The styleguide should display the **semantic tokens only** — Bootstrap aliases are an implementation detail, not brand intent.

**Styleguide-relevant subset:** Accent + Status + Text + Surface + Border. Spacing + motion are valuable but secondary — could land in a "tokens deep dive" follow-up.

### Editor-relevant typographic classes

| Class | What it does | Editor-exposable? |
|---|---|---|
| `.lead` | 1.25rem, 300 weight, increased line-height | **Yes** — standard intro paragraph |
| `.overline` | 0.75rem, 700 weight, uppercase, tracked | **Yes** — pre-heading label |
| `.blockquote` / `.blockquote-footer` | 1.375rem serif italic + attribution | **Yes** — already a TipTap toolbar item |
| `.caption` | 0.8rem italic, secondary color | **Yes** — figure/image caption |
| `.pull-quote` | 1.75rem serif italic, centered, light weight | **Likely yes** — editorial pull-quote |
| `.kicker` | 11px mono, uppercase, accent | Maybe — currently set by component, not author |
| `.dek` | Italic serif, ~1.375rem clamp | No — auto-generated from article subtitle |
| `.ai-authored` / `.ai-assisted` | Editorial markers (border + cooler tone) | Maybe — content-type semantics |
| `.post-meta` `.article-meta` `.post-title` `.post-subtitle` `.section-heading` `.ai-label` `.block-author` `.ella` | Internal/auto-generated | No — component-driven |

**Conservative author-exposable list:** `.lead`, `.overline`, `.blockquote`, `.caption`, `.pull-quote`. The `.kicker` / `.ai-authored` / `.ai-assisted` calls are editorial decisions worth a separate conversation.

---

## Audit 0c — Block list components inventory

Source: [Views/Partials/blocklist/Components/](src/UmbracoProject/Views/Partials/blocklist/Components/). Dispatch via [blocklist/default.cshtml](src/UmbracoProject/Views/Partials/blocklist/default.cshtml) on `data.ContentType.Alias`.

| File | Alias | Purpose | Showcase on /components? |
|---|---|---|---|
| `alertBanner.cshtml` | `alertBanner` | Contextual alerts (info/warning/emergency) with icon | Yes |
| `codeSnippetRow.cshtml` | `codeSnippetRow` | Syntax-highlighted code block with title + author | Yes |
| `iconLinkRow.cshtml` | `iconLinkRow` | Icon-based link item (typically composed in larger blocks) | Maybe — needs a wrapping context |
| `imageCarouselRow.cshtml` | `imageCarouselRow` | Multi-slide carousel, captions, controls | Yes |
| `imageRow.cshtml` | `imageRow` | Single responsive image + caption + author | Yes |
| `latestArticlesRow.cshtml` | `latestArticlesRow` | Article listing (grid or list, filter, paginate) | Yes |
| `richTextRow.cshtml` | `richTextRow` | Rich text + optional author credit | Yes — also doubles as the typography demo surface |
| `videoRow.cshtml` | `videoRow` | YouTube embed + caption + author | Yes |

**Eight blocks total.** All but `iconLinkRow` are clean reference candidates; `iconLinkRow` is more of a sub-block than a top-level showcase item.

---

## Audit 0d — Block Grid investigation

**Status: never used.** Zero Block Grid `.uda` artifacts exist in [umbraco/Deploy/Revision/](src/UmbracoProject/umbraco/Deploy/Revision/) (verified via `find ... -iname "*blockgrid*"`). The Razor partials at [Views/Partials/blockgrid/](src/UmbracoProject/Views/Partials/blockgrid/) are the framework defaults shipped with Umbraco — `default.cshtml`, `area.cshtml`, `areas.cshtml`, `items.cshtml`.

### Architecture comparison

| Concern | Block List | Block Grid |
|---|---|---|
| Property editor | `Umbraco.BlockList` | `Umbraco.BlockGrid` |
| Data model | `BlockListModel` — flat `IEnumerable` | `BlockGridModel` — items with `ColumnSpan`, `RowSpan`, nested `Areas` |
| Layout | None (linear) | 2D grid (default 12 col), CSS Grid via custom properties |
| Slots / named zones | No | Yes (`BlockGridArea` with aliases) |
| Nesting | No | Yes (areas inside items) |
| Razor render | Single loop | Recursive — items → areas → items, via `GetBlockGridItemsHtmlAsync()` |
| Component dir | `blocklist/Components/{alias}.cshtml` | `blockgrid/Components/{alias}.cshtml` (doesn't exist yet — would need to be created) |

### What Block Grid can do that Block List can't

Multi-column rows. Row spanning. Named slots inside items (e.g. a "two-column-with-sidebar" layout where `main` and `sidebar` are separate areas). Editor-driven layout configuration without per-block Razor.

### Honest recommendation

**For /components specifically: Block List.** The page is a linear catalog — one block, one example, label, repeat. Block Grid's 2D machinery is dead weight here.

**For "exercising Block Grid":** find a layout that actually wants 2D composition. Strong candidates: a campaign landing page, a multi-feature article masthead, an editor-driven dashboard. Forcing Block Grid into /components would set the wrong precedent.

---

## Audit 0e — TipTap dropdown class gap

**The dropdown source-of-truth is [wwwroot/css/dropdownStyles.css](src/UmbracoProject/wwwroot/css/dropdownStyles.css).** Configured via the `stylesheets` array in [data-type__ca90c9500aff4e72b976a30b1ac57dad.uda](src/UmbracoProject/umbraco/Deploy/Revision/data-type__ca90c9500aff4e72b976a30b1ac57dad.uda) (the `Richtext editor` data type). TipTap's `Umb.Tiptap.Toolbar.StyleSelect` reads selectors from this file and derives the dropdown label from `/**umb_name:foo*/` comments.

### Current dropdown contents

```css
/**umb_name:h2*/ h2 { font-size: 2.4em; }
/**umb_name:h3*/ h3 { font-size: 2em; }
/**umb_name:h4*/ h4 { font-size: 1.8em; }
```

That's the **entire file.** Three heading size overrides — no class-based options at all.

### Gap diff

| Class (in CSS) | In dropdown? | Status |
|---|---|---|
| `h2`, `h3`, `h4` (size override) | Yes | configured |
| `.lead` | No | missing — should be exposed |
| `.overline` | No | missing — should be exposed |
| `.blockquote` | No | covered by toolbar button, not class picker — fine |
| `.caption` | No | missing — should be exposed |
| `.pull-quote` | No | missing — likely should be exposed |
| `.kicker` | No | TBD (editorial decision) |
| `.ai-authored` / `.ai-assisted` | No | TBD (editorial decision) |

### Verdict

**The gap is large, not 1–2 classes.** Every Package C author-facing typography class is missing. This sharpens Decision 2: the styleguide spec without the dropdown fix would document classes authors physically cannot apply.

The fix itself is small (edit one CSS file, optionally add a stylesheet `.uda` if it's not already deployed) — but the editorial decisions around which classes to expose (`.kicker`, `.ai-*`) need a conversation with the brand intent.

---

## What's not covered (deferred to spec)

- Information architecture for /styleguide — single page vs sectioned, anchor nav vs sub-pages
- IA for /components — block ordering, grouping, page header / intro
- Document type design — new doc types or reuse existing Content / Block-only page pattern
- Block Grid exercise candidate (separate spec, separate decision)
- Editor preview behavior — should the brand summary section render the same in backoffice preview as on the live page
- Rich-text preview infrastructure — required if typography section uses live class samples authored in TipTap

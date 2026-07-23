# Block CSS seam — functional vs. per-site skin

> The portability contract for the shared page-body blocks under
> `src/UmbracoProject/Views/Partials/blocks/Components/`. It records **what ships
> with a block** (structural/functional CSS that any site needs for the block to
> lay out and behave) versus **what a new site overrides** (brand/skin values —
> colors, fonts, spacing scale — expressed as CSS custom properties). Porting a
> block to another site should be a restyle (override tokens), never a markup edit.

This is the implementation companion to `docs/brand.md` (north-star intent) and
`_specs/design-system.md` (the token vocabulary). Where those two describe *what
the site should feel like*, this describes *how a block stays reusable*.

---

## The seam mechanism: CSS custom properties

The seam is **CSS custom properties**, not a class layer or `@layer`. It was already
the de-facto mechanism across the block CSS; this note makes the contract explicit.

- **Functional CSS ships with the block, globally.** Layout (`display`, `grid`, `flex`,
  column structure), spacing rhythm, `clamp()`-based fluid type sizing, line-height,
  letter-spacing, transitions/easing hooks, square-corner reset, and the block's own
  class vocabulary (`exp-card`, `exp-stat`, `styleguide-block`, `image-carousel`, …) are
  the same on every site. For the reusable page-body blocks this base CSS lives in the
  **globally-loaded `wwwroot/assets/css/blocks.css`** (linked site-wide from `master.cshtml`),
  alongside the **Block Grid layout engine** (`.umb-block-grid*`). That global home is what
  makes "restyle-only port to another page/site" literally true — the block lays out
  correctly on *any* page, not only inside the page-scoped Experiments (`experiments.css`) or
  Style Guide (`styleguide.css`) sheets.
- **Brand/skin is a token.** Every color, font family, border color, surface, and the
  spacing/easing scale itself resolve through `var(--token)`. A new site redefines the
  tokens in `:root` (see `_specs/design-system.md` → Color Palette / Spacing system /
  Easing tokens) and the blocks restyle with no markup or block-CSS edit.

The tokens are declared in `wwwroot/assets/css/typography.css` (warm-stone palette,
text/surface/accent/border tokens, `--font-*`, `--space-*`, `--ease-*`) and
`wwwroot/assets/css/tokens-extras.css` (the `--dc-*` Dark Constructivism imagery
sub-palette + `--pattern-*` asset paths). Both load before any block CSS. The global
chain in `master.cshtml` is
`styles.css → typography.css → tokens-extras.css → site-chrome.css → blocks.css →
(listings, vs2015, highlight, swiffy)`. `experiments.css` and `styleguide.css` are
**per-page sheets** each template injects later via its own `@section Styles`, so a page
sheet still overrides `blocks.css` where a page needs to.

### Verified state

- **`blocks.css`** (global) — the Block Grid layout engine (`.umb-block-grid*`) plus the
  base/functional CSS of the six reusable page-body blocks: `.exp-card` (featureCard),
  `.exp-cmd` (commandBadge), `.exp-stat` (statCallout), `.exp-pullquote` (pullQuoteBlock,
  including its pillar-**independent** `--dark`/`--accent` tone modifiers — border *and*
  text color), `.exp-timeline` (timelineRow), `.exp-sketch` (embeddedSketch). Fully
  tokenized. This is what loads on every page, so these blocks lay out anywhere.
- **`experiments.css`** (per-page) — Experiments page chrome only: the `main.experiments`
  reset/shell, `showcaseHero` (`.exp-hero*`), `pillarSection` (`.exp-pillar*`), the
  **pillar-tone context** rules (`.exp-pillar--light/--dark/--accent .exp-*` — recolor a
  plain block by the tone of the pillar it sits in), the `.exp-pillar >
  .umb-block-grid__area-container` composition rule, and the `main.experiments .richtext`
  / `.exp-cta` overrides. **175** `var(--…)` references, **0** hardcoded hex colors.
- `styleguide.css` (per-page — colorPalette / typographyShowcase / generalElements blocks):
  fully tokenized, 0 hardcoded hex.
- Media/rich-text blocks (`image-carousel`, `.richtext`, `.image`, `.caption`,
  `block-author`, `latest-articles-row`, `youtube-player`): no hardcoded brand colors.

The only non-token color values in the `exp-*` CSS are **six alpha-composited variants of
existing tokens** — text-shadows and `text-decoration-color` at a custom opacity, e.g.
`rgba(194, 61, 46, …)` = `--accent-primary` alpha, `rgba(240, 237, 232, …)` =
`--text-on-dark` alpha (in `experiments.css`), `rgba(139, 107, 74, …)` =
`--accent-secondary` alpha (`.exp-timeline` in `blocks.css`). These are functional
micro-details, not skin values a new site would rebrand, and the token system defines no
standalone alpha variant for them.
Converting them to `color-mix(in srgb, var(--token) …)` is a **deferred, value-check-first
follow-up** — left untouched here because it risks sub-pixel rendering movement against
committed screenshot baselines, and the guardrail for this step is behavior-preserving.

---

## Per-block contract

| Block (view alias) | Class root(s) | Functional (ships with block) | Skin (site overrides via token) |
|---|---|---|---|
| `showcaseHero` (page-scoped) | `exp-hero` | full-bleed section, inner max-width, `--exp-hero-bg` background hook, fluid type — CSS stays in `experiments.css`, see *Page-composition* below | surface/overlay/text tokens |
| `featureCard` | `exp-card` | flex column, padding, border width, hover transition | `--surface-primary`, `--border-light`, accent tokens |
| `commandBadge` | `exp-cmd` | inline code layout, spacing | mono font + accent/text tokens |
| `statCallout` | `exp-stat` | `clamp()` figure size, line-height, letter-spacing | `--font-display`, `--accent-secondary` (→ `--accent-primary` on `--dark`) |
| `pullQuoteBlock` | `exp-pullquote` | figure layout, tone modifier structure (`--light`/`--dark`) | display font + text/accent tokens |
| `embeddedSketch` | `exp-sketch` | figure/poster slot, caption layout, lazy-load | text/surface tokens |
| `timelineRow` | `exp-timeline` | row grid, date column, feature heading | display font + text/accent tokens |
| `pillarSection` (grid-only, page-scoped) | `exp-pillar` | area layout, numbered head, tone modifier — CSS stays in `experiments.css`, see *Page-composition* below | surface/text/accent tokens |
| `colorPaletteBlock` | `styleguide-block--palette`, `styleguide__palette` | swatch grid, meta layout | text/surface/border tokens |
| `typographyShowcaseBlock` | `styleguide-block--type`, `styleguide__type` | heading/editor-class specimen layout | inherits site type tokens (that is the point) |
| `generalElementsBlock` | `styleguide-block--elements`, `styleguide__elements` | inline/list/table/form specimen layout | Bootstrap-aliased tokens |
| `richTextRow` | `richtext` | prose flow + spacing classes | inherited body type/color tokens |
| `imageRow` | `image` | img-fluid, caption/author layout | text tokens |
| `imageCarouselRow` | `image-carousel` | Bootstrap carousel + controls layout, SVG icons via `currentColor` | text/accent tokens |
| `videoRow` | `youtube-player` | responsive player slot, caption layout | text tokens |
| `codeSnippetRow` | `.row.clearfix` + `pre code` | code block layout | `--surface-dark` code substrate + mono font |
| `latestArticlesRow` | `latest-articles-row` | grid/list layout, pagination slot | text/accent tokens (cards via shared partial) |
| `alertBanner` | `alert alert-*` | Bootstrap alert flex + icon layout | left-border + subtle-bg accent/status tokens |
| `iconLinkRow` | `social-icon` | inline list item, `our-svg` icon | `currentColor` (inherits context text token) |

**Spot-check (verified):** overriding `--accent-secondary` in `:root` recolors
`.exp-stat__figure` (statCallout) with no markup or block-CSS edit — the seam works
as documented.

### Page-composition (non-portable) blocks

Two of the `exp-*` blocks are **intentionally page-scoped** and are *not* portable content
specimens — their CSS deliberately stays in the per-page `experiments.css`, not `blocks.css`:

| Block (view alias) | Class root | Why page-scoped |
|---|---|---|
| `showcaseHero` | `exp-hero` | Full-bleed hero band that renders its own page `<h1>` + scatter-pattern backdrop — Experiments page composition, not a drop-in content block. |
| `pillarSection` (grid-only) | `exp-pillar` | Provides the numbered band + `.umb-block-grid__area-container` that *hosts* other blocks (uses Block Grid areas). It's the page's compositional scaffold, not a reusable specimen. |

**Pillar-tone split — where the same block name appears in both sheets.** A block's OWN tone
modifier is functional and ships globally in `blocks.css` (e.g. `.exp-pullquote--dark` sets
border + text color, pillar-independent — a dark pullquote works on any page). The
pillar-**context** form (e.g. `.exp-pillar--dark .exp-pullquote__quote`, and the analogous
`.exp-pillar--*` recolors for `.exp-card` / `.exp-stat` / `.exp-timeline`) recolors a *plain*
block by the tone of the pillar it sits inside — that's Experiments page composition, so it
correctly stays page-scoped in `experiments.css`.

**Cross-branch follow-up (out of scope here):** curating the Guide Body palette to drop
`showcaseHero` (so a page-composition hero isn't offered as an ordinary body block) is a
`consolidated-guides` concern — that schema lives on that branch and is not touched here.

---

## Self-containment (coupling audit)

Every shared block view reads its settings **only via the composition interfaces**
(`ISpacingProperties` → `SpacingHelper` for spacing classes; `…Settings.Hide` to
short-circuit). **No block view references a page type or a sibling block.** Two
dependencies are intentional and documented, not portability defects:

1. **Living-styleguide blocks read the site's own CSS tokens by design.**
   `colorPaletteBlock` parses `assets/css/typography.css` (via
   `IWebHostEnvironment` + `IMemoryCache` + `SwatchTokenParser`) to render live
   swatches; `typographyShowcaseBlock` / `generalElementsBlock` render specimens of
   the site's live type/element styles. Reflecting the current tokens **is their whole
   purpose** — this is an accepted dependency on the token layer, not coupling to
   remove. On a new site they self-adjust to that site's tokens.

2. **`latestArticlesRow` renders the shared `v2/_ArticleCard.cshtml` partial** and
   invokes the `Pagination` view component. `_ArticleCard` is a **self-contained,
   reusable** partial (also used by Blog landing, Author, Article list, and Search)
   bound to a generic `IPublishedContent` — not page-specific. The block is inherently
   coupled to the `Article` content model (a "latest articles" block must know what an
   article is); a new site maps that content schema, same as any content-driven block.
   No fix needed; flagged here so the dependency stays visible.

---

## Rule of thumb for new blocks

- Layout, spacing rhythm, fluid sizing, transitions, and the block's class names →
  **ship in the globally-loaded `blocks.css`** so the block lays out on any page (only
  genuinely page-composition CSS, like a hero band or pillar scaffold, belongs in a
  per-page sheet).
- Any color, font, border, surface, or scale value → **a `var(--token)`**, never a
  literal. If you need a value the token set doesn't have, add the token to the design
  system first, then reference it.
- Read settings through composition interfaces (`ISpacingProperties`, …); never reach
  for the page type or a sibling block.

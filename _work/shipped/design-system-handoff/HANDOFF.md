# Package A v2 — design-system foundation handoff

> v2 supersedes the original `_handoff/`. This package incorporates the
> codebase audit findings: `typography.css` is the source of truth (kept
> in place), patterns live under `wwwroot/assets/`, the snippet is
> additive, and the masthead direction is locked per-template.

## What this package is

The minimum, **additive** layer needed before v2 hybrid templates can
be propagated. It does **not** replace anything that's already loading.

Two new CSS files, four pattern SVGs, one Razor `<head>` snippet.

```
_handoff/
├── HANDOFF.md                     ← this file
├── MASTHEAD-DECISION.md           ← article vs. secondary page model
├── CLEAN-BLOG-INVENTORY.md        ← what stays / goes in styles.css
├── snippets/
│   └── head-links.cshtml          ← additive <link> tags
└── wwwroot/
    ├── assets/css/
    │   ├── tokens-extras.css      ← DC palette + pattern url() vars
    │   └── site-chrome.css        ← .site-head .page-head .foot etc.
    └── assets/patterns/
        ├── stochastic-grid.svg
        ├── woven-lines.svg
        ├── scatter-left.svg
        └── scatter-left-dark.svg
```

## Why no `design-system.css` this time

The audit caught it: `typography.css` already declares the warm-stone
tokens, the Bootstrap palette aliases (`--bs-primary`, `--bs-light`,
`--bs-dark`, `--bs-gray-*`, `--bs-teal`), and the Clean-Blog-aware
link rules (`.post-preview > a`, `.article-grid-card .card-title a`,
`header.masthead a`, `.on-dark a`, `#mainNav a`, etc.).

Shipping a parallel `design-system.css` would either lose those rules
or fight them on load order. So **`typography.css` stays as-is** and
this package only adds what's missing:

- `tokens-extras.css` — the Dark Constructivism imagery sub-palette
  (`--dc-obsidian` through `--dc-signal`) and the four `--pattern-*`
  url() tokens. Not in `typography.css` today.
- `site-chrome.css` — the v2 layout primitives (`.site-head`,
  `.page-head`, `.foot`, `.wrap`, `.wrap-narrow`, `.visually-hidden`).
  None of these collide with existing class names; they're inert
  until a template opts in.

## Install steps

### 1. Copy files into the project

```
_handoff/wwwroot/assets/css/tokens-extras.css
    →  src/UmbracoProject/wwwroot/assets/css/tokens-extras.css

_handoff/wwwroot/assets/css/site-chrome.css
    →  src/UmbracoProject/wwwroot/assets/css/site-chrome.css

_handoff/wwwroot/assets/patterns/*.svg
    →  src/UmbracoProject/wwwroot/assets/patterns/*.svg
```

Note: patterns deliberately go under `wwwroot/assets/`, **not**
`wwwroot/media/`. The `media/` tree is gitignored (`.gitignore:398`)
and owned by Umbraco Cloud Deploy. Patterns are static design assets,
not authored content, so they belong in `assets/`.

### 2. Add two `<link>` tags to `master.cshtml`

Open `src/UmbracoProject/Views/master.cshtml`. Find the existing
stylesheet block at lines 22–26:

```cshtml
<link href="/assets/css/styles.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/typography.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/vs2015.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/swiffy-slider.min.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/highlightjs-copy.min.css" rel="stylesheet" asp-append-version="true" />
```

**Append** the two lines from `snippets/head-links.cshtml` directly
after `typography.css`. **Do not remove anything.** Match the existing
style: root-relative `href="/..."` and `asp-append-version="true"` so
Cloud Deploy busts the CDN cache on each push. The result should
read:

```cshtml
<link href="/assets/css/styles.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/typography.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/tokens-extras.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/site-chrome.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/vs2015.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/swiffy-slider.min.css" rel="stylesheet" asp-append-version="true" />
<link href="/assets/css/highlightjs-copy.min.css" rel="stylesheet" asp-append-version="true" />
```

Load order matters: tokens before chrome, both after `typography.css`
so they inherit its declarations and Bootstrap-palette overrides.

### 3. Smoke test

After `dotnet build` and reload, **the live site should look
unchanged.** That's the goal of this package — foundation only,
zero visual diff until templates opt in.

To verify the package loaded, open dev tools on any page and run:

```js
getComputedStyle(document.documentElement).getPropertyValue('--dc-anthracite')
// → "#1A1A1E"

getComputedStyle(document.documentElement).getPropertyValue('--pattern-stochastic')
// → "url('/assets/patterns/stochastic-grid.svg')"
```

Both should return values. Also confirm the four SVGs return 200 at
their direct URLs:

- `/assets/patterns/stochastic-grid.svg`
- `/assets/patterns/woven-lines.svg`
- `/assets/patterns/scatter-left.svg`
- `/assets/patterns/scatter-left-dark.svg`

### 4. Convert one low-risk template (optional, recommended)

`error.cshtml` or `Login.cshtml` are the safest single-page tests
before Package B lands. The mock for the 404 lives at
`ui_kits/web/home/D-404.html` in the design-system project. Markup
can be lifted directly — it only uses classes from this package and
`typography.css` tokens.

This step is optional but it validates the install end-to-end and
surfaces any partial-decision gaps before Package B.

## Intentionally **not** included

- **No `.visually-hidden`.** Bootstrap reboot already declares it in
  `styles.css` with `!important`. v1 had a duplicate; removed in v2.1.
- **No font imports.** `master.cshtml` already imports Cormorant
  Garamond, Source Sans 3, and IBM Plex Mono with broader weight
  ranges. Duplicate imports would add request overhead.
- **No `body { font-size: ... }`.** `styles.css:11032` and
  `styles.css:13–15` already set the base. v1 had a stray
  `body{font-size:1rem}` that would have fought the Clean Blog
  default — removed in v2.
- **No global resets.** Bootstrap reboot already covers `box-sizing`,
  `body { margin: 0 }`, and image max-width.
- **No replacement of existing partials.** `pageHeader.cshtml`,
  `footer.cshtml`, `mainNavigation.cshtml` continue to render as
  they always have. Package B will introduce v2 partials alongside
  them — never replace them globally.

## What comes next

| Package | Contents | Status |
|---|---|---|
| **A v2** | Tokens + chrome + patterns | This package |
| **B**    | Razor partials: `_SiteHead`, `_PageHead`, `_Footer`, `_EmptyState`, `_ArticleCard` | Pending — needs A landed first |
| **C**    | Per-template rollout (404 → blog landing → authors → contact → search → tag → about → home) | Pending B |

See `MASTHEAD-DECISION.md` for the article-vs-secondary-page model
that drives Package B's partial design. See
`CLEAN-BLOG-INVENTORY.md` for what we're keeping vs. retiring from
`styles.css` once Package C is complete.

## Rollback

If anything goes wrong: revert the 4-line addition to
`master.cshtml` and the package becomes inert (the CSS files load,
but nothing references them). No data, content, or routing is
touched by this package.

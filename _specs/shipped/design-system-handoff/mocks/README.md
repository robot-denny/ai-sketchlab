# Mocks — visual reference for the v2 templates

Static, self-contained HTML mocks for every primary template in **The Human Signal** (Package B). Each `D-*.html` is the high-fidelity design target for the corresponding Razor partial set under `Views/Partials/v2/`. Open any of them directly in a browser — no build step, no parent-folder dependencies.

## What's in here

| File | Maps to | Purpose |
|---|---|---|
| `D-hybrid.html` | Home | Featured + 3-up grid + archive link |
| `D-blog.html` | Archive / index | Full essay list, pagination |
| `D-article.html` | Single essay | Long-form reading layout |
| `D-content.html` | Generic content page | Marketing/about-style body content |
| `D-about.html` | About | Lab + publication backstory, hero |
| `D-author.html` | Author profile | One author + their essays |
| `D-authors.html` | Authors index | All bylines, grid |
| `D-tag.html` | Tag archive | Filtered essay list |
| `D-search.html` | Search results | Query + results list |
| `D-contact.html` | Contact | Form + info |
| `D-empty.html` | Empty / zero-state specimens | Reference for Ella's empty byline, no-results, offline, inbox-zero |
| `D-404.html` | 404 | Missing page |

Shared styles:

- `colors_and_type.css` — the canonical token + type scale layer (mirror of the root design-system file)
- `_shared.css` — shared UI patterns used across mocks (header, footer, buttons, etc.)
- `assets/` — image/icon assets referenced inline (article thumbs, headshots, logo marks)

## How to use these

These are **the visual contract**, not implementation. When building the matching Razor partial in `Views/Partials/v2/`:

1. Open the mock in a browser to see the intended final state.
2. Read the mock's HTML to understand the DOM structure, class names, and copy hierarchy.
3. Lift the structure verbatim into the partial; the global token CSS in `wwwroot/assets/css/` already provides the styling layer, so you should not need to copy mock-local `<style>` blocks except where a pattern is genuinely page-specific.
4. Replace static content with model bindings. Image `src` paths in mocks point at `assets/…` — the production equivalents live in `wwwroot/assets/` or come from Umbraco media.

## Things to know

- **Self-contained.** All paths are sibling-relative (`assets/foo.png`, `colors_and_type.css`). You can drop this whole folder anywhere in the repo and the mocks still render.
- **Fonts.** Cormorant Garamond, Source Sans 3, IBM Plex Mono — pulled from Google Fonts via CDN. Same families as the production site.
- **Not pixel-tested.** The mocks were built at desktop widths. Treat narrower-viewport behaviour as an open implementation detail unless explicitly shown.
- **`_archive/`** in the source UI kit (older greybox explorations like `B-darkfield.html`) is intentionally **not** included here — only the approved direction.

## When in doubt

Match the mock. If the mock and the production page diverge, the mock is the spec — flag the divergence and confirm before changing the design.

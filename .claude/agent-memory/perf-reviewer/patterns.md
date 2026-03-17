---
name: Recurring performance anti-patterns in this codebase
description: Patterns observed across perf reviews — use to fast-track issue identification in future diffs
type: project
---

## Footer / Navigation Partials

- Footer partial (`Views/Partials/footer.cshtml`) is wrapped in `Html.CachedPartialAsync()` at the master layout level with a 60-minute cache. Confirmed present — do not flag missing cache wrapper for this file.
- `AncestorOrSelf<Home>()` is used in the footer partial to resolve site-wide config (logo, description, nav links). Preferred alternative: `Umbraco.ContentAtRoot().OfType<Home>().FirstOrDefault()` — avoids O(depth) tree walk on each cache miss.
- Null guard on `homePage` is missing in the current footer rewrite. Any page without a `Home` ancestor will throw on every request, bypassing the cache entirely.

## Images

- Footer logo `<img>` rendered without explicit `width`/`height` HTML attributes and without `loading="lazy"`. CSS-only sizing (`width: 153px; height: 21px`) does not prevent layout shift — HTML attributes are required.

## CSS Organization

- `.block-author` rule was appended to the footer stylesheet (`styles.css`). Block-level rules are drifting into footer CSS — watch for this spreading.

## Fonts

- `'Source Sans 3'` and `'Oxanium'` font families used in footer CSS. Origin (Google Fonts vs self-hosted) not confirmed in diff. If externally hosted, `<link rel="preconnect">` hints should be present in the master layout `<head>`.

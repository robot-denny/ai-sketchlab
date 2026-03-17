---
name: Project Conventions
description: Confirmed Razor, CSS, and Umbraco conventions observed across reviewed diffs
type: project
---

## Razor Views

- Views inherit `UmbracoViewPage` (untyped) when traversing the content tree with `AncestorOrSelf<T>()`.
- `_ViewImports.cshtml` imports `Umbraco.Cms.Web.Common.PublishedModels` as `ContentModels`.
- `@using Umbraco.Cms.Core.Models` is required when using `LinkType` enum (Multi-URL picker link type checks).
- Rich text properties (`IHtmlEncodedString`) render safely with `@property` (Razor auto-encodes, but IHtmlEncodedString bypasses — requires `@Html.Raw()` if truly raw, otherwise `@property` is safe as Umbraco wraps it). No explicit `@using Umbraco.Cms.Core.Strings` seen yet but may be needed in future partials.
- Partials use `Html.CachedPartialAsync()` with 60-minute cache — flag any new partial that omits caching.
- `AncestorOrSelf<T>()` can return null if the model is not a descendant of T — null guard required before property access.

## CSS

- Project uses Bootstrap 5 (CDN) + a custom `styles.css` with project-specific overrides.
- Custom CSS uses hardcoded hex values (no CSS custom properties / design tokens) — this is an established pattern, not a violation.
- Footer hover accent color is `#009171`; primary brand color is `#005E70`.
- Magic numbers in padding/sizing (e.g., `39px`, `153px`, `327px`) appear to be intentional design values — not flaggable without a design token system.

## UDA / Document Type Schema

- Compositions live in the `Compositions` folder (container `3503b89f-2819-4e41-86d7-d17dcc5b4212`).
- Properties in `.uda` are under `PropertyGroups[n].PropertyTypes`, not a flat `PropertyTypes` at root level (root `PropertyTypes` is always `[]` for composition doc types).
- The Management API flattens these to `elementType.properties` — the `.uda` nesting is schema-storage format only.

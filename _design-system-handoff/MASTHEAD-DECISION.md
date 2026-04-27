# Masthead direction — SUPERSEDED by Package B

> **⚠️ Status:** Superseded.
> An earlier doc (`MASTHEAD-DECISION.md`, in the v1 handoff drop)
> locked in an image-led article masthead. **Package B revises that
> decision.**

## Current direction (Package B)

- **Article DETAIL pages are text-led.** `_MastheadArticle.cshtml`
  emits `.art-head` (kicker / h1 / dek / byline) followed by an
  optional inline `<figure class="art-hero">` containing the
  `MainImage`. The image renders **below the headline, framed inside
  the reading column** — not as a full-bleed background.
- **`MainImage` is still required content.** It continues to feed
  the blog-listing thumbnail and now also the inline `.art-hero` on
  the detail page. No content migration is needed.
- **Secondary pages** still use the text-led `.page-head` from
  `site-chrome.css` (Package A) via `_PageHead.cshtml`. Unchanged.
- **Home** still uses its bespoke hybrid hero from `D-hybrid.html`
  via `_HeroHome.cshtml`. Unchanged.
- **`masthead-overlay.css`** ships in Package B but is **not** wired
  to any template. It exists as an opt-in CSS-only Dark
  Constructivism overlay (`.masthead.masthead--dc`) for any future
  template that wants to keep the image-led masthead aesthetic.

## What this changes for the migration

1. `tests/e2e/header/siteHeader.spec.ts` asserts on
   `header.masthead` padding/dimensions. Article pages no longer
   emit `.masthead` — retarget the assertion at `.art-head` (or
   scope the test to the legacy template) in Package C.
2. The article controller / `PageHeaderViewModel` contract is
   **unchanged**. `_MastheadArticle.cshtml` is a drop-in
   replacement for `@Html.Partial("pageHeader")`.
3. Older v1 docs that still describe the article masthead as
   image-led are stale. This file is the current direction.

See `README-PACKAGE-B.md` § "Decisions baked in" #1.

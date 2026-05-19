# Package B — v2 Hybrid Razor Partials & Page CSS

**Scope:** This package adds the Razor partials and CSS that translate the v2 hybrid mocks (`ui_kits/web/home/D-*.html`) into Umbraco-flavored, drop-in components. It builds on **Package A** (tokens + site chrome CSS) and stops short of any per-template wiring or `.uda` schema edits — those land in **Package C**.

---

## Round-1 review fixes (applied)

Reviewer raised six code defects + two doc drifts against the initial B drop. All eight are addressed in this revision:

| # | Issue | Fix |
|---|---|---|
| 1 | `_MastheadArticle` referenced `Model.CurrentPage` (not on `PageHeaderViewModel` — won't compile) | Replaced with `Umbraco.AssignedContentItem` |
| 2 | `_LatestSection` used unqualified `MediaWithCrops` (not in `_ViewImports` — `Umbraco.Cms.Core.Models.PublishedContent` is, the parent namespace isn't) | Added `@using Umbraco.Cms.Core.Models;` |
| 3 | Cards read `authorName` (string) — Article doc type actually has `author` (multi-content picker → `IEnumerable<Author>`) | Switched to the `article.cshtml` / `latestArticlesRow.cshtml` pattern: read `IEnumerable<Author>` and join names |
| 4 | Cards / masthead read `readingTime` — field does not exist on the doc type today | Removed all `readingTime` reads; bylines degrade to author + date. Added to README "Known gaps" as `.uda` work for C |
| 5 | `_Footer` read `footerSocialLinks` — actual alias on `footerControls` is `socialIconLinks` | One-character fix |
| 6 | `_PageHead` / `_DcPull` / `_EmptyState` read parameters from `ViewData` — `Html.Partial(name, anonymous)` binds to `Model`, not `ViewData` (every parameterized partial would render empty) | Switched to `UmbracoViewPage<dynamic>` + reflection helper to read named props off the anonymous `Model` |
| 7 | `_Manifesto` comment claimed all fields "already on the Home doc type" — they aren't | Comment now flags them as proposed, references "Known gaps" |
| 8 | The v1 `MASTHEAD-DECISION.md` still said articles keep image-led masthead | This package now ships `_handoff/MASTHEAD-DECISION.md` as the current direction (text-led article header). The v1 doc is superseded — delete or keep as history per C's call. |

---

## What ships

### Razor partials — `Views/Partials/v2/`

All partials live under a `v2/` namespace so they coexist with the existing `pageHeader.cshtml`, `mainNavigation.cshtml`, `footer.cshtml`, etc. Templates opt in by including the v2 partial instead of the legacy one — there is **no global swap** in Package B.

| Partial | Source mock | Notes |
|---|---|---|
| `_SiteHead.cshtml` | every `D-*.html` | Replacement for `mainNavigation.cshtml`. Sticky, compact, wordmark + nav. |
| `_Footer.cshtml` | `D-hybrid.html` | Replacement for `footer.cshtml`. Reads existing Home fields (`FooterDescription`, `FooterNavigation`); also reads `socialIconLinks` (the `footerControls` composition's actual alias) for the "Elsewhere" column. |
| `_PageHead.cshtml` | `D-blog.html`, `D-authors.html`, `D-author.html`, `D-contact.html`, `D-content.html`, `D-search.html`, `D-tag.html`, `D-404.html`, `D-empty.html` | Text-led page header for **all secondary pages**. Razor parameters (no `.uda` changes): `Title`, `Eyebrow`, `Dek`, `Pattern` (`scatter`/`stochastic`), `Crumbs`. |
| `_HeroHome.cshtml` | `D-hybrid.html` § hero | Home hero. Text-led, no image slot. Reads Home `Title` / `Subtitle` and a dictionary key `Home.HeroEyebrow` for the eyebrow. |
| `_LatestSection.cshtml` | `D-hybrid.html` § latest | Pulls 4 most recent articles from `ArticleList`. Index 0 → asymmetric featured row; 1–3 → 3-up grid. Archive link at the bottom. |
| `_DcPull.cshtml` | `D-hybrid.html` § from-the-lab | Razor parameters: `Eyebrow`, `Quote`, `Cite`. Add Home content fields in Package C if user wants it CMS-managed. |
| `_Manifesto.cshtml` | `D-hybrid.html` § manifesto | Reads existing/proposed Home fields: `manifestoTitle`, `manifestoBody` (rich text), `manifestoEyebrowLeft`, `manifestoEyebrowRight`, `manifestoAudience` (newline-separated). Renders nothing if all fields empty. |
| `_MastheadArticle.cshtml` | `D-article.html` | **Text-led** article header — kicker / h1 / dek / byline, with optional `MainImage` rendered as an inline `.art-hero` figure below the headline. Keeps the existing `PageHeaderViewModel` contract intact. |
| `_ArticleCard.cshtml` | `D-blog.html`, `D-tag.html` | Single-article card. Used by Blog landing, Author detail, Topic, Search results. Reads only standard Article fields. |
| `_EmptyState.cshtml` | `D-empty.html` | Headline + dek + actions. Razor parameters: `Headline`, `Body`, `Actions` (label/url/primary tuples). |

### CSS — `wwwroot/assets/css/`

| File | Used by |
|---|---|
| `home-sections.css` | `_HeroHome`, `_LatestSection`, `_DcPull`, `_Manifesto` |
| `article-page.css` | `_MastheadArticle` + the article reading column (`.art-body`, `.next`, `.ella`) |
| `listings.css` | `_ArticleCard`, `_EmptyState`, `.archive-page` grid, `.filters` bar, `.pager`, `.page-head-crumbs` |
| `masthead-overlay.css` | **Opt-in** Dark Constructivism overlay for any template that retains the legacy image-led `.masthead`. Trigger with the `.masthead--dc` modifier class — see "Masthead decision" below. |

All four files are scoped — including them on a template that doesn't use the corresponding partials is harmless (no global selectors).

---

## Wiring (Package C preview — do not do this in B)

Per-template includes for converted pages:

```cshtml
@* home.cshtml *@
@Html.Partial("v2/_SiteHead")
@Html.Partial("v2/_HeroHome")
@Html.Partial("v2/_LatestSection")
@await Html.PartialAsync("v2/_DcPull", new {
    Quote = "Ethics is what you owe the people affected by your choices when you can't see them.",
    Cite  = "— from \"What is ethics?\""
})
@Html.Partial("v2/_Manifesto")
@Html.Partial("v2/_Footer")
```

```cshtml
@* article.cshtml *@
@Html.Partial("v2/_SiteHead")
@Html.Partial("v2/_MastheadArticle", pageHeaderViewModel)
@* existing article body … *@
@Html.Partial("v2/_Footer")
```

CSS includes (per template, via the existing layout's `@section Styles` or equivalent):
- Home: `home-sections.css`
- Article: `article-page.css`
- Listings (blog, authors list, author detail, topic, search): `listings.css`
- Plus `site-chrome.css` from Package A on every v2-converted template.

---

## Decisions baked in (carry forward to Package C)

1. **Article masthead is text-led, not image-led.** The v2 article DETAIL page does *not* keep the full-bleed image masthead from `pageHeader.cshtml`. The `MainImage` is still required content (it feeds blog listing thumbnails) but renders as an inline `.art-hero` figure below the headline. Package C must:
    - Update `tests/e2e/header/siteHeader.spec.ts` — it asserts `header.masthead` padding/dimensions that no longer exist on v2 articles. Either retarget the assertion at the new `.art-head` element or scope it to the legacy template.
    - Decide whether other templates (e.g. landing pages, topic page heroes) should opt into `masthead-overlay.css` to retain an image-led header. The CSS is shipped; no template uses it yet.
2. **Active-link rule for `_SiteHead`** — a top-nav link is current when the current page is at or below the link's content node (uses `Path.Contains(",Id,")`). The `ArticleList` node is correctly treated as ancestor of article pages.
3. **Eyebrow on Home hero** is sourced from the dictionary key `Home.HeroEyebrow`, falling back to `Site.Name`. Add a content field on Home in Package C if the user wants it inline-editable.
4. **No `.uda` schema changes shipped in B.** All parameterized partials take Razor params from the caller, not new Umbraco fields.

---

## Files

```
_handoff/
├── README-PACKAGE-B.md             ← this file
├── MASTHEAD-DECISION.md            ← supersedes the v1 doc
├── Views/Partials/v2/
│   ├── _SiteHead.cshtml
│   ├── _Footer.cshtml
│   ├── _PageHead.cshtml
│   ├── _HeroHome.cshtml
│   ├── _LatestSection.cshtml
│   ├── _DcPull.cshtml
│   ├── _Manifesto.cshtml
│   ├── _MastheadArticle.cshtml
│   ├── _ArticleCard.cshtml
│   └── _EmptyState.cshtml
└── wwwroot/assets/css/
    ├── home-sections.css
    ├── article-page.css
    ├── listings.css
    └── masthead-overlay.css
```

---

## Known gaps (handled in Package C)

- Per-template wiring (home / article / blog / authors / etc.).
- E2E test update for the article masthead.
- **`.uda` document-type changes**:
    - Article: add `readingTime` to `articleControls` (string), or replace with a computed estimate. The v2 partials reference it, but the field doesn't exist today — byline degrades to author + date until C ships.
    - Home: add `manifestoTitle`, `manifestoBody` (rich text), `manifestoEyebrowLeft`, `manifestoEyebrowRight`, `manifestoAudience`. `_Manifesto.cshtml` renders nothing until these fields exist.
    - Home (optional): `pullQuote`, `pullQuoteAttribution` if we want the DC pull-quote CMS-managed instead of caller-literal.
    - Home (optional): `heroEyebrow` if we want the hero eyebrow inline-editable instead of dictionary-keyed.
- Dictionary key seeds (`Home.HeroEyebrow`, `Home.LatestTitle`, `Home.ArchiveLink`, `Home.DcPullEyebrow`, `Footer.PublicationHeading`, `Footer.ElsewhereHeading`, `Footer.ColophonLeft`, `Footer.ColophonRight`, `Article.By`, `Article.On`, `Article.Posted`, `Navigation.MenuTitle`).
- Decision on whether legacy partials (`mainNavigation.cshtml`, `pageHeader.cshtml`, `footer.cshtml`) get retired or kept as fallbacks.
- **Doc cleanup:** The v1 `MASTHEAD-DECISION.md` (image-led articles) has been superseded; `_handoff/MASTHEAD-DECISION.md` ships in this package as the current direction. Decide in C whether to delete the v1 doc outright or keep as historical record.

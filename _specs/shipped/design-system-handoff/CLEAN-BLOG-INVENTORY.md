# Clean Blog inventory — keep vs. retire

> Pre-Package-C audit of `wwwroot/assets/css/styles.css` (Clean Blog +
> Bootstrap, ~12k lines). The goal: know what's load-bearing for v2
> hybrid templates **before** anyone considers removing or trimming.

## TL;DR

**Keep `styles.css` in place through Package C.** Do not attempt to
remove or replace it as part of this design system rollout. Several
of its rules are still doing real work for components we're keeping.

## Keep — load-bearing for v2 templates

These selectors render content that v2 hybrid mockups assume will
look right. Removing them would visibly break pages.

| Selector / scope | Used by | Why kept |
|---|---|---|
| Bootstrap reboot, grid, utilities | Every template | Foundation. Not optional. |
| Bootstrap components: `.card`, `.btn`, `.nav`, `.form-control`, `.alert`, `.badge`, `.pagination`, `.breadcrumb` | Article body content, contact form, search results | v2 templates use these directly. |
| `.masthead` and descendants | Article pages | The image-led article masthead from `pageHeader.cshtml`. Locked in per the masthead decision. |
| `.post-preview`, `.post-title`, `.post-subtitle`, `.post-meta` | Blog listing, related-articles widgets | The article-card vocabulary. v2's `_ArticleCard.cshtml` (Package B) will emit these classes deliberately so Clean Blog's existing typography handles them. |
| `.article-grid-card`, `.card-title`, `.card-body` | Blog listing variants | Same reasoning. |
| `.swiffy-slider` and friends | Block grid carousel components | Authored content uses these in block lists. |
| `code`, `pre`, `.hljs-*`, vs2015 theme | Article code blocks | Editorial content depends on it. |
| `#mainNav`, `.navbar` | Default master layout when a template has not opted into `.site-head` | Until every template uses `.site-head`, `#mainNav` still renders on the rest. |
| `.site-footer` and descendants | Default master layout footer | Same — until every template emits `.foot`, `.site-footer` is still rendering. |

## Retire candidates — only after Package C ships

These selectors apply to chrome that v2 templates replace. They can
be deleted **once every template using them has been converted**.

| Selector | Replaced by | Wait for |
|---|---|---|
| `.navbar.navbar-expand-lg #mainNav` styling | `.site-head` | Package C complete |
| `.site-footer .footer-inner / .footer-brand / .footer-nav / .footer-description` | `.foot .foot-inner` | Package C complete |
| Page-header background-image + overlay rules on `.masthead.page-heading` (only the **non-article** variant) | `.page-head` and its pattern modifiers | Package C complete on all secondary pages |
| Clean Blog's hero/jumbotron variants we don't use | — | Confirm via grep before removing |

This is a deletion **plan**, not an action. Each row needs a
final-check grep across `Views/` before removal in Package C.

## Audit notes

- Bootstrap-palette aliases (`--bs-primary`, `--bs-light`, `--bs-dark`)
  are declared in `typography.css` and override Clean Blog's defaults.
  Keeping `styles.css` does not regress the warm-stone palette
  because `typography.css` loads after.
- The font-family inheritance chain is `body → typography.css base
  rules`, so Clean Blog's font declarations don't fight the design
  system either.
- `dropdownStyles.css` and `index.css` under `wwwroot/css/` are
  back-office assets; they are not on the public site critical path
  and can be ignored for this rollout.

## E2E tests — flag for Package C

Three Playwright specs lock the existing chrome's markup down. They
are **unaffected by Package A v2** (additive only) but **will break
when Package C** swaps templates to `.foot` / `.site-head` /
`.page-head`. List them here so nobody is surprised:

| Spec | Asserts | Action in C |
|---|---|---|
| `tests/e2e/footer/updatedFooter.spec.ts` | `footer.site-footer`, `.footer-brand`, `.footer-nav`, `.footer-description` | Port selectors to `.foot` / `.foot-inner` / `.foot .col` after the global footer swaps in C, **or** retire if the new chrome ships with new tests. |
| `tests/e2e/header/siteHeader.spec.ts` | `#mainNav` styling, `header.masthead` padding | Keep the `header.masthead` assertions (articles still render the masthead per the masthead decision). Port the `#mainNav` ones to `.site-head` / `.site-nav` once `mainNavigation.cshtml` is replaced. |
| `tests/e2e/linkStyles.spec.ts` | Link decoration on various pages | Should survive — link rules live in `typography.css` and aren't changing. Re-run as a sanity check after C. |

Decide port-vs-retire at the start of Package C; don't let the suite
sit broken between conversions.

## When to revisit

After Package C lands and every public template is converted, do a
proper trim pass: open `styles.css` in a project that watches
unused-CSS coverage (Chrome devtools coverage panel works in a
pinch), navigate every public route, and remove rules that show up
as fully-unused on every page.

That trim is a **separate project** from this rollout. It will
likely halve the file size, but it requires its own QA cycle and
isn't part of Package A / B / C.

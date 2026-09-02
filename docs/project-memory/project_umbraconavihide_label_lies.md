---
name: project-umbraconavihide-label-lies
description: "umbracoNaviHide is labelled \"Hide From Search\" in this backoffice but drives section nav and the sitemap, never the site search."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5f56dd50-ed72-4e9b-ac5f-ace555ad2e04
  modified: 2026-09-01T15:05:20.639Z
---

In this repo the `umbracoNaviHide` property on the **Visibility Controls** composition is described in
the backoffice as *"Tick this box if you want to hide this page from search results"* — the label is
wrong. What actually reads it:

- `IsVisible()` → `sectionNavigation.cshtml` (section-nav sidebar) and `xmlSitemap.cshtml`.
- The site search does **not** read it. `SearchService.cs` filters by document-type alias only
  (`DocTypesToIgnore`), so a node with `umbracoNaviHide` ticked is still fully searchable.
- Top navigation reads a different property entirely — `hideFromTopNavigation`, and only over Home's
  direct children.

Two related facts that shape how many nodes need flagging:

- `xmlSitemap.cshtml` skips a hidden node **and never descends into it**, so hiding a parent removes
  its whole subtree from the sitemap.
- `sectionNavigation.cshtml` shows only the current page's siblings plus its **direct children** —
  grandchildren and deeper never appear in nav at all.

**Why:** the label invites exactly the wrong inference in both directions — ticking it to remove
something from search does nothing, and leaving it unticked to keep something searchable needlessly
exposes it in nav and the sitemap.

**How to apply:** to hide a subtree from nav and the sitemap while keeping it searchable, tick
`umbracoNaviHide` + `hideFromSectionNavigation` on the **top node of the subtree only**. To actually
remove a document type from search, add its alias to `DocTypesToIgnore` in `SearchService.cs` — that
is the only lever. Verify with a real site search, not by reading the property label.

Established while planning [[spell-cards]] (2026-09-01), where cards had to be out of nav but in
search.

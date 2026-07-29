# Content Transfer Workflow (local → Dev → Live)

Durable runbook for how **content** moves between environments on this project. This is a **runbook**, not a feature behavioral spec — it records the by-hop discipline so future contributors (and agent sessions) don't re-derive it or fight the workflow.

- The short version lives in [CLAUDE.md → "Content workflow under CI"](../CLAUDE.md#content-workflow-under-ci). This file is the durable, full home.
- **Schema** flows through git (`.uda` files); **media binaries** flow through Cloud's media transfer (see [CLAUDE.md → Media files](../CLAUDE.md#media-files)); **content records** flow local → Dev → Live as described below.

## The model

**Content flows local → Dev → Live**, riding the same pipeline as schema. You author content **locally** (local SQLite, preview locally first), transfer it *up* to Dev, verify it on the tested Dev environment, then promote it to Live. Two payoffs:

1. **Content can't outrun its schema.** Because content takes the same local → Dev → Live path as the code, content that depends on new schema can't reach Live before the code it needs is there.
2. **Everything is gated through Dev.** All content — including MCP/Ella-authored content — passes through the tested Dev environment before it lands on Live. Nothing goes local → Live directly.

This inverts the project's earlier "Live is canonical for content, local → Live direct" model. That earlier model only worked because of a stale, Live-only `umbraco-cloud.json` that silently pointed the local backoffice's transfer target at Live — the July-incident landmine that quietly repointed local transfers at Live. The file is now the stock all-workspaces version (Dev + Live) and must stay both git-tracked **and** stock — no Live-only divergence — because the local → Dev → Live model removes the only reason anyone ever kept such a divergence.

## The by-hop discipline

### local → Dev — root-queue freely

Low stakes. Dev already hosts CI fixtures and is the staging surface everything passes through, so a broad root-level transfer up to Dev is fine. This is the default "push my work up" hop.

### Dev → Live — selective / per-item by default

Promote content **per-item** (selective transfer) as the default. A **root-level** Dev → Live transfer is only safe **just after a green CI run with the test fixtures cleaned**.

**Why the fixture caveat is the decisive risk.** CI creates E2E fixtures directly on Dev via `POST /document` under the Home node. If a failed or interrupted CI run leaves *published* fixtures on Dev, a root-level Dev → Live transfer during that window is the one credible path for **test junk to reach Live**. The containment is the specs' recycle-bin clean-before-setup plus the shared `[E2E]` name prefix (fixtures cluster at the top of the Home children list and are unmistakable to grep/eye) — not a dedicated corral doc type. So before any root-level Dev → Live promotion: confirm CI is green and no stray `[E2E]`-prefixed nodes are published on Dev.

**Transition note — legacy un-prefixed orphans.** CI fixtures created *before* the shared `[E2E]` prefix convention may still exist on Dev under their old, un-prefixed names — and grepping for `[E2E]` will **not** catch them. Sweep once for these legacy prefixes: `ACM Test`, `ALGV Test`, `SN Test Parent` / `SN Lone Parent` / `SN SecNav Lone Parent`, `EBA`, `Exp BG Test`, and `E2E-Guide-Fixture`. The fix is a **one-time manual sweep** — recycle-bin any such nodes on Dev. After that sweep, everything is `[E2E]`-prefixed and the grep guidance above holds; this is a transition cleanup, not a standing step.

### Live → Dev restores — forbidden by default

A restore is **overwrite-not-merge**: restoring Live onto Dev clobbers any unpromoted content sitting on Dev (Dev is a *superset* of Live — it holds work in flight that Live hasn't received yet). Don't do it as a routine "refresh Dev" step.

If content was hotfixed directly on Live (which should be rare), reconcile it **upstream** — reproduce the change local → Dev → Live and re-promote — or accept it as small, known drift. Do not pull Live down onto Dev to "sync."

### Rule of thumb — transfer WIP up before pulling down

Umbraco Cloud has **no merge story for concurrent same-node edits anywhere** (restore and transfer are both overwrite, not merge). So whenever you're about to pull content *down* (Cloud → local, or any restore), transfer your local/Dev work-in-progress *up* first, or you will lose it.

## Dev-as-superset and the screenshot baselines

**No regression — Dev holding content that Live doesn't have does not affect baseline discovery or diffing.** Verified read-and-reason across `tests/e2e/_helpers.ts`, the page/block screenshot specs (`tests/e2e/pages/*.screenshot.spec.ts`, `tests/e2e/blocks/screenshots/*`), and `.github/workflows/update-snapshots.yml`. Two structural facts make the baseline flow indifferent to Dev being a superset of Live:

1. **Baselines are captured *and* compared against the same environment (Dev).** `update-snapshots.yml` regenerates against the `URL` GitHub variable (Dev), and the `playwright-against-dev` gate compares against the same `URL`. Live never participates in a screenshot diff, so "Dev holds extra content" can never surface as a Dev-vs-Live mismatch — there is no cross-environment comparison anywhere in the flow.

2. **Every spec resolves its target by a stable identifier, never by content-tree position or a global count.** Concretely:
   - **Fixed structural URL** — `home` (`/`), `search` (`/search/?q=zzzz-no-results-baseline`, a deliberate no-results query so extra content can't create hits), and all block specs (fixed guide slugs `/guides/component-guide/`, `/guides/styleguide/`, `/experiments/`). Extra Dev nodes live elsewhere in the tree and never appear on these surfaces.
   - **Template fingerprint via nav-walk** — `articleList` / `article` / `contact` / `experimentsLandingPage` use `findNavLinkForTemplate(...)`, which walks `header/nav/footer` anchors and returns the first link whose destination renders a **template-unique** selector (`main.archive-page`, `main form[method="post"]`, `main .umb-block-grid__layout-item`). It resolves by rendered template shape, not by node name/order.
   - **Block-type selector** — block specs select `.locator(<block-alias-selector>).first()`, i.e. the first instance *of that block type on that fixed page*, not the first node in the tree.
   - **Dynamic/volatile regions are masked** — `.article-grid-card`, `.byline`, `section.latest`, `section.next`, `.pagination`, and `time, .post-meta, .article-meta` (see `dynamicRegionMasks`), so content churn inside a screenshotted page doesn't thrash the diff.

The one position-flavored path (nav-walk "first match" + the `.first()` article card) was checked against the CI fixtures that Step 4 sorts to the top of Home's children with the `[E2E]` prefix: the header nav (`_SiteHead.cshtml`) only lists **published**, non-`hideFromTopNavigation` children of Home, and none of the fixtures both publishes into that nav *and* renders one of the fingerprints — the `experiments.blockgrid` fixture (the only one that renders the blockgrid fingerprint) is created **draft-only and never published**, so it is invisible to the rendered nav walk; the `sectionNavigation` fixtures publish under Home but render section-nav pages, not the archive/form/blockgrid fingerprints; the article fixtures publish under the article-list node (not Home), so they never enter the top nav. So the `[E2E]` prefix does not steer any nav-walk onto a fixture.

(Separately, and *not* introduced by this topology change: running the fixture-creating specs and the screenshot specs in one suite means published article fixtures can transiently sit in the article grid during a run. Those regions are masked, and this predates the local → Dev → Live inversion — it is not a Dev-as-superset effect and is out of scope here.)

## Media rides separately

Content transfers and restores do **not** carry media binaries. After any content restore you still need the matching **media restore** (or `npm run media:sync` as the safety net). Media remains Cloud-managed: `src/UmbracoProject/wwwroot/media/` is gitignored and binaries are never committed. Only the CONTENT direction is described here — the media-binary rules are unchanged. See [CLAUDE.md → Media files](../CLAUDE.md#media-files).

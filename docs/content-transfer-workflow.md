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

## Media rides separately

Content transfers and restores do **not** carry media binaries. After any content restore you still need the matching **media restore** (or `npm run media:sync` as the safety net). Media remains Cloud-managed: `src/UmbracoProject/wwwroot/media/` is gitignored and binaries are never committed. Only the CONTENT direction is described here — the media-binary rules are unchanged. See [CLAUDE.md → Media files](../CLAUDE.md#media-files).

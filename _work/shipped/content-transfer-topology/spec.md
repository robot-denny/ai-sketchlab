# Spec for content-transfer-topology

> This spec captures initial requirements and design rationale. For **current system behavior**, see the doc named on the **Work type** line below. This is a workflow/process + config + docs change, so its durable record lands in CLAUDE.md sections, project memories, and (optionally) a `docs/` runbook — **not** in a `_features/` doc.

branch: claude/feature/content-transfer-topology
**Work type**: fix-infra — see CLAUDE.md → Workflow layers → "Work types"; no `_features/` doc (this changes how content flows through environments and how local Deploy config is maintained, not a visitor-facing site capability)
figma_component (if used): (none)

Source discovery: `/explore`, 2026-07-28, lean scope (discovery doc retired post-ship — its rationale is summarized in this spec)

## Summary

Today the project's documented content workflow says **"Live is canonical for content"** and **"Do not use local → Dev content transfers"** — content is authored locally and pushed **directly to Live**, with Dev treated as a disposable mirror periodically restored from Live. That model only ever worked because of a **stale, Live-only `umbraco-cloud.json`** that silently pointed the local backoffice's transfer target at Live. The July 9 incident recovery replaced that file with the correct all-workspaces version, flipping the target to Dev and exposing that the "direct to Live" habit was propped up by a config divergence that the `project_umbraco_cloud_json_must_stay_tracked` memory warns must never be committed (committing the Live-only version re-arms the July deletion landmine).

This change **inverts the content-transfer topology** to the option chosen in discovery (Option B): content flows **local → Dev → Live**, riding the same pipeline as schema. Because CI pushes schema to Dev before Live, content that depends on new schema physically can't cleanly reach Live ahead of its code — the previously-manual "code before content" sequencing becomes pipeline structure, and content gets rendered/tested on Dev (Playwright, screenshots) before promotion. MCP/Ella-authored content is gated through Dev like everything else. The work is primarily **discipline + configuration + documentation**: revert the local config divergence to stock, corral CI test-content under one parent node, and rewrite the CLAUDE.md sections and memories that currently assert the opposite model.

This aligns with the three stated best-practice pillars: Umbraco/coding hygiene (stock config, zero hacks), testing/TDD gated delivery (content passes through the tested Dev environment), and AI/MCP workflow safety (agent-authored content is gated, and MCP never touches Live).

## Functional Requirements

1. **Stock Deploy config.** The tracked `src/UmbracoProject/umbraco-cloud.json` is the stock all-workspaces version (Dev + Live). The local working-tree divergence that repoints transfers at Live is **reverted** — no author's clone needs to carry a permanent uncommitted/skip-worktree divergence. The local backoffice Deploy transfer target is Dev.

2. **Content enters the pipeline at Dev.** The canonical content path is **local → Dev → Live**. Content authored locally (by the human or by MCP/Ella) transfers up to Dev, is verified on Dev, then is promoted Dev → Live.

3. **By-hop transfer discipline (documented):**
   - **local → Dev:** root-queue freely (low stakes; Dev already hosts CI fixtures).
   - **Dev → Live:** selective / per-item by default. A root-level Dev → Live transfer is only done just after a green CI run, when test fixtures have been cleaned.
   - **Live → Dev restores:** forbidden-by-default (they clobber unpromoted content on Dev). Live hotfixes are made upstream and re-promoted, or accepted as small drift.

4. **Test-content corral.** CI-created fixtures (`SN Test *`, `ALGV Test *`, guide pages, etc.) are created under **one designated parent node** in the content tree, for visual clarity on Dev. Specs that create fixtures look up this parent dynamically (no hardcoded UUID/slug) and create their fixtures beneath it. The corral is for clarity; the actual containment against test-junk-reaching-Live remains the existing recycle-bin clean-before-setup cleanup (recycle-bin content does not transfer).

5. **Documentation inversion.** Every place that asserts the old model is rewritten to the new one:
   - CLAUDE.md **"Content workflow under CI"** and **"Media files"** sections (the "Live is canonical" / "Do not use local → Dev content transfers" statements) are replaced with the local → Dev → Live model and the by-hop discipline.
   - The `project_content_authoring_direction` memory is updated (content still authored locally, but now flows up through Dev, not direct to Live).
   - The `project_umbraco_cloud_json_must_stay_tracked` memory is cross-linked so the config revert and the tracked-file invariant stay consistent (the file stays tracked **and** stock — no Live-only divergence).

6. **No regression to media or schema flows.** Schema continues to flow through git (`.uda`) → Cloud CI/CD Flow → Dev → manual Live promotion. Media continues to flow through Cloud media transfer with `media:sync` as the local safety net. Only the **content** direction changes.

## Possible Edge Cases

- **Test-content pollution reaching Live** — the decisive risk. A root-level Dev → Live transfer during the window when a failed/interrupted CI run left published fixtures on Dev is the one credible path for test junk to reach Live. Mitigation: the Dev → Live "selective by default, root only after green CI" rule; the corral for visibility.
- **Live → Dev restore run by habit** clobbers unpromoted content sitting on Dev awaiting promotion. The new rule forbids it by default.
- **Concurrent same-node edits** across environments have no merge story anywhere in Umbraco Cloud (restore is overwrite-not-merge). Rule of thumb: transfer WIP up before pulling down.
- **Screenshot-baseline / `update-snapshots.yml` flow** may implicitly assume Dev mirrors Live (fixture discovery, nav-link helpers). Now that Dev is a **superset** of Live, verify nothing in that flow breaks or silently changes coverage.
- **The config revert itself** must not re-arm the July landmine: the file stays git-tracked and lists all workspaces; the revert removes only the *local working-tree divergence*, it does not untrack or Live-only-ize the committed file.
- **A future co-author** authoring on Dev's backoffice (Option C, unlocked by this change) — not built now, but the model must not preclude it.
- **Media does not ride content restores** — pulling another stream's content down still needs the separate media restore / `media:sync` step; easy to forget.

## Acceptance Criteria

1. The committed `src/UmbracoProject/umbraco-cloud.json` is the stock all-workspaces version, and the local working tree carries **no** divergence of it after this change ships. The file remains git-tracked.
2. The local backoffice Deploy transfer target resolves to **Dev**, and a content transfer from local sends content to Dev (not Live).
3. CLAUDE.md contains a single canonical "content workflow" statement describing **local → Dev → Live** with the by-hop discipline, and contains **no** surviving statement asserting "Live is canonical for content" or "Do not use local → Dev content transfers."
4. The `project_content_authoring_direction` memory reflects the local → Dev → Live direction and cross-links `project_umbraco_cloud_json_must_stay_tracked`.
5. CI-created fixtures are created under one designated corral parent node, and each spec that creates fixtures looks that parent up dynamically (no hardcoded UUID or slug) — verified by an existing/updated E2E run staying green.
6. The Dev → Live discipline (selective by default; root only after green CI; no Live → Dev restores by default) is documented where a future agent session will find it before transferring.
7. The screenshot-baseline / `update-snapshots.yml` flow still passes with Dev as a superset of Live (no fixture-discovery or nav-link-helper regression).

## Scenarios (Draft)

Draft BDD scenarios derived from the acceptance criteria using Example Mapping. These are **workflow/process** scenarios (the actors are the author, the Claude agent Ella, and CI), not visitor-facing runtime behavior — appropriate for a fix-infra change. They will be verified against the shipped configuration + docs and refined during planning.

### Rule: Deploy config is stock all-workspaces with no local divergence

```scenario
Scenario: Fresh clone points local transfers at Dev
  Given a developer clones the repo and does no manual config edit
  When they open Settings → Deploy in the local backoffice and start a content transfer
  Then the transfer target offered is the Dev environment
  And umbraco-cloud.json in their working tree matches the committed all-workspaces version with no divergence
```

```scenario
Scenario: The July landmine stays disarmed
  Given the stock all-workspaces umbraco-cloud.json is committed and tracked
  When a developer follows the new workflow
  Then no step requires an uncommitted or skip-worktree Live-only divergence of umbraco-cloud.json
  And the file remains git-tracked listing all workspaces
```

### Rule: Content enters the pipeline at Dev, never directly at Live

```scenario
Scenario: Author publishes a new blog post that depends on a new block
  Given the author has built a new block locally and authored a post using it
  And the block's schema has been merged to master and deployed to Dev by CI
  When the author transfers the post up
  Then the post lands on Dev where its block renders correctly
  And the post is not transferred directly to Live
```

```scenario
Scenario: Ella-authored content is gated through Dev
  Given the Claude agent Ella publishes content locally via MCP
  When that content is transferred up
  Then it goes to Dev for verification
  And MCP/Ella never has write access to Live
```

### Rule: By-hop transfer discipline (root local→Dev, selective Dev→Live)

```scenario
Scenario: Root-queue a batch of unrelated changes up to Dev
  Given the author has several unrelated local content edits
  When they perform a root-level transfer to Dev
  Then all queued content transfers with dependencies auto-resolved
  And this is an accepted low-stakes operation
```

```scenario
Scenario: Promote to Live selectively by default
  Given content on Dev is ready to promote and CI is not confirmed green with fixtures cleaned
  When the author promotes to Live
  Then they transfer the specific content nodes per-item
  And they do not perform a root-level Dev → Live transfer
```

```scenario
Scenario: Root Dev→Live transfer only after a green CI run
  Given the most recent CI run is green and its test fixtures have been cleaned from Dev
  When the author performs a root-level Dev → Live transfer
  Then no test-content fixtures are carried to Live
```

### Rule: Live → Dev restores are forbidden by default

```scenario
Scenario: Unpromoted Dev content is protected from a habitual restore
  Given Dev holds content that has not yet been promoted to Live
  When the workflow is followed
  Then a Live → Dev restore is not performed
  And any needed Live hotfix is made upstream and re-promoted instead
```

### Rule: CI test-content is corralled under one parent node

```scenario
Scenario: A spec creates its fixture under the corral parent
  Given the designated "Test Content" corral parent exists on the target environment
  When an E2E spec creates a fixture page
  Then it looks up the corral parent dynamically by name
  And creates the fixture beneath it
  And the spec passes without any hardcoded UUID or slug
```

### Rule: Documentation asserts one canonical model

```scenario
Scenario: A future agent session reads the current workflow
  Given a new Claude session reads CLAUDE.md and project memories
  When it looks for the content-transfer direction
  Then it finds a single canonical local → Dev → Live statement with the by-hop discipline
  And it finds no surviving "Live is canonical for content" or "Do not use local → Dev content transfers" statement
```

### Rule: Screenshot-baseline flow tolerates Dev-as-superset

```scenario
Scenario: update-snapshots still passes with Dev a superset of Live
  Given Dev now holds unpromoted content in addition to everything on Live
  When the update-snapshots / Playwright baseline flow runs against Dev
  Then fixture discovery and nav-link helpers still resolve
  And the run passes with no regression attributable to Dev holding extra content
```

## Open Questions

- **Dedicated corral doc type — DEFERRED (resolved during implementation).** The dedicated "Test Content" corral document type was **deferred** in favor of a lightweight `[E2E]` fixture-naming convention (a shared naming corral standardized across the six fixture-creating specs). A purpose-built corral doc type / parent node can be revisited later if the naming convention proves insufficient for visual clarity or containment on Dev.
- **Corral node home & doc type.** Where does the "Test Content" corral parent live in the content tree, what document type is it, and exactly which specs need their fixture-parent lookup updated to use it? (Discovery Q1.)
- **Tooling assist vs. docs-only.** Should the Dev → Live "selective by default, root only after green CI" rule be documented-only, or is a lightweight tooling assist worth it (e.g. a `/check-uda`-style pre-transfer checklist)? (Discovery Q3.)
- **Screenshot-baseline assumptions.** Does anything in the `update-snapshots.yml` / baseline flow implicitly assume Dev mirrors Live (fixture discovery, nav-link helpers) now that Dev is a superset? Needs a concrete check, not just an assertion. (Discovery Q4.)
- **Restore-source selector in practice.** Confirm the local Deploy dashboard's restore-source selector against Dev (partial restore per node) the first time a second stream of content exists. (Discovery Q5.)
- **Exact doc surface.** Precisely which CLAUDE.md subsections change ("Content workflow under CI", "Media files", possibly "Content authoring"), which memories update, and whether a new `docs/` runbook is warranted for the by-hop discipline vs. folding it into CLAUDE.md. (Discovery Q2.)
- **Is a `docs/` runbook the right durable home** for the by-hop transfer discipline, or should it live entirely in CLAUDE.md? (Fix-infra work records residue in a runbook and/or a CLAUDE.md section.)

## Testing Guidelines

This is a config + docs + discipline change; most "tests" are verifications rather than new automated suites. Where automation exists, keep it light:

- **Config assertion:** verify the committed `umbraco-cloud.json` is the stock all-workspaces version and the working tree has no divergence (a simple check, possibly a note in `/check-uda` rather than a new test).
- **Fixture-corral E2E:** update the affected specs (`section-navigation`, `algorithmic-art`/`ALGV`, guides) to create fixtures under the corral parent via **dynamic lookup** (per the E2E Resilience Rules — never hardcode UUIDs/slugs), and confirm they stay green against Dev.
- **Docs consistency check:** grep CLAUDE.md and memories to confirm no surviving "Live is canonical for content" / "Do not use local → Dev content transfers" statements after the inversion.
- **Screenshot-baseline smoke:** run (or reason through) the `update-snapshots.yml` flow once against Dev-as-superset to confirm no fixture-discovery / nav-link regression.
- Do **not** add tests that hardcode environment UUIDs, slugs, or assume Dev mirrors Live.

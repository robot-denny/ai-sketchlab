# Plan: Content Transfer Topology (local → Dev → Live)

**Spec**: `_specs/content-transfer-topology.md`
**Branch**: `claude/feature/content-transfer-topology`
**Work type**: fix-infra — carried from the spec; drives the final step (no `_features/` doc; durable residue lands in CLAUDE.md + a `docs/` runbook + project memories)

## Context

The project currently documents content as flowing **local → Live directly**, with "Live is canonical for content" and "Do not use local → Dev content transfers." That model only worked because of a stale, Live-only `umbraco-cloud.json` that silently pointed the local backoffice's transfer target at Live. This increment inverts the topology to **local → Dev → Live** (discovery Option B): content rides the same pipeline as schema, so content that depends on new schema can't reach Live ahead of its code, and everything (including MCP/Ella-authored content) is gated through the tested Dev environment before promotion.

The work is **config + docs + discipline**, plus a light E2E fixture-naming refactor. There is **no schema, Razor, CSS, or backoffice-extension work.** The proven hazard (the config divergence) is disarmed by a one-line working-tree revert; the bulk of the value is rewriting the docs/memories that assert the opposite model so future agent sessions don't fight the new workflow.

---

## Key Decisions

- **Config revert is working-tree-only — no commit for the config.** The committed `HEAD:src/UmbracoProject/umbraco-cloud.json` is *already* the stock all-workspaces (Dev + Live) version. The divergence exists **only in the working tree** (a Live-only edit that removed the Dev workspace). So AC#1 is satisfied by `git checkout -- src/UmbracoProject/umbraco-cloud.json` — this aligns the working tree to HEAD and produces **zero** git changes to the file. Do **not** try to "commit the config fix"; there is nothing to commit for that file. The file stays tracked (`git ls-files -v` shows `H`, not skip-worktree). This is the AC#1 + AC#2 step and is the disarming of the July landmine (see `project_umbraco_cloud_json_must_stay_tracked`).
- **Corral = naming convention, NOT a dedicated doc type** (decided with the user, 2026-07-28). A real "Test Content" parent node would need a doc type whose allowed-children covers every fixture doc type *and* an edit to Home's allowed-children, deployed via `.uda`, plus a permanent maintenance tax (every future fixture doc type must be added + redeployed or its spec fails at creation). Discovery called the corral "visual clarity, **not** the containment mechanism" (recycle-bin cleanup is the real containment, and it already exists). So this increment standardizes a **single shared root prefix** across all fixture-creating specs — greppable and visually clustered in the Home children list — at ~25% of the effort and zero schema coupling. The dedicated corral doc type is recorded as a **deferred follow-up** in the spec's open questions.
- **Recommended shared prefix: `[E2E]`.** Leading bracket sorts fixtures to the top of Home's children (visual clustering) and is an unmistakable grep marker. Each spec keeps its existing sub-label after the root prefix (e.g. `[E2E] ALGV No Image`). Implementer may pick a different exact string but must apply it uniformly.
- **Dev → Live discipline is docs-only** (decided with the user, 2026-07-28): CLAUDE.md canonical content-workflow section + a new `docs/content-transfer-workflow.md` runbook. No tooling/checklist command.
- **Memories are legitimate fix-infra residue.** `project_content_authoring_direction` and `project_umbraco_cloud_json_must_stay_tracked` are the durable homes future sessions read; they are updated as part of this work even though they live outside the repo.
- **Six fixture-creating specs are in scope** for the naming refactor (all create via `POST /document` under `homeId`): `articleCardMetaDescription` (`ACM Test`), `articleListGridView` (`ALGV Test`), `sectionNavigation` (`SN Test *`), `blocks/ellaBlockAttribution` (`EBA`), `experiments/experiments.blockgrid` (`Exp BG Test`), `styleguide` (`E2E-Guide-Fixture`). The `guides.spec.ts` / `guides-cli.spec.ts` CLI-driven specs are audited (name their fixtures via the guide generator) but not force-fit if the CLI owns the naming.
- **This is test-infra refactor, not product TDD.** The "tests" here are the specs themselves; the success criterion is they still create/clean/find fixtures correctly and stay green — not a new RED→GREEN product assertion.

---

## Steps

Each step is designed to be completed independently in its own context window.

---

### Step 1 — Revert the local `umbraco-cloud.json` divergence to stock

> **Prompt**: Implement Step 1 of `_plans/content-transfer-topology.md`. The committed `HEAD:src/UmbracoProject/umbraco-cloud.json` is already the correct stock all-workspaces version (Dev + Live); only the working tree carries a Live-only divergence (the Dev workspace was removed). Run `git checkout -- src/UmbracoProject/umbraco-cloud.json` to discard that working-tree divergence. Then verify: (a) `git diff --exit-code src/UmbracoProject/umbraco-cloud.json` is clean, (b) `git ls-files -v src/UmbracoProject/umbraco-cloud.json` shows `H` (tracked, not skip-worktree), (c) the file's `Workspaces` array contains BOTH a `"Name": "Dev"` and `"Name": "Live"` entry. Do NOT create any commit for this file — there is nothing to commit; this only aligns the working tree to HEAD. This satisfies AC#1 and AC#2 and disarms the July `umbraco-cloud.json` landmine.

**What to build**: No new files. One working-tree operation on `src/UmbracoProject/umbraco-cloud.json`.

**Validation**:
- [Automated]: `git diff --exit-code src/UmbracoProject/umbraco-cloud.json` → clean (exit 0); `git ls-files -v src/UmbracoProject/umbraco-cloud.json` → starts with `H`; `grep -c '"Name": "Dev"\|"Name": "Live"' src/UmbracoProject/umbraco-cloud.json` → 2.
- [Manual]: In the local backoffice, open **Settings → Deploy** and start a content transfer — confirm the offered transfer target is now **Dev** (not Live). (AC#2.)

---

### Step 2 — Invert the documentation: CLAUDE.md canonical workflow + Media cross-ref + runbook

> **Prompt**: Implement Step 2 of `_plans/content-transfer-topology.md`. Rewrite CLAUDE.md's **"Content workflow under CI"** subsection (currently ~lines 328–332, under CI/CD & Build hygiene) so it asserts the NEW model: content flows **local → Dev → Live**, riding the same pipeline as schema; content is verified on Dev before promotion; MCP/Ella content is gated through Dev. Remove the two statements that assert the old model — "Live is canonical for content" and "**Do not use local → Dev content transfers.**" — and replace with the by-hop discipline (local→Dev: root-queue freely; Dev→Live: selective/per-item by default, root only just after a green CI run with fixtures cleaned; Live→Dev restores: forbidden-by-default because they clobber unpromoted Dev content; transfer WIP up before pulling down). Fix the **Media files** section's content-direction wording (the "content restore from the target Cloud environment (typically Live)" phrasing at ~line 524 and the cross-ref at ~line 330) so it's consistent with local→Dev→Live — but keep the media-binary rules unchanged (media is still Cloud-managed, `wwwroot/media/` still gitignored, `media:sync` still the safety net; only the CONTENT direction changes). Then create a new runbook `docs/content-transfer-workflow.md` that is the durable home for the by-hop discipline (the four hop rules above, the test-content-pollution risk, the WIP-up-before-pull rule, and the note that media rides separately). Link the runbook from the CLAUDE.md content-workflow section. Confirm with grep that no surviving "Live is canonical for content" or "Do not use local → Dev content transfers" statement remains anywhere in CLAUDE.md.

**What to build**:
- Modify `CLAUDE.md` — "Content workflow under CI" subsection (full rewrite to local→Dev→Live + by-hop discipline + runbook link) and "Media files" content-direction wording (keep media-binary rules intact).
- Create `docs/content-transfer-workflow.md` — the by-hop transfer discipline runbook.

**Validation**:
- [Automated]: `grep -n "Live is canonical for content\|Do not use local → Dev content transfers" CLAUDE.md` → **no matches**. `test -f docs/content-transfer-workflow.md` → exists. `grep -n "content-transfer-workflow" CLAUDE.md` → the link is present.
- [Manual]: Read the rewritten CLAUDE.md section end-to-end — it reads as one coherent local→Dev→Live model with no residual contradiction, and the media-binary rules are unchanged. (AC#3, AC#6.)

---

### Step 3 — Update project memories to the inverted direction

> **Prompt**: Implement Step 3 of `_plans/content-transfer-topology.md`. Update the project memory `project_content_authoring_direction.md` (in `/Users/dkardys/.claude/projects/-Users-dkardys-Sites-umbraco-17-demo-site/memory/`) so it reflects the NEW direction: content is still authored **locally** (local SQLite, author previews locally first), but it now flows **local → Dev → Live** through the pipeline — NOT direct to Live. Keep the still-true parts (Cloud is not the source of truth for content records; media is Cloud-managed; schema rides git). Add a **How to apply** bullet pointing future sessions at `docs/content-transfer-workflow.md` and cross-link `[[project_umbraco_cloud_json_must_stay_tracked]]`. Then update `project_umbraco_cloud_json_must_stay_tracked.md` to note that the file must stay tracked AND stock all-workspaces (no Live-only divergence) — the local→Dev→Live model removes the reason anyone kept a Live-only divergence — and cross-link `[[project_content_authoring_direction]]`. Update the corresponding one-line hooks in `MEMORY.md` if their wording no longer matches. Do not create duplicate memory files; edit the existing ones in place.

**What to build**:
- Modify `memory/project_content_authoring_direction.md` (invert direction; cross-links; runbook pointer).
- Modify `memory/project_umbraco_cloud_json_must_stay_tracked.md` (stays tracked + stock; cross-link).
- Modify `memory/MEMORY.md` index hooks if wording drifted.

**Validation**:
- [Manual]: Both memory bodies describe local → Dev → Live consistently; the two files cross-link each other; `MEMORY.md` hooks match the updated bodies. (AC#4.)

---

### Step 4 — Corral CI fixtures under one shared name prefix (E2E refactor)

> **Prompt**: Implement Step 4 of `_plans/content-transfer-topology.md`. Add a shared fixture-naming convention so all CI-created content clusters visibly in the Home children list without any schema change. In `tests/e2e/_umbracoApi.ts`, export a `TEST_FIXTURE_PREFIX` constant (recommended value `'[E2E]'` — a leading bracket sorts fixtures to the top of the tree and is an unmistakable grep marker) and optionally a small `testFixtureName(sub: string)` helper that prefixes it. Then refactor the six fixture-creating specs to compose their fixture names from the shared prefix and to filter their clean-before-setup on it, PRESERVING each spec's existing sub-label so tests still find their own fixtures: `tests/e2e/articleCardMetaDescription.spec.ts` (`ACM Test *`), `tests/e2e/articleListGridView.spec.ts` (`ALGV Test *`), `tests/e2e/sectionNavigation.spec.ts` (`SN Test Parent` / `SN Lone Parent` / `SN SecNav Lone Parent`), `tests/e2e/blocks/ellaBlockAttribution.spec.ts` (`EBA` via its `TEST_PREFIX`), `tests/e2e/experiments/experiments.blockgrid.spec.ts` (`Exp BG Test`), `tests/e2e/styleguide.spec.ts` (`E2E-Guide-Fixture`). Keep every fixture lookup dynamic (no hardcoded UUIDs/slugs — E2E Resilience Rule #1/#2); fixtures still create under `homeId` (via `findHomeDocId()`), just renamed. Audit `guides.spec.ts` / `guides-cli.spec.ts` — if the guide-generator CLI owns fixture naming, leave them and note it; don't force-fit. Run each refactored spec and confirm it stays GREEN (fixtures still create, clean, and are found under the new names). Because this is a test-infrastructure refactor, the success criterion is "specs still pass," not a new product assertion.

**What to build**:
- Modify `tests/e2e/_umbracoApi.ts` — add `TEST_FIXTURE_PREFIX` (+ optional `testFixtureName` helper).
- Modify the six specs listed above to use the shared prefix for names + cleanup filters.
- Audit (and possibly note-only) `tests/e2e/guides.spec.ts`, `tests/e2e/guides-cli.spec.ts`.

**Test first** *(refactor framing — the specs ARE the tests)*:
- Before refactoring, note the current green/red state of each spec so you can confirm no regression.
- Run per spec, e.g.: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/articleListGridView.spec.ts` — confirm it passes both before and after the rename (behavior unchanged; only fixture names change).

**Validation**:
- [Automated]: Each of the six specs passes: `PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx playwright test tests/e2e/articleCardMetaDescription.spec.ts tests/e2e/articleListGridView.spec.ts tests/e2e/sectionNavigation.spec.ts tests/e2e/blocks/ellaBlockAttribution.spec.ts tests/e2e/experiments/experiments.blockgrid.spec.ts tests/e2e/styleguide.spec.ts` → all green. `grep -rn "TEST_FIXTURE_PREFIX" tests/e2e` → the six specs reference the shared constant.
- [Manual]: After a run, open the backoffice Home node — all CI fixtures are clustered under the `[E2E]` prefix at the top of the children list. (AC#5.)

---

### Step 5 — Verify the screenshot-baseline flow tolerates Dev-as-superset

> **Prompt**: Implement Step 5 of `_plans/content-transfer-topology.md`. Now that Dev is a **superset** of Live (it holds unpromoted content in addition to everything Live has), verify nothing in the screenshot-baseline / `update-snapshots.yml` flow implicitly assumed Dev mirrors Live. Read `tests/e2e/_helpers.ts` (especially `discoverBlockOnPage`, `findNavLinkForTemplate`, `dynamicRegionMasks`) and `.github/workflows/update-snapshots.yml`, and the page/block screenshot specs under `tests/e2e/pages/` and `tests/e2e/blocks/screenshots/`. Look specifically for: fixture-discovery that would match an unexpected extra Dev node, nav-link helpers that assume a fixed set of pages, or any "first node" / count-based assumption that Dev-holding-extra-content would break. If you find a real fragility, fix it (dynamic lookup, tighter selector, or a mask); if the flow is already resilient (fixtures are looked up by name/prefix and dynamic regions are masked), record "no regression — Dev-as-superset does not affect baseline discovery" in `docs/content-transfer-workflow.md`. Do NOT regenerate baselines as part of this step; this is a read-and-reason (plus targeted fix if needed) verification.

**What to build**:
- Read-and-reason over `tests/e2e/_helpers.ts`, `.github/workflows/update-snapshots.yml`, and the screenshot specs.
- Modify only if a real Dev-superset fragility is found; otherwise append a "no regression" note to the runbook.

**Validation**:
- [Manual]: Either a concrete fragility is identified and fixed, or the runbook records why the baseline flow is unaffected by Dev holding extra content. (AC#7, spec Open Q4.)

---

### Step 6 — Record durable residue, track the discovery doc, and archive (fix-infra final step)

> **Prompt**: Complete Step 6 of `_plans/content-transfer-topology.md`. This is a **fix-infra** change, so there is NO `_features/` doc. Confirm the durable behavior is recorded in its correct homes: the CLAUDE.md content-workflow section (Step 2), `docs/content-transfer-workflow.md` (Steps 2 & 5), and the two project memories (Step 3). Bring the source discovery doc into git on this branch — `git add docs/discovery/content-transfer-topology.md` (it was untracked). Confirm the shipped spec `_specs/content-transfer-topology.md` still carries the acceptance criteria, then archive the spec and plan: `git mv _specs/content-transfer-topology.md _specs/shipped/content-transfer-topology.md` and `git mv _plans/content-transfer-topology.md _plans/shipped/content-transfer-topology.md`. Verify nothing was filed under `_features/`. In the spec's Open Questions (now in `_specs/shipped/`), confirm the deferred "dedicated corral doc type" follow-up is recorded so it isn't lost. Do NOT touch `src/UmbracoProject/umbraco-cloud.json` (Step 1 already left it correct — a stray edit would re-arm the landmine).

**What to build**:
- `git add docs/discovery/content-transfer-topology.md` (track the discovery input).
- `git mv` the spec and plan into their `shipped/` folders.
- Confirm (no new file) that `_features/` gained nothing.

**Validation**:
- [Manual]: `docs/content-transfer-workflow.md` + the rewritten CLAUDE.md section are the durable homes; the two memories reflect the new direction; the discovery doc is tracked; spec + plan live under `shipped/`; `_features/` has no `content-transfer-topology.md`. (Work-type = fix-infra honored.)

---

## File Summary

| Action | File |
|--------|------|
| Working-tree revert (no commit) | `src/UmbracoProject/umbraco-cloud.json` |
| Modify | `CLAUDE.md` (Content workflow under CI + Media files content-direction wording) |
| Create | `docs/content-transfer-workflow.md` (by-hop transfer discipline runbook) |
| Modify | `memory/project_content_authoring_direction.md` |
| Modify | `memory/project_umbraco_cloud_json_must_stay_tracked.md` |
| Modify | `memory/MEMORY.md` (index hooks, if wording drifted) |
| Modify | `tests/e2e/_umbracoApi.ts` (shared `TEST_FIXTURE_PREFIX`) |
| Modify | `tests/e2e/articleCardMetaDescription.spec.ts` |
| Modify | `tests/e2e/articleListGridView.spec.ts` |
| Modify | `tests/e2e/sectionNavigation.spec.ts` |
| Modify | `tests/e2e/blocks/ellaBlockAttribution.spec.ts` |
| Modify | `tests/e2e/experiments/experiments.blockgrid.spec.ts` |
| Modify | `tests/e2e/styleguide.spec.ts` |
| Audit (note-only if CLI owns naming) | `tests/e2e/guides.spec.ts`, `tests/e2e/guides-cli.spec.ts` |
| Modify only if Dev-superset fragility found | `tests/e2e/_helpers.ts`, `.github/workflows/update-snapshots.yml` |
| Track (git add) | `docs/discovery/content-transfer-topology.md` |
| Move to shipped | `_specs/content-transfer-topology.md` → `_specs/shipped/` |
| Move to shipped | `_plans/content-transfer-topology.md` → `_plans/shipped/` |
| **No feature doc** *(fix-infra)* | (nothing under `_features/`) |

# Cantrip toolkit adoption

Durable runbook for the **cantrip toolkit** — the agentic developer tooling this repo runs on. It
records what the toolkit is, the layout it established, how a new increment flows through it, and how
to update it without losing local tailoring. This is a **runbook**, not a feature spec: it captures
the operational residue of a `fix-infra` adoption so future contributors (and agent sessions) don't
re-derive it.

The adoption itself is archived at [`_work/shipped/cantrip-toolkit-adoption/`](../_work/shipped/cantrip-toolkit-adoption/)
(spec + plan). The concise reference lives in [AGENTS.md → Toolkit & workflow](../AGENTS.md#toolkit--workflow);
this file is the deeper "how it works and how to operate it" companion.

## What the toolkit is

Cantrip is an NPX-installable agentic toolkit (source: `robot-denny/cantrip`) installed via the
[vercel-labs `skills`](https://www.npmjs.com/package/skills) CLI. It is organized in three layers:

- **L0 Core** — the tool-agnostic **spellbook** (`/spec`, `/plan`, `/implement-step`, `/feature`,
  `/retrofit`, `/explore`, `/code-review`, `/commit-message`) plus reference skills
  (`workflow`, `bdd-principles`, `tdd-principles`, `memory-discipline`, `reviewer-discipline`,
  `update-toolkit`).
- **L1 Stack packs** — technology guidance the core spells consult, opt-in per pack:
  - `umbraco-17` — `umbraco-17-starter-facts`, `umbraco-17-planning`, `umbraco-17-review-rules`,
    `umbraco-17-feature-backfill`.
  - `umbraco-cloud` — `umbraco-deploy-facts`: Deploy `.uda` artifact mechanics, why local files and an
    environment's database drift, and the remediation paths that actually clear a pending or mismatched
    entry. **Versionless** — Deploy behaves the same across CMS majors.
  - Not installed: the `dotnet` pack (`dotnet-conventions`, `dotnet-review-rules`) and
    `umbraco-17-audit-patterns`. `umbraco-17-review-rules` now *defers* the general
    async/cancellation/timeout rule to whatever language pack is installed, and tells the reviewer to
    apply it directly when none is — so nothing is lost meanwhile, but the `dotnet` pack is the
    intended home for it.
- **L2 Project** — this repo's own tailoring: the config slots under `.agents/config/`, the
  project-authored skills (`architecture-audit`), and the tailored reviewers. This is the layer
  updates must never clobber (see [Updating safely](#updating-safely)).

Installed skills are pinned in [`skills-lock.json`](../skills-lock.json) (source + `skillPath` +
content hash per skill).

## The adopted layout

| Piece | Where | Notes |
|---|---|---|
| **Spells** (workflow commands) | `.agents/skills/*`, symlinked from `.claude/skills/*` | `/spec`, `/plan`, `/implement-step`, `/feature`, `/retrofit`, `/explore`, `/code-review`, `/commit-message`. **Skills shadow same-named commands** — the skill wins, which is why the eight `.claude/commands/*.md` of these names were retired. |
| **Kept project commands** | `.claude/commands/*.md` | Seven tailored commands with no spell equivalent stay: `check-uda`, `umbraco-edit`, `block`, `cms-image`, `guide`, `algorithmic-art`, `canvas-design`. |
| **Config slots (L2)** | `.agents/config/` | `paths.md` (where things live), `stack.md` (build/test/run), `conventions.md` (branch/commit/impl discipline + planning gotchas), `reviewer-rules/` (shared reviewer context). Spells read these via a `**Slot:** … **If empty:** …` fallback pattern. |
| **Stack pack (L1)** | `.agents/skills/umbraco-17-*` | Consulted automatically by the core spells when planning, reviewing, or backfilling Umbraco work. |
| **Reviewers** | `.claude/agents/{code-reviewer,accessibility-reviewer,perf-reviewer}.md` | `/code-review` runs all three. The tailored `code-reviewer` (renamed from `umbraco-code-reviewer`) carries project rules + calibrated memory — it's preferred over cantrip's generic reviewer. |
| **Reviewer memory** | `.claude/agent-memory/<reviewer>/` (gitignored) | One `MEMORY.md` index + topic files per reviewer, written per the `memory-discipline` skill. |
| **Workspace** | `_work/<slug>/` → `_work/shipped/<slug>/` | One increment bundle per slug (`spec.md`, `plan.md`, optional `notes/`, `assets/`). See [`.agents/config/paths.md`](../.agents/config/paths.md). |
| **Capability docs** | `_features/<area>.md` | Living Given/When/Then behavior, one file per capability area. |
| **Audits** | `docs/audits/` (committed) · `_scratch/` (gitignored) | Durable audits are committed; scratch/throwaway audits go to the gitignored `_scratch/`. The legacy `_audits/` stays gitignored and untouched. |

### Two skill-folder locations

By accident of history, skills live in two places (consolidation is a future P2):

- **`.agents/skills/`** — the [Anthropic skills convention](https://github.com/anthropics/skills);
  cantrip + pack skills install here, symlinked into `.claude/skills/` so Claude Code discovers them.
- **`skills/`** — the older repo-local convention, kept for skills that ship bundled binary assets
  (`algorithmic-art`, `canvas-design` — see [skills/README.md](../skills/README.md)).

## How a new increment flows

The `workflow` skill owns the spine and the **work-type classification** — consult it before creating
any artifact. The classification decides what durable artifacts the work earns:

- **`new-capability`** — introduces behavior the site doesn't have. Earns a new `_features/<area>.md`.
- **`change-to <existing>`** — modifies an existing capability. Folds into that capability's feature
  doc; no new file.
- **`fix-infra`** — a fix/infra/cleanup with no standing behavior change. Earns a `docs/` runbook
  (like this one), no feature doc.

The typical chain:

1. **`/spec <idea>`** — branches, writes `_work/<slug>/spec.md`, classifies the work type, and (for
   `new-capability`) drops a draft `_features/` skeleton.
2. **`/plan <slug>`** — writes `_work/<slug>/plan.md`: TDD-ordered, independently-runnable steps,
   each with a paste-ready prompt. Reads the config slots for real build/test commands and layout.
3. **`/implement-step <slug> <n>`** — dispatches step *n* to a fresh worker context. The worker
   implements + validates but **does not commit**.
4. **`/code-review`** — runs the three reviewers over the diff (use scope `branch` when the work was
   built across several committed steps).
5. **`/commit-message`** — proposes a message from the staged diff; commit + push after approval.
6. **Record behavior** — the plan's final step: `/feature update <slug>` for a capability, or a
   `docs/` runbook for `fix-infra`.

**Out-of-flow changes** — anything that skipped the spine — get reconciled with `/retrofit` before
commit (or before push, if already committed).

## Updating safely

**Never run the bare installer** (`npx skills update`, `skills update`) directly. The underlying
installer **silently overwrites local modifications** — no warning, no merge, no check against local
state (verified: a local edit to an installed skill was reverted to pristine and the run still
reported success). Your L2 tailoring would vanish with no trace.

Instead run **`/update-toolkit`**. It wraps the installer with a git safety net:

1. Refuses to run unless this is a git repo, the working tree is clean, and the installed skills are
   git-tracked — because after the update, `git diff` is the *only* record of what changed.
2. Records what's installed from `skills-lock.json` (the blast radius) before running.
3. Runs the update with telemetry disabled (`DISABLE_TELEMETRY=1` — the installer uploads skill file
   contents by default).
4. Walks every change so you can see which tailorings were reverted and move them somewhere updates
   can't reach (the L2 slots exist precisely so tailoring lives *outside* the updatable skills).

A "failed to check for deleted skills" warning from the installer is known and benign. So is
`1 project skill(s) cannot be updated automatically … frontend-design` — that entry predates
`skillPath` tracking in the lockfile, so the updater skips it and leaves the local copy alone.

### Two things the guard does not protect you from

Both were confirmed against the installer's source (CLI 1.5.23), and both bit on the 2026-08-31 update:

1. **An update deletes files upstream removed.** Each skill directory is `rm -rf`'d and recopied
   (`cleanAndCreateDirectory` → `copyDirectory`), so it is not a merge. A reference file that upstream
   dropped disappears locally, and *anything of your own placed inside an installed skill directory
   goes with it*. That is a second reason tailoring belongs in the L2 slots, not in a vendored skill.
2. **A pack never arrives by update.** `update` only refreshes what `skills-lock.json` already pins —
   it never adds a skill. So when upstream *moves* content into a new pack, updating deletes your copy
   and does not bring the replacement.

Together those two are one failure mode: **content that migrated to a pack you don't have.** Check for
it before updating, not after — `git diff --stat` will show the deletion, but by then the guidance is
gone from the working tree. Install the successor **first**, then update, so the facts are never absent.

## Adoption history

Landed on `master` as six independently-green per-step PRs (ported from the validated `cantrip-trial`
branch, not merged wholesale), followed by this runbook:

| Step | PR | What landed |
|---|---|---|
| 1 | #51 | Install core spellbook + fill the four L2 config slots |
| 2 | #52 | Add the two `umbraco-17` stack-pack references |
| 3 | #53 | Rename reviewer `umbraco-code-reviewer` → `code-reviewer` (+ remap its memory) |
| 4 | #54 | Retire the eight shadowed `.claude/commands/*.md` |
| 5 | #55 | Split the 663-line `CLAUDE.md` → tool-agnostic `AGENTS.md` + ten `docs/` runbooks |
| 6 | #56 | Migrate `_specs/`/`_plans/` → `_work/<slug>/` increment bundles |
| — | (this doc) | Durable adoption record |

### First update after adoption — 2026-08-31

Cantrip had moved on considerably (a `/setup` spell, a `/guide` spell, `tdd-principles`, and three
packs where there had been one). This update took the cheap half and deliberately deferred the rest:

- **Installed the successor before updating.** The Deploy facts had migrated out of
  `umbraco-17-starter-facts/references/deploy-schema.md` and into `umbraco-deploy-facts` in the new
  `umbraco-cloud` pack. The update deletes the former and does not supply the latter, so
  `umbraco-deploy-facts` went in first. All ten facts verified present at the new location; the
  successor adds ~100 lines of remediation paths on top.
- **Installed `tdd-principles`,** which the refreshed `bdd-principles`, `implement-step`, `plan`,
  `retrofit`, and `reviewer-discipline` all now reference.
- **Refreshed 19 skills** (all 20 pinned except `frontend-design`), **12** of them with content
  changes — reproduce that count with `git diff --stat`, counting *skills* rather than files, since
  `reviewer-discipline` and `umbraco-17-starter-facts` each had more than one file change. No local
  tailoring was reverted — because none
  had ever been made inside a vendored skill. That is the L2 discipline paying off.
- **Installed by single-skill subpath, not `--all` on the pack** — `umbraco-cloud` also carries a
  `/check-uda` spell, and a skill shadows a same-named command, so `--all` would have silently
  retired [.claude/commands/check-uda.md](../.claude/commands/check-uda.md).

Deferred, roughly in value order — each is independently shippable:

1. **Reviewer convergence** — the three reviewers in [.claude/agents/](../.claude/agents/) are still
   the pre-cantrip tailored ones: they reference neither `reviewer-discipline` nor `memory-discipline`
   nor `umbraco-17-review-rules`, and they read none of the `reviewer-rules/` slots (only `_shared.md`
   exists; `code.md`, `performance.md`, `accessibility.md` do not). Cantrip's skeletons — which do all
   four — sit inert at `.agents/skills/reviewer-discipline/agents/`. Updates refresh the inert copies
   and the live reviewers gain nothing, so this drift *widens with every update*. Fixing it means
   moving the Umbraco-specific checklists out of the agent files into the slots, then adopting the
   skeletons. **Watch the memory trap:** renaming a reviewer silently orphans
   `.claude/agent-memory/<name>/`.
2. **The `dotnet` pack** — pure addition, no shadowing risk, and the declared home for the general
   async/cancellation/timeout rule `umbraco-17-review-rules` now defers. Until it lands, that rule
   rests on the skill's own "where none is installed, apply it yourself" fallback, which holds only
   if the reviewer reads past the form-handler sentence — so this repo's outbound calls (AI services,
   the Deploy Management API) depend on a fallback rather than a stated rule. Installing the pack is
   the fix; **an upstream candidate** is for cantrip to name the check (*"look for a
   `dotnet-review-rules` entry in `skills-lock.json`"*) instead of leaving it to initiative.
3. **`umbraco-17-audit-patterns`** — cantrip absorbed most of the project-authored
   `architecture-audit`; decide whether ours retires or keeps its extra pillars.
4. **`/setup`** — detects and *proposes* slot fills from what the repo already says; may do much of
   item 1's discovery. Note `tdd-principles` already cites `/setup` as a place a project's
   test-harness answer is read from, so that reference is dangling until this lands (harmless — the
   skill carries its own fallback for a project with no harness).

Key decisions worth carrying forward:

- **Hold the pack spellbook.** Cantrip's `check-uda`/`umbraco-edit`/`block`/`guide` spells are **not**
  installed — the tailored `.claude/commands/` versions stay. Only the pack *references* are added,
  and always by single-skill subpath so a pack's spells cannot shadow a kept command.
- **Land as per-step PRs**, never a wholesale trial merge — master is never left half-migrated.
- **`.uda` discipline** still applies: Umbraco rewrites `.uda` on local startup; discard the churn
  (`git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/`) rather than staging it.

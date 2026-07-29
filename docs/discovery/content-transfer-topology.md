# Discovery: Content-Transfer Topology (local → Dev → Live vs. local → Live)

_Discovery input for `/spec` — produced by `/explore` on 2026-07-28. Scope: lightweight (lean)._

## Problem framing

- **Who's affected:** a solo author (plus the Claude agent Ella, publishing via MCP) authoring blog posts and experimental content locally, where content frequently co-evolves with new code (blocks, templates, auto-generated guides). Future non-technical co-authors are a consideration, not a requirement.
- **Trigger:** the July 9 `umbraco-cloud.json` incident recovery replaced the (stale, Live-only) tracked file with the correct all-workspaces version — silently flipping the local backoffice transfer target from Live to Dev. Investigation showed the six-month-old "content local→Live direct" workflow only ever worked because of that stale file; local currently carries an uncommitted Live-only divergence to restore it (verified working 2026-07-28).
- **Observed vs. assumed pain:** observed — manual "promote code Dev→Live before transferring dependent content" sequencing is tricky but has never caused a recorded failure; the config divergence itself is the proven hazard (July incident). Assumed — content outrunning code onto Live.
- **Worth preserving:** local as the experimentation sandbox for code+content together; MCP/Ella never having write access to Live; root-level batch transfers as a convenience.
- **Problem in one sentence:** where should content enter the cloud pipeline, and how should local's Deploy config be maintained, so that experimentation stays local, MCP never touches Live, content/schema deploys don't conflict, and the pipeline can't be re-broken by config divergence?

## Outcomes sought

- Code and content can be created and experimented with locally, with reduced likelihood of errors and schema conflicts at deploy time.
- The setup demonstrates best practices in three named areas: Umbraco/coding, testing/TDD (Farley-style gated delivery), and AI/MCP workflow safety.
- Three-environment flow (Local, Dev, Live) is a fixed constraint. Client-site replicability is explicitly **not** required (clients have dev/staging/prod with a dedicated authoring environment; this site doesn't).
- Room for a future co-author without redesign.

## Options considered

- **A. As-designed (content local→Live direct; Dev a restored mirror).** Requires every author's local clone to carry a permanent Live-only divergence of `umbraco-cloud.json` (uncommitted or skip-worktree; committing it re-arms the July deletion landmine — see `project_umbraco_cloud_json_must_stay_tracked` memory for the refined incident diagnosis). Content bypasses the tested environment entirely; "code before content" stays a human discipline. Worse at: config hygiene, gating, onboarding author #2.
- **B. Content rides the pipeline (local→Dev→Live) — CHOSEN.** Stock config, zero hacks. Schema reaches Dev via CI before Live, so content-with-new-schema physically can't cleanly reach Live ahead of its code — the manual sequencing becomes pipeline structure. Content is rendered/tested on Dev (Playwright, screenshots) before promotion. Worse at: Dev stops being a disposable mirror (Live→Dev restores would clobber unpromoted content); publishing gains a deliberate second hop (accepted — friction deemed fine).
- **C. Author on Dev's backoffice.** Rejected as the primary mode — breaks local code+content co-experimentation (Dev only has code already through CI). Retained as the natural onboarding path for a future non-technical co-author, which B unlocks.

## Trade-offs & second-order effects

- **Test-content pollution (the decisive risk in B):** CI creates real published fixtures on Dev (`SN Test *`, `ALGV Test *`, guide pages). Cleanup is trash-based clean-before-setup, so the exposure window is fixtures left published after a failed/interrupted run. Recycle-bin content does not transfer. A root-level Dev→Live transfer during the exposure window is the one credible path for test junk to reach Live.
- **Root-queuing habit, examined:** per-item transfers already auto-resolve dependencies (referenced media rides along), and AI settings/prompts/agents now travel as `.uda` schema via git — not via content transfer. Root-queuing's remaining value is batching unrelated changes.
- **Documentation inversion (the main follow-through cost):** CLAUDE.md ("Live is canonical for content", "**Do not use local→Dev content transfers**") and the `project_content_authoring_direction` memory assert the opposite model and must be rewritten, or future agent sessions will fight the new workflow.
- **Indirect benefits:** MCP/Ella-authored content gets gated through Dev like everything else (good AI-workflow story); config landmine fully disarmed; Dev becomes a superset of Live (baselines/screenshots need no restores).
- **Multi-author sync:** local pulls others' work via environment-selectable restore (from Dev = everything transferred; from Live = only promoted) with per-node partial restores. Restore is overwrite-not-merge — same-node concurrent edits have no merge story anywhere in Umbraco Cloud; rule of thumb is "transfer WIP up before pulling down." Media restores remain a separate step (`media:sync` as safety net).

## Direction

**Option B — content flows local → Dev → Live — with a by-hop transfer discipline:**

1. **local→Dev: root-queue freely.** Low stakes; Dev already hosts fixtures.
2. **Dev→Live: selective/per-item by default.** Root-transfer from Dev only just after a green CI run (fixtures cleaned). Promotion is where deliberateness is a feature.
3. **Corral test content** under one designated parent node (e.g. "Test Content") that all specs create under — visual clarity, not the containment mechanism (published fixtures still ride root transfers; the recycle-bin cleanup is the containment).
4. **Live→Dev restores become forbidden-by-default** (they'd clobber unpromoted content). Live hotfixes should be made upstream and re-promoted, or accepted as small drift.
5. **Revert the local `umbraco-cloud.json` divergence** back to the stock all-workspaces version.

Rationale that carried it: friction was acceptable to the author; B converts in-your-head sequencing into pipeline structure; it removes rather than institutionalizes the config hack; and it aligns with all three stated best-practice pillars, including gating agent-authored content.

## Open questions for /spec

- Where does the corral parent live in the content tree, what doc type, and which specs need their fixture-parent lookup updated to use it?
- Exact edits: which CLAUDE.md sections (Content workflow under CI, Media files) and which memories (`project_content_authoring_direction`, `project_umbraco_cloud_json_must_stay_tracked` link) need the inversion, and what does the new canonical "content workflow" section say?
- Should the Dev→Live "selective by default, root only after green CI" rule be documented-only, or is any tooling assist worth it (e.g. a `/check-uda`-style pre-transfer checklist)?
- Does anything in the screenshot-baseline / `update-snapshots.yml` flow implicitly assume Dev mirrors Live (fixture discovery, nav-link helpers), now that Dev is a superset?
- Confirm the local Deploy dashboard's restore-source selector against Dev in practice (partial restore per node) the first time a second stream of content exists.

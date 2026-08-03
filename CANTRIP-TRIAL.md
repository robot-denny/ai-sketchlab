# Cantrip toolkit — canary trial (this branch only)

**Branch:** `cantrip-trial` · **Started:** 2026-08-03 · **Baseline:** master @ `b00e350`

This repo is the **canary consumer** for the `cantrip` agentic toolkit
(`robot-denny/cantrip`). Goal: install the toolkit into a real repo, fill L2
slots from real facts, and **cast the full spell chain on one small real
increment** — surfacing the naive-consumer friction the toolkit author can't
see, and producing an executable spec for the Phase-6 setup skill. Feed
friction back to cantrip as ADRs/notes.

This is the **cheap, additive half** of adoption. The expensive half (delete old
commands, migrate `_specs/_plans/_features/_audits` → `_work/<slug>/`, split the
663-line CLAUDE.md) is **deferred to after cantrip Phase 5**, as its own work.

---

## Ground rules (verified findings — do not relearn the hard way)

- **Branch-contained on purpose.** A same-named skill **shadows** a
  `.claude/commands/*.md` command (Claude Code: "if a skill and a command share
  the same name, the skill takes precedence"). So installing cantrip core makes
  `/spec /plan /implement-step /feature /retrofit /explore /code-review
  /commit-message` resolve to the **cantrip** versions immediately, and the old
  commands become present-but-unreachable. Keeping the install on this branch
  contains that shadowing — `git checkout master` restores the old commands.
- **Install core ONLY.** cantrip's `umbraco-17` pack has only `reference/` so
  far (no spellbook yet — Phase 5). So **keep the existing umbraco commands**
  (`check-uda`, `umbraco-edit`, `block`, `cms-image`, `guide`) — nothing
  shadows them, and they're our schema/safety net until the pack replaces them.
- **Always `DISABLE_TELEMETRY=1`** — the skills CLI uploads skill file contents
  by default, and this repo draws on client-derived knowledge.
- **Never run bare `skills update`** — verified to silently clobber local edits
  *and report success*. Update only via the `/update-toolkit` git-guarded wrapper.
- Expect a stray top-level `agent/skills/` dir (known CLI wart) — harmless, ignore.

## Install (run when ready — not yet executed)

```bash
# core only, telemetry off
DISABLE_TELEMETRY=1 npx skills add robot-denny/cantrip/skills/core --all

# register the 3 reviewer agents (the one step the CLI can't do; layout-independent)
mkdir -p .claude/agents
for f in .claude/skills/reviewer-discipline/agents/*.md; do
  n=$(basename "$f"); ln -sf "../skills/reviewer-discipline/agents/$n" ".claude/agents/$n"
done
```

## Rollback

```bash
rm -rf .agents .claude/skills   # remove installed toolkit scaffolding
git checkout master             # old commands + agents restored
git branch -D cantrip-trial     # discard the trial entirely
```

Backstops already in place: pre-flight tarball at
`~/Sites/cantrip-preflight-backup/…tar.gz`; cross-session memory mirrored to
`docs/project-memory/` on master (`907f9ee`).

---

## The trial increment — placeholder graphics for imageless article cards

**Capability (fresh, small, real):** when an Article has no `mainImage`, its card
in the article grid renders a **branded placeholder** instead of an empty
thumbnail box.

**Today:** [`v2/_ArticleCard.cshtml`](src/UmbracoProject/Views/Partials/v2/_ArticleCard.cshtml)
lines 64–69 render `<div class="card-thumb">` with an `<img>` only when
`mainImage != null`; otherwise the thumb is an **empty div**. Cards appear on
Blog landing, Author detail, Topic/Tag, Search results, and related-article widgets.

**Constraints to respect (let `/spec` engage these — don't pre-decide):**
- The thumbnail is **decorative** (empty `alt`, out of the a11y tree per the
  inclusive-components card pattern). Any placeholder must stay decorative —
  `aria-hidden` / CSS-only, no accessible-name pollution, exactly one focusable
  link per card preserved.
- Fits the site's **Dark Constructivism × Human Signal** design language
  (`docs/design-system.md`) — sharp corners, warm/near-black palette, signal red.
  Open design question for `/spec`: deterministic CSS placeholder derived from
  the title (zero runtime cost) vs. reusing the flow-field image generator.
- No schema change; editor-agnostic; must not regress the existing card layout
  or the Playwright card-grid baselines.

**Why this increment:** small enough to cast the whole chain quickly; real enough
to exercise `/spec` (design decision), `/plan` (TDD steps, screenshot baseline),
the **accessibility-reviewer** (decorative-graphic correctness), and `/feature`
(a genuine new capability doc) — a broad, honest slice of the toolkit.

---

## Friction log (fill while casting — this is the payload back to cantrip)

Record every point where a spell was unclear, asked for a slot it should have
inferred, produced generic-when-it-should-be-stack-aware output, or where an
empty-slot fallback misfired. Date each entry.

- _(none yet — begins at first cast)_

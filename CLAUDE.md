# CLAUDE.md

Guidance for **Claude Code** operating in this repository. Project context, architecture, solution
layout, and conventions now live in **[AGENTS.md](AGENTS.md)** — read that first. This file holds
only the Claude-Code-specific operating notes.

## Start here

- **[AGENTS.md](AGENTS.md)** — project identity, architecture, solution layout, conventions, the
  toolkit layout, and the full **documentation index**.
- **Operational runbooks** — [docs/](docs/) (indexed from AGENTS.md).

## Workflow & planning

The workflow spine (roadmap → feature → spec → plan → implement) and the **work-type
classification** (new-capability / change-to-existing / fix-infra — which decides the durable
artifacts a piece of work earns) are owned by the installed **`workflow` skill**. Consult it before
creating a spec, plan, or feature doc. Project-specific paths live in [.agents/config/paths.md](.agents/config/paths.md): increment bundles in `_work/<slug>/` (archived to `_work/shipped/<slug>/`), capability docs in `_features/`.

Project-specific planning facts not carried by the skill:

- **Out-of-flow changes** — any change that skipped the flow → run `/retrofit` before you commit it
  (or before you push, if already committed): it reconciles intent vs. diff, runs the three
  reviewers, and proposes the tests + docs the change would otherwise skip.
- **Optional PRD** — for a body of work spanning 3+ features, write `_prds/<slug>.md` and link it
  from the roadmap.
- **`_features/`** — living Given/When/Then capability behavior; the **source of truth for what the
  site does now** (QA regression + onboarding). Follow the `bdd-principles` skill.
- **`_audits/`** — dated reference notes, **gitignored** personal working reference; they date
  quickly, so treat any as a point-in-time snapshot, not current truth. The two `2026-05-19-*`
  audits predate the ignore rule and stay tracked.

## Skills, commands & reviewers

This repo runs the **cantrip toolkit**. See
[AGENTS.md → Toolkit & workflow](AGENTS.md#toolkit--workflow) for the full layout: **spells**
(the `/spec`, `/plan`, `/implement-step`, `/feature`, `/retrofit`, `/explore`, `/code-review`,
`/commit-message` skills) vs. the **seven kept** tailored `.claude/commands/` (`check-uda`,
`umbraco-edit`, `block`, `cms-image`, `guide`, `algorithmic-art`, `canvas-design`), the
`.agents/config/` slots, and the reviewers (`/code-review` runs `code-reviewer`,
`accessibility-reviewer`, `perf-reviewer`).

### Bundled design & meta skills

Five skills are installed in this project — three from [anthropics/skills](https://github.com/anthropics/skills), one Anthropic skill used as meta-tooling, and one project-authored:

**From [anthropics/skills](https://github.com/anthropics/skills):**
- `/algorithmic-art` — Interactive p5.js generative art for decorative hero visuals. Outputs self-contained HTML with seed navigation and parameter controls. Export PNG via the built-in download button.
- `/canvas-design` — Static PNG visual design with curated typography. Requires fonts (see `skills/README.md` for fetch instructions).
- `frontend-design` — Refined UI design exploration (used during the image-carousel-captions-controls work; see [_work/shipped/image-carousel-captions-controls/plan.md](_work/shipped/image-carousel-captions-controls/plan.md) Step 3 for an example invocation).
- `skill-creator` — Anthropic's official scaffolding for building, evaluating, and tuning new skills. Used to build `architecture-audit`; available for future skills.

**Project-authored:**
- `architecture-audit` — Audits the architectural quality of an Umbraco/.NET codebase against seven pillars (modern .NET, architectural separation, Umbraco-version-appropriate patterns, headless suitability, documentation & onboarding, resilience & operations, scalability & refactorability). Lifecycle-aware; optionally compares two repos head-to-head. Reports save to `_audits/<YYYY-MM-DD>-<slug>.md`.

#### Two skill folder locations (and why)

Skills live in two top-level folders by accident of history. The intent is to consolidate eventually; for now both are valid:

- **`skills/`** — older repo-local convention. Holds skills that ship bundled binary assets (e.g., `canvas-design` needs font files fetched at install time). `/algorithmic-art` and `/canvas-design` live here; outputs go to `skills/output/` (gitignored). See [skills/README.md](skills/README.md) for the asset-fetch instructions.
- **`.agents/skills/`** — the [Anthropic skills convention](https://github.com/anthropics/skills). `frontend-design`, `skill-creator`, and `architecture-audit` live here. Each is symlinked from `.claude/skills/<name>` so Claude Code discovers it.

Future cleanup (P2): move `algorithmic-art` and `canvas-design` to `.agents/skills/` with their bundled assets and retire the legacy `skills/` location. Hash of `frontend-design` is tracked in [skills-lock.json](skills-lock.json).

## Two memory systems

- **Reviewer working memory** — `.claude/agent-memory/<reviewer>/` (gitignored): one `MEMORY.md`
  index + topic files per reviewer (`code-reviewer`, `accessibility-reviewer`, `perf-reviewer`),
  written per the `memory-discipline` skill. This is how a reviewer's calibrated findings persist
  across `/code-review` runs.
- **Cross-session project memory** — lives outside the repo under `~/.claude/…/memory/`, mirrored
  read-only into [docs/project-memory/](docs/project-memory/) so the memories are visible in-tree.

## Umbraco MCP server

The **Umbraco MCP server** lets Claude Code interact with backoffice content — tool collections for
`document`, `media`, `document-type`, and `data-type`. Connection settings are in `.env`, expanded
from the launching shell's env (not from `.env` directly — launch via the `claude-umb` alias), and
the site must be serving on `:44367` first. For Management-API edits from outside the backoffice,
use the `/umbraco-edit` skill ([docs/umbraco-edit.md](docs/umbraco-edit.md)).

## Claude Code Plugins

The **Umbraco CMS Backoffice Skills** plugin (60+ backoffice-extension skills) is installed via the
Claude Code CLI — see [AGENTS.md → Claude Code Plugins](AGENTS.md#claude-code-plugins) for the
install commands.

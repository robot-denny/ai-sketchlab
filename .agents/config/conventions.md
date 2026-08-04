# Conventions

How this project works — project-specific discipline that shapes how a spell does its job.
Filled during the cantrip trial (2026-08-03) from CLAUDE.md + git history; doubles as the
executable spec for the setup skill.

## Branch naming

`claude/feature/<slug>` — the prefix convention across the repo's merged history
(`git branch -a`; PRs #1–#48). Fix/chore work has used `claude/chore/<slug>`. Feature branches
are pushed to the `github` remote — **never `origin`** (that is Umbraco Cloud Live SCM).

## Commit format

Conventional-commit subjects with a leading gitmoji: `🔨 refactor:`, `🐛 fix:`, `📝 docs:`,
`📦 chore:`, `🧪 chore:`, `✨ feat:`. Imperative subject, body explaining the *why*.

## Commit trailers

AI-assisted commits carry a `Co-Authored-By:` trailer naming the assisting model (recent history:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`). No trailer is imposed on
purely human commits.

## Implementation rules

- `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` + `<Nullable>enable</Nullable>` on all
  three C# projects — any new warning fails the build. Relax only via surgical per-code
  `<NoWarn>` with an inline justification comment.
- Match the file's dominant style (this codebase is `var`-heavy C#; Allman braces via
  `.editorconfig`; single-line guards are idiomatic). Prefer string interpolation.
- Page-body block views bind to `IBlockReference<IPublishedElement, IPublishedElement>` and read
  settings via composition interfaces (e.g. `ISpacingProperties`) — never a page/sibling type —
  so a block is a restyle-only port. Functional CSS ships globally in `blocks.css`; brand is a
  `var(--token)` override (see `docs/design-system.md`, `docs/block-css-seam.md`).
- The pre-push hook (`dotnet build -c Release` + `dotnet test --no-build`) must pass.
- Never stage unintended `.uda` churn — Umbraco rewrites `.uda` on every local startup; verify
  before staging, `git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/` to discard.

## Memory

Reviewer working-memory: `.claude/agent-memory/<reviewer>/` (gitignored) — one `MEMORY.md` index
+ topic files per reviewer. Cross-session project memory lives outside the repo under
`~/.claude/…/memory/`, mirrored read-only into `docs/project-memory/`. Entry format follows the
`memory-discipline` skill.

## Planning gotchas

Standing constraints a plan must respect on this Umbraco-Cloud-hosted repo:
- Pin explicit package versions — Cloud's CI/CD validator rejects `Version="*"`.
- RCL-split changes: host + RCL both emit schema files that collide only on `dotnet publish`
  (NETSDK1152) — always `dotnet publish` to verify RCL changes, not just `dotnet build`.
- Cloud's runtime Razor honors TWAE (so `[Obsolete]`/CS0618 in `.cshtml` fails on Cloud) but
  ignores csproj `<NoWarn>` — suppress per-call-site with `#pragma warning disable`.
- Cloud build container has no npm — guard MSBuild `npm` Exec with `ContinueOnError="true"` and
  commit the build output.
- Screenshot baselines are Linux-only — regenerate via the update-snapshots GitHub workflow;
  never commit `*-darwin.png`.
- CI deploys master → Dev only; promotion to Live is manual in the Cloud Portal.

## Unit of work

A vertical slice along the architecture:
- A page-body block → shared `IBlockReference` view + palette membership (`.uda` allow-lists) +
  the render-coverage test + a Playwright screenshot baseline.
- A template/partial change → the view + its CSS + a screenshot baseline.
- Business logic → a service in the `UmbracoProject.Features` RCL (interface co-located) + xUnit.
Plan and verify along the layers the increment actually touches.

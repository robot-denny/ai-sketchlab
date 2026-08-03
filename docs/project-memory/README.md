# Project memory — tracked snapshot

This folder is a **point-in-time mirror** of the Claude Code cross-session
*project memory* for this repo — the harness auto-memory that normally lives
**outside** the repository at:

```
~/.claude/projects/-Users-dkardys-Sites-umbraco-17-demo-site/memory/
```

That live store is not version-controlled anywhere by default, so a machine
change or a `~/.claude` reset would lose it. These files are hard-won
operational knowledge (Cloud deploy gotchas, the `origin` vs `github` push
trap, `.uda` GUID landmines, CI failure recipes, etc.), so this mirror exists
to give them git history and to travel with the repo for onboarding.

## Status: snapshot, not the live store

- **The live store above remains authoritative.** Claude reads and writes
  memory there, not here. This mirror does **not** auto-update.
- Snapshot taken: **2026-08-03**. It will drift as the live memory grows.
- Do **not** hand-edit these files expecting Claude to see the change — edit
  memory through the normal flow; this folder only receives refreshes.

## Refreshing the mirror

Re-copy from the live store and commit the diff:

```bash
cp ~/.claude/projects/-Users-dkardys-Sites-umbraco-17-demo-site/memory/*.md docs/project-memory/
git add docs/project-memory/ && git commit -m "📝 docs: refresh project-memory snapshot"
```

Worth doing after any session that adds or meaningfully changes a memory note.

## Relationship to reviewer agent-memory and to cantrip

There are **two** distinct memory systems in this repo — don't conflate them:

1. **This** — cross-session *project* memory (the `MEMORY.md` index + `project_*.md`
   notes). Harness-level, lives under `~/.claude`, mirrored here.
2. **Reviewer working-memory** — per-agent notes under the gitignored
   `.claude/agent-memory/` (accessibility / umbraco-code / perf reviewers).
   A different store; **not** mirrored here.

If/when this repo adopts the **cantrip** toolkit, cantrip's model treats memory
as a project-owned L2 asset under `.agents/memory/` (tracked). That mainly
concerns system (2). This snapshot is the safety net for system (1), which
cantrip does not manage.

## Secrets

These notes were secret-scanned before being committed and contain only
placeholder references (`$OpenAI:ApiKey`, `Anthropic__ApiKey`), never raw keys.
Keep it that way on every refresh — memory notes must never carry live secrets.

---
description: Execute a single step from a plan in a clean subagent context
argument-hint: <plan-file> <step-number>  (e.g. _plans/extract-search-service.md 3)
allowed-tools: Read, Bash(ls:*), Bash(git status:*), Agent(*)
---

You are dispatching a single plan step to a fresh subagent so the main conversation context stays clean. The subagent does the work; you orchestrate.

User input: $ARGUMENTS

## Step 1 — Parse the arguments

Expect two whitespace-separated tokens in `$ARGUMENTS`:

1. **plan_file** — relative path to a plan file (e.g. `_plans/extract-search-service.md`)
2. **step_number** — an integer (e.g. `3`)

If either is missing or malformed, abort with a one-line message showing the expected usage and stop.

If `plan_file` doesn't exist on disk, abort with a one-line message and stop. Do not guess at alternative paths.

## Step 2 — Read the plan and locate the step

Read `plan_file` in full.

Locate the heading `### Step {step_number} — <title>`. Extract the block from that heading up to (but not including) the next `### Step ` heading, the next top-level `---` separator that begins a new section, or end-of-file — whichever comes first.

Also extract:

- The **Context** section (everything between `## Context` and the next `##` or `---`)
- The **Key Decisions** section (everything between `## Key Decisions` and the next `##` or `---`)
- The plan's **Spec** path and **Branch** name if listed near the top

If the step number doesn't exist in the file, abort with a message listing the step numbers you did find, and stop.

## Step 3 — Sanity-check the working tree

Run `git status --short`. If the working tree is dirty (uncommitted changes), surface this to the user as a one-line warning before dispatching:

> Working tree is dirty. The subagent will edit files on top of your uncommitted changes. Continue? (yes/no)

Wait for confirmation. If the tree is clean, skip the prompt and proceed.

## Step 4 — Compose the subagent prompt

Build a self-contained prompt for the subagent. It has no access to this conversation — everything it needs must be in the prompt. Use this structure:

```
You are executing **Step {N}** of the plan at `{plan_file}`. The main conversation context dispatched you so it can stay clean — work in this isolated context and report back.

## Plan context

{verbatim contents of the plan's Context section}

## Key decisions already made (do not re-derive)

{verbatim contents of the plan's Key Decisions section}

## Your step

{verbatim contents of the Step N block — heading, prompt, "What to build", "Test first" if present, "Validation"}

## Behavioral envelope

- **Follow TDD if the step says "Test first"**: write the failing test, run it to confirm RED, then implement, then run again to confirm GREEN. Don't skip the RED check.
- **Run every command listed under "Validation"** at the end. Report each one's result.
- **Do not commit.** Leave the changes staged/unstaged as-is — the user will run `/code-review` and `/commit-message` after reviewing your output.
- **Stay inside the step's scope.** Do not refactor surrounding code, do not "drive-by" fix unrelated issues, do not add features the step does not require. If you find something concerning, mention it in your report and move on.
- **Read `CLAUDE.md` at the project root** if you need conventions, formatting rules, or Umbraco-specific patterns. Pay attention to the E2E Test Resilience Rules section if this step writes or modifies Playwright tests.
- **If you get stuck**, stop and report what you tried and what blocked you — don't thrash. A clean report on a blocked step is more useful than a half-implementation.

## Reporting format

When you finish (success or blocked), end your response with:

```
## Step {N} — <DONE | BLOCKED>

**Files changed**:
- path/to/file (created | modified | deleted)
- ...

**Validation results**:
- <command>: <pass | fail | n/a> — <one-line note if useful>
- ...

**Notes** (optional):
<anything the next step or the human reviewer should know — e.g. an open question, a deviation from the plan's letter, a follow-up worth filing>
```
```

## Step 5 — Dispatch

Invoke the `general-purpose` subagent (via the Agent tool) with:

- `description`: `Implement step {N} of {plan_slug}` (where plan_slug is the basename of plan_file without `.md`)
- `subagent_type`: `general-purpose`
- `prompt`: the prompt composed in Step 4
- `run_in_background`: false (you need its result to relay to the user)

Do not isolate to a worktree. The subagent works on the current checkout. If the user wanted isolation, they would have created a worktree before invoking this command.

## Step 6 — Relay the result

When the subagent returns, surface its report to the user verbatim (the `## Step N — DONE | BLOCKED` block at the end of its response is the load-bearing part).

Then add a one-line `Next:` pointer:

- If status was **DONE**: `Next: review changes (git diff), run /code-review when satisfied, then /implement-step {plan_file} {N+1} for the next step.`
  - If step N was the final step in the plan, instead say: `Next: review changes (git diff), run /code-review, then /commit-message. After commit, archive the plan to _plans/shipped/.`
- If status was **BLOCKED**: `Next: read the subagent's notes, resolve the blocker, then re-invoke /implement-step {plan_file} {N} once the issue is cleared.`

Do not print the subagent's full work transcript — only its final report block + your `Next:` line.

## Rules of thumb

- This command is for executing **one** step. If the user wants to chain steps automatically, that's a different command — don't try to be clever.
- The subagent's context is bounded by what you pass. Pass too little and it works blind; pass the whole plan file and you bloat its context with irrelevant steps. Context + Key Decisions + Step N is the right cut.
- The plan's existing **Validation** section is the truth about whether the step succeeded. Don't second-guess it.

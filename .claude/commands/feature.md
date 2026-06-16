---
description: Generate or update a living BDD feature spec from specs, plans, and tests
allowed-tools: Read, Write, Glob, Grep
argument-hint: "[_specs/slug.md | feature-name | update _features/slug.md]"
---

You are generating (or updating) a **living behavioral specification** — a BDD-style feature doc that describes what a feature does *right now*, using Given/When/Then scenarios. This is the single source of truth for current system behavior, used by QA for regression testing and by developers for onboarding.

User input: $ARGUMENTS

## What This Does

Creates or updates a feature doc in `_features/` that:
- Describes current feature behavior using BDD scenarios (Given/When/Then)
- Groups scenarios under `Rule:` headings (the business rule each cluster proves)
- Maps scenarios to test files in a coverage table
- Uses business language, not technical jargon
- Is ONE file per logical **capability**, named by area of the site, even if the capability spans multiple specs/plans

## Guard — `_features/` is for capabilities, not work

Before creating any new file, apply the work-type classification from [CLAUDE.md → Workflow layers → "Work types — which artifacts a piece of work earns"](../../CLAUDE.md#workflow-layers). `_features/` holds **evergreen capability behavior only**.

- If the slug names a **change to an existing capability** (migration, upgrade, refactor, "add X to existing Y") — e.g. it starts with `migrate-`/`upgrade-`/`extract-`/`bump-`, or its draft Rules read as *transitions* ("goes from red to…", "after the change ships…", "compiles on the stable stack") rather than standing behavior — **do not create a `<slug>.md`.** Instead, find the existing capability doc it changes (grep `_features/` by area) and update *that*, folding in the evergreen behavior. Point-in-time ACs stay in the shipped spec.
- If the slug names a **fix / infra / CI / cleanup** effort (e.g. `fix-`, `triage-`, a dependency bump with no behavior change) — **do not create a feature doc at all.** Durable residue belongs in a `docs/` runbook and/or a CLAUDE.md section.
- Only a genuinely **new capability** earns a new `_features/<slug>.md`.

If the argument points at a change/fix slug, STOP and tell the user which existing capability doc (or runbook) should receive the content instead, rather than creating a transition-style feature doc.

## Before You Start

1. Read `.claude/skills/BDD.md` for scenario-writing guidance — especially:
   - **Example Mapping**: Rules (blue) → Scenarios/Examples (green)
   - **Specification by Example**: Use concrete values, not abstractions
   - **Ubiquitous Language**: Business terms ("CMS editor", "visitor", "page"), not technical ("document type", "controller", "API endpoint")
2. Read `_features/_template.md` to understand the output format

## Step 1 — Parse the argument

Determine mode and feature slug from `$ARGUMENTS`:

- **Spec path** (contains `/` or ends in `.md`, starts with `_specs`): Read the spec's `**Work type**:` line first. For `new-capability`, create a new feature doc (extract slug from filename, e.g. `_specs/shipped/section-navigation.md` → `section-navigation`). For `change-to <existing>`, update `_features/<existing>.md` instead of creating a new file. For `fix-infra`, do not create a feature doc — apply the Guard above. If the spec has no work-type line, classify it yourself per the Guard.
- **Feature name** (no path separators, no `.md`): Look for existing `_features/{name}.md`. If found, update it. If not, apply the Guard before creating: only create from `_specs/{name}.md` when the work is a new capability.
- **`update` directive** (starts with `update`): Update the existing feature doc at the path that follows.

## Step 2 — Locate all related artifacts

Search for all artifacts related to this feature:

1. **Spec(s)**: `_specs/{slug}.md` and any sub-specs (e.g., `_specs/{slug}/*.md`)
2. **Plan(s)**: `_plans/{slug}*.md` (may be multiple — e.g., `image-generator.md`, `image-generator-backoffice.md`)
3. **Test files**: Search `tests/` for files matching the feature name or slug
4. **Source files**: Search `src/` for Razor views, partials, CSS, JS, or C# files related to the feature (use the plan's file summary if available)

Read all located artifacts.

## Step 3 — Resolve behavioral truth

When sources disagree about behavior (this happens when features evolve):

1. **Test assertions** are the strongest signal — they describe what the code actually does
2. **Plan descriptions** are second — they reflect the most recent intent
3. **Spec descriptions** are third — they reflect the original intent

If you find a conflict, note it in the output summary. The feature doc should reflect reality (test behavior), not aspiration (spec/plan).

## Step 4 — Derive Rules and write scenarios

For each distinct behavior:

1. **Identify the Rule** — the business rule or acceptance criterion. Frame it from the user's perspective. Good: "Only visible pages appear in section navigation." Bad: "Pages with umbracoNaviHide=true are filtered by LINQ Where clause."
2. **Write scenarios** under that Rule using Given/When/Then:
   - Use **concrete values** (Specification by Example): "Given a page with 3 visible siblings" not "Given a page with siblings"
   - Use **business language** (Ubiquitous Language): "CMS editor", "visitor", "page" not "document type", "IPublishedContent", "controller"
   - One scenario per distinct behavior or example
   - Edge cases get their own Rule section under "## Edge Cases"
3. **Do not include implementation details** — no CSS classes, no file paths, no API endpoints, no code patterns. Those live in plans.

## Step 5 — Build the test coverage table

For each scenario, find the corresponding test (if any):

| Scenario | Test File | Status |
|----------|-----------|--------|
| Scenario name | `tests/e2e/file.spec.ts:L42` | Covered |
| Scenario name | — | Not covered |

Match by behavioral intent, not exact wording. A scenario about "mobile toggle collapses navigation" maps to a test named "click toggle hides nav list" even though the wording differs.

## Step 6 — Assemble and save

Use the template structure from `_features/_template.md`:

- **Feature summary**: 2-3 sentences, user perspective, business language
- **Source spec**: path to the original spec
- **Last verified**: today's date
- **Behaviors**: Rule-grouped scenarios
- **Edge Cases**: Rule-grouped edge case scenarios
- **Test Coverage**: table from Step 5
- **Revision Notes**: "Initial feature doc from spec + implementation" (for new) or describe what changed (for updates)

If this is a **new** feature doc (create mode), save to `_features/{slug}.md`.
If this is an **update**, overwrite the existing file. Add a revision note with today's date.

If the feature doc has a "Draft" banner from `/spec`, remove it — this is the verified version.

## Step 7 — Report

Print a short summary:

```
Feature doc: _features/{slug}.md
Scenarios: {count}
Test coverage: {covered}/{total} scenarios covered
Conflicts resolved: {list any behavioral conflicts found and how they were resolved, or "None"}
Next: /code-review before merge
```

Do not print the full feature doc to chat unless the user asks. The doc lives in the file.

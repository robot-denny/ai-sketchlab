---
description: Create a phased, TDD-first implementation plan from a spec file or feature description
argument-hint: Path to spec file (e.g. _specs/my-feature.md) or a short feature description
allowed-tools: Read, Write, Glob, Bash(git branch*), Bash(git status*), mcp__umbraco-mcp__*, Agent(*)
---

You are creating a detailed implementation plan for this project. Always follow the rules in CLAUDE.md.

User input: $ARGUMENTS

## High-level behavior

Turn the spec (or description) above into a saved plan file in `_plans/` that:
- Breaks the feature into independently-executable steps, each runnable in a fresh context window
- Follows TDD: tests are written **before** implementation in each step where testable behavior is introduced
- Includes a paste-ready prompt per step
- Records key design decisions so future implementers don't re-derive them

## Step 1 — Resolve the input

Determine if `$ARGUMENTS` is a path to an existing spec file or a plain description:

- **If it looks like a file path** (contains `/` or ends in `.md`): read the file and use its contents as the feature spec. Extract `feature_title` and `feature_slug` from the filename (e.g. `_specs/shipped/section-navigation.md` → slug `section-navigation`, title `Section Navigation`).
- **If it is a description**: treat it as the full spec. Derive `feature_slug` (lowercase, kebab-case, max 40 chars) and `feature_title` (Title Case) from it.

## Step 2 — Understand the codebase context

Before planning, read enough of the codebase to answer:
- What existing patterns does this feature extend or resemble? (Check `Views/`, `Views/Partials/`, `tests/e2e/`, `src/HelloWorld/Client/src/` as relevant)
- Are there existing data types, document types, or compositions that can be reused?
- What is the right test file location and naming convention for this feature?

Do not plan in a vacuum — ground every step in what already exists.

### Use MCP to inspect live backoffice state (schema-related features)

If the feature involves document types, element types, compositions, or data types, query the live Umbraco instance via MCP tools **before** designing the schema steps. This surfaces real IDs, existing property editors, and reusable compositions that can't be reliably derived from `.uda` files alone.

Useful MCP tools for planning:
- `mcp__umbraco-mcp__get-all-document-types` — see every existing document type and composition
- `mcp__umbraco-mcp__get-all-data-types` — find reusable data types (dropdowns, toggles, text fields, etc.) by name rather than hardcoding IDs
- `mcp__umbraco-mcp__get-document-type-by-id` — inspect a specific type's properties and groups
- `mcp__umbraco-mcp__get-data-type-root` / `get-data-type-children` — browse the data type tree

Record any IDs or aliases discovered here in the plan's **Key Decisions** section so implementers don't need to look them up again.

### Invoke the relevant Umbraco skill (backoffice extension features)

If the feature involves a backoffice extension (dashboards, property editors, workspaces, modals, trees, context API, entry points, or any TypeScript/Lit component in `src/HelloWorld/Client/src/`), **invoke the matching skill before writing the plan**. Umbraco 17 uses Lit web components and a specific extension registry pattern — the skills provide authoritative, current documentation that training data may not cover accurately.

Choose the skill that matches the extension type:

| Extension type | Skill to invoke |
|----------------|----------------|
| Dashboard | `umbraco-cms-backoffice-skills:umbraco-dashboard` |
| Property editor UI | `umbraco-cms-backoffice-skills:umbraco-property-editor-ui` |
| Workspace | `umbraco-cms-backoffice-skills:umbraco-workspace` |
| Modal / dialog | `umbraco-cms-backoffice-skills:umbraco-modals` |
| Tree / tree item | `umbraco-cms-backoffice-skills:umbraco-tree` / `umbraco-tree-item` |
| Context API | `umbraco-cms-backoffice-skills:umbraco-context-api` |
| Entry point | `umbraco-cms-backoffice-skills:umbraco-entry-point` |
| Entity actions | `umbraco-cms-backoffice-skills:umbraco-entity-actions` |
| Block editor custom view | `umbraco-cms-backoffice-skills:umbraco-block-editor-custom-view` |

Skip skills for: Management API/content CRUD, C#/Razor/.NET patterns, or tasks where the pattern is already clearly visible in the codebase.

## Step 3 — Identify the feature layers

Classify the work into the layers that apply (not every feature has all of them):

| Layer | Examples |
|-------|---------|
| **Schema** | New document types, element types, compositions, data types — created via Management API script |
| **Backend / Razor** | `.cshtml` partials, view templates, C# view components |
| **Frontend assets** | CSS in `wwwroot/assets/css/styles.css`, JS in `wwwroot/assets/js/` |
| **Backoffice extension** | TypeScript/Lit components in `src/HelloWorld/Client/src/` |
| **E2E tests** | `tests/e2e/` Playwright specs |

## Step 4 — Sequence the steps

Order the layers into implementation steps following these rules:

1. **Schema first** — you cannot write tests or Razor views against element types that don't exist.
2. **Tests written before the implementation they cover** — each step that introduces testable behavior must write the test first (expect RED), then implement (expect GREEN). Put the test-writing and implementation in the **same step** when they are tightly coupled (e.g. a single Razor partial + its E2E test). Split them when the implementation is large enough to warrant its own step.
3. **Manual verification checkpoints** — any step that changes visible behavior in the browser (layout, rendered output, interactive JS) should end with a concrete manual check the developer can do before moving to the next step.
4. **Each step must be independently completable** — it should have a clear start state (what was done before) and end state (what passes/exists after).

5. **Feature doc verification as the final step** — every plan ends with a step that runs `/feature update _features/{slug}.md` (or `/feature _specs/{slug}.md` if no feature doc exists yet) to verify/update the living behavioral spec against the actual implementation.

Typical step order for most features:
1. Schema (Management API script)
2. Razor partial / template (+ build check)
3. Layout integration (+ build + browser check)
4. CSS / JS assets (+ browser check)
5. E2E test file (write tests → RED, then confirm GREEN after prior steps)
6. Verify feature behavioral spec (`/feature update`)

Backoffice extensions follow their own order — schema is usually not needed; steps follow: extension registration → component → context/state → E2E → verify feature spec.

## Step 5 — Draft the plan content

Write the plan in the format shown below. Do not skip sections.

```markdown
# Plan: {feature_title}

**Spec**: `_specs/{feature_slug}.md`
**Branch**: `claude/feature/{feature_slug}`

## Context

[2–4 sentences: what this feature does and why, any important background from the spec or codebase that shapes the plan. What already exists that this builds on.]

---

## Key Decisions

- **[Decision topic]**: [Chosen approach and why — rule out alternatives briefly if useful]
- (repeat for each non-obvious design choice)

---

## Steps

Each step is designed to be completed independently in its own context window.
The step heading contains a ready-to-use prompt you can paste into a new chat.

---

### Step N — [Short title]

> **Prompt**: Implement Step N of `_plans/{feature_slug}.md`. [One paragraph that is fully self-contained: what file(s) to create or modify, what API calls or tools to use, what the end state should be. Include the exact `dotnet build` or Playwright run command if relevant.]

**What to build**: [Enumerate files, scripts, or backoffice operations. Be specific: file path, method names, property aliases, API endpoints.]

**Test first** *(only for steps that introduce testable behavior)*:
- Write `tests/e2e/[filename].spec.ts` (or the relevant test file)
- The test should [describe what it asserts]
- Run: `PATH="/Users/dkardys/.nvm/versions/node/v18.19.0/bin:$PATH" npx playwright test [path]` — confirm RED before implementing

**Validation**:
- [Automated]: `[command to run]` — what a passing result looks like
- [Manual] *(if applicable)*: [Where to look in the browser / backoffice and what to confirm]

---

[Repeat for each implementation step]

---

### Step {final} — Verify feature behavioral spec

> **Prompt**: Run `/feature update _features/{feature_slug}.md` to verify the living behavioral spec reflects the actual implementation. Review each scenario against the code and test results. Update any scenarios where the implementation diverged from the draft. Fill in the test coverage table with actual test file paths and line numbers. Remove the "Draft" banner if present. Commit the verified feature doc.

**Validation**:
- [Manual]: Every scenario in `_features/{feature_slug}.md` matches observable behavior
- [Manual]: Test coverage table has no unexpected "Not covered" gaps

---

## File Summary

| Action | File |
|--------|------|
| Create | `path/to/file` |
| Modify | `path/to/file` |
| Create (delete after running) | `scripts/setup-*.mjs` |
| Create/Update | `_features/{feature_slug}.md` |
```

## Step 6 — Validate the plan before saving

Check that:
- Every step has a paste-ready prompt that contains enough context to act on without reading the rest of the plan
- TDD steps write the test before implementation (not after)
- No step depends on a result that isn't established in a prior step
- Manual verification points exist wherever a browser or backoffice check is natural
- The file summary lists every file that will be created or modified

## Step 7 — Save and report

Save the plan to `_plans/{feature_slug}.md`.

Report to the user in this format:

```
Plan: _plans/{feature_slug}.md
Steps: N
Branch: claude/feature/{feature_slug}
Next: run step 1 of the plan (paste its prompt into a fresh context, or use /implement-step _plans/{feature_slug}.md 1 once that command exists)
```

Do not print the full plan to chat — just the summary above. The plan lives in the file.

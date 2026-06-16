---
description: Create a feature spec file and branch from a short idea
argument-hint: Short feature description
allowed-tools: Read, Write, Glob, Bash(git switch:*)
---

> **Before drafting**: Read `.claude/skills/BDD.md` for guidance on writing scenarios using Example Mapping, Specification by Example, and Ubiquitous Language.

You are helping to spin up a new feature spec for this application, from a short idea provided in the user input below. Always adhere to any rules or requirements set out in any CLAUDE.md files when responding.

User input: $ARGUMENTS

## High level behavior

Your job will be to turn the user input above into:

- A human friendly feature title in kebab-case (e.g. new-heist-form)
- A safe git branch name not already taken (e.g. claude/feature/new-heist-form)
- A detailed markdown spec file under the _specs/ directory

Then save the spec file to disk and print a short summary of what you did.

## Step 1. Check the current branch

Check the current Git branch, and abort this entire process if there are any uncommitted, unstaged, or untracked files in the working directory. Tell the user to commit or stash changes before proceeding, and DO NOT GO ANY FURTHER.

## Step 2. Parse the arguments

From `$ARGUMENTS`, extract:

1. `feature_title`  
   - A short, human readable title in Title Case.  
   - Example: "Card Component for Dashboard Stats".

2. `feature_slug`  
   - A git safe slug.  
   - Rules:  
     - Lowercase 
     - Kebab-case 
     - Only `a-z`, `0-9` and `-`  
     - Replace spaces and punctuation with `-`  
     - Collapse multiple `-` into one  
     - Trim `-` from start and end  
     - Maximum length 40 characters  
   - Example: `card-component` or `card-component-dashboard`.

3. `branch_name`  
   - Format: `claude/feature/<feature_slug>`  
   - Example: `claude/feature/card-component`.

If you cannot infer a sensible `feature_title` and `feature_slug`, ask the user to clarify instead of guessing.

## Step 3. Switch to a new Git branch

Before making any content, switch to a new Git branch using the `branch_name` derived from the `$ARGUMENTS`. If the branch name is already taken, then append a version number to it: e.g. `claude/feature/card-component-01`

## Step 4. Draft the spec content

Create a markdown spec document that Plan mode can use directly and save it in the _specs folder using the `feature_slug`. Use the exact structure as defined in the spec template file here: @_specs/_template.md. Do not add technical implementation details such as code examples.

After writing the Acceptance Criteria section, use the **Example Mapping** technique from BDD to derive draft scenarios:
- Treat each acceptance criterion as a **Rule** (blue card)
- Write concrete **Scenarios** (green cards) in Given/When/Then format that prove each rule
- Use **Specification by Example** — concrete values, not abstractions
- Use **Ubiquitous Language** — business terms ("CMS editor", "visitor", "page"), not technical terms
- Flag any uncertainties discovered during scenario writing as **Open Questions** (red cards)

Add these draft scenarios in the "Scenarios (Draft)" section of the spec (see template).

## Step 5. Classify the work type

Before deciding whether to create a feature doc, classify the work using the table in [CLAUDE.md → Workflow layers → "Work types — which artifacts a piece of work earns"](../../CLAUDE.md#workflow-layers). The `_features/` folder is for **evergreen capability behavior, one file per capability named by area of the site** — not for records of work done. Decide which bucket applies:

- **New capability** — a behavior or surface the site didn't have. → A new feature doc is warranted.
- **Change to an existing capability** — a refactor, upgrade, migration, or enhancement to how an already-documented capability behaves. → No new feature doc; the existing capability's doc gets updated after implementation. Identify which `_features/<existing>.md` that is (grep `_features/` by capability area).
- **Fix / infra / CI / cleanup** — no standing change to a documented capability. → No feature doc; durable residue lands in a `docs/` runbook and/or a CLAUDE.md section.

**The tell**: if your draft Rules read as *transitions* ("goes from red to…", "after the change ships…", "compiles on the stable stack") rather than *standing behavior*, it is a change/fix, not a new capability.

Record the decision in the spec under a `**Work type**:` line near the top — one of `new-capability` / `change-to <existing-feature-slug>` / `fix-infra` — so `/plan` and `/feature` can honor it without re-deciding.

## Step 6. Create the draft feature doc skeleton (only for new capabilities)

**Only if Step 5 classified this as a _new capability_**, create a draft feature doc at `_features/<feature_slug>.md` using the template from `_features/_template.md`. Populate it with:

- The feature summary from the spec
- The draft scenarios from the spec's "Scenarios (Draft)" section
- A "Draft" banner at the top: `> **Draft** — These scenarios have not yet been verified against an implementation. They will be refined during planning and verified after implementation.`
- Source spec pointing to the spec file
- Empty test coverage table (no tests exist yet)
- Revision note: `{today's date}: Draft scenarios from initial spec`

This skeleton gives QA and planners the behavioral contract immediately, even before implementation begins.

**For a _change-to-existing_ or _fix-infra_ work type, do NOT create a `_features/<feature_slug>.md`.** The draft scenarios still live in the spec (Step 4). The spec's `**Work type**:` line tells `/plan` where the behavior will eventually be recorded (an existing feature doc, a runbook, or nowhere).

## Step 7. Final output to the user

After the files are saved, respond to the user with a short summary in this exact format (the Feature doc line varies by work type):

Branch: <branch_name>
Spec file: _specs/<feature_slug>.md
Work type: <new-capability | change-to <existing-feature-slug> | fix-infra>
Feature doc (draft): _features/<feature_slug>.md   ← only for new-capability; otherwise write "Feature doc: (none — <reason>)"
Title: <feature_title>
Next: /plan _specs/<feature_slug>.md

Do not repeat the full spec in the chat output unless the user explicitly asks to see it. The main goal is to save the files and report where they live and what branch name to use.
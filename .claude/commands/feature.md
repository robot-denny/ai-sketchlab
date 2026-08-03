---
description: Generate or update a living BDD feature doc from specs, plans, tests, or code
allowed-tools: Read, Write, Glob, Grep
argument-hint: "[_specs/slug.md | feature-name | update _features/slug.md | doc-type-alias | .uda path | partial/block name]"
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

**From-code mode (below) also runs this Guard.** A code entity is usually a genuine capability (a doc type, block, or page renders standing behavior), so it normally earns a new feature doc — but if the code you're pointed at only exists to serve a fix/infra concern, or is a change to an existing capability, fold it per the rules above instead of drafting a cold-start feature doc.

## Before You Start

1. Read `.claude/skills/BDD.md` for scenario-writing guidance — especially:
   - **Example Mapping**: Rules (blue) → Scenarios/Examples (green)
   - **Specification by Example**: Use concrete values, not abstractions
   - **Ubiquitous Language**: Business terms ("CMS editor", "visitor", "page"), not technical ("document type", "controller", "API endpoint")
2. Read `_features/_template.md` to understand the output format

## Step 1 — Parse the argument

Resolve `$ARGUMENTS` in this **precedence order** and stop at the first branch that matches. The richer artifact-driven path always wins when artifacts exist — from-code is strictly the fallback for the zero-artifact cold-start case (a doc-type alias that *does* have a spec should take the artifact-driven path, not the thinner code-only one):

1. **`update` directive** (starts with `update`) → **update mode**. Update the existing feature doc at the path that follows.
2. **Artifact-driven** — the argument is a `_specs/` path, or a token that resolves to an existing `_features/<slug>.md` or a locatable spec/plan/behavioral test (a test asserting observable Given/When/Then behavior that would populate the coverage table — a pure visual-regression `*.screenshot.spec.ts` / `toHaveScreenshot`-only baseline does **not** count, so a block whose only test is a screenshot spec stays a from-code cold-start target):
   - **Spec path** (contains `/` or ends in `.md`, starts with `_specs`): Read the spec's `**Work type**:` line first. For `new-capability`, create a new feature doc (extract slug from filename, e.g. `_specs/shipped/section-navigation.md` → `section-navigation`). For `change-to <existing>`, update `_features/<existing>.md` instead of creating a new file. For `fix-infra`, do not create a feature doc — apply the Guard above. If the spec has no work-type line, classify it yourself per the Guard.
   - **Feature name** (no path separators, no `.md`): Look for existing `_features/{name}.md`. If found, update it. Otherwise look for a locatable `_specs/{name}.md`, plan, or **behavioral** test (a visual-regression `*.screenshot.spec.ts` baseline does not count). If any exist, apply the Guard before creating: only create when the work is a new capability.

   Follow **Steps 2–7** below for this mode.
3. **From-code (fallback)** — only if nothing above resolves *and* the token resolves to code: a `.uda` path under `src/UmbracoProject/umbraco/Deploy/Revision/`, a document-type alias, or a partial/block name under `src/UmbracoProject/Views/`, with **no** upstream `_specs`/`_plans`/**behavioral** tests/existing `_features` doc (the presence of only a visual-regression `*.screenshot.spec.ts` baseline does NOT disqualify from-code mode). Reverse-engineer a draft feature doc from the implementation by following the **From-code mode** section below (in place of Steps 2–6), then finish with **Step 7 — Report**.

## From-code mode (cold start — no upstream artifacts)

This mode reverse-engineers a **draft** feature doc when a capability exists in code but has no spec, plan, tests, or feature doc to work from. The output is the same `_features/_template.md` shape as every other mode — it just self-identifies as reverse-engineered and not-yet-human-verified, because the code is the only source. Run the **Guard** first (see above); this mode still classifies the work and only proceeds for a genuine capability.

### F1 — Read the three code sources

Resolve the argument to a document type / element type and read its implementation, in this order:

1. **The `.uda`** — find the matching artifact under `src/UmbracoProject/umbraco/Deploy/Revision/document-type__*.uda` (or `element-type__*.uda`). Parse its JSON for structure: `Name` (human-readable feature name), `Alias`, `Description`/`Icon` (context), and every `PropertyGroups[].PropertyTypes[]` entry — each property's `Name` (label), `Alias`, `DataType` UDI, `Mandatory` flag, and per-property `Description` (help text). Also note `CompositionContentTypes` (inherited property groups).
2. **The committed generated model** — read the matching `*.generated.cs` under `src/UmbracoProject.Features/Models/Generated/` (this repo runs ModelsBuilder in `SourceCodeManual` mode, so models are committed there). **Use the generated C# property types as the primary signal for what each property is** — a strongly-typed `IHtmlEncodedString`, `bool`, `MediaWithCrops`, `IEnumerable<IPublishedElement>`, etc. is more reliable and repo-native than reverse-mapping a `umb://data-type/...` UDI. Fall back to the UDA UDI→label table below only when the model is absent or the C# type is ambiguous.
3. **The view** — find the `.cshtml` that renders it under `src/UmbracoProject/Views/` (page templates in `Views/`, block components in `Views/Partials/blocks/Components/`, `Views/Partials/blocklist/`, or `Views/Partials/blockgrid/`). Read it for **conditional branches** — `if`/`else`, null/empty checks, `@if (Model.X.Any())`, toggle guards — and write one scenario per branch you find (the true and the false path each become an outcome).

If no `.uda` or view resolves for the token, say so and ask the user to confirm the alias / partial name rather than guessing.

### F2 — Compact UDA UDI→label fallback table

Only when the generated model doesn't disambiguate a property, map its `DataType` UDI (or known editor alias) to a readable type:

| Editor alias / UDI hint | Readable type |
|---|---|
| Umbraco.RichText, Umbraco.TinyMCE | Rich Text |
| Umbraco.TextBox, Umbraco.TextArea | Text |
| Umbraco.MediaPicker3, Umbraco.MediaPicker | Media Picker |
| Umbraco.TrueFalse | Toggle |
| Umbraco.BlockList | Block List |
| Umbraco.BlockGrid | Block Grid |
| Umbraco.ContentPicker, Umbraco.MultiNodeTreePicker | Content / Node Picker |
| Umbraco.DropDown.Flexible | Dropdown |
| Umbraco.Integer, Umbraco.Decimal | Number |
| Umbraco.DateTime | Date/Time |

Unrecognised → call it "Content" and flag it for human input (see F4).

### F3 — Derive Rules from each property

One `### Rule:` per meaningful property or behavior cluster (not one Rule per property blindly). Derive the scenario shape from the property's kind:

- **Mandatory property** → a Rule with a "renders when set" scenario **and** a "fails validation when missing" scenario.
- **Optional text / rich text** → "renders when set" **and** "renders nothing when blank".
- **Toggle** → "shows X when enabled" **and** "hides X when disabled".
- **Media picker** → "renders image when set" **and** "no image / placeholder when blank".
- **Block list / grid** → "renders child blocks when present" **and** "renders no container when empty".
- **Every conditional branch found in the `.cshtml`** (F1 step 3) → a scenario for each side of the branch.

Write scenarios in Given/When/Then with concrete values and business language, exactly as Step 4 describes — no CSS classes, file paths, or property aliases inside the scenarios themselves.

### F4 — Flag what code can't prove

Where the exact observable proof (the precise element, text, or selector a test would assert) **cannot** be derived from the `.uda` + model + view alone, do **not** invent it. Append this line to that scenario:

`> needs human input: exact element/selector — confirm what proves this outcome.`

Also flag any property whose data type stayed unrecognised (F2), and note if no view file was found (scenarios may be incomplete).

### F5 — Provenance and coverage

Emit the standard template, with these from-code specifics:

- **Draft banner** → add immediately under the `# Feature: {Name}` heading: `> **Draft** — Reverse-engineered from code; these scenarios have not been verified against a running implementation or any test. Refine and verify before relying on them.` (This is the from-code counterpart to the banner `/spec` adds; a later `/feature update` run removes it once the doc is verified.)
- **`**Source spec**:`** line → `derived from implementation ({today's date}) — no originating spec; reverse-engineered from code.`
- **`**Last verified**:`** → today's date (the draft banner, not this field, carries the "unverified" signal).
- **`## Increments`** → leave a single placeholder bullet: `- [ ] (no shipped increments recorded — reverse-engineered baseline)`.
- **Test Coverage table** → every scenario row starts **Not covered** (from-code mode only drafts behavior; tests don't exist yet).
- **`## Edge Cases`** → pull genuinely boundary/unusual scenarios (missing content, invalid input, empty collections) out of `## Behaviors` into here, using the same `### Rule:` + scenario shape.
- **Revision Notes** → `{today's date}: Initial draft reverse-engineered from {alias} — not yet human-verified.`
- If reading the model/view surfaced a genuine bug or dead code (a property nothing reads, a wrong alias) — not just a doc-accuracy gap — add a short `## Open Issues` section (numbered prose bullets, no scenario blocks) before `## Behaviors`. Omit it entirely otherwise.

Save to `_features/{slug}.md`, deriving `{slug}` from the alias in kebab-case (e.g. `statCallout` → `stat-callout`). Then go to **Step 7 — Report**, and point the "Next" line at commands that exist here — e.g. `/block` for the TDD workflow that turns these draft scenarios into tests, or `/code-review`.

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

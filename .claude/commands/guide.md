---
description: Create or amend an editor-facing how-to guide for one block, setting, or global feature
allowed-tools: Bash(PATH*npx tsx scripts/guide-generator/src/cli.ts*), Read
argument-hint: "[<feature-alias> | --audit | --auto-apply <feature-alias>]"
---

## User Input

**$ARGUMENTS**

## Usage

| Invocation | Behaviour |
|---|---|
| `/guide <feature-alias>` | Create the guide page if it doesn't exist; if it does, skip when the source signature matches, otherwise propose an interactive amend (unified diff → `y/N`). |
| `/guide --audit` | Print the gap report — missing block guides, missing global guides, orphaned guides — and exit `0` if everything is in sync, `1` otherwise. |
| `/guide --auto-apply <feature-alias>` | Same as the bare form, but apply amends without prompting. Reserved for trusted automation; humans should prefer the interactive flow. |

`<feature-alias>` is either a blocklist component filename without `.cshtml` (e.g. `alertBanner`, `imageCarousel`) or one of the curated global feature aliases (`siteHeader`, `siteFooter`, `siteSettings`, `search`, `articleList`). Run `/guide --audit` to see the canonical list.

## What This Does

Runs the guide-generator CLI at [scripts/guide-generator/src/cli.ts](scripts/guide-generator/src/cli.ts) to keep the editor-facing **Guides** section under Home (`/guides/`) in sync with the codebase. For each documentable feature it owns one `howToGuidePage` whose `description` is written by the **How-To Guide Writer** backoffice agent against the **Site Content Guidelines** + **How-To Guide Style** contexts. The CLI computes a SHA-256 signature over the feature's source files (partial + element type shape) and stores it in `generationMetadata` so subsequent runs can detect drift and amend rather than rewrite. Spec: [_specs/editor-how-to-guides.md](_specs/editor-how-to-guides.md). Living behaviour: [_features/editor-how-to-guides.md](_features/editor-how-to-guides.md).

## Prerequisites

- Umbraco running locally (the CLI hits the Management API at `https://localhost:44367`).
- `.env` has `UMBRACO_CLIENT_ID`, `UMBRACO_CLIENT_SECRET`, and `URL`.
- Schema in place — `scripts/setup-guides-schema.mjs` has been run (creates the Guides parent, the `howToGuidePage` doc type, the `Guide Visibility Controls` composition, and the Guides landing page).
- The **How-To Guide Writer** agent exists in the local backoffice (see *Setup* below).
- Dependencies installed (`npm install`).

## Setup — Backoffice agent (per environment)

The `/guide` command relies on two AI entities in **Settings → AI**:

- **Context** "How-To Guide Style" (alias `how-to-guide-style`) — owns the structural template every guide must follow. Deploys via `Umbraco.AI.Prompt.Deploy` as `umbraco-ai-context__*.uda` and flows through git → Umbraco Cloud like any other schema artifact.
- **Agent** "How-To Guide Writer" (alias `how-to-guide-writer`) — links the default chat profile to the two contexts above. **DB-only** (the `Umbraco.AI.Agent.Deploy` package is intentionally not installed — see CLAUDE.md "Pinned betas"), so this entity must be recreated manually in every environment (Local, Development, Staging, Live).

### One-time bootstrap on a fresh environment

Save in this order so Deploy's dependency chain serializes the context first; the agent (which references the context) then resolves cleanly when recreated:

1. **Sign in to the backoffice** of the target environment.
2. **Settings → AI → Contexts → + Create context**
   - Name: `How-To Guide Style`
   - Alias: `how-to-guide-style`
   - Add a resource → **Text**
     - Name: `Structural Template`
     - Content: paste the structural template — intro paragraph, `<h2>When to use it</h2>`, `<h2>Configuration</h2>` (one entry per property in source order, no inventing), `<h2>Tips</h2>`. The full body is in the local `umbraco-ai-context__d11be0ca…uda` artifact under [src/UmbracoProject/umbraco/Deploy/Revision/](src/UmbracoProject/umbraco/Deploy/Revision/) — copy it from there to keep environments aligned.
     - Injection mode: **Always**
   - **Save.** On Local, verify a new `umbraco-ai-context__*.uda` appears under [src/UmbracoProject/umbraco/Deploy/Revision/](src/UmbracoProject/umbraco/Deploy/Revision/). On Cloud environments the file is already present (deployed via git) — saving here writes it into the DB.
3. **Settings → AI → Agents → + Create agent**
   - Name: `How-To Guide Writer`
   - Alias: `how-to-guide-writer`
   - Description: `Generates and amends editor-facing how-to guides for blocks, settings, and global features. Invoked by the /guide CLI.`
   - Agent type: **Standard**
   - Chat profile: **Content Generation Assistant** (the project's default chat profile)
   - Contexts: attach **both**
     - `Site Content Guidelines` (`site-content-guidelines`)
     - `How-To Guide Style` (`how-to-guide-style`)
   - Surfaces: `copilot`
   - Tools: leave empty — the CLI passes the source payload in the message; no client-side tools are needed.
   - Instructions (system prompt): produce HTML (not Markdown), follow the structural template from the context, never invent properties not in the source payload, and when an existing description is provided **amend** rather than rewrite (preserve unchanged prose, only modify what no longer matches the source).
   - **Save.** No `.uda` is written for the agent — that's expected (Agent.Deploy is not installed).
4. **Smoke-test in the Copilot chat surface**: pick the agent and send "draft a paragraph about a fictional ImageRow block." The reply should be HTML, in the brand voice, following the structural template.

### Promoting to Cloud

After the local context save, the new `umbraco-ai-context__*.uda` flows through git like any other schema artifact:

1. `git add src/UmbracoProject/umbraco/Deploy/Revision/umbraco-ai-context__*.uda`
2. Run `/check-uda` and confirm no schema conflicts.
3. Push the branch — Umbraco Cloud's deploy pipeline imports the context.
4. **In each Cloud environment** (Development, Staging, Live), repeat **step 3 only** (recreate the agent) — the context is already there.

### Secrets

Never paste raw API keys into AI Connection forms. The connections in this project reference `$Anthropic:ApiKey` and `$OpenAI:ApiKey` placeholders — secrets live in each environment's app settings (`Anthropic__ApiKey` / `OpenAI__ApiKey` on Cloud, `appsettings.Development.json` locally). Before committing, double-check:

```bash
grep -rE '(sk-[A-Za-z0-9]{20,}|ANTHROPIC_)' src/UmbracoProject/umbraco/Deploy/Revision/
```

No matches expected.

## What It Doesn't Touch

The CLI is deliberately narrow. It only ever writes two fields on a `howToGuidePage`:

- `description` — the rich-text body produced by the agent.
- `generationMetadata` — the JSON envelope holding the source signature, ISO timestamp, and last feature alias.

It **never** modifies:

- `screenshot` — the editor-uploaded image is owned by humans. The CLI doesn't read it, doesn't clear it, doesn't replace it.
- `sectionRows` — seeded **once** on first creation (one instance of the documented block for `kind: 'block'` features; left empty for global features). After creation, the live-example slot is editor territory; subsequent `/guide <feature>` runs leave it untouched even if the documented block's element type changes.
- The page name, URL slug, `hideFromTopNavigation` toggle, or any composition property other than the two listed above.
- Any other content node, media item, agent, or AI context.

The two amend-flow safety rails reinforce this: when stored signature matches the current source signature, the run is a no-op (no AI call, no document write); when it doesn't match, the diff against `description` is shown and the operator must approve before anything is written.

## Per-environment Notes

- **Contexts deploy via `.uda`.** `umbraco-ai-context__*.uda` artifacts ship through git → Umbraco Cloud like any other schema file. The first save on Local writes the file; pushing the branch promotes it; importing on each Cloud environment is automatic on deploy/restart.
- **Agents do not deploy.** `Umbraco.AI.Agent.Deploy` is intentionally not installed (see the *Pinned betas* table in [CLAUDE.md](CLAUDE.md)). The **How-To Guide Writer** agent must be recreated manually in every environment that runs `/guide` — Local, Development, Staging, Live. Repeat the *Setup* step 3 (and only step 3) per environment after the context lands.
- **Per-environment API keys.** `Anthropic__ApiKey` / `OpenAI__ApiKey` must be set in each Cloud environment's app settings via the Cloud portal (double-underscore form — the portal rejects colons). Locally the keys live in the gitignored `appsettings.Development.json` under the `:` form.
- **Local is the only place the CLI runs.** `/guide` writes to `https://localhost:44367` only. Promote new/amended guide pages to other environments via the standard content transfer in the Umbraco Cloud Deploy dashboard. Don't try to point the CLI at Cloud.
- **Vector index** — if the new guide pages should appear in the AI search, rebuild the `UmbAI_Search` index from **Settings → Search** in each environment after content transfer (see [CLAUDE.md](CLAUDE.md) *Search* section).

## Determine the Command

Parse `$ARGUMENTS` to build the CLI invocation:

| User says | CLI argv |
|-----------|----------|
| `--audit`, "audit", "report", "what's missing" | `--audit` |
| A feature alias (e.g. `alertBanner`) | `<alias>` |
| `--auto-apply <alias>` or "auto-apply <alias>" | `--auto-apply <alias>` |
| `--dry-run <alias>` or "dry-run <alias>" | `<alias> --dry-run` |

If `$ARGUMENTS` is empty, ask the user:
1. Which feature to generate or amend (offer to run `/guide --audit` first to see what's missing).
2. Whether they want the interactive amend flow or `--auto-apply`.

## Execute

Run the CLI with the parsed argv. Pipe stdin from the terminal so the amend flow can prompt the operator for `y/N`:

```bash
PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH" npx tsx scripts/guide-generator/src/cli.ts <argv>
```

Capture both stdout and the exit code; the audit path uses exit code `1` to signal "gaps exist" while still printing a complete report.

## Report Results

Parse the CLI output and report concisely back to the user:

- **`/guide <alias>` → created**: stdout matches `created /guides/how-to-use-{slug}/`. Tell the user the page was created and published, and suggest they open it in the browser to add a screenshot if it's a global feature. Remind them `sectionRows` was seeded with one instance of the documented block for `kind: 'block'` features.
- **`/guide <alias>` → no-op**: stdout matches `no changes — {alias} guide is up to date`. Just relay that line.
- **`/guide <alias>` → amend approved**: stdout matches `amended /guides/ guide for "{alias}"`. Confirm the description was updated and `generationMetadata` rewritten; flag that `screenshot` and `sectionRows` were preserved.
- **`/guide <alias>` → amend declined**: stdout contains `no changes written`. Relay that line.
- **`/guide <alias>` → non-interactive without `--auto-apply`**: stderr/stdout contains `amend pending — re-run interactively or pass --auto-apply` and exit code `1`. Tell the user how to re-run.
- **`/guide --audit`**: print the three sections (`Missing guides — Blocks (N)`, `Missing guides — Global (N)`, `Orphaned guides (N)`). If exit code was `1`, suggest the next `/guide <alias>` invocations to close the gaps. If `0`, confirm everything is in sync.
- **Errors**: surface the exception message verbatim. Common ones — `Guides parent page not found under Home` (re-run setup script), `Agent returned an empty description` (check the agent + contexts in **Settings → AI**), or `howToGuidePage document type not found` (re-run setup script).

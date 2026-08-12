# AI & Copilot

The backoffice includes an **AI Copilot** that can generate and edit content directly in blocks/fields. Configuration is done in the Umbraco backoffice under **Settings > AI**:

- **AI Connection**: Provider + API credentials (Anthropic key stored in `appsettings.Development.json` under `Anthropic:ApiKey`)
- **Chat Profile**: Links an AI connection to a specific model
- **Agent**: Links a chat profile and defines the agent's role. **Permissions must be set on the agent** to allow content editing (scope controls which document types/properties it can modify).
- **Contexts**: Define data access boundaries (e.g., brand voice guidelines)

What's been validated end-to-end with MCP + AI is tracked in [docs/capabilities.md](capabilities.md), which mirrors the **Capabilities** page in the backoffice.

The **Umbraco MCP server** enables Claude Code to interact with backoffice content. Connection settings are in `.env` with tool collections for `document`, `media`, `document-type`, and `data-type`.

## AI schema deployment to Umbraco Cloud

With the `Umbraco.AI.Deploy` + `Umbraco.AI.Prompt.Deploy` + `Umbraco.AI.Agent.Deploy` packages installed, every AI Connection, Context, Guardrail, Chat Profile, Embedding Profile, Prompt, Agent, and AI Setting saved in **Settings > AI** auto-serializes to a `umbraco-ai-*.uda` artifact under [src/UmbracoProject/umbraco/Deploy/Revision/](../src/UmbracoProject/umbraco/Deploy/Revision/). Those artifacts flow through the same git → Umbraco Cloud pipeline as document types.

**Profile settings (Max Tokens, Temperature, System Prompt, Context IDs) require `Umbraco.AI.Deploy` ≥ 17.0.1.** Earlier versions wrote `Settings: {}` to the `.uda` (a serialization bug), so profile tuning couldn't deploy and deploying a profile artifact **overwrote** the target's settings with empty. On ≥ 17.0.1 profile settings flow through the normal path: edit in local **Settings > AI**, **Save** (the Save is what serializes — nothing auto-exports on its own), then commit the updated `umbraco-ai-profile__*.uda` and push. **Tell/symptom:** a profile `.uda` with `Settings: {}` right after a save means you're on a pre-17.0.1 Deploy package.

**Secrets stay per-environment**: `.uda` artifacts reference API keys via placeholders (e.g. `$OpenAI:ApiKey`, `$Anthropic:ApiKey`), never the raw value. Each Cloud environment (Development, Staging, Live) must have its own keys set in that environment's app settings via the Cloud portal — **never paste raw keys into the backoffice connection form** (they get encrypted to the DB and break on Data Protection key rotation).

**Cloud portal secret-key naming**: the portal's app-settings UI rejects `:` in key names (validator allows only `0-9 a-z A-Z _`). Use the .NET Core double-underscore convention — `Anthropic__ApiKey` / `OpenAI__ApiKey`. .NET Core flattens `__` back to `:` when building `IConfiguration`, so the backoffice connection references (`$OpenAI:ApiKey`) and `appsettings.Development.json` entries (`"OpenAI:ApiKey": "..."`) keep the colon form unchanged.

**AI config-key allow-list** (behavior of the current **Umbraco.AI 17.x** suite; the feature landed in the pre-alignment 1.14.0 release): the AI core refuses to resolve a `$`-referenced configuration key unless its prefix is allow-listed. The defaults are `Umbraco:AI:Secrets` and `Umbraco:AI:Variables` only — so the `$OpenAI:ApiKey` / `$Anthropic:ApiKey` references this project uses throw `InvalidOperationException: Configuration key 'OpenAI:ApiKey' is not permitted in settings` at resolve time. The failure is **swallowed** by the AI searcher (logged as `Vector search failed for index UmbAI_Search`) and silently breaks embeddings/semantic search rather than erroring loudly. Fix: extend `Umbraco:AI:AllowedConfigurationKeyPrefixes` in the committed [appsettings.json](../src/UmbracoProject/appsettings.json) — the .NET config binder merges arrays by index, so **re-list the two defaults** then add yours:

```json
"Umbraco": { "AI": { "AllowedConfigurationKeyPrefixes": [
  "Umbraco:AI:Secrets", "Umbraco:AI:Variables", "OpenAI", "Anthropic" ] } }
```

Because it lives in the committed `appsettings.json`, it applies to local + every Cloud environment with no per-environment portal action. This is the least-invasive fix (preserves the `$OpenAI:ApiKey` convention everywhere); relocating keys under `Umbraco:AI:Secrets` would rewrite the whole secret convention and re-serialize `.uda` — avoid.

**Bootstrapping existing AI config into Deploy** (one-time, when adopting the Deploy packages on an established install): existing DB-only entities do **not** auto-export on package install — the serializer only writes on save. Open **Settings → AI** and click Save on every entity once, in Deploy's dependency order: Connections/Contexts/Guardrails → Chat & Embedding Profiles → Prompts & Settings (default chat/embedding profile) → Agents. Verify new `umbraco-ai-*.uda` files appear under `umbraco/Deploy/Revision/`; before committing, grep the folder for raw secrets (`grep -rE '(sk-[A-Za-z0-9]{20,}|ANTHROPIC_)' src/UmbracoProject/umbraco/Deploy/Revision/`) to confirm only placeholder references are present, then run `/check-uda`.

**What still needs manual per-environment work**: only the vector search index (see [Search](search.md)) — every AI entity, agents included, now flows through Deploy.

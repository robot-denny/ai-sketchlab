---
name: project_ai_1_14_allowed_config_key_prefixes
description: Umbraco.AI 1.14.0 added a $-config-reference allowlist that breaks $OpenAI:ApiKey / $Anthropic:ApiKey unless prefixes are whitelisted
metadata: 
  node_type: memory
  type: project
  originSessionId: 528d658a-1a75-4a7f-ac7e-9cdcdc08b09f
  modified: 2026-07-30T15:28:19.179Z
---

The current **17.x AI suite** (the allow-list landed in the pre-alignment **1.14.0** release) enforces a security allowlist on `$`-syntax config resolution: AI connections referencing `$OpenAI:ApiKey` / `$Anthropic:ApiKey` throw `InvalidOperationException: Configuration key 'OpenAI:ApiKey' is not permitted in settings` unless the prefix is allow-listed (`AllowedConfigurationKeyPrefixes` defaults to `Umbraco:AI:Secrets`, `Umbraco:AI:Variables` only).

**Non-obvious DIAGNOSTIC TELL (the reason to keep this memory):** the exception is **swallowed** by the AI searcher's catch — logged only as `Vector search failed for index UmbAI_Search` → 0 hits → SearchService falls back to keyword → Provider.Examine beta.9 NREs on multi-word queries, so the user-visible symptom is a **500 on semantic `/search`**, not an obvious config error. It silently breaks ALL embedding/AI calls, not just search. So: a `Vector search failed for index UmbAI_Search` log line = suspect this allow-list first.

**Fix** is fully documented in **CLAUDE.md → AI & Copilot → "AI config-key allow-list"** (re-list the two default prefixes, then add `OpenAI`/`Anthropic`, in committed `appsettings.json` — the .NET binder merges arrays by index so the defaults must be re-listed). Discovered during the [[migrate-ai-search-stable-1-0]] work.

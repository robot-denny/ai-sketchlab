---
name: project_ai_suite_17_version_alignment
description: "Umbraco.AI realigned versioning to the CMS major (17.0.0 line); keep the AI stack on it, and note AI.Search pins Cms.Search.Core to 1.x"
metadata: 
  node_type: memory
  type: project
  originSessionId: fba1fba6-5ff7-4cc6-9e14-1c262fc8fdc5
  modified: 2026-08-03T19:49:58.024Z
---

On 2026-06-25 the Umbraco.AI vendor realigned ALL package versions to track the CMS major: a `17.0.0` line (Agent/Copilot/Search/Deploy/providers, "to align with Umbraco CMS v17") and an `18.0.0` line for CMS 18. The old `1.x` line (AI 1.14.0 / Agent 1.10.4 / Copilot 1.0.1) was the pre-alignment line.

Running the `1.x` line against **Cms 17.5.x** left the AG-UI copilot tool protocol out of step (Agent 17.0.0 carries "Forward AG-UI tool metadata to server" / "Adopt AG-UI Tool.metadata" fixes) and caused the **`#umbracoIdentity_signIn` login-label regression** (stale backoffice bundle vs the 17.5.x SPA). Fixed by moving the whole AI suite to `17.0.x` (PR #15, branch `claude/fix/ai-suite-17-alignment`, 2026-07-02).

**Non-obvious constraint:** `Umbraco.AI.Search 17.0.0` pins `Umbraco.Cms.Search.Core` to `[1.0.0, 1.999.999)` — so the `Umbraco.Cms.Search.*` family must STAY on the **1.x** line (bumping to Cms.Search 17.0.0 triggers NU1608). The two "search" families version independently. Provider.Examine stays `1.0.0-beta.9`.

**CONFIRMED 2026-08-03 — AI.Search 17.0.1 FLIPPED that constraint.** `Umbraco.AI.Search 17.0.1` requires `Umbraco.Cms.Search.Core (>= 17.0.0 && < 17.999.999)` — the **17.x** line, the opposite of 17.0.0's 1.x pin. So AI.Search is the coupling pivot: bumping it 17.0.0 → 17.0.1 forces the WHOLE search stack (`Cms.Search.Core`/`.BackOffice`/`.DeliveryApi` → 17.0.0, and Provider.Examine off beta.9) up together, surfacing as **NU1605 downgrade errors** at restore. That's a spec-worthy coupled migration, NOT a take-now bump. During the 2026-08-03 AI-suite 17.x patch sweep, AI.Search was deliberately KEPT at 17.0.0 (everything else in the suite bumped to latest 17.x cleanly); it's the one AI package that can't move without dragging search along.

**When moving to Umbraco 18:** bump the AI suite to the `18.0.0` line; the search stack is now unified stable at `Cms.Search.* 18.0.0` (retires the 1.x pin AND the Provider.Examine beta.9 pin + its NRE guard in `SearchService.cs`) — AI.Search 17.0.1+ already points at the 17.x/18.x search line, so this is the natural moment to move both together. See [[project_ai_1_14_allowed_config_key_prefixes]].

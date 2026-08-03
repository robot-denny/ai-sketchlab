---
name: project_ai_context_resource_ids_are_cloud_managed
description: "Never hand-edit or feature-branch the Resources[].Id GUIDs in umbraco-ai-context .uda — they are Cloud-managed and clobbering them hard-fails cloud-sync (apply_patch.sh), skipping the Dev deploy."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 60bb64ae-20bd-4f39-8962-2f99f7f74522
  modified: 2026-07-28T16:14:48.603Z
---

The `Resources[].Id` GUIDs inside `umbraco-ai-context__*.uda` are **Cloud-managed normalized values** — Umbraco Cloud rewrites them on its own (drift mechanism #4) and auto-commits them to the Cloud SCM (`origin`/`dev-cloud`). They are NOT ours to author.

**Why this matters:** On 2026-07-28, master run #42 hard-failed at `Umbraco Cloud Sync / Apply remote changes` (`apply_patch.sh`), skipping the Dev deploy. Root cause: the `consolidated-guides` branch hand-edited these IDs (`0ce0b906`/`ee01bf3c`; my `845e45e` "reconcile ai-context Resource IDs after backoffice update" was the last such edit). Merging #42 overwrote the `496192b5`/`2d3b8967` values Cloud had established after #41. Cloud's sync patch expected the `496192b5`/`2d3b8967` base, couldn't find it, and `git apply` failed — the `csproj` hunk failed too. This cost significant time across several attempts.

**How `apply_patch.sh` actually works (the key mental model I got wrong first):** the Cloud sync patch is a **fixed artifact pinned to the last-green deployment** (`latestDeploymentId`, e.g. `ef010d4a` = #41). Cloud serves the SAME patch UNCHANGED on every subsequent run until it applies — **a new push does NOT regenerate it.** The script tries reverse-check (`--reverse --check` = "already applied?", passes iff repo == patch TARGET) then forward-check (`--check`, passes iff repo == patch BASE). So to fix a stuck sync, the repo must present the patch **BASE** = the file exactly as it was at the last-green deploy commit; the patch then applies forward (Cloud transforms base → its current normalization, bumps any Cloud-managed csproj versions, commits `Adding cloud changes since deployment …`, deploy proceeds).

**How to apply:**
- Never edit a `Resources[].Id` in an ai-context `.uda`. If a backoffice save churns them, discard: `git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/`.
- If cloud-sync is red on `apply_patch.sh`: read the failing job log's `while searching for` block — the `Id`/context shown is the patch **BASE**. Find the last-green master deploy commit (the one whose artifact = `latestDeploymentId`, usually the previous successful `#NN` merge) and restore ONLY the affected files to THAT commit on a fresh branch off `github/master` → PR → merge: `git checkout <last-green-sha> -- <the .uda>`. Verify the diff vs master is only the churned line (no content loss). The patch then applies forward. (Fix PR #44.)
- **Do NOT realign to Cloud's *current* value** (`origin/master` / `cf83a36c`) — that was PR #43's mistake and it FAILED: current-value is neither the base (forward fails) nor guaranteed to equal the patch target across all hunks (reverse fails on e.g. csproj). Restore to the **base**, let the patch move it forward.
- Only the ai-context (and other churned) hunks need base-restoring; unrelated hunks in the same patch (`guidePage.cshtml`, `csproj` when its base already matches) apply on their own.
- Do NOT hand-pick "reconcile" GUIDs — that IS the anti-pattern that caused this. Relates to [[project_cloud_deploy_bootstrap_skip]] and CLAUDE.md "How schema drift happens → mechanism 4".

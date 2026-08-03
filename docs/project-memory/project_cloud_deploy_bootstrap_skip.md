---
name: Cloud Deploy bootstrap silently skips schema import
description: When Live's bootstrapper skips schema import and pending .uda files don't move into the DB, the dashboard's "Update item" action (after toggling "hide up to date") is the simplest fix; POST /schema/item is the API-driven fallback
type: project
originSessionId: 5553ae03-f73d-4e69-b716-589ff26c0ccb
modified: 2026-07-30T15:26:31.816Z
---
When Umbraco Cloud's Deploy bootstrapper silently skips schema import on Live, `.uda` files sit on disk and never reach the DB. **Portal restarts and empty-commit nudges usually do NOT help** — the bootstrapper compares `deploy-*` marker files (not `*.uda`, not file mtimes), and Cloud's "No changes in metadata detected" optimization short-circuits the extraction step when the empty commit follows an already-deployed commit. The dashboard "Update item" action sidesteps both by invoking the import directly at runtime.

**Dashboard path (try FIRST — a 30-second fix for one or two rows):**
1. Live backoffice → **Settings → Deploy**.
2. Toggle **"hide up to date"** ON so only non-matching rows remain. **This is the trap:** without the toggle, the offending row is filtered out of view and the action affordance never appears.
3. Right-click the row → choose the action for its state (which of file-exists / in-Umbraco / up-to-date checkmarks are missing):
   - **Mismatch** (file ✓, in Umbraco ✓, up to date ✗) → **Update item** (imports file → DB).
   - **Pending** (file ✓, in Umbraco ✗) → the dashboard may only offer Create (DB → file) / Delete, NOT a UI import. Confirm before assuming "Update item" is available; use the API fallback for pending.
   - **Orphan** (file ✗, in Umbraco ✓) → **Create** (exports DB → file).
4. Retry the content transfer.

Don't generalize "Update item is always available" — it's only there for the **mismatch** state.

**API fallback** — `POST /umbraco/deploy/management/api/v1/schema/item?udi={url-encoded UDI}` (bearer token via `UMBRACO_LIVE_*` OAuth in `.env`, empty body → `200 "Item updated."`, idempotent). Use when the dashboard isn't reachable (CI/automation) or for dozens of pending entries. Pick the simplest pending UDI (no deps — a data-type or AI context); posting **one** UDI tends to unblock Deploy's full pending-set evaluation, so drift often drops to zero in one shot. After any import, `git pull` before your next push (Cloud may have auto-committed normalized `.uda`).

**Symptoms:** `/check-uda` reports pending entries that don't clear on restart/nudge; Live startup log `Skipping Umbraco content and/or schema import at startup` (missing `deploy-*` trigger marker); content transfer fails with `DeploySchemaMismatchException` at "Review manifest on target", or `Could not retrieve artifact with UDI` — all the same root cause (Live's DB lacks the referenced schema).

**Related Deploy endpoints** (sparse OpenAPI at `/umbraco/swagger/deploy-management/swagger.json`): `POST /schema/item?udi=` file→DB import; `DELETE /schema/item?udi=` remove entity; `POST /schema/file?udi=` DB→file extract; `DELETE /schema/file?udi=` remove file. `/operation/detail/failed` returns empty when bootstrap silently skipped (skipped ≠ failed) — useful for distinguishing this case from a real import error.

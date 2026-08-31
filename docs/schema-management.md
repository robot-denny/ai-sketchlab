# Schema Management

`.uda` files in `umbraco/Deploy/Revision/` are auto-modified by Umbraco on every local startup. Before staging, always verify `.uda` changes are intentional — if not, discard them:

```bash
git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/
```

The pre-commit hook in `.githooks/pre-commit` (activated with `git config core.hooksPath .githooks` — see README) automatically checks for conflicts before each commit.

Use `/check-uda` for a detailed pre-commit analysis: fetches remote state, identifies which schema entities are at risk, rates conflict severity (SAFE / LOW / MEDIUM / HIGH / CRITICAL), and gives specific remediation steps. `/check-uda` also hits Live's Deploy Management API to detect DB↔file drift that pure git diffing can't see (see **How schema drift happens** below).

The **stack-generic** half of this knowledge — `.uda` artifact mechanics, why files and a database
drift, and which dashboard control genuinely imports — lives in the `umbraco-deploy-facts` skill, which
agents consult automatically. This runbook holds what is specific to *this* project: the drift history
below, the fixes already applied, and the environment layout.

## How schema drift happens in this project

The Deploy dashboard treats any entity where `umbracoExists !== fileExists` as drift. Four mechanisms can drive a wedge between DB state and file state:

**1. Built-in Umbraco entities never extracted at setup.** When the project was first provisioned, only user-authored entities (custom document types, custom data types, templates) got extracted to `.uda`. Built-in defaults — `Date Picker`, `Textstring`, `Dropdown`, the 18 `Label (*)` types, the six default media types (`Article`, `Audio`, `File`, `Folder`, `Vector Graphics (SVG)`, `Video`), the `en-US` language, the `Member` type, and the seven standard relation types — stayed DB-only on every environment. This created permanent "not up to date" noise on the Deploy dashboard that masked real drift. **Fixed once, 2026-04-23**: all 51 built-in defaults are now committed as `.uda` files. If you install a new package that adds built-in entities (e.g. a member-type container), expect the same pattern — extract its artifacts via `POST /umbraco/deploy/management/api/v1/schema/file?udi={udi}` or the dashboard's per-row "Create file" action, then commit.

**2. Schema edits made directly on Live's backoffice.** Local is the declared source of truth — all schema authoring should happen on local and flow through git to Live. If someone makes a schema change directly in Live's backoffice (including via the Deploy dashboard's "Create" action on an orphan), that change becomes a Live-only entity with no `.uda` file. Rule: **never author schema on Live** — always edit locally and push. If Live already has orphans (as we found with the old manually-created AI connection), either delete them from Live and let the file-backed version replace them, or extract them to `.uda` via the Deploy dashboard before deleting.

**3. Umbraco auto-regenerates `.uda` on local startup.** Every `dotnet run` can rewrite files based on local DB signatures. If that regeneration gets staged inadvertently, git drifts from Live without any intentional schema change. See the `git checkout --` recipe above. Under [CI/CD & Build hygiene](ci-cd.md#cicd--build-hygiene), `cloud-sync` also pulls Cloud's auto-normalized `.uda` commits back to the branch before each Dev deploy (the `permissions: contents: write` block in [main.yml](../.github/workflows/main.yml) exists for this push) — an additional surface for the same drift, already covered by `/check-uda`.

**4. Umbraco Cloud auto-commits normalized `.uda` back to git.** When a file is imported into Live's DB via the Deploy dashboard, Cloud can re-serialize the artifact with normalized internal IDs (e.g. regenerating `Resources[].Id` GUIDs in ai-context files) and commit it directly to the repo as `Umbraco Cloud <support@umbraco.io>`. This is normal — it means Live becomes the source of truth for those specific normalized values. **Always `git pull` / `git fetch` before pushing** so you don't conflict with Cloud's own commits. The `/check-uda` pre-commit hook warns about this.

Root-cause summary: mechanism (1) was the biggest contributor historically (51 entities of drift from day one). Mechanisms (2)–(4) are ongoing risks that `/check-uda` is designed to catch before push.

## Importing pending schema on a Cloud environment

If `/check-uda` reports `mismatch` or `pending` entries on Live and content transfers get stuck, the fastest fix is usually the dashboard's **per-row "Update item"** action — right-click the row after toggling "hide up to date" on. Do **not** start with portal restarts or empty-commit nudges (they often don't trigger reimport), and do not confuse the per-row action with the top-of-dashboard bulk "Update Umbraco Schema from data files" button (which does nothing on Cloud despite reporting "operation completed"). Full remediation paths — including the `POST /schema/item?udi=...` API fallback for pending rows — live in `/check-uda` Step 8.

## Enabling Live-drift detection in `/check-uda`

`/check-uda` can optionally query Live's Deploy Management API to catch drift that pure git diffing misses. To enable:

1. On Live's backoffice, create an OAuth client credentials pair: **Settings → OAuth → Add client** (same mechanism as the local credentials the `/umbraco-edit` command uses). Grant it scopes sufficient to read the Deploy Management API.
2. Add these entries to your local `.env`:
   ```
   UMBRACO_LIVE_URL=https://<your-live-host>
   UMBRACO_LIVE_CLIENT_ID=<client id>
   UMBRACO_LIVE_CLIENT_SECRET=<client secret>
   ```
3. Run `/check-uda`. If credentials resolve, the report will include a **Live-Side Drift** section with per-category counts of orphans / pending / signature mismatches.

Without `UMBRACO_LIVE_*` entries, `/check-uda` degrades gracefully to git-only mode with a yellow warning.

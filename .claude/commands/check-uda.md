Analyze Umbraco Deploy schema (.uda) files for potential conflicts and drift before committing or pushing.

## Overview

Umbraco stores CMS schema (document types, data types, templates, etc.) as `.uda` files in `src/UmbracoProject/umbraco/Deploy/Revision/`. Problems fall into two buckets:

**Git-side conflicts** (comparing local working tree against `origin/master`):
1. **Accidental local changes** — Umbraco auto-regenerates `.uda` files on startup. Developers stage them without realising.
2. **Remote-ahead** — A teammate or Umbraco Cloud's auto-commit modified schema you haven't pulled.
3. **Both-modified** — The same `.uda` was changed both locally and remotely.

**Live-side drift** (comparing local `.uda` files against Live's DB):
4. **Live-only orphans** — Entities exist in Live's DB but no matching `.uda` file in git. Happens when someone authors schema directly in Live's backoffice, or when Umbraco built-in entities were never extracted.
5. **File-only pending** — `.uda` exists locally but no matching entity in Live's DB. Normal for newly-added schema before its first push; flags an issue if it persists after deploy.
6. **Signature mismatch** — Both sides have the entity but content diverged.

## Step 0 — Live credentials (optional, enables Steps 6+)

Load Live's Deploy Management API credentials from `.env`:

- `UMBRACO_LIVE_URL` — Live backoffice base URL (e.g. `https://umbraco-17-demo-site.useast01.umbraco.io`)
- `UMBRACO_LIVE_CLIENT_ID` — OAuth client ID (created via Live's backoffice → Settings → OAuth)
- `UMBRACO_LIVE_CLIENT_SECRET` — OAuth client secret

If any are missing, skip Steps 6+ and emit a yellow warning: `⚠️ Live credentials not configured — git-side checks only. Add UMBRACO_LIVE_* entries to .env to enable Live-drift detection.`

If all are present, fetch a bearer token:

```bash
curl -sk -X POST "${UMBRACO_LIVE_URL}/umbraco/management/api/v1/security/back-office/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${UMBRACO_LIVE_CLIENT_ID}&client_secret=${UMBRACO_LIVE_CLIENT_SECRET}"
```

If the token request fails (401/timeout/network error), warn and degrade to git-only mode.

## Step 1 — Collect git state

Run these bash commands (in order — each depends on the last):

```bash
# Current branch name
git rev-parse --abbrev-ref HEAD
```

```bash
# Fetch latest from remote (updates remote refs without merging — safe)
git fetch origin 2>&1
```

```bash
# Check upstream tracking branch (output is e.g. origin/master, or nothing)
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "NO_UPSTREAM"
```

```bash
# .uda files staged for commit
git diff --cached --name-only -- "*.uda"
```

```bash
# .uda files modified locally but NOT yet staged
git diff --name-only -- "*.uda"
```

```bash
# Untracked .uda files (newly extracted, not yet in git)
git ls-files --others --exclude-standard -- "*.uda"
```

```bash
# .uda files changed on remote that haven't been pulled (remote-ahead changes)
git diff HEAD..@{u} --name-only -- "*.uda" 2>/dev/null || echo "NO_UPSTREAM"
```

## Step 2 — Identify git-side conflicts

From the output:

- **Staged UDA files** = output of `git diff --cached --name-only -- "*.uda"`
- **Remote UDA changes** = output of `git diff HEAD..@{u} --name-only -- "*.uda"`
- **Direct conflicts** = files that appear in **both** lists — these will break the push

## Step 3 — Read conflicting files for context

For each file that appears in BOTH staged AND remote changes, read the file to extract:
- `Name` — the human-readable entity name
- `Alias` — the developer alias (for document types)
- `__type` — the artifact type

## Artifact risk table

Cross-reference against this table when reporting risk:

| Prefix | Risk | Why |
|---|---|---|
| `document-type__` | 🔴 Critical | Breaks content rendering if schema mismatches |
| `data-type__` | 🔴 High | Property editors may stop working |
| `language__` | 🔴 High | Content variants can become unreachable if the language is deleted |
| `media-type__` | 🟠 Medium | Media rendering could break |
| `member-type__` | 🟠 Medium | Login/profile pages depend on member types |
| `relation-type__` | 🟡 Medium | Content relationships could orphan |
| `template__` | 🟡 Medium | Template assignments may break |
| `umbraco-ai-connection__` | 🟠 Medium | AI chat/Copilot disabled if misconfigured |
| `umbraco-ai-profile__` | 🟠 Medium | Agents/prompts bound to it will fail |
| `umbraco-ai-context__` | 🟡 Medium | Brand voice / retrieval degraded |
| `umbraco-ai-prompt__` | 🟡 Medium | Individual prompt unavailable |
| `umbraco-ai-settings__` | 🟡 Medium | Default chat / embedding profile selection |
| `umbraco-ai-guardrail__` | 🟡 Medium | Safety guardrail would be missing |
| `document-type-container__` / `data-type-container__` / `media-type-container__` / `member-type-container__` | ✅ Low | Folder organisation only |
| `dictionary-item__` | ✅ Low | Translation strings |

## Step 4 — Check for unintentional local changes

If there are unstaged or untracked `.uda` files, note these separately — the developer may not have intended to change/add them (Umbraco auto-write on startup can produce this). Recommend reviewing before staging:

```bash
# Discard all unstaged changes to .uda files (safe if none are intentional)
git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/
```

## Step 5 — Confirm token (if Live creds were loaded in Step 0)

If Step 0 got a Live token, proceed to Step 6. Otherwise skip to Step 7 (Report).

## Step 6 — Live-drift check

Call Live's Deploy Management API to get the current schema comparison state (this is the data backing Live's Deploy dashboard):

```bash
curl -sk -H "Authorization: Bearer ${TOKEN}" \
  "${UMBRACO_LIVE_URL}/umbraco/deploy/management/api/v1/schema"
```

The response has shape:

```json
{
  "comparisonData": {
    "data-type": [
      { "udi": {"uriValue": "umb://data-type/..."}, "label": "...",
        "fileName": "data-type__...uda",
        "umbracoExists": true, "fileExists": true, "isUpToDate": true }
    ],
    "document-type": [ ... ],
    ...
  }
}
```

For each entity type category, compute three counts:

- **Live-only orphans**: items where `umbracoExists && !fileExists` AND no local file exists at that filename either. These are DB-only entities on Live that are not tracked in git. Action: either extract them on Live (dashboard → "Create file" → pull back via git), or delete them from Live's DB if they shouldn't exist.
- **File-only on Live**: items where `!umbracoExists && fileExists`. The `.uda` arrived on Live but Deploy hasn't imported it yet. Usually transient after a push; if it persists, click "Update Umbraco schema from data files" on Live's dashboard.
- **Signature mismatch**: items where `umbracoExists && fileExists && !isUpToDate`. Content diverged. Action: determine which direction should win (usually local files, since local is canonical), then run the appropriate dashboard operation.

Also cross-reference against local: for any local `.uda` file we have that Live doesn't list at all, that's a "pending push" — expected if the file is in a commit not yet pushed, a warning if it is pushed but Live hasn't processed it.

Summarise drift per category: `data-type: 0 orphans, 2 pending, 0 mismatch`.

## Step 7 — Generate the report

Output a clearly formatted report:

---

## Umbraco Schema Conflict & Drift Check

**Branch:** `{branch}`
**Upstream:** `{upstream or "none — push will create a new remote branch"}`
**Live API:** `{"✓ connected" if token acquired, else "⚠ not configured (git-only mode)"}`

---

### 📋 Local Staged Schema Changes

List each staged `.uda` file with entity type, Name, and risk level. If none: _"No schema files are staged — safe to commit from a Deploy perspective."_

---

### 🌐 Remote Schema Changes (unpulled)

List each `.uda` file changed on the remote you haven't pulled, with entity type and Name. If none: _"Remote is in sync — no unpulled schema changes."_

---

### 🔴 Direct Git Conflicts

Files changed in BOTH staged AND remote. For each:
- Filename
- Entity name and type
- Why it's risky

If none: _"✅ No direct git conflicts detected."_

---

### 🟠 Live-Side Drift (skipped if no Live credentials)

Per-category summary of Live-vs-local drift:

```
data-type:      0 orphans  |  0 pending  |  0 mismatch  ✓
document-type:  0 orphans  |  0 pending  |  0 mismatch  ✓
media-type:     1 orphan   |  0 pending  |  0 mismatch  ⚠
...
```

For each non-zero category, list the specific entities involved.

---

### ⚠️ Risk Assessment

| Level | Condition |
|---|---|
| ✅ SAFE | No staged `.uda` files, no Live drift |
| 🟢 LOW | Staged `.uda` files, remote in sync, no Live drift |
| 🟡 MEDIUM | Remote has unpulled schema changes to different files |
| 🟠 HIGH | Live has orphans or signature mismatches, or remote changed same entity types as yours |
| 🔴 CRITICAL | Direct git conflicts (same files modified locally and on remote) |

State the overall level and a one-line summary.

---

### Recommended Action

- **SAFE / LOW**: Proceed with commit.
- **MEDIUM**: Run `git pull --rebase` first. Let Umbraco Deploy sync locally (`dotnet run`, check the `/umbraco` Deploy dashboard). Then commit.
- **HIGH (Live drift)**: Resolve the drift on Live before pushing local changes on top. Options:
  - If Live orphans are entities you want to keep: extract them to `.uda` via Live's Deploy dashboard → "Create file" per row, then `git pull` to bring them into local.
  - If Live orphans shouldn't exist: delete them in Live's backoffice UI (Settings → AI / Settings → Data Types / etc.), then click "Update schema from data files" to ensure everything is aligned.
  - For signature mismatches: compare via `/schema/item?udi=...`, decide direction, apply.
- **HIGH (remote-ahead on same entity type)**: Coordinate with whoever pushed. For a solo project, inspect the remote diff before pulling.
- **CRITICAL**: **Do not push without resolving first.** Steps:
  1. `git pull --rebase` (will conflict)
  2. Manually merge each conflicting `.uda` file — keep the JSON structure that matches the intended schema
  3. `dotnet run` locally and verify Deploy dashboard shows clean state
  4. Commit and push

---

### 💡 Unintentional Changes

If there are unstaged or untracked `.uda` files you didn't deliberately create/change, Umbraco likely rewrote them on startup from the local DB. To discard:

```bash
git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/
# Untracked files must be removed separately:
git clean -f src/UmbracoProject/umbraco/Deploy/Revision/
```

Only commit `.uda` files when you deliberately changed a document type, data type, or template in the backoffice — or when bulk-extracting pre-existing built-in defaults (see CLAUDE.md "How schema drift happens").

Analyze Umbraco Deploy schema (.uda) files for potential conflicts before committing or pushing.

## Overview

Umbraco stores CMS schema (document types, data types, templates, etc.) as `.uda` files in `src/UmbracoProject/umbraco/Deploy/Revision/`. Conflicts happen when:

1. **Accidental local changes** — Umbraco auto-regenerates `.uda` files when the site runs locally to reflect the local DB. Developers stage these without realising.
2. **Remote-ahead** — A teammate or the Cloud environment changed schema that you haven't pulled yet.
3. **Both-modified** — Both you and the remote changed the same `.uda` file — guaranteed conflict on push.

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
# .uda files changed on remote that haven't been pulled (remote-ahead changes)
git diff HEAD..@{u} --name-only -- "*.uda" 2>/dev/null || echo "NO_UPSTREAM"
```

## Step 2 — Identify conflicts

From the output:

- **Staged UDA files** = output of `git diff --cached --name-only -- "*.uda"`
- **Remote UDA changes** = output of `git diff HEAD..@{u} --name-only -- "*.uda"`
- **Direct conflicts** = files that appear in **both** lists — these will break the push

## Step 3 — Read conflicting files for context

For each file that appears in BOTH staged AND remote changes, read the file to extract:
- `Name` — the human-readable entity name
- `Alias` — the developer alias (for document types)
- `__type` — the artifact type

Also note the entity type from the filename prefix:
| Prefix | Risk level | Why |
|--------|-----------|-----|
| `document-type__` | 🔴 Critical | Breaks content rendering if schema mismatches |
| `data-type__` | 🔴 High | Property editors may stop working |
| `template__` | ⚠️ Medium | Template assignments may break |
| `document-type-container__` | ✅ Low | Just folder organisation |
| `dictionary-item__` | ✅ Low | Translation strings |

## Step 4 — Check for unintentional local changes

If there are unstaged `.uda` files (from `git diff --name-only -- "*.uda"`), note these separately — the developer may not have intended to change them (Umbraco auto-write on startup). Recommend reviewing before staging.

## Step 5 — Generate the report

Output a clearly formatted report:

---

## Umbraco Schema Conflict Check

**Branch:** `{branch}`
**Upstream:** `{upstream or "none — push will create a new remote branch"}`

---

### 📋 Local Staged Schema Changes

List each staged `.uda` file with entity type, Name, and risk level. If none: _"No schema files are staged — safe to commit from a Deploy perspective."_

---

### 🌐 Remote Schema Changes (unpulled)

List each `.uda` file changed on the remote you haven't pulled, with entity type and Name. If none: _"Remote is in sync — no unpulled schema changes."_

---

### 🔴 Direct Conflicts

Files changed in BOTH staged AND remote. For each:
- Filename
- Entity name and type
- Why it's risky (e.g. "document type — schema mismatch will cause Deploy to fail on push")

If none: _"✅ No direct conflicts detected."_

---

### ⚠️ Risk Assessment

| Level | Condition |
|-------|-----------|
| ✅ SAFE | No staged `.uda` files |
| 🟢 LOW | Staged `.uda` files, remote is in sync |
| 🟡 MEDIUM | Remote has unpulled schema changes to different files |
| 🟠 HIGH | Remote changed same entity types (different files but related) |
| 🔴 CRITICAL | Direct file conflicts — same files modified in both |

State the overall level and a one-line summary.

---

### Recommended Action

Give a specific, actionable recommendation:

- **SAFE / LOW**: Proceed with commit.
- **MEDIUM**: Run `git pull` first. Let Umbraco Deploy sync locally (`dotnet run`, check the `/umbraco` backoffice Deploy dashboard). Then commit.
- **HIGH**: Coordinate with the team. Confirm which schema version is correct before committing.
- **CRITICAL**: **Do not push without resolving first.** Steps:
  1. `git pull` (will conflict)
  2. Manually merge each conflicting `.uda` file — keep the JSON structure that matches the intended schema
  3. `dotnet run` locally and verify Deploy shows clean state
  4. Then commit and push

---

### 💡 Unintentional Changes

If there are unstaged `.uda` files you didn't intentionally change, Umbraco likely rewrote them on startup from the local DB. To discard them:

```bash
git checkout -- src/UmbracoProject/umbraco/Deploy/Revision/
```

Only commit `.uda` files when you deliberately changed a document type, data type, or template in the backoffice.

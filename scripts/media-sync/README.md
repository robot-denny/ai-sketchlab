# Media Sync

Heals missing local media binaries by pulling them from a source Umbraco environment (Live by default). The safety net for the Cloud-native pattern where `wwwroot/media/` is gitignored and binaries flow through Cloud Deploy rather than git.

See [CLAUDE.md → Media files](../../CLAUDE.md) for the full workflow this supports.

## When you'd run it

After a content restore from a Cloud environment that wasn't followed by a matching media restore, the local DB points at `/media/<hash>/<file>` paths whose binaries live on Live but not on disk. Articles render with broken images. Two ways to fix:

- **Canonical fix**: do the media restore from the **Settings → Deploy** dashboard in the local backoffice for the same source environment. This is the right answer in the steady state.
- **Safety net**: `npm run media:sync` — walks the local media tree, finds every record whose `umbracoFile.src` points at a missing file, and downloads each from the source environment at the same path.

Both end up at the same place. Use the script when the dashboard step got skipped or when you want a quick CLI-based sweep.

## Usage

```bash
# Heal using $UMBRACO_LIVE_URL from .env
npm run media:sync

# Report what would change without writing
npm run media:sync -- --dry-run

# Pull from a different source environment
npm run media:sync -- --source=https://your-staging-host
```

If `node` isn't on your PATH (nvm users), prefix commands with:

```bash
PATH="/Users/dkardys/.nvm/versions/node/v22.22.2/bin:$PATH"
```

## Required `.env`

```
UMBRACO_CLIENT_ID=<local backoffice OAuth client id>
UMBRACO_CLIENT_SECRET=<local backoffice OAuth client secret>
UMBRACO_LIVE_URL=https://<your-live-host>     # default source environment
URL=https://localhost:44367                    # or UMBRACO_BASE_URL
```

The OAuth client is the same one used by the rest of the project — see the `/umbraco-edit` skill ([.claude/commands/umbraco-edit.md](../../.claude/commands/umbraco-edit.md)) for the token request shape.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All records present, or all missing records healed successfully |
| 1 | Hard failure (auth, network, missing env) — nothing was synced |
| 2 | Some records' binaries are missing from the source too (e.g., locally-created media that was never pushed up). The script tells you which ones |

Exit 2 is the signal that the source environment isn't a complete superset of the local environment. Resolve by either pushing those binaries up via a Cloud Deploy media transfer, or deleting the orphan records from the local backoffice.

## How it works

```
walk local media tree (Management API, paginated)
  ↓
filter to records with umbracoFile.src starting with /media/
  ↓
check disk under src/UmbracoProject/wwwroot/<src>
  ↓
for each missing file, download from <source><src> and write to disk
```

Idempotent — re-runs are safe. Only writes files that don't already exist locally; never overwrites or deletes.

## Architecture

```
scripts/media-sync/src/
└── cli.ts    # everything in one file: arg parsing, auth, tree walk, download, reporting
```

Single-file by design — small enough that splitting across modules would add friction without value. If this grows beyond ~400 lines, split it.

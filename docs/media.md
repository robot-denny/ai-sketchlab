# Media files

**Umbraco Cloud is the source of truth for media binaries.** `src/UmbracoProject/wwwroot/media/` is gitignored — binaries are never committed. This is the Cloud-native pattern: schema flows through git (.uda files), content flows through Cloud Deploy, and media flows through Cloud's media transfer. It scales cleanly across multiple authors because nobody has to remember to "commit the image they just uploaded".

## Local development workflow

**Fresh clone:** `dotnet run` starts with an empty local media folder. Existing articles will render with broken images until media is restored from Cloud.

**Restoring content from Cloud to local:**

1. In the local backoffice, open **Settings → Deploy** and do a content restore from a Cloud environment — **Dev** for the full superset (including content not yet promoted to Live), or **Live** for published-only content. (A restore overwrites local records, so transfer any local WIP *up* first — see [content workflow under CI](ci-cd.md#content-workflow-under-ci).)
2. In that same dashboard, also do a **media restore** for the same environment. This is the step that's easy to forget — content restore pulls document records (including the media picker references like `/media/<hash>/<name>.png`), but **does not** pull the media binaries.
3. Verify: browse the restored articles. If `mainImage` fields show broken links, step 2 was skipped.

**Authoring:** Create and generate media **locally** (backoffice upload or the image-generator CLI — the local `wwwroot/media/` is where new binaries land), then transfer it **up** the same direction as content: local → Dev → Live, via the Cloud Deploy dashboard. Do not commit `wwwroot/media/` changes — the gitignore rule will block them, but don't bypass it.

## When local media breaks

The usual cause is skipping the media restore after a partial content restore: local DB now points to `/media/<hash>/<filename>` paths whose binaries live on Dev-or-Live (Dev is the superset) but not on disk. To heal:

```bash
npm run media:sync                  # pull every missing binary from $UMBRACO_LIVE_URL
npm run media:sync -- --dry-run     # report what would change, don't write
npm run media:sync -- --source=<url>   # use a different source environment
```

The script walks the local media tree, finds every record whose `umbracoFile.src` points at a file not on disk, and downloads each from the source env at the same path. Safe to run anytime — idempotent, only writes missing files. Exits 2 if any record's binary is missing from the source too (e.g., locally-created media that was never pushed up).

Source: [scripts/media-sync/src/cli.ts](../scripts/media-sync/src/cli.ts). Requires `UMBRACO_LIVE_URL` in `.env`.

The "right" fix is always to do the matching media restore from the Cloud Deploy dashboard — `media:sync` is the safety net when that step got skipped.

## The generator produces media the same way

The image generator CLI ([scripts/image-generator/src/umbraco-api.ts](../scripts/image-generator/src/umbraco-api.ts)) calls the same Management API endpoints as a backoffice upload: `POST /temporary-file` followed by `POST /media`. The generated files land in local `wwwroot/media/<hash>/`, get picked up by the local DB, and need to be pushed to Cloud via a standard media transfer if they're needed on other environments.

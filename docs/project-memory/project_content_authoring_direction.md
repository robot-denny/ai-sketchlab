---
name: Content authoring direction (local → Dev → Live)
description: User authors content locally, then it flows local → Dev → Live through the pipeline — not direct to Live; Cloud is not source of truth for content records
type: project
originSessionId: 0cc9b535-c44f-43e2-b1e6-219684431b4b
modified: 2026-07-28T22:09:29.899Z
---
Content authoring on this project **originates locally** — the user creates pages/articles in their local backoffice (local SQLite, previewing locally first) — but as of 2026-07-28 it now flows **local → Dev → Live** through the pipeline, NOT direct to Live. Content rides the same environment chain as schema: local → Dev (via Settings → Deploy transfer to the adjacent Dev environment), then Dev → Live by promotion. This gates content through the tested Dev environment before it reaches Live, so content that depends on new schema can't outrun its code.

**Why:** Previously the workflow was documented as "local → Live directly," but that only worked because of a stale Live-only `umbraco-cloud.json` that silently pointed local's transfer target at Live (see [[project_umbraco_cloud_json_must_stay_tracked]]). With the file reverted to stock (all-workspaces, Dev+Live), Deploy transfers to the immediately-next environment (Dev) — no skipping — so Dev is now the first hop. This is intentional (discovery Option B): everything, including MCP/Ella-authored content, is gated through Dev before promotion.

**How to apply:**
- **Read the runbook first:** `docs/content-transfer-workflow.md` is the durable, by-hop playbook (local→Dev freely; Dev→Live selective/per-item by default, root only just after green CI with fixtures cleaned; Live→Dev restores forbidden-by-default since they clobber unpromoted Dev content; transfer WIP up before pulling down). The rewritten CLAUDE.md "Content workflow under CI" section is the other durable home.
- Assume content **originates locally**, then flows **local → Dev → Live** — never advise a direct local → Live transfer, and never advise a Live → Dev restore by default (it clobbers unpromoted Dev content).
- Don't describe Cloud as "the source of truth for content" in this project — it's true for media binaries (gitignored, Cloud-managed) and for schema's normalized `.uda` round-trips, but not for content records.
- Media is still Cloud-managed and rides separately — `wwwroot/media/` is gitignored, binaries flow through the Deploy dashboard, and content transfers do NOT carry media binaries. The asymmetry is intentional.
- Schema still rides git as usual (local → master → Dev → Live).

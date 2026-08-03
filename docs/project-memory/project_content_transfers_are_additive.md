---
name: project_content_transfers_are_additive
description: "Umbraco Cloud content transfers/restores are ADDITIVE, not a sync — local deletions never propagate to Live, and a name collision with a stale target node creates a \"(1)\" duplicate with a suffixed slug that breaks hardcoded links."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 60bb64ae-20bd-4f39-8962-2f99f7f74522
  modified: 2026-07-28T19:41:38.311Z
---

Umbraco Cloud content **transfer (local→Live)** and **restore (Live→Dev)** are additive/upsert-by-GUID, **not** a mirror. Two consequences that bit us on 2026-07-28 (consolidated-guides):

1. **Deletions don't propagate.** Deleting/renaming/restructuring a node locally does NOT remove the old node on Live when you next transfer. The old node lingers as an orphan on Live (and can survive Live→Dev restores).
2. **Name collisions create "(1)" duplicates with suffixed slugs.** Transferring a node whose *name* collides with a stale orphan already on the target makes Umbraco append " (1)" and slug `-1` (e.g. `/guides/how-to-use-the-alert-banner-1/`). Any **hardcoded** link to the clean slug (`/guides/how-to-use-the-alert-banner/`) — as the Component Guide uses — then 404s, because the clean slug is held by the orphan and the real node is at `-1`. (A GUID-based document link would instead render the `-1` slug; the tell that a link is hardcoded is that it shows the clean slug while the node lives at `-1`.)

Concrete instance: local Guides = {How To Use The Alert Banner, Styleguide, Component Guide}. Live ended up with a stale original "How to Use the Alert Banner" + "How to Use the Alert Banner (1)" (the real transferred node, GUID 2738dad3) + a Live-only orphan "How to Use the Image Carousel". Dev restore brought only the "(1)". The content-gated `styleguide-components.spec.ts` broken-link assertion correctly failed on Dev, which also blocked the update-snapshots baseline commit.

**How to apply:**
- Treat every local delete/rename/move of content as **also requiring a manual delete on Live** (then restore Live→Dev to mirror). There is no auto-propagation.
- Before transferring after a restructure, check the target env for stale nodes at the slug you expect — a lingering orphan will bump your node to `-1`.
- To reclaim a clean slug: delete BOTH the orphan AND the "(1)" node on Live, clear any URL-Tracker 301 for that slug (Content → Redirect URL Management), then re-transfer from local (now no collision → clean slug), then restore Live→Dev.
- Local is the content source of truth ([[project_content_authoring_direction]]); a node that exists ONLY on Live (e.g. an image-carousel how-to) is an orphan — either recreate it locally so it's authoritative, or delete it on Live. Don't leave it.
- MCP is local-only; Live/Dev content surgery is manual (backoffice) or via Deploy transfer/restore. Verify with `curl -sI <DevURL>/<path>` (Dev URL = `gh variable get URL`).

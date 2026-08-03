---
name: project_git_push_to_github_not_origin
description: "In this repo `origin` is Umbraco Cloud Live SCM, not GitHub — always push branches/PRs to the `github` remote; `git push -u origin <branch>` sends code to the wrong place"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 878f03ea-5070-409d-b307-7c7fa57fa177
  modified: 2026-07-30T15:26:06.761Z
---

Habit-guard (repeated correction): push to **`github`**, not `origin` — `origin` is Umbraco Cloud **Live** SCM, so `git push -u origin <branch>` silently sends code to Cloud (no PR, no CI). New branches need an explicit `git push -u github <branch>` because `remote.pushDefault` is unset and git falls back to `origin`. PRs go against `robot-denny/ai-sketchlab` (base `master`). Durable fix worth offering: `git config remote.pushDefault github`.

Full remotes table (github / origin / dev-cloud) lives in **CLAUDE.md → Deployment → "Git remotes — always push to `github`, never `origin`"**. The one deliberate exception (direct SCM push to recover a down pipeline) is [[project_umbraco_cloud_json_must_stay_tracked]]; see [[project_gate2_transient_deploy_flakiness]] for the pipeline this feeds.

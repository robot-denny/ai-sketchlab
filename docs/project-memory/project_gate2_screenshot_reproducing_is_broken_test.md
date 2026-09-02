---
name: project_gate2_screenshot_reproducing_is_broken_test
description: "A Playwright screenshot failure that reproduces across reruns is a broken test, not transient — investigate the diff, don't --failed rerun"
metadata: 
  node_type: memory
  type: project
  originSessionId: d59c2f09-d01a-438a-91b9-7c94e01e80a8
  modified: 2026-08-17T21:05:56.940Z
---

A Gate 2 **screenshot** failure that **reproduces identically across reruns** (same test, same pixel-diff count) is a broken-test-design problem, NOT the transient flakiness family in [[project_gate2_transient_deploy_flakiness]]. Do not `gh run rerun --failed` it — it is deterministic and will keep failing.

**Why:** the transient modes (status-poll 500/503, verify-timeout, cold-AI cascade) clear on rerun. A stable pixel diff means the rendered page genuinely differs from the baseline every time. Re-running just burns CI minutes.

**How to apply:** investigate the diff instead. The `search.screenshot.spec.ts` case (fixed in #59, 2026-08-17) had two compounding defects worth checking first in any `*.screenshot.spec.ts`:
1. **The "no-results" query wasn't no-results.** `zzzz-no-results-baseline` tokenized on hyphens; keyword search matched `results`/`baseline` in article bodies → 4 hits, not the empty state. Fix: single opaque token (`zzzzqqqxvbnm`). `SearchService` routes any ≤2-whitespace-token query to Keyword-only, so a single token never touches the vector path.
2. **The empty-state guard used the wrong page's selector.** It asserted `.post-preview` count 0, but search cards render as `.article-grid-card` (via `_ArticleCard.cshtml`); `.post-preview` is the Article-List *list-mode* row class. The guard passed vacuously and the screenshot captured the rank-dependent results layout the spec meant to avoid.

Also: this test **self-skips when keyword search is down** after a deploy (`keywordSearchAvailable()` gate), so a broken screenshot spec can hide for many deploys and only surface when search is healthy — its first "failure" may be its first real run.

**Regenerating a baseline is the fix ONLY after confirming the visual change is intentional.** `update-snapshots.yml` (workflow_dispatch, scope with `-f testFilter=<spec>`) regenerates Linux baselines against Dev and commits them back to the triggering branch — its own header warns against using it as a quick fix for master failures. macOS baselines never match Linux CI, so always regen via that workflow, never locally.

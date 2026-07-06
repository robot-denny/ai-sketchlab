#!/usr/bin/env bash
# Measure how long Dev search takes to self-warm after a deploy.
#
# Context: after a Gate 2 deploy to Dev, the search indexes (Examine keyword +
# AI vector) come up COLD and hydrate GRADUALLY — /search self-warms in
# ~20-30 min with no restart or rebuild (see wait_for_search_warm.sh and
# docs/ci-failure-recipes.md → "cold AI.Search"). This script measures the
# ACTUAL warm-up duration so we can decide whether raising the gate budget is
# viable (option B) or whether cold-resilient fixtures (option C) are the answer.
#
# It is a DIAGNOSTIC, run on demand — NOT wired into CI. Run it right after a
# deploy starts (or right after a Cloud Portal restart, to observe a clean cold
# start), and leave it running. It polls the same readiness marker the gate uses
# (GET $URL/search?q=article body contains >= 1 "article-grid-card"), timestamps
# every probe, and reports the total seconds from first observed COLD to first
# observed SERVING.
#
# Usage:
#   URL=https://<dev-slug>.umbraco.io bash .github/scripts/measure_search_warmup.sh
#   # or locally, sourcing .env for URL:
#   set -a; source .env; set +a; URL="$URL" bash .github/scripts/measure_search_warmup.sh
#
# Tunables (env):
#   PROBE_INTERVAL   seconds between probes         (default 30)
#   MAX_WAIT         give up after this many seconds (default 2400 = 40 min)
set -euo pipefail

URL="${URL:?set URL to the Dev base URL, e.g. https://<slug>.umbraco.io}"
PROBE_INTERVAL="${PROBE_INTERVAL:-30}"
MAX_WAIT="${MAX_WAIT:-2400}"
PROBE_URL="${URL%/}/search?q=article"

# marker count: >0 means serving, 0 (HTTP 200 "No matches") means cold,
# empty/non-200 means transient/unreachable.
_count() {
  local body code
  code="$(curl -sk -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 20 "$PROBE_URL" || echo 000)"
  if [ "$code" != "200" ]; then echo "ERR($code)"; return; fi
  body="$(curl -sk --connect-timeout 5 --max-time 20 "$PROBE_URL" || true)"
  printf '%s' "$body" | grep -c 'article-grid-card' || true
}

echo "Measuring Dev search warm-up at $PROBE_URL"
echo "probe interval=${PROBE_INTERVAL}s  max wait=${MAX_WAIT}s"
start="$(date +%s)"
cold_seen=""
while :; do
  now="$(date +%s)"; elapsed="$(( now - start ))"
  c="$(_count)"
  ts="$(date -u +%H:%M:%SZ)"
  case "$c" in
    ERR*)      echo "[+${elapsed}s ${ts}] transient: $c" ;;
    0)         echo "[+${elapsed}s ${ts}] COLD (0 results)"; [ -z "$cold_seen" ] && cold_seen="$elapsed" ;;
    *)         echo "[+${elapsed}s ${ts}] SERVING ($c results)"
               if [ -n "$cold_seen" ]; then
                 echo "RESULT: warmed after ~$(( elapsed - cold_seen ))s from first COLD (first COLD at +${cold_seen}s, first SERVING at +${elapsed}s)."
               else
                 echo "RESULT: already SERVING at first probe (+${elapsed}s) — start earlier (right at deploy/restart) to capture the cold→warm transition."
               fi
               exit 0 ;;
  esac
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "GAVE UP: still not serving after ${MAX_WAIT}s (first COLD at +${cold_seen:-n/a}s). This would be a genuine cold-serving failure, not just slow warm-up." >&2
    exit 1
  fi
  sleep "$PROBE_INTERVAL"
done

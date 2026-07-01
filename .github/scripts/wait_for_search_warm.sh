#!/usr/bin/env bash
# Gate 2 post-deploy search readiness gate (detect + fail-fast).
#
# After Gate 2 deploys to Dev, Umbraco.AI.Search can come up COLD: its vector
# data survives the deploy but the searcher isn't *serving* yet (the vector
# query path returns near-empty results). Because AI.Search hooks the publish
# pipeline to embed each document, POST /document also misbehaves while cold —
# and playwright-against-dev creates fixtures via POST /document, so one cold
# subsystem cascades into ~9 misleading test failures. A plain home-page curl
# passes while search is still cold.
#
# This gate polls GET $URL/search?q=article for the readiness marker before
# Playwright runs:
#   - As soon as search is SERVING → exit 0 (gate open, Playwright proceeds).
#   - If still cold at TOTAL_BUDGET → fail fast with ONE clear diagnostic and
#     do NOT launch Playwright (so you get a single actionable failure instead
#     of a ~9-test POST /document cascade).
#
# IMPORTANT — this gate DETECTS and FAILS FAST; it does NOT self-heal. An
# earlier version fired a Management API `UmbAI_Search` rebuild as a self-heal
# lever; a real cold master run (2026-07-01, run 28539245107) DISPROVED it: the
# rebuild repopulates the *index* (writer side, went to 179/Healthy) but does
# NOT rehydrate the running app's *searcher* (reader/query side), so /search
# stayed cold for the full budget — and firing the rebuild correlated with
# "index was locked and could not be unlocked" errors in Dev's log. Only an app
# RESTART (Cloud Portal → Database/Environment → Restart) rehydrates the
# searcher. CI cannot restart (the Cloud CI/CD Flow API has no restart
# endpoint), so the rebuild was removed and this gate is detect-only. See the
# CI Failure Recipes runbook for the full playbook. Revisit on the v18 upgrade:
# the Umbraco.Cms.Search / AI.Search stack is still beta and its behavior (and
# this readiness marker) should be re-verified on the new version.
#
# Readiness marker = search actually SERVING, not any 200: ready iff
# GET $URL/search?q=article body contains >= 1 "article-grid-card". The empty
# "No matches" state means still cold.
#
# Inputs (env):
#   URL              Dev base URL (e.g. https://<slug>.umbraco.io)
# Tunables (env):
#   PROBE_INTERVAL   seconds between probes                       (default 10)
#   TOTAL_BUDGET     hard ceiling before failing fast, seconds    (default 180)
#     Kept short on purpose: a genuinely cold deploy does NOT self-warm (observed
#     cold for 20+ min until a Portal restart), so waiting longer only delays an
#     inevitable fail. The budget just covers a deploy that came up warm or warms
#     quickly, plus riding out brief transients.
#
# Testability: the two effects (the /search probe and the sleep) are isolated
# behind overridable shell functions (_probe_search / _sleep). The local harness
# (test-wait-for-search-warm.sh) sources this file with WARMUP_SOURCED=1 (so
# main() does not auto-run), replaces those functions with canned stubs, and
# drives every decision path with NO real network.
#
# Exit codes: 0 = search serving (gate open). Non-zero = never warmed (gate
# closed; the caller must not run Playwright).

set -u
set -o pipefail  # surface failures in the grep/sed status-parsing pipe
# NB: deliberately NOT `set -e` — the `|| { ...; return 0; }` transient-error
# handler below is load-bearing and would become dead code under `set -e`.

# --- Tunables --------------------------------------------------------------
PROBE_INTERVAL="${PROBE_INTERVAL:-10}"
TOTAL_BUDGET="${TOTAL_BUDGET:-180}"

# Readiness marker in the /search HTML.
READY_MARKER="article-grid-card"

# Elapsed-seconds counter. Driven by _sleep so the same code path works for a
# real run (wall clock via actual sleeps) and for the harness (no-op sleeps that
# still advance elapsed by PROBE_INTERVAL, keeping the loop deterministic and
# fast). Not derived from `date` so tests need no real clock.
ELAPSED=0

# --- Overridable seams ------------------------------------------------------
# Each is replaced by a canned stub in the test harness. A real run performs the
# actual curl call below.

# _sleep <seconds>: sleep and advance the elapsed counter. Overridden to a no-op
# (that still advances ELAPSED) in tests.
_sleep() {
  sleep "$1"
}

# _probe_search: echo a readiness token for GET $URL/search?q=article.
#   "READY"  -> body contains the readiness marker (search is serving)
#   anything else (e.g. "COLD", "TRANSIENT_503") -> keep polling
_probe_search() {
  local body http
  # -s silent, -w to capture status; tolerate connection errors (curl exit != 0)
  # by treating them as transient (keep polling).
  # --connect-timeout/--max-time cap a hung connection on a cold/restarting Dev:
  # without them a stalled TCP read blocks the loop for the OS default (~2 min)
  # without advancing ELAPSED, silently eating the budget.
  body="$(curl -s --connect-timeout 5 --max-time 15 -w $'\n%{http_code}' "${URL%/}/search?q=article" 2>/dev/null)" || {
    echo "TRANSIENT_ERR"
    return 0
  }
  http="$(printf '%s' "$body" | tail -n1)"
  body="$(printf '%s' "$body" | sed '$d')"
  if [ "$http" = "200" ] && printf '%s' "$body" | grep -qF "$READY_MARKER"; then
    echo "READY"
  elif [ "$http" = "500" ] || [ "$http" = "503" ] || [ "$http" = "502" ] || [ "$http" = "504" ]; then
    echo "TRANSIENT_${http}"
  else
    echo "COLD"
  fi
}

# --- Main loop --------------------------------------------------------------
main() {
  # Fail fast with a clear message (not a bare `unbound variable` from `set -u`)
  # if the required input is missing.
  : "${URL:?URL must be set to the Dev base URL (e.g. https://<slug>.umbraco.io)}"

  echo "Waiting for Dev search to serve at ${URL%/}/search?q=article"
  echo "  probe interval=${PROBE_INTERVAL}s  total budget=${TOTAL_BUDGET}s"

  while [ "$ELAPSED" -lt "$TOTAL_BUDGET" ]; do
    local marker
    marker="$(_probe_search)"

    if [ "$marker" = "READY" ]; then
      echo "Dev search is serving at ${ELAPSED}s. Gate open — proceeding to Playwright."
      return 0
    fi

    echo "  [${ELAPSED}s] search not ready (${marker}); continuing to poll."

    _sleep "$PROBE_INTERVAL"
    ELAPSED=$((ELAPSED + PROBE_INTERVAL))
  done

  echo "Dev search did not come up serving within ${TOTAL_BUDGET}s. Cold Umbraco.AI.Search makes every POST /document (Playwright fixture creation) misbehave — NOT launching Playwright (this is a single fail-fast, not a ~9-test cascade)." >&2
  echo "FIX: restart the Dev environment from the Cloud Portal (this rehydrates the searcher), confirm ${URL%/}/search?q=article returns results, then re-run the failed job: gh run rerun <run-id> --failed. A UmbAI_Search index rebuild does NOT fix this (it repopulates the index but not the running searcher). See docs/ci-failure-recipes.md." >&2
  return 1
}

# Only auto-run when executed directly, so the test harness can source the file,
# override the seams, and invoke main() itself.
if [ "${WARMUP_SOURCED:-}" != "1" ] && [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  main "$@"
  exit $?
fi

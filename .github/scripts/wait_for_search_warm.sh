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
# IMPORTANT — this gate DETECTS and FAILS FAST; it does NOT self-heal. The TRUE
# root cause (confirmed 2026-07-06, superseding two earlier wrong theories):
# after a Cloud deploy the *Examine keyword* index `Umb_PublishedContent` comes
# up CORRUPTED (beta.9 Provider.Examine fragility — "index was locked and could
# not be unlocked"). The public /search is hybrid — SHORT queries run the keyword
# index, LONG natural-language queries run the AI vector index `UmbAI_Search`.
# `UmbAI_Search` stays HEALTHY across deploys, so semantic search works; only the
# corrupted keyword index returns 0. This gate probes `q=article` (a SHORT query),
# so it reads "cold" whenever the keyword index is corrupt.
#
# Two things this disproves:
#   - The old `UmbAI_Search` rebuild "self-heal" targeted the WRONG index
#     (UmbAI_Search is Healthy). Removed. It never was the problem.
#   - "It self-warms, just wait" was ALSO wrong (a confounded 2026-07-02 reading):
#     a clean 2026-07-06 deploy sat cold for 90+ min untouched, and the dashboard
#     "Rebuild" on Umb_PublishedContent FAILS (goes Corrupted -> Empty + "A fatal
#     server error occurred"). Waiting does not reliably fix it.
#
# For the keyword index itself, the fix is a RESTART of Dev from the Cloud Portal
# (on boot the app rebuilds the Examine indexes cleanly; verified 2026-07-06:
# post-restart q=article went 0 -> 10). The dashboard "Rebuild" on
# Umb_PublishedContent FAILS (fatal error), and it does not reliably self-recover.
#
# GATE BEHAVIOR (as of 2026-07-06): to stop failing on every merge over the
# routine keyword-index corruption, this gate now probes a LONG/SEMANTIC query
# ($PROBE_QUERY) that routes to the Healthy UmbAI_Search vector index — NOT the
# fragile keyword index. Keyword search is still checked once (q=$KEYWORD_PROBE_
# QUERY) but only LOGGED as a non-gating WARNING, so a corrupt Examine index no
# longer blocks CI (the site's semantic search still works; short-query search is
# broken until a restart). A gate FAILURE now therefore means SEMANTIC search is
# down (UmbAI_Search unhealthy, query-time embeddings failing, or a broken
# deploy) — a worse, rarer condition than the keyword corruption. Revisit on the
# v18 upgrade — a stable `Provider.Examine` should end the keyword corruption
# entirely (pinned at beta.9 only because no stable exists).
#
# Readiness marker = search actually SERVING, not any 200: ready iff
# GET $URL/search?q=$PROBE_QUERY body contains >= 1 "article-grid-card". The empty
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

# The GATING probe is a LONG, natural-language query ON PURPOSE: it routes to the
# AI vector index (UmbAI_Search), which stays Healthy across deploys — NOT the
# Examine keyword index (Umb_PublishedContent), which comes up corrupt after a
# Cloud deploy and used to fail this gate on every merge (see header). Keep it a
# real multi-word question so the site's hybrid search picks the semantic path.
PROBE_QUERY="${PROBE_QUERY:-what can AI teach us about ethics and humanity}"

# A SHORT keyword query, checked ONCE when the gate opens, purely to LOG whether
# keyword search is up. Non-gating: a corrupt keyword index no longer blocks CI,
# it just prints a WARNING so the (known, restart-fixable) condition is visible.
KEYWORD_PROBE_QUERY="${KEYWORD_PROBE_QUERY:-article}"

# Readiness marker in the /search HTML (same result-card class for keyword + semantic).
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

# _probe_search: echo a readiness token for the SEMANTIC probe
# (GET $URL/search with q=$PROBE_QUERY, a long natural-language query).
#   "READY"  -> body contains the readiness marker (semantic search is serving)
#   anything else (e.g. "COLD", "TRANSIENT_503") -> keep polling
# The whole function is a test seam: the harness replaces it wholesale, so the
# real curls here (including the keyword health check) never run under test.
_probe_search() {
  local body http
  # -s silent, -w to capture status; tolerate connection errors (curl exit != 0)
  # by treating them as transient (keep polling).
  # --connect-timeout/--max-time cap a hung connection on a cold/restarting Dev:
  # without them a stalled TCP read blocks the loop for the OS default (~2 min)
  # without advancing ELAPSED, silently eating the budget.
  # -G --data-urlencode encodes the multi-word query safely.
  body="$(curl -s --connect-timeout 5 --max-time 15 -w $'\n%{http_code}' -G --data-urlencode "q=${PROBE_QUERY}" "${URL%/}/search" 2>/dev/null)" || {
    echo "TRANSIENT_ERR"
    return 0
  }
  http="$(printf '%s' "$body" | tail -n1)"
  body="$(printf '%s' "$body" | sed '$d')"
  if [ "$http" = "200" ] && printf '%s' "$body" | grep -qF "$READY_MARKER"; then
    # Semantic path serving → gate opens. Do a ONE-SHOT, non-gating keyword health
    # check so a corrupt Examine index is visible in the log without blocking CI.
    local kbody khttp
    kbody="$(curl -s --connect-timeout 5 --max-time 15 -w $'\n%{http_code}' -G --data-urlencode "q=${KEYWORD_PROBE_QUERY}" "${URL%/}/search" 2>/dev/null)" || kbody=""
    khttp="$(printf '%s' "$kbody" | tail -n1)"
    kbody="$(printf '%s' "$kbody" | sed '$d')"
    if [ "$khttp" = "200" ] && printf '%s' "$kbody" | grep -qF "$READY_MARKER"; then
      echo "  keyword search OK (q='${KEYWORD_PROBE_QUERY}' serving)." >&2
    else
      echo "  WARNING: keyword search is DOWN (q='${KEYWORD_PROBE_QUERY}' -> no results; Examine 'Umb_PublishedContent' likely corrupt after the deploy). Semantic search serves, so the gate opens and Playwright runs — but short-query search on Dev is broken until a Portal restart. Non-gating by design; see docs/ci-failure-recipes.md." >&2
    fi
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

  echo "Waiting for Dev SEMANTIC search to serve at ${URL%/}/search (q='${PROBE_QUERY}')"
  echo "  probe interval=${PROBE_INTERVAL}s  total budget=${TOTAL_BUDGET}s"
  echo "  (probing the AI vector path, which stays healthy across deploys; keyword health is logged, non-gating)"

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

  echo "Dev SEMANTIC search did not serve (did not come up serving) within ${TOTAL_BUDGET}s (probe q='${PROBE_QUERY}'). This gate probes the AI vector path (UmbAI_Search), which normally stays HEALTHY across deploys — so a failure here is WORSE than the routine post-deploy Examine keyword corruption: e.g. UmbAI_Search itself is down, query-time embeddings are failing (check OPENAI__APIKEY / the AI config-key allow-list), or the deploy is genuinely broken. NOT launching Playwright (single fail-fast, not a ~9-test cascade)." >&2
  echo "FIX: check Dev's log and Settings -> Search — is UmbAI_Search Healthy? are embeddings erroring? A Portal restart of the Dev environment may clear it; confirm ${URL%/}/search returns results for a natural-language query, then: gh run rerun <run-id> --failed. (Routine keyword-index corruption no longer fails this gate — it is logged as a non-gating WARNING above.) See docs/ci-failure-recipes.md." >&2
  return 1
}

# Only auto-run when executed directly, so the test harness can source the file,
# override the seams, and invoke main() itself.
if [ "${WARMUP_SOURCED:-}" != "1" ] && [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  main "$@"
  exit $?
fi

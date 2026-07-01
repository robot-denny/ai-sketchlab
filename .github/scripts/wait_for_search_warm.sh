#!/usr/bin/env bash
# Gate 2 post-deploy search warm-up gate.
#
# After Gate 2 deploys to Dev, Umbraco.AI.Search can come up COLD: its vector
# data survives the deploy but the searcher isn't *serving* yet. Because
# AI.Search hooks the publish pipeline to embed each document, every
# POST /document then throws 500 while cold — and playwright-against-dev creates
# fixtures via POST /document, so one cold subsystem cascades into ~9 misleading
# test failures. A plain home-page curl passes while search is still cold.
#
# This gate replaces the human "Portal restart + gh run rerun" ritual with an
# automated warm-up:
#   (1) Poll GET $URL/search?q=article for the readiness marker.
#   (2) If still cold after INITIAL_POLL_BUDGET, fire ONE UmbAI_Search rebuild
#       via the Management API (self-heal lever CI can reach — the Cloud CI/CD
#       Flow API has no restart endpoint).
#   (3) Keep polling to TOTAL_BUDGET.
#   (4) If still cold at TOTAL_BUDGET, fail fast with ONE clear diagnostic and
#       do NOT launch Playwright.
#
# Readiness marker = search actually SERVING, not any 200: ready iff
# GET $URL/search?q=article body contains >= 1 "article-grid-card". The empty
# "No matches" state means still cold.
#
# Inputs (env):
#   URL                    Dev base URL (e.g. https://<slug>.umbraco.io)
#   UMBRACO_CLIENT_ID      Dev Management API OAuth client id
#   UMBRACO_CLIENT_SECRET  Dev Management API OAuth client secret
# Tunables (env, defaults pinned by the Step 1 spike):
#   PROBE_INTERVAL         seconds between probes            (default 10)
#   INITIAL_POLL_BUDGET    passive grace before rebuild      (default 60)
#   TOTAL_BUDGET           hard ceiling before failing       (default 600)
#
# Testability: the three HTTP calls are isolated behind overridable shell
# functions (_probe_search / _get_token / _rebuild_index) plus a _sleep seam.
# The local harness (test-wait-for-search-warm.sh) sources this file with
# WARMUP_SOURCED=1 (so main() does not auto-run), replaces those functions with
# canned stubs, and drives every decision path with NO real network.
#
# Exit codes: 0 = search serving (gate open). Non-zero = never warmed (gate
# closed; the caller must not run Playwright).

set -u
set -o pipefail  # surface failures in the grep/sed token- and status-parsing pipes
# NB: deliberately NOT `set -e` — the `|| { ...; return 0; }` transient-error
# handlers below are load-bearing and would become dead code under `set -e`.

# --- Tunables (Step 1 pinned defaults) -------------------------------------
PROBE_INTERVAL="${PROBE_INTERVAL:-10}"
INITIAL_POLL_BUDGET="${INITIAL_POLL_BUDGET:-60}"
TOTAL_BUDGET="${TOTAL_BUDGET:-600}"

# Readiness marker in the /search HTML.
READY_MARKER="article-grid-card"
# Search index actuated by the rebuild.
INDEX_ALIAS="UmbAI_Search"

# Elapsed-seconds counter. Driven by _sleep so the same code path works for a
# real run (wall clock via actual sleeps) and for the harness (no-op sleeps that
# still advance elapsed by PROBE_INTERVAL, keeping the loop deterministic and
# fast). Not derived from `date` so tests need no real clock.
ELAPSED=0

# --- Overridable seams ------------------------------------------------------
# Each is replaced by a canned stub in the test harness. A real run performs the
# actual curl / OAuth calls below.

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

# _get_token: echo a fresh Management API bearer token (client-credentials).
# Fetched immediately before the rebuild — the token's 300s lifetime is shorter
# than TOTAL_BUDGET, so it must not be reused from the start of the wait.
_get_token() {
  local resp token restore_x=""
  # Suppress xtrace around the secret expansion so the client secret can't leak
  # into a `bash -x` / ACTIONS_STEP_DEBUG trace (defense-in-depth on top of
  # GitHub's own secret masking). Restore xtrace afterwards only if it was on.
  case "$-" in *x*) restore_x=1 ;; esac
  { set +x; } 2>/dev/null
  resp="$(curl -s --connect-timeout 5 --max-time 20 -X POST "${URL%/}/umbraco/management/api/v1/security/back-office/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=client_credentials" \
    --data-urlencode "client_id=${UMBRACO_CLIENT_ID}" \
    --data-urlencode "client_secret=${UMBRACO_CLIENT_SECRET}" 2>/dev/null)" || {
      [ -n "$restore_x" ] && set -x
      return 1
    }
  [ -n "$restore_x" ] && set -x
  token="$(printf '%s' "$resp" | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"//; s/"$//')"
  # A non-200 body (401/503/HTML error page) parses to an empty token; return
  # non-zero so the caller treats it as a failure, not a silent empty success.
  if [ -z "$token" ]; then
    echo "WARN: no access_token in the token response (non-200 or malformed)." >&2
    return 1
  fi
  printf '%s' "$token"
}

# _rebuild_index: fire the asynchronous UmbAI_Search rebuild once. Returns
# non-zero only if the token could not be obtained; the PUT itself returns 200
# immediately (empty body) and rebuilds in the background — never treated as
# "done".
_rebuild_index() {
  local token http
  if ! token="$(_get_token)" || [ -z "$token" ]; then
    echo "WARN: could not obtain a Management API token — skipping rebuild PUT." >&2
    return 1
  fi
  # The PUT returns 200 immediately (empty body, async rebuild). Capture the
  # status so a 401/403 (bad token / missing scope) or 404 (wrong endpoint) is
  # reported rather than silently logged as a successful fire.
  http="$(curl -s --connect-timeout 5 --max-time 20 -o /dev/null -w '%{http_code}' -X PUT \
    "${URL%/}/umbraco/search/api/v1/rebuild?indexAlias=${INDEX_ALIAS}" \
    -H "Authorization: Bearer ${token}" 2>/dev/null)" || {
      echo "WARN: rebuild PUT could not be sent (connection error/timeout)." >&2
      return 1
    }
  if [ "$http" != "200" ]; then
    echo "WARN: rebuild PUT returned HTTP ${http} — rebuild may not have fired." >&2
    return 1
  fi
  return 0
}

# --- Main loop --------------------------------------------------------------
main() {
  # Fail fast with a clear message (not a bare `unbound variable` from `set -u`)
  # if a required input is missing. Credentials are only used at escalation, so
  # without this guard a missing secret would surface opaquely ~60s in.
  : "${URL:?URL must be set to the Dev base URL (e.g. https://<slug>.umbraco.io)}"
  : "${UMBRACO_CLIENT_ID:?UMBRACO_CLIENT_ID must be set (Dev Management API OAuth client)}"
  : "${UMBRACO_CLIENT_SECRET:?UMBRACO_CLIENT_SECRET must be set (Dev Management API OAuth secret)}"

  echo "Waiting for Dev search to warm up at ${URL%/}/search?q=article"
  echo "  probe interval=${PROBE_INTERVAL}s  grace=${INITIAL_POLL_BUDGET}s  total budget=${TOTAL_BUDGET}s"

  local rebuild_fired=0

  while [ "$ELAPSED" -lt "$TOTAL_BUDGET" ]; do
    local marker
    marker="$(_probe_search)"

    if [ "$marker" = "READY" ]; then
      if [ "$rebuild_fired" -eq 1 ]; then
        echo "Dev search is now serving (warmed after rebuild escalation) at ${ELAPSED}s. Gate open."
      else
        echo "Dev search is serving at ${ELAPSED}s (no rebuild needed). Gate open."
      fi
      return 0
    fi

    echo "  [${ELAPSED}s] search not ready (${marker}); continuing to poll."

    # Escalate once: grace elapsed and still cold and haven't rebuilt yet.
    if [ "$rebuild_fired" -eq 0 ] && [ "$ELAPSED" -ge "$INITIAL_POLL_BUDGET" ]; then
      echo ">>> ESCALATION: search still cold after ${INITIAL_POLL_BUDGET}s grace — firing a one-time ${INDEX_ALIAS} rebuild via the Management API."
      if _rebuild_index; then
        echo ">>> Rebuild request sent (asynchronous). Continuing to poll for serving readiness."
      else
        echo ">>> Rebuild request could not be sent; continuing to poll in case search warms on its own." >&2
      fi
      rebuild_fired=1
    fi

    _sleep "$PROBE_INTERVAL"
    ELAPSED=$((ELAPSED + PROBE_INTERVAL))
  done

  echo "Dev search subsystem did not warm up within ${TOTAL_BUDGET}s (rebuild fired=${rebuild_fired}). Cold Umbraco.AI.Search would make every POST /document (Playwright fixture creation) return 500 — not launching Playwright. Check Dev's ${INDEX_ALIAS} index / restart Dev from the Cloud Portal, then re-run." >&2
  return 1
}

# Only auto-run when executed directly, so the test harness can source the file,
# override the seams, and invoke main() itself.
if [ "${WARMUP_SOURCED:-}" != "1" ] && [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  main "$@"
  exit $?
fi

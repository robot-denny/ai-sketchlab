#!/usr/bin/env bash
# Smoke validation for the Gate 2 search warm-up gate (wait_for_search_warm.sh).
#
# One-time validation artifact — committed but NOT wired into CI.
# Mirrors the style of .githooks/test-pre-push.sh (per-case PASS/FAIL, exit 0
# only when every case passes).
#
# It drives wait_for_search_warm.sh with NO real network by overriding the
# script's HTTP seams (_probe_search / _get_token / _rebuild_index) with canned
# stubs, and asserts each decision path:
#   1. warm on first probe          → exit 0, rebuild NOT fired
#   2. cold < sub-budget then warm  → exit 0, rebuild NOT fired
#   3. cold past sub-budget, warm   → exit 0, rebuild fired ONCE (after escalation)
#      after rebuild
#   4. single transient 503 mid-poll → retried, not fatal (exit 0)
#   5. cold the whole total budget  → non-zero exit, "did not warm up",
#      rebuild attempted
#
# Usage:
#   bash .github/scripts/test-wait-for-search-warm.sh
#
# Exits 0 if all cases pass; non-zero on any failure.

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "FAIL: must be run inside the repo." >&2
  exit 1
fi

SCRIPT="$REPO_ROOT/.github/scripts/wait_for_search_warm.sh"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "  PASS: $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "  FAIL: $1" >&2
}

echo ""
echo "=== Search warm-up gate smoke validation ==="
echo ""

# Case (a): the script exists and is executable.
echo "[a] Script file exists and is executable"
if [ -f "$SCRIPT" ] && [ -x "$SCRIPT" ]; then
  pass "$SCRIPT is executable"
else
  fail "$SCRIPT is missing or not executable"
  echo ""
  echo "Aborting — remaining assertions require the script to be runnable."
  exit 1
fi

# Shared temp workspace for the canned stubs' state files.
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# run_case <name> <stub-preamble-file> — sources the script into a subshell
# harness that first defines the canned stubs, then invokes the script's main
# entry (main "$@"). WARMUP_SOURCED=1 tells the script NOT to auto-run its main
# loop on source, so the harness controls invocation after installing stubs.
#
# Each case writes a small preamble script (the stubs) to $WORK/preamble.sh.
# The counters/probe-state live in files under $WORK so stubs (which run in
# subshells for command substitution) can share state.

# Tiny budgets so the whole harness runs in ~seconds.
export URL="https://dev.example.test"
export UMBRACO_CLIENT_ID="test-client"
export UMBRACO_CLIENT_SECRET="test-secret"
export PROBE_INTERVAL=1
export INITIAL_POLL_BUDGET=2
export TOTAL_BUDGET=6
# Neutralize real sleeps: the script calls _sleep, overridable to a no-op.
export WARMUP_SOURCED=1

# Helper that runs the script with a given set of stub definitions.
# Args: $1 = path to a file containing stub function definitions.
run_with_stubs() {
  local stubs="$1"
  (
    # shellcheck disable=SC1090
    source "$SCRIPT"
    # shellcheck disable=SC1090
    source "$stubs"
    # Make the wait fast: no real sleeping.
    _sleep() { :; }
    main
  )
}

# ---------------------------------------------------------------------------
# Case 1: warm on first probe → exit 0, rebuild NOT fired.
# ---------------------------------------------------------------------------
echo ""
echo "[1] Warm on first probe → exit 0, no rebuild"
: > "$WORK/rebuild_count"
cat > "$WORK/stubs1.sh" <<EOF
_probe_search() { echo "READY"; }
_get_token() { echo "tok"; }
_rebuild_index() { echo x >> "$WORK/rebuild_count"; }
EOF
OUT1="$(run_with_stubs "$WORK/stubs1.sh" 2>&1)"
EXIT1=$?
RB1=$(wc -l < "$WORK/rebuild_count" | tr -d ' ')
if [ "$EXIT1" -eq 0 ] && [ "$RB1" -eq 0 ]; then
  pass "exit 0, rebuild not fired"
else
  fail "expected exit 0 + 0 rebuilds, got exit=$EXIT1 rebuilds=$RB1"
  echo "$OUT1" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# Case 2: cold for < sub-budget (a couple probes) then warm → exit 0, no rebuild.
# INITIAL_POLL_BUDGET=2, PROBE_INTERVAL=1 → escalation happens once elapsed >= 2s.
# We make it warm on the 2nd probe (before the 2s grace elapses in probe-count
# terms). _sleep is overridden to a no-op, but the script still runs
# `ELAPSED=$((ELAPSED + PROBE_INTERVAL))` after every _sleep, so the elapsed
# counter advances at probe-count speed rather than wall-clock speed.
# ---------------------------------------------------------------------------
echo ""
echo "[2] Cold briefly then warm before grace → exit 0, no rebuild"
: > "$WORK/rebuild_count"
: > "$WORK/probe_n"
cat > "$WORK/stubs2.sh" <<EOF
_probe_search() {
  echo x >> "$WORK/probe_n"
  n=\$(wc -l < "$WORK/probe_n" | tr -d ' ')
  if [ "\$n" -ge 2 ]; then echo "READY"; else echo "COLD"; fi
}
_get_token() { echo "tok"; }
_rebuild_index() { echo x >> "$WORK/rebuild_count"; }
EOF
OUT2="$(run_with_stubs "$WORK/stubs2.sh" 2>&1)"
EXIT2=$?
RB2=$(wc -l < "$WORK/rebuild_count" | tr -d ' ')
if [ "$EXIT2" -eq 0 ] && [ "$RB2" -eq 0 ]; then
  pass "exit 0, rebuild not fired (warmed within grace)"
else
  fail "expected exit 0 + 0 rebuilds, got exit=$EXIT2 rebuilds=$RB2"
  echo "$OUT2" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# Case 3: cold past sub-budget then warm after rebuild → exit 0, rebuild ONCE.
# Stay cold until the rebuild has fired, then go warm.
# ---------------------------------------------------------------------------
echo ""
echo "[3] Cold past grace, warm after rebuild → exit 0, rebuild fired once"
: > "$WORK/rebuild_count"
cat > "$WORK/stubs3.sh" <<EOF
_probe_search() {
  c=\$(wc -l < "$WORK/rebuild_count" | tr -d ' ')
  if [ "\$c" -ge 1 ]; then echo "READY"; else echo "COLD"; fi
}
_get_token() { echo "tok"; }
_rebuild_index() { echo x >> "$WORK/rebuild_count"; }
EOF
OUT3="$(run_with_stubs "$WORK/stubs3.sh" 2>&1)"
EXIT3=$?
RB3=$(wc -l < "$WORK/rebuild_count" | tr -d ' ')
if [ "$EXIT3" -eq 0 ] && [ "$RB3" -eq 1 ]; then
  pass "exit 0, rebuild fired exactly once"
else
  fail "expected exit 0 + exactly 1 rebuild, got exit=$EXIT3 rebuilds=$RB3"
  echo "$OUT3" | sed 's/^/      /'
fi
if echo "$OUT3" | grep -qi "rebuild"; then
  pass "escalation logged a rebuild line"
else
  fail "no rebuild escalation line in output"
  echo "$OUT3" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# Case 4: single transient 503 on the first probe → retried, then warm. Exit 0.
# The script's readiness check treats a non-"READY" transient marker as "keep
# polling", not fatal.
# ---------------------------------------------------------------------------
echo ""
echo "[4] Transient 503 mid-poll → retried, not fatal"
: > "$WORK/rebuild_count"
: > "$WORK/probe_n"
cat > "$WORK/stubs4.sh" <<EOF
_probe_search() {
  echo x >> "$WORK/probe_n"
  n=\$(wc -l < "$WORK/probe_n" | tr -d ' ')
  if [ "\$n" -eq 1 ]; then echo "TRANSIENT_503"; else echo "READY"; fi
}
_get_token() { echo "tok"; }
_rebuild_index() { echo x >> "$WORK/rebuild_count"; }
EOF
OUT4="$(run_with_stubs "$WORK/stubs4.sh" 2>&1)"
EXIT4=$?
RB4=$(wc -l < "$WORK/rebuild_count" | tr -d ' ')
if [ "$EXIT4" -eq 0 ] && [ "$RB4" -eq 0 ]; then
  pass "exit 0 after transient retry, rebuild not fired"
else
  fail "expected exit 0 + 0 rebuilds, got exit=$EXIT4 rebuilds=$RB4"
  echo "$OUT4" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# Case 5: cold the whole total budget → non-zero exit, diagnostic, rebuild tried.
# ---------------------------------------------------------------------------
echo ""
echo "[5] Cold for the whole budget → non-zero exit + diagnostic + rebuild attempted"
: > "$WORK/rebuild_count"
cat > "$WORK/stubs5.sh" <<EOF
_probe_search() { echo "COLD"; }
_get_token() { echo "tok"; }
_rebuild_index() { echo x >> "$WORK/rebuild_count"; }
EOF
OUT5="$(run_with_stubs "$WORK/stubs5.sh" 2>&1)"
EXIT5=$?
RB5=$(wc -l < "$WORK/rebuild_count" | tr -d ' ')
if [ "$EXIT5" -ne 0 ]; then
  pass "non-zero exit ($EXIT5) on exhausted budget"
else
  fail "expected non-zero exit, got $EXIT5"
  echo "$OUT5" | sed 's/^/      /'
fi
if echo "$OUT5" | grep -qi "did not warm up"; then
  pass "diagnostic contains 'did not warm up'"
else
  fail "missing 'did not warm up' diagnostic"
  echo "$OUT5" | sed 's/^/      /'
fi
if [ "$RB5" -ge 1 ]; then
  pass "rebuild was attempted before giving up"
else
  fail "rebuild was never attempted (expected >= 1)"
  echo "$OUT5" | sed 's/^/      /'
fi

echo ""
echo "=== Result: $PASS_COUNT passed, $FAIL_COUNT failed ==="
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0

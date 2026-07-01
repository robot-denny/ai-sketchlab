#!/usr/bin/env bash
# Smoke validation for the Gate 2 search readiness gate (wait_for_search_warm.sh).
#
# One-time validation artifact — committed but NOT wired into CI.
# Mirrors the style of .githooks/test-pre-push.sh (per-case PASS/FAIL, exit 0
# only when every case passes).
#
# It drives wait_for_search_warm.sh with NO real network by overriding the
# script's seams (_probe_search / _sleep) with canned stubs, and asserts each
# decision path of the detect-and-fail-fast gate:
#   1. serving on first probe        → exit 0
#   2. cold briefly then serving     → exit 0
#   3. single transient 503 mid-poll → retried, not fatal (exit 0)
#   4. cold the whole budget         → non-zero exit + fail-fast diagnostic
#
# (There is no rebuild/escalation path any more: a real cold master run proved a
# rebuild does not rehydrate the running searcher, so the gate is detect-only —
# see the script header and docs/ci-failure-recipes.md.)
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
echo "=== Search readiness gate smoke validation ==="
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

# Each case writes a small preamble script (the stubs) under $WORK. The
# probe-state lives in files under $WORK so stubs (which run in subshells for
# command substitution) can share state across probes.

# Tiny budgets so the whole harness runs in ~seconds.
export URL="https://dev.example.test"
export PROBE_INTERVAL=1
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
# Case 1: serving on first probe → exit 0.
# ---------------------------------------------------------------------------
echo ""
echo "[1] Serving on first probe → exit 0"
cat > "$WORK/stubs1.sh" <<EOF
_probe_search() { echo "READY"; }
EOF
OUT1="$(run_with_stubs "$WORK/stubs1.sh" 2>&1)"
EXIT1=$?
if [ "$EXIT1" -eq 0 ]; then
  pass "exit 0 (gate open)"
else
  fail "expected exit 0, got exit=$EXIT1"
  echo "$OUT1" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# Case 2: cold for a couple probes then serving → exit 0.
# _sleep is a no-op, but the script still runs `ELAPSED=$((ELAPSED +
# PROBE_INTERVAL))` after every _sleep, so the counter advances at probe-count
# speed and the budget is reached deterministically.
# ---------------------------------------------------------------------------
echo ""
echo "[2] Cold briefly then serving → exit 0"
: > "$WORK/probe_n"
cat > "$WORK/stubs2.sh" <<EOF
_probe_search() {
  echo x >> "$WORK/probe_n"
  n=\$(wc -l < "$WORK/probe_n" | tr -d ' ')
  if [ "\$n" -ge 3 ]; then echo "READY"; else echo "COLD"; fi
}
EOF
OUT2="$(run_with_stubs "$WORK/stubs2.sh" 2>&1)"
EXIT2=$?
if [ "$EXIT2" -eq 0 ]; then
  pass "exit 0 after warming mid-budget"
else
  fail "expected exit 0, got exit=$EXIT2"
  echo "$OUT2" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# Case 3: single transient 503 on the first probe → retried, then serving.
# The readiness check treats a non-"READY" transient marker as "keep polling",
# not fatal.
# ---------------------------------------------------------------------------
echo ""
echo "[3] Transient 503 mid-poll → retried, not fatal"
: > "$WORK/probe_n"
cat > "$WORK/stubs3.sh" <<EOF
_probe_search() {
  echo x >> "$WORK/probe_n"
  n=\$(wc -l < "$WORK/probe_n" | tr -d ' ')
  if [ "\$n" -eq 1 ]; then echo "TRANSIENT_503"; else echo "READY"; fi
}
EOF
OUT3="$(run_with_stubs "$WORK/stubs3.sh" 2>&1)"
EXIT3=$?
if [ "$EXIT3" -eq 0 ]; then
  pass "exit 0 after transient retry"
else
  fail "expected exit 0, got exit=$EXIT3"
  echo "$OUT3" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# Case 4: cold the whole budget → non-zero exit + fail-fast diagnostic.
# ---------------------------------------------------------------------------
echo ""
echo "[4] Cold for the whole budget → non-zero exit + fail-fast diagnostic"
cat > "$WORK/stubs4.sh" <<EOF
_probe_search() { echo "COLD"; }
EOF
OUT4="$(run_with_stubs "$WORK/stubs4.sh" 2>&1)"
EXIT4=$?
if [ "$EXIT4" -ne 0 ]; then
  pass "non-zero exit ($EXIT4) on exhausted budget"
else
  fail "expected non-zero exit, got $EXIT4"
  echo "$OUT4" | sed 's/^/      /'
fi
if echo "$OUT4" | grep -qi "did not come up serving"; then
  pass "diagnostic contains 'did not come up serving'"
else
  fail "missing fail-fast diagnostic"
  echo "$OUT4" | sed 's/^/      /'
fi
if echo "$OUT4" | grep -qi "restart the Dev environment"; then
  pass "diagnostic points to the Portal-restart fix"
else
  fail "diagnostic does not mention the restart fix"
  echo "$OUT4" | sed 's/^/      /'
fi

echo ""
echo "=== Result: $PASS_COUNT passed, $FAIL_COUNT failed ==="
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0

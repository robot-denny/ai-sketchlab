#!/bin/sh
# Smoke validation for the pre-push hook.
#
# One-time validation artifact — committed but NOT wired into CI.
# Run it after editing .githooks/pre-push to confirm:
#   (a) the hook exists and is executable,
#   (b) on success it prints "build:" and "test:" timing tokens,
#   (c) SKIP_PREPUSH=1 short-circuits with exit 0 and a skip notice,
#   (d) when a test fails, the hook exits non-zero and surfaces the failing
#       test name.
#
# Usage:
#   ./.githooks/test-pre-push.sh
#
# Exits 0 if all four assertions pass; non-zero on the first failure.

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "FAIL: must be run inside the repo." >&2
  exit 1
fi

HOOK="$REPO_ROOT/.githooks/pre-push"
SMOKE_TEST_FILE="$REPO_ROOT/tests/UmbracoProject.Tests/SmokeTests.cs"

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
echo "=== Pre-push hook smoke validation ==="
echo ""

# Assertion (a): hook file exists and is executable.
echo "[a] Hook file exists and is executable"
if [ -f "$HOOK" ] && [ -x "$HOOK" ]; then
  pass "$HOOK is executable"
else
  fail "$HOOK is missing or not executable"
  echo ""
  echo "Aborting — remaining assertions require the hook to be runnable."
  exit 1
fi

# Assertion (c) runs before (b) because it's the cheapest — skip path exits early.
echo ""
echo "[c] SKIP_PREPUSH=1 short-circuits with exit 0 + skip notice"
SKIP_OUT=$(SKIP_PREPUSH=1 "$HOOK" 2>&1 < /dev/null)
SKIP_EXIT=$?
if [ "$SKIP_EXIT" -eq 0 ]; then
  if echo "$SKIP_OUT" | grep -qi "skip"; then
    pass "exit 0 with skip notice"
  else
    fail "exit 0 but no skip notice in output:"
    echo "$SKIP_OUT" | sed 's/^/      /'
  fi
else
  fail "expected exit 0 with SKIP_PREPUSH=1, got $SKIP_EXIT"
  echo "$SKIP_OUT" | sed 's/^/      /'
fi

# Assertion (b): on a green tree, hook prints "build:" and "test:" timing tokens.
echo ""
echo "[b] Hook prints build/test timings on success"
GREEN_OUT=$("$HOOK" 2>&1 < /dev/null)
GREEN_EXIT=$?
if [ "$GREEN_EXIT" -eq 0 ]; then
  if echo "$GREEN_OUT" | grep -q "build:" && echo "$GREEN_OUT" | grep -q "test:"; then
    pass "build:/test: timing tokens present"
  else
    fail "missing build:/test: timing tokens in output:"
    echo "$GREEN_OUT" | tail -20 | sed 's/^/      /'
  fi
else
  fail "expected exit 0 on green tree, got $GREEN_EXIT"
  echo "$GREEN_OUT" | tail -20 | sed 's/^/      /'
fi

# Assertion (d): when a test fails, hook exits non-zero and surfaces the failure.
echo ""
echo "[d] Hook exits non-zero when a test fails"
if [ ! -f "$SMOKE_TEST_FILE" ]; then
  fail "smoke test file not found at $SMOKE_TEST_FILE — can't inject a failure"
else
  # Back up the file, inject a guaranteed failure, run the hook, restore.
  BACKUP="$(mktemp)"
  cp "$SMOKE_TEST_FILE" "$BACKUP"

  # Replace Assert.True(true) with Assert.True(false). Use a literal swap.
  # POSIX sed: in-place edit needs a backup suffix on macOS; on Linux empty is fine.
  # Portable workaround: rewrite the file via awk.
  awk '{ gsub(/Assert\.True\(true\)/, "Assert.True(false)"); print }' "$BACKUP" > "$SMOKE_TEST_FILE"

  FAIL_OUT=$("$HOOK" 2>&1 < /dev/null)
  FAIL_EXIT=$?

  # Restore the original file unconditionally before checking results.
  cp "$BACKUP" "$SMOKE_TEST_FILE"
  rm -f "$BACKUP"

  if [ "$FAIL_EXIT" -ne 0 ]; then
    if echo "$FAIL_OUT" | grep -qi "True_IsTrue\|Failed\|FAILED"; then
      pass "non-zero exit ($FAIL_EXIT) with failing test surfaced"
    else
      fail "non-zero exit ($FAIL_EXIT) but failure detail not surfaced:"
      echo "$FAIL_OUT" | tail -20 | sed 's/^/      /'
    fi
  else
    fail "expected non-zero exit on failing test, got $FAIL_EXIT"
    echo "$FAIL_OUT" | tail -20 | sed 's/^/      /'
  fi
fi

echo ""
echo "=== Result: $PASS_COUNT passed, $FAIL_COUNT failed ==="
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0

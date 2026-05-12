#!/usr/bin/env bash
# Smoke test for verify_wi_actually_merged + block_fake_completion (flowset.sh).
#
# Run from the repo root:  bash .flowset/scripts/test-verify-wi.sh
#
# Validates the 2026-05-12 anti-fake-completion patch: when last_git_sha..HEAD
# contains a commit referencing the WI prefix, the helper returns 0; otherwise
# it returns 1. Uses a throwaway git history in a tmpdir so the real repo is
# untouched.

set -euo pipefail

FLOWSET_SH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/flowset.sh"

if [[ ! -f "$FLOWSET_SH" ]]; then
  echo "FAIL: flowset.sh not found at $FLOWSET_SH" >&2
  exit 1
fi

# Source only the function block we care about — flowset.sh's main entry
# does heavy I/O on sourcing, so we eval the function bodies via grep+sed.
extract_fn() {
  local name="$1"
  awk -v fn="$name" '
    $0 ~ "^" fn "\\(\\) \\{" { capture = 1 }
    capture { print }
    capture && /^\}$/ { exit }
  ' "$FLOWSET_SH"
}

eval "$(extract_fn verify_wi_actually_merged)"

# Set up an isolated git history for testing.
TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

cd "$TMPDIR_TEST"
git init -q
git config user.email "test@example.com"
git config user.name "Test"
echo "base" > a.txt
git add a.txt
git commit -q -m "base"
BASELINE_SHA=$(git rev-parse HEAD)

# Scenario 1 — no new commit after baseline → should block (return 1).
if verify_wi_actually_merged "WI-999-feat dummy" "$BASELINE_SHA"; then
  echo "FAIL: scenario 1 — empty range should return non-zero" >&2
  exit 1
fi
echo "PASS: scenario 1 (no commit → blocked)"

# Scenario 2 — add commit with matching WI prefix → should allow (return 0).
echo "x" >> a.txt
git add a.txt
git commit -q -m "WI-999-feat dummy work"
if ! verify_wi_actually_merged "WI-999-feat dummy" "$BASELINE_SHA"; then
  echo "FAIL: scenario 2 — matching commit should return 0" >&2
  exit 1
fi
echo "PASS: scenario 2 (matching commit → allowed)"

# Scenario 3 — commit exists but unrelated WI prefix → should block.
BASELINE_SHA=$(git rev-parse HEAD)
echo "y" >> a.txt
git add a.txt
git commit -q -m "WI-888-feat unrelated"
if verify_wi_actually_merged "WI-999-feat dummy" "$BASELINE_SHA"; then
  echo "FAIL: scenario 3 — unrelated commit should not satisfy" >&2
  exit 1
fi
echo "PASS: scenario 3 (unrelated commit → blocked)"

# Scenario 4 — baseline = "none" → cannot verify, allow (legacy path).
if ! verify_wi_actually_merged "WI-999-feat dummy" "none"; then
  echo "FAIL: scenario 4 — none baseline should allow (no-op)" >&2
  exit 1
fi
echo "PASS: scenario 4 (none baseline → allowed)"

echo ""
echo "All 4 scenarios passed — anti-fake-completion gate works."

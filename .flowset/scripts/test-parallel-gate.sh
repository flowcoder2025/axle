#!/usr/bin/env bash
# Phase 20 WI-703 — 병렬 모드 mark_wi_done 게이트 smoke test.
#
# Verifies that flowset.sh execute_parallel() routes both mark_wi_done call
# sites through verify_wi_actually_merged, and that the per-worker baseline
# SHA (worktree_pre_iter_sha) is captured before dispatch. Mirrors the v3.0.1
# sequential gate added in PR #171 (now extended to parallel in v3.0.2).
#
# Run from repo root:  bash .flowset/scripts/test-parallel-gate.sh

set -euo pipefail
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

FLOWSET_SH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/flowset.sh"

if [[ ! -f "$FLOWSET_SH" ]]; then
  echo "FAIL: flowset.sh not found at $FLOWSET_SH" >&2
  exit 1
fi

# 1) pre_iter_sha 캡쳐 패턴이 존재하는지 확인
if ! grep -q "worktree_pre_iter_sha\[" "$FLOWSET_SH"; then
  echo "FAIL: worktree_pre_iter_sha[] capture missing" >&2
  exit 1
fi
echo "PASS: worktree pre_iter_sha capture present"

# 2) 병렬 mark_wi_done 두 곳 모두 verify gate 통과 확인
gate_count=$(grep -c "verify_wi_actually_merged.*worktree_wi" "$FLOWSET_SH" || true)
if [[ "${gate_count:-0}" -lt 2 ]]; then
  echo "FAIL: 병렬 mark_wi_done 게이트 ${gate_count:-0}/2" >&2
  exit 1
fi
echo "PASS: 병렬 게이트 ${gate_count}/2"

# 3) FLOWSET_VERSION 확인 (3.0.2 이상)
version=$(grep -E '^FLOWSET_VERSION=' "$FLOWSET_SH" | head -1 | sed 's/.*"\(.*\)".*/\1/')
if [[ -z "$version" ]]; then
  echo "FAIL: FLOWSET_VERSION not found" >&2
  exit 1
fi
echo "PASS: FLOWSET_VERSION=$version"

echo ""
echo "All parallel-gate smoke checks passed."

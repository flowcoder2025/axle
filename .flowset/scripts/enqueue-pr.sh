#!/usr/bin/env bash
# PR을 merge queue에 등록하는 래퍼 스크립트
# 사용법: bash .flowset/scripts/enqueue-pr.sh <PR번호> [--wait] [--timeout 분]
# merge queue 미지원 시 gh pr merge --auto --squash fallback
# --wait: 머지 완료까지 대기 (exit 0=머지, 1=실패/닫힘, 2=timeout)

set -euo pipefail

PR_NUMBER="${1:?PR 번호를 입력하세요. 예: bash .flowset/scripts/enqueue-pr.sh 79}"
shift || true

# 옵션 파싱
WAIT=false
TIMEOUT_MIN=15
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait) WAIT=true; shift ;;
    --timeout) TIMEOUT_MIN="${2:?--timeout 값이 필요합니다}"; shift 2 ;;
    *) shift ;;
  esac
done

OWNER=$(gh repo view --json owner --jq '.owner.login' 2>/dev/null || echo "")
REPO=$(gh repo view --json name --jq '.name' 2>/dev/null || echo "")

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  echo "ERROR: GitHub 레포 정보를 가져올 수 없습니다."
  exit 1
fi

# PR node ID 조회
PR_NODE_ID=$(gh api graphql -f query="{ repository(owner: \"$OWNER\", name: \"$REPO\") { pullRequest(number: $PR_NUMBER) { id } } }" --jq '.data.repository.pullRequest.id' 2>/dev/null || true)

if [[ -z "${PR_NODE_ID:-}" ]]; then
  echo "ERROR: PR #$PR_NUMBER 을 찾을 수 없습니다."
  exit 1
fi

# merge queue 존재 여부 확인 (리스팅 API에 rules 미포함 → 개별 조회)
HAS_MERGE_QUEUE=0
for _rid in $(gh api repos/"$OWNER"/"$REPO"/rulesets --jq '.[].id' 2>/dev/null); do
  if gh api repos/"$OWNER"/"$REPO"/rulesets/"$_rid" --jq '.rules[].type' 2>/dev/null | grep -q "merge_queue"; then
    HAS_MERGE_QUEUE=1
    break
  fi
done

# Pre-merge gate: 레포에 branch protection이 없으면 (GitHub Pro 미가입 등)
# gh pr merge --auto가 required check 없이 즉시 통과해버리므로, 여기서
# 직접 모든 체크가 종료(PENDING 탈출)될 때까지 기다린 뒤 FAILURE가 있으면
# 중단. Issue #35 참고. 최대 20분 대기.
GATE_TIMEOUT_SEC=$((20 * 60))
GATE_ELAPSED=0
GATE_INTERVAL=15
echo "🚦 CI 체크 종료 대기 (pre-merge gate, 최대 20분)..."
while [[ $GATE_ELAPSED -lt $GATE_TIMEOUT_SEC ]]; do
  PENDING_COUNT=$(gh pr checks "$PR_NUMBER" --json state --jq '[.[] | select(.state=="PENDING")] | length' 2>/dev/null || echo "0")
  FAILURE_COUNT=$(gh pr checks "$PR_NUMBER" --json state --jq '[.[] | select(.state=="FAILURE")] | length' 2>/dev/null || echo "0")
  # 실패가 먼저 드러나면 남은 PENDING 기다릴 필요 없이 중단 (fail-fast)
  if [[ "$FAILURE_COUNT" -gt 0 ]]; then
    FAILED_NAMES=$(gh pr checks "$PR_NUMBER" --json name,state --jq '.[] | select(.state=="FAILURE") | .name' 2>/dev/null || echo "(이름 조회 실패)")
    echo "❌ PR #$PR_NUMBER CI FAILURE 감지 — 머지 중단"
    echo "   실패 체크:"
    echo "$FAILED_NAMES" | sed 's/^/     - /'
    exit 1
  fi
  if [[ "$PENDING_COUNT" -eq 0 ]]; then
    echo "✅ CI 체크 전부 종료 — FAILURE 없음, 머지 진행"
    break
  fi
  sleep "$GATE_INTERVAL"
  GATE_ELAPSED=$((GATE_ELAPSED + GATE_INTERVAL))
done
if [[ $GATE_ELAPSED -ge $GATE_TIMEOUT_SEC ]]; then
  echo "⚠️ pre-merge gate timeout — CI가 20분 안에 끝나지 않음"
  exit 2
fi

# merge queue에 등록 시도
RESULT=$(gh api graphql -f query="mutation { enqueuePullRequest(input: { pullRequestId: \"$PR_NODE_ID\" }) { mergeQueueEntry { position } } }" 2>&1 || true)

if echo "$RESULT" | grep -q '"position"'; then
  POSITION=$(echo "$RESULT" | grep -oE '"position":[0-9]+' | grep -oE '[0-9]+')
  echo "✅ PR #$PR_NUMBER → merge queue position $POSITION"
elif echo "$RESULT" | grep -qi "already.*queue"; then
  echo "✅ PR #$PR_NUMBER → 이미 큐에 등록됨"
elif [[ "$HAS_MERGE_QUEUE" -gt 0 ]]; then
  echo "⏳ enqueue 실패 (CI 대기 또는 충돌) — auto-merge 설정"
  echo "   에러: $(echo "$RESULT" | grep -oE '"message":"[^"]*"' | head -1)"
  gh pr merge "$PR_NUMBER" --auto 2>/dev/null || {
    echo "⚠️ auto-merge 설정 실패"
  }
  echo "✅ PR #$PR_NUMBER → auto-merge 설정 완료 (CI 통과 후 자동 큐 등록)"
else
  echo "ℹ️ merge queue 미설정 — gh pr merge --auto --squash fallback"
  gh pr merge "$PR_NUMBER" --auto --squash 2>/dev/null || {
    echo "⚠️ auto-merge 설정 실패"
  }
  echo "✅ PR #$PR_NUMBER → auto-merge 설정 완료"
fi

# --wait: 머지 완료까지 대기
if [[ "$WAIT" == true ]]; then
  echo "⏳ PR #$PR_NUMBER 머지 완료 대기 (timeout: ${TIMEOUT_MIN}분)..."
  TIMEOUT_SEC=$((TIMEOUT_MIN * 60))
  ELAPSED=0
  POLL_INTERVAL=15

  while [[ $ELAPSED -lt $TIMEOUT_SEC ]]; do
    STATE=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")

    case "$STATE" in
      MERGED)
        echo "✅ PR #$PR_NUMBER 머지 완료"
        exit 0
        ;;
      CLOSED)
        echo "❌ PR #$PR_NUMBER 닫힘 (CI 실패 또는 수동 닫기)"
        exit 1
        ;;
      UNKNOWN)
        echo "⚠️ PR 상태 조회 실패"
        exit 1
        ;;
    esac

    # CI 실패 조기 감지
    if gh pr checks "$PR_NUMBER" --json state --jq '.[].state' 2>/dev/null | grep -q "FAILURE"; then
      echo "❌ PR #$PR_NUMBER CI 실패 감지"
      exit 1
    fi

    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
    local_min=$((ELAPSED / 60))
    local_sec=$((ELAPSED % 60))
    printf "\r  ⏳ %dm %02ds / %dm 대기 중...  " "$local_min" "$local_sec" "$TIMEOUT_MIN"
  done

  echo ""
  echo "⚠️ PR #$PR_NUMBER timeout (${TIMEOUT_MIN}분 초과)"
  exit 2
fi

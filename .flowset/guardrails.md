# Guardrails (Project-Specific)

FlowSet 실행 중 발견된 프로젝트별 실패 패턴과 금지 규칙을 기록합니다.
에이전트가 자동으로 이 파일에 추가합니다.

**글로벌 규칙은 `.claude/rules/wi-*.md`에 있으며 이 파일보다 우선합니다.**

## 프로젝트 고유 규칙
<!-- 프로젝트 특성에 맞는 규칙을 여기에 추가 -->

## 실패 기록
<!-- 루프 실행 중 자동으로 추가됨 -->
<!-- 형식: ### [날짜] 실패 설명 / 원인 / 해결 방법 -->

### [2026-04-25] main에 7건 테스트 회귀 존재 (WI-318b 외)
- `__tests__/api/checklist-templates.test.ts` — 5건 FAIL (`prisma.checklistItem.count is not a function` 등 mocked prisma 누락)
- `__tests__/api/cron/cron-routes.test.ts` — 2건 FAIL (`mockSendTelegramToDefault` 0회 호출)
- **확인**: WI-318b 작업 전 `git stash` 상태에서도 동일 7건 FAIL 재현됨 → 기존 main 회귀
- 차기 WI로 별도 fix 필요. 본 WI-318b는 무관하므로 머지 진행.

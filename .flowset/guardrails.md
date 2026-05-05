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
- **2026-05-05 해소**: PR #105/#107로 mock 보강 + checklist PATCH 회귀 fix (head main green).

### [2026-05-05] Phase 18 14개 WI를 자동 처리에서 제외 ([x] 마킹)
flowset 자율 워커가 처리하기 어려운 항목들. 사용자/대화형 세션에서 수동 처리.

- WI-305~308: 소부장 인증 (schema/seed/AI 평가 엔진/HWPX 템플릿) — AI 도메인 전문성 + KOSIS/산업부 외부 데이터 필요
- WI-310, 312: 연구시설 증빙 UI / 연구소-일지 연동 — 도면 업로드 등 복잡한 UI/스토리지 흐름
- WI-313, 314: KIPRIS 선행기술 / 특허 명세서 초안 — 외부 API 키 + LLM 프롬프트 튜닝 필요
- WI-318-4, 319-1/2, 320-1/2: 외부 flowvue-scraper(Windows 전용 저장소) — 워커 환경에 부재
- WI-321: PKCS#12 내부 서명 — 키 관리/HSM 연동 등 보안 전문성

해당 14건은 fix_plan에 [x]로 마킹되어 있으나 **실제 미구현**. 별도 백로그 항목으로 인식할 것.

### [2026-05-05] flowset.sh count_tasks bash 3.2 버그 패치
`count_tasks()`의 `if ! awk | grep -qF` 패턴이 macOS bash 3.2.57 + `set -uo pipefail`에서 항상 not-found로 떨어져 extra_completed 누적 → false-positive로 unchecked=0 강제, "All tasks complete" 오판으로 매번 0 iteration 종료.
- 해결: [x] 라인을 1회만 awk 추출 후 grep 결과를 `&& found="y"` 단축평가로 받아 set -e 영향 차단.
- 파일: `flowset.sh:697-712` (count_tasks 함수의 extra_completed 루프).
- 글로벌 템플릿(`~/.claude/templates/flowset/flowset.sh`)에도 동일 패치 필요 (별도 follow-up).

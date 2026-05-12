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

### [2026-05-05] WI-609-test E2E 월급 정산 시나리오 — 자동 워커 스킵
WI-609 는 Playwright E2E 시나리오 작성으로, `claude -p` 비대화형 워커가 처리할 수 없는 카테고리 (rule: `.claude/rules/wi-flowset.md` §2 + 본 PROMPT.md 절차 §3).

스킵 사유:
- 워커 환경에 브라우저 / GUI 가 없어 실제 셀렉터 확인 불가 → 추측한 셀렉터는 거의 전부 실패함.
- apps/flowteams 는 WI-608 에서 thin shell 스캐폴드만 머지된 상태 (실제 UI 페이지/data-testid 미존재). FlowTeams v1 안정화 게이트 후 화면 컴포넌트가 채워지면 그때 E2E 작성 가능.

후속 처리:
- 대화형 세션에서 Playwright 로 실제 화면을 보며 작성 (rule §7.1 — page.goto + UI 인터랙션 + data-testid 셀렉터, request.get/post API shortcut 금지).
- 시나리오 골자: org 어드민 로그인 → /payroll → 직원 선택 → 월급 정산 trigger → 결과 검증 (gross / 4대보험 / net) → DOCX/HWPX 다운로드 (선택).
- 활성화 게이트: WI-608 thin shell 위에 FlowTeams v1 화면이 안정화된 후.

### [2026-05-05] flowset.sh count_tasks bash 3.2 버그 패치
`count_tasks()`의 `if ! awk | grep -qF` 패턴이 macOS bash 3.2.57 + `set -uo pipefail`에서 항상 not-found로 떨어져 extra_completed 누적 → false-positive로 unchecked=0 강제, "All tasks complete" 오판으로 매번 0 iteration 종료.
- 해결: [x] 라인을 1회만 awk 추출 후 grep 결과를 `&& found="y"` 단축평가로 받아 set -e 영향 차단.
- 파일: `flowset.sh:697-712` (count_tasks 함수의 extra_completed 루프).
- 글로벌 템플릿(`~/.claude/templates/flowset/flowset.sh`)에도 동일 패치 필요 (별도 follow-up).

### [2026-05-12] WI-621~626 가짜 완료 사고 (재발) — flowset 자율 루프 SSOT 오염
2026-05-12 09:50~11:47 KST flowset.sh 50-iteration 자율 루프 종료 후 발견. WI-611~620은 PR #158~#165로 진짜 머지됐으나 WI-621~626 6건은 sprint contract 받고도 코드/PR 없이 worker가 `mark_wi_done` 호출 → `completed_wis.txt` SSOT 오염 → `reconcile_fix_plan`이 fix_plan에 가짜 `[x]` 마킹.

**증거**:
- `apps/flowteams/` 여전히 main 존재 (WI-621이 제거했어야 함)
- `apps/web/src/modules/` 디렉토리 없음 (WI-622~626이 생성했어야 함)
- `gh pr list --search "WI-62"` → WI-620 PR #165만 존재, 621~626은 0건
- 부가: WI-611은 PR #158 머지됐으나 09:50 cleanup 후 SSOT 재추가 안 되어 fix_plan `[ ]` 유지 (반대 방향 불일치)

**복구 (이 PR)**:
- `completed_wis.txt`: WI-621~626 제거 + WI-611-feat 추가 (gitignored, 로컬 변경)
- `fix_plan.md`: WI-621~626 `[x]` → `[ ]`, WI-611 `[ ]` → `[x]`

**Why 재발**: 2026-05-05 Phase 18에서도 동일 패턴(본 파일 위 섹션). `flowset.sh:mark_wi_done`이 PR 머지 검증 없이 worker 호출만으로 SSOT 추가하는 구조적 결함.

**Follow-up 필요 (flowset.sh 패치)**:
- `mark_wi_done` 진입 전 `gh pr list --search "WI-NNN"` + `git log --grep "WI-NNN"`로 실제 머지 검증 게이트 추가.
- `reconcile_fix_plan` 종료 후 fix_plan `[x]` vs git log diff 대조 후 불일치 발견 시 경고 출력.

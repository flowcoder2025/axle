# Sprint Contract — WI-316-chore VENTUREIN/KOITA 포털 자동화 제거

> **CANCELLED** (2026-04-24): VENTUREIN/KOITA Playwright 실구현 계획은 벤처 트랙 DOCX(WI-301~309) 및 연구소 DOCX 트랙으로 대체되어 불필요. 본 문서는 히스토리 기록용으로 보존.

## 계약 상태
- [x] 리드 초안 작성 (Playwright 실구현 계획)
- [x] 사용자 판단: VENTUREIN/KOITA는 DOCX 트랙으로 대체되므로 포털 자동화 제거
- [x] WI-316-chore / WI-317-chore 로 전환 (스텁/IPC/테스트/requirements.md 정리)

## 제거된 산출물
- apps/desktop/src/main/portal/page-objects/venturein.ts (삭제)
- apps/desktop/src/main/portal/page-objects/koita.ts (삭제)
- apps/desktop/src/main/ipc/portal.ts — PortalName union/import/factory 정리
- apps/desktop/__tests__/ipc-portal.test.ts — 두 포털 테스트 제거
- .flowset/requirements.md line 141 — VENTUREIN/KOITA 토큰 제거

## 배경 (히스토리)

## 배경
`apps/desktop/src/main/portal/page-objects/venturein.ts` 현재 stub. IPC `portal:login` / `portal:scrape(fetchApplicationList|fetchApplicationDetail)` / `portal:logout` 가 이미 연결되어 있음. Playwright 드라이버 실제 구현으로 교체.

WI-316을 5개 포털(316~320)의 **패턴 레퍼런스**로 먼저 확립한 뒤 나머지에 확장.

## 수용 기준 (Acceptance Criteria)
- [ ] 1. `apps/desktop/package.json`에 `playwright` 런타임 의존성 추가, `npm install` 정상
- [ ] 2. `VentureinPageObject` 가 실제 Chromium 브라우저를 lazy-launch (`login()` 최초 호출 시), `logout()` 에서 close
- [ ] 3. `login({userId, password})`:
  - `https://www.venturein.or.kr` 네비게이션
  - ID/PW 입력 → 로그인 버튼 클릭
  - 성공 판정: 마이페이지 URL 또는 로그인 후 고정 selector 도달 (timeout 15s)
  - 실패 시 `new Error("VENTUREIN login failed: <reason>")` throw
  - 성공 시 `{sessionToken}` 반환 (세션 내부에 Page 인스턴스 보관)
- [ ] 4. `fetchApplicationList()`:
  - 신청 내역 페이지로 네비게이션
  - 테이블 row 파싱 → `VentureinApplication[]` (기존 interface 유지)
  - 로그인 안 된 경우 `throw new Error("Not logged in")`
- [ ] 5. `fetchApplicationDetail(id)`:
  - 상세 페이지 네비게이션
  - 기본 필드 (programName, status, submittedAt, updatedAt) + 본문 텍스트 스크랩
- [ ] 6. `logout()`: 로그아웃 링크 클릭(가능한 경우) → 브라우저 close → sessionToken null
- [ ] 7. 셀렉터는 `apps/desktop/src/main/portal/selectors/venturein.json` 외부 파일로 분리 (self-repair WI 와의 호환 확보)
- [ ] 8. 헤드리스 제어: `PLAYWRIGHT_HEADLESS` 환경변수 (기본 `true`, 로컬 디버깅은 `false`)
- [ ] 9. 단위 테스트 (vitest): `playwright` 모듈을 mock 하여
  - login 성공/실패 시나리오
  - fetchApplicationList 테이블 파싱
  - logout 후 sessionToken null
- [ ] 10. 기존 `apps/desktop/__tests__/ipc-portal.test.ts` 통과 유지
- [ ] 11. `npx turbo lint build typecheck test --filter=desktop` 전체 통과
- [ ] 12. **사용자 수동 검증** (크레덴셜 보유 시): `PLAYWRIGHT_HEADLESS=false` 로컬 실행 → 실제 로그인 + 신청 목록 확인 → 스크린샷 `.flowset/verify-result.md`
  - 크레덴셜 없을 시 생략, 사양 주석에 "실 로그인 검증은 운영 환경에서 수행" 명시

## 검증 방법 (Verification Method)
1. `cd apps/desktop && npm test -- venturein` (mocked)
2. `npx turbo lint build typecheck test --filter=desktop`
3. 수동 스모크 (크레덴셜 있으면): `PLAYWRIGHT_HEADLESS=false node -e "..."` 세션 실행
4. 기존 IPC 테스트 회귀 없음 확인

## 산출물 (Deliverables)
| # | 파일 경로 | 설명 |
|---|---------|------|
| 1 | apps/desktop/package.json | playwright 의존성 추가 |
| 2 | apps/desktop/src/main/portal/page-objects/venturein.ts | stub → 실 Playwright 드라이버 |
| 3 | apps/desktop/src/main/portal/selectors/venturein.json | 셀렉터 외부화 |
| 4 | apps/desktop/src/main/portal/selectors/index.ts | 셀렉터 로더 유틸 |
| 5 | apps/desktop/__tests__/venturein.test.ts | 단위 테스트 (mock) |

## 제약 (Constraints)
- Hometax 처럼 anti-bot 강한 포털과 동일 패턴 강제 적용 금지 — VENTUREIN 특성에 맞게 최소 구현
- 공동인증서 로그인 범위 제외 (별도 WI)
- Self-repair 자동 복구 로직 범위 제외 (selectors.json 외부화만)
- Windows 전용 코드 추가 금지 (Mac/Windows 모두에서 동작)
- 실 크레덴셜을 코드/로그에 기록 금지
- 스텁 초기화가 의존하는 stub 생성 행동(`venturein-stub-${Date.now()}`) 제거

## 롤백
단일 PR — 문제 발생 시 revert. `PLAYWRIGHT_ENABLED` env flag 로 런타임 비활성화 가능 (미설정 시 이전 stub 동작 유지는 선택 사항; 기본은 실 구현 강제).

## 평가 기준 유형
type: code

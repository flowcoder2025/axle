# Technical Debt Registry

FlowSet 실행 중 발견된 기술 부채를 기록합니다.
팀원이 발견하면 이 파일에 추가하고, 리드가 우선순위를 판단합니다.

## 우선순위 기준
| 등급 | 기준 | 대응 |
|------|------|------|
| P0 | 장애 위험 (보안, 데이터 유실) | 즉시 해소 |
| P1 | 성능 저하 (응답 > 3초, 메모리 누수) | 다음 스프린트 |
| P2 | 코드 품질 (중복, 하드코딩, 미사용 코드) | 여유 시 해소 |

## 형식
```markdown
### [P등급] 제목
- **위치**: 파일 경로
- **발견**: 날짜 / 발견 팀
- **설명**: 문제 내용
- **영향**: 어떤 기능/팀에 영향
- **해결 방안**: 제안
- **상태**: open / in-progress / resolved
```

## 부채 목록
<!-- 팀원이 작업 중 발견한 기술 부채를 아래에 추가 -->

### [P1] CI typecheck Prisma client 레이스 컨디션 — flaky
- **위치**: `.github/workflows/ci.yml` + `turbo.json` (@axle/db build outputs)
- **발견**: 2026-05-17 / WI-722 (PR #200)
- **설명**: `npx turbo build --filter='./packages/*'` 후 `npx turbo typecheck` 시 동일 코드가 run마다 다른 에러로 실패 (e.g., 1차 `'AiJobType' has no exported member`, 2차 `'*/' expected at line 29316`). 로컬 fresh 빌드는 항상 성공. 추정 원인: `@axle/db` build의 `prisma generate`가 출력하는 `node_modules/.prisma/client/**`가 turbo cache `outputs`에 포함되지 않아, 동일 hash로 cache hit/replay되어도 실제 파일 상태가 부정합.
- **영향**: 모든 PR의 CI flake — 재실행으로 우회 가능하나 머지 지연 + 신뢰도 저하
- **해결 방안**: 
  1. `turbo.json`의 build `outputs`에 `"../../node_modules/.prisma/client/**"`, `"../../node_modules/@prisma/client/**"` 추가 (root-relative — turbo는 workspace-root까지 가능)
  2. 또는 CI workflow에 `npm ci` 직후 명시적 `npx prisma generate --schema=packages/db/prisma/schema.prisma` step 추가 (가장 안전)
- **상태**: in-progress (option 2 적용 — WI-chore PR로 CI workflow lint/typecheck/build/test 4잡에 explicit `prisma generate` step 추가, 2026-05-17). 후속 PR들에서 flake 재발 없으면 resolved로 전환.

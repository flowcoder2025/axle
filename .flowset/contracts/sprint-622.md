# Sprint Contract — WI-622-feat Pack A 모듈 메타데이터 (10 modules)

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
Pack A 비즈니스 운영 (10 modules)의 module.config.ts 작성. WI-616의 ModuleConfig 인터페이스 준수.
상세 사양: `wireframes/packs/A-business.html`, `wireframes/module-catalog.md` §1.

## 수용 기준
- [ ] 1. `apps/web/src/modules/pack-a-business/` 디렉토리 생성
- [ ] 2. `apps/web/src/modules/pack-a-business/pack.config.ts`:
  - `export const packA: PackConfig = { id:"A", label:"비즈니스 운영", recommended:true, modules:[...10 ids...], pricing:{monthly:59000} }`
- [ ] 3. 10개 `module.config.ts` 작성:
  - customers/projects/estimates/contracts/documents/portal/calendar/meetings/finance/analytics
  - 각각 ModuleConfig 인터페이스 만족
  - finance/analytics는 `multiOrg: true`
- [ ] 4. `apps/web/src/modules/pack-a-business/index.ts`에서 packA + 10 modules export
- [ ] 5. `apps/web/src/modules/registry.ts` (모듈 레지스트리 진입점):
  - import + registerPack(packA) + registerModule(...) 일괄 등록
- [ ] 6. **route 필드는 실제 라우트와 일치 검증**:
  - 예: customers → "/customers" 와 apps/web/src/app/(platform)/customers/page.tsx 존재해야
  - 단 본 WI에서 신규 라우트 생성 금지 — 이미 존재하는 라우트와 매핑만
- [ ] 7. 단위 테스트 `__tests__/pack-a.test.ts`:
  - packA.modules.length === 10
  - 각 모듈의 deps 일관성 검증 (hard deps가 다른 모듈 id 참조)
  - 권한 scope가 documented set에 속함
- [ ] 8. `npx turbo lint build typecheck test --filter=web` 통과

## 검증 방법
1. `cd /Volumes/포터블/AXLE && npx turbo build test --filter=web`
2. `node -e "const m=require('./apps/web/dist/...'); console.log(m.packA.modules.length)"` → 10
3. evaluator: 와이어프레임 packs/A-business.html의 module.config.ts 예시와 정합

## 산출물
| # | 파일 |
|---|---|
| 1 | apps/web/src/modules/pack-a-business/pack.config.ts |
| 2 | apps/web/src/modules/pack-a-business/customers/module.config.ts |
| 3 | apps/web/src/modules/pack-a-business/projects/module.config.ts |
| 4 | apps/web/src/modules/pack-a-business/estimates/module.config.ts |
| 5 | apps/web/src/modules/pack-a-business/contracts/module.config.ts |
| 6 | apps/web/src/modules/pack-a-business/documents/module.config.ts |
| 7 | apps/web/src/modules/pack-a-business/portal/module.config.ts |
| 8 | apps/web/src/modules/pack-a-business/calendar/module.config.ts |
| 9 | apps/web/src/modules/pack-a-business/meetings/module.config.ts |
| 10 | apps/web/src/modules/pack-a-business/finance/module.config.ts |
| 11 | apps/web/src/modules/pack-a-business/analytics/module.config.ts |
| 12 | apps/web/src/modules/pack-a-business/index.ts |
| 13 | apps/web/src/modules/registry.ts (또는 갱신) |
| 14 | apps/web/__tests__/pack-a.test.ts |

## 제약
- 새 페이지 생성 금지 — 메타데이터만
- ModuleConfig 인터페이스 변경 금지 — WI-616 정의 그대로 사용
- onInstall hook은 단순 stub (실 seed 데이터는 별도 WI)

## 평가 기준 유형
type: code

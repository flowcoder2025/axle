# Sprint Contract — WI-620-feat Multi-org Tenancy 모델

## 계약 상태
- [x] 리드 초안 작성 (2026-05-11)
- [x] 자율 루프 진입 승인 (사용자, 2026-05-11)

## 배경
컨설팅 회사가 N개 고객 조직을 위탁 관리하는 기능. 별도 요금제(premium tier).
적용 모듈: Pack A 재무/분석, Pack B AI매칭/연구일지, Pack D 전체.

상세 UX: `wireframes/platform/org-switcher.html`.

## 수용 기준
- [ ] 1. **Prisma 모델 추가** (`packages/db/prisma/schema.prisma`):
  ```prisma
  model ManagedOrg {
    id              String   @id @default(cuid())
    ownerOrgId      String   // 결제/관리 주체 (= 본인 조직)
    name            String
    bizRegNumber    String?
    status          ManagedOrgStatus @default(ACTIVE)
    installedPacks  Json     @default("[]")  // 위탁된 Pack ID 배열
    createdAt       DateTime @default(now())
    @@index([ownerOrgId])
  }
  enum ManagedOrgStatus { ACTIVE PAUSED TERMINATED }

  model OrgMultiOrgSubscription {
    id           String @id @default(cuid())
    orgId        String @unique
    enabled      Boolean @default(false)
    maxManaged   Int     @default(0)
    activatedAt  DateTime?
  }
  ```
  - 마이그레이션 자동 생성
- [ ] 2. **multi-org 적용 모듈 테이블에 `tenantOrgId` 컬럼 추가** (예시 — 본 WI에서는 모델만 정의, 실 추가는 해당 모듈 WI에서):
  - 본 WI에서는 1개 시범 모델(예: Payroll)에 tenantOrgId 추가하여 패턴 확립
- [ ] 3. `apps/web/src/lib/tenant-context.ts`:
  - `getActiveTenant(req): Promise<{ id, isManaged, name }>` — 세션 또는 cookie에서 active tenant 추출 (기본: 본인 조직)
  - `setActiveTenant(tenantId): Promise<void>` — 권한 검증 후 세션 갱신
- [ ] 4. `apps/web/src/components/org-switcher.tsx` (Client Component):
  - Topbar 우측에 드롭다운
  - 본인 조직 + 활성 ManagedOrg 목록
  - 선택 시 setActiveTenant 호출 → router.refresh()
  - `data-testid="org-switcher"`
- [ ] 5. `apps/web/src/app/(platform)/layout.tsx`에 OrgSwitcher 통합 (Multi-org subscription 활성 시만 렌더)
- [ ] 6. `apps/web/src/app/(platform)/settings/managed-orgs/`:
  - `page.tsx` — 관리 조직 목록 + 추가/제거
  - `[orgId]/page.tsx` — 위탁 Pack 설정
  - `new/page.tsx` — 신규 등록
- [ ] 7. ReBAC scope 통합 (WI-619의 `tenant:<managedOrgId>` scope 활용):
  - 본인 조직 owner는 `tenant:*` 자동 부여
  - 컨설턴트별로 `tenant:<managedOrgId>` 부여 가능
- [ ] 8. 단위 테스트:
  - `apps/web/__tests__/tenant-context.test.ts` — 활성 tenant 전환
  - `apps/web/__tests__/managed-orgs.test.tsx` — CRUD UI
- [ ] 9. Topbar 조직 스위처가 single-org tier(`enabled=false`)일 때 표시 안 됨
- [ ] 10. `npx turbo lint build typecheck test --filter=web --filter=@axle/db` 통과

## 검증 방법
1. `npm run db:migrate` 후 `npx prisma studio` — ManagedOrg + OrgMultiOrgSubscription 테이블 확인
2. dev server에서 multi-org subscription 활성화 → topbar 스위처 표시 → 클릭 시 전환 검증
3. evaluator: tenantOrgId scope 패턴이 일관

## 산출물
| # | 파일 |
|---|---|
| 1 | packages/db/prisma/schema.prisma | ManagedOrg + OrgMultiOrgSubscription |
| 2 | apps/web/src/lib/tenant-context.ts |
| 3 | apps/web/src/components/org-switcher.tsx |
| 4 | apps/web/src/app/(platform)/layout.tsx (수정) |
| 5 | apps/web/src/app/(platform)/settings/managed-orgs/page.tsx |
| 6 | apps/web/src/app/(platform)/settings/managed-orgs/[orgId]/page.tsx |
| 7 | apps/web/src/app/(platform)/settings/managed-orgs/new/page.tsx |
| 8 | apps/web/__tests__/tenant-context.test.ts |
| 9 | apps/web/__tests__/managed-orgs.test.tsx |

## 제약
- 결제 연동 placeholder만 (실 Polar 통합은 별도 WI)
- 모든 multi-org 적용 모듈 테이블 한꺼번에 tenantOrgId 추가 금지 (1개 시범만 — 나머지는 모듈별 WI에서)
- E2E 테스트 작성 금지

## 평가 기준 유형
type: code

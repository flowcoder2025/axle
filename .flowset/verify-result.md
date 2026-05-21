---VERIFY_RESULT---
TOTAL: ~60 (requirements.md L3 항목 합계)
IMPLEMENTED: 0
INCOMPLETE: 0
MISSING: 0
DETAILS:
- ⏭️ Phase 0~16 모든 항목: 이번 변경(WI-725)은 Phase 21 ERP 트랙(ChartOfAccounts)으로, requirements.md에 명시된 Phase 0~16 기능 요구사항과 무관

NOTE (참고 — requirements.md 범위 밖이지만 WI-725 작업 자체의 자체 검증):
- ✅ ChartOfAccounts seed ~30 과목: `apps/web/lib/erp/coa-seed.ts:38-83` COA_SEED 34개 항목 (REVENUE/COGS/OPEX/NON_OPERATING/OTHER 카테고리 포함)
- ✅ 국세청 표준재무제표 v2024 출처: `coa-seed.ts:23` `COA_SOURCE = "국세청 표준재무제표 v2024"` 상수 + 각 row `source` 필드에 기록
- ✅ 사용자 추가 API: `app/api/erp/chart-of-accounts/route.ts:110-146` POST 라우트, Zod 검증, `isSystem=false` 강제, P2002 → 409 매핑
- ✅ 사용자 수정 API + isSystem 보호: `[coaId]/route.ts:54-107` PATCH + `:71-77` isSystem 가드 (400 SYSTEM_ROW_READONLY)
- ✅ DELETE + isSystem 보호: `[coaId]/route.ts:109-136` isSystem 가드 동일
- ✅ Tenant scope: 모든 쿼리에 `orgId: ctx.orgId` 적용, `requireErpScope("erp:read"|"erp:write")` 인증
- ✅ Lazy seed (idempotent): `route.ts:94` GET 첫 호출 시 `seedSystemChartOfAccounts` + `coa-seed.ts:99-141` P2002 catch로 동시성 안전
- ✅ Tests: `__tests__/lib/erp/coa-seed.test.ts`, `__tests__/api/erp/chart-of-accounts.test.ts` 존재
---END_VERIFY---

requirements.md(Phase 0~16)는 이번 커밋과 무관하므로 모든 항목 ⏭️로 판정. Phase 21 ERP 트랙은 사용자 원본 요구사항에는 없으나, fix_plan.md WI-725 정의(COA seed + isSystem 보호 CRUD)는 코드에 충실히 구현됨.
트: __tests__/lib/erp/coa-seed.test.ts (178줄) + __tests__/api/erp/chart-of-accounts.test.ts (347줄) — 멱등성, 시스템 row 가드, 충돌 처리 커버.

⏭️ requirements.md(Phase 0–16) 항목 일체: 본 변경의 직접적 범위 밖 — Foundation/CRM/Documents/Projects/Communication/AI Engine/DocGen/Calendar/Matching/Meetings/Journal/Finance/Collaboration/Estimates/Agent Bridge/Desktop/Cron 모두 이번 diff와 무관 (해당 Phase의 검증은 별도 WI/PR에서 수행됨).
---END_VERIFY---
```

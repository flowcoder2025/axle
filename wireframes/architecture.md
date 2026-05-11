# 아키텍처 (v3: 6 Pack + Multi-org Tenancy)

> v3 = 단일 플랫폼 + Pack/모듈 + Multi-org tenancy 차원.

---

## 1. 4-Layer

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 4: Single Platform — apps/web                          │
│   src/                                                        │
│     app/                  ← Next.js App Router               │
│       (platform)/        ← 공통 + 모든 모듈 페이지           │
│         dashboard/                                            │
│         customers/  (A.01)                                    │
│         projects/   (A.02)                                    │
│         payroll/    (D.02, ★ multi-org)                       │
│         create/     (E.01)                                    │
│         programs/   (B.01)                                    │
│         ...                                                   │
│       settings/                                               │
│         modules/         ← Pack 카탈로그                     │
│         managed-orgs/    ← Multi-org 관리                    │
│       admin/                                                  │
│     modules/              ← Pack/Module 메타데이터           │
│       pack-a-business/                                        │
│       pack-b-rd-support/                                      │
│       pack-d-hr/         (★ apps/flowteams 흡수)             │
│       pack-e-content/                                         │
│       pack-f-erp/        (1년 후)                            │
│       pack-g-desktop/                                         │
│     lib/                                                      │
│       module-registry.ts                                      │
│       sidebar.ts         ← buildSidebar(org, user, tenant)   │
│       tenant-context.ts  ← active tenant 관리                │
│                                                              │
│   companion (별도 배포):                                      │
│     apps/desktop                                              │
│     apps/agent-bridge                                         │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Packages                                            │
│   횡단 11: ai/auth/crawler/db/docgen/email/matching/...       │
│   PBC (Phase 19):                                             │
│     pbc-image-engine    (★ WI-611)                            │
│     pbc-block-builder                                         │
│     pbc-hr-payroll      (★ WI-612)                            │
│   Core:                                                       │
│     core-design-md      (★ WI-613)                            │
│     core-module-system  (★ WI-616, 신규)                      │
│     core-rebac          (미시작, 향후 분리)                  │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: FDP Core (현행)                                     │
│  Layer 1: Rust 마이크로서비스 (3년 후)                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Pack × Module × PBC 매트릭스

(★ = WI-611~613 보강 / ☆ = WI-616~626 신규)

| Pack \ PBC | image-engine | block-builder | hr-payroll | consulting-crm | crawler | ocr | docgen | scheduler | core-design-md | core-module-system ☆ |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| A. 비즈니스 (10) | — | ● (서류) | — | ●● | — | ● | — | ● | ● | ●● |
| B. 지원사업 (6) | — | ● (양식) | — | — | ●● | — | ● (HWPX) | — | ● | ●● |
| D. HR (5) | — | — | ●● ★ | — | — | — | — | — | ● | ●● |
| E. 콘텐츠 (4) | ●● ★ | ●● | — | — | — | — | — | — | ● | ●● |
| F. ERP (7) | ● | ● (상품 상세) | — | — | — | — | — | — | ● | ●● |
| G. Desktop (3) | — | — | — | — | ● | — | — | — | — | ●● |

---

## 3. Multi-org Tenancy 모델

### 데이터 모델
```typescript
// 새 모델
model ManagedOrg {
  id           String @id
  ownerOrgId   String  // 결제/관리 주체
  name         String
  bizRegNumber String?
  status       ManagedOrgStatus  // ACTIVE/PAUSED/TERMINATED
  installedPacks Json    // 이 ManagedOrg에 위탁된 Pack 목록
  createdAt    DateTime
}

// Multi-org 적용 모든 테이블에 추가
model Payroll {
  id           String @id
  tenantOrgId  String  // self 또는 ManagedOrg.id
  // ...
  @@index([tenantOrgId])
}
```

### ReBAC scope
```typescript
// 본인 조직 owner
{ userId, orgId: self, scope: "tenant:*" }

// 컨설턴트 (위탁 컨설팅 담당)
{ userId, orgId: self, scope: "tenant:<managedOrgId>" }

// 위탁 직원
{ userId, orgId: managedOrgId, scope: "tenant:self + hr:read" }
```

### 모듈 설계
- Pack A 재무/분석: 모든 query에 `WHERE tenantOrgId = activeTenant`
- Pack B AI 매칭/일지: 동일
- Pack D 전체: 동일

---

## 4. core-module-system (★ WI-616 신규)

```typescript
// packages/core-module-system/

interface ModuleConfig {
  id: string;                  // "customers", "payroll", ...
  packId: string;              // "A", "B", "D", "E", "F", "G"
  label: string;
  icon?: string;
  route: string;
  permission: string;          // ReBAC scope
  multiOrg: boolean;           // tenantOrgId 사용 여부
  pbc: string[];               // 의존 PBC
  deps: {
    hard?: string[];           // 부모 모듈 (install 차단)
    soft?: string[];           // 통합 효과 (자동 연결)
  };
  prismaModels: string[];
  widgets?: WidgetDef[];
  onInstall?: (deps: { prisma, orgId, ai? }) => Promise<void>;
}

interface PackConfig {
  id: string;                  // "A"
  label: string;               // "비즈니스 운영"
  modules: string[];           // ["customers", "projects", ...]
  pricing: { monthly: number };
  recommended?: boolean;       // Pack A는 default 추천
}

// Public API
registerModule(config: ModuleConfig): void
registerPack(config: PackConfig): void
getInstalledModules(orgId): Promise<string[]>
installModule(orgId, moduleId): Promise<void>
installPack(orgId, packId): Promise<void>
uninstallModule(orgId, moduleId): Promise<void>
checkDependencies(orgId, moduleId): Promise<{ ok: boolean; missing: string[] }>
isMultiOrgActive(orgId): Promise<boolean>
buildSidebar(orgId, userId, activeTenant): Promise<SidebarSection[]>
```

---

## 5. 데이터 흐름 — Multi-org 시 (HR 위탁 시나리오)

```
사용자 (FlowCoder 컨설턴트) 로그인
  ↓
Topbar 스위처에서 "ABC Manufacturing" 선택
  ↓
session.activeTenant = "ABC"
  ↓
/payroll 페이지 진입
  ↓
middleware:
  ├─ packInstalled("D")?         → ✓
  ├─ moduleInstalled("payroll")? → ✓
  ├─ userPerm("hr:write")?       → ✓
  ├─ tenantScope("D.02", "ABC")? → ✓ (tenant:ABC 권한 보유)
  └─ 통과
  ↓
RSC 페이지 렌더
  ↓ Server Action
createPayrollService({prisma}).calculate(input)   ← ★ WI-612
  ↓ Prisma query
SELECT * FROM Payroll WHERE tenantOrgId = "ABC"   ← multi-org scoping
  ↓
ABC Manufacturing 직원들의 급여 데이터만 반환
```

---

## 6. 6 Pack vs Domain Apps (v1/v2와 비교)

| 항목 | v1 (6 도메인 앱) | v2 (5 도메인 모듈) | v3 (6 Pack × 35 모듈) |
|---|---|---|---|
| 배포 | 6 앱 | 1 앱 | 1 앱 (apps/web) |
| 사용자 진입 | 6 도메인 | 1 도메인 | 1 도메인 + tenant 스위처 |
| 모듈 단위 | 앱 | 도메인(5) | **모듈(35) 또는 Pack(6)** |
| 멀티 테넌시 | 앱별 | 미정 | **별도 tier (Multi-org)** |
| FlowTeams | 별도 앱 | 별도 앱 | **흡수 (WI-621)** |
| 컨설팅 Pack | 별도 묶음 | 13 모듈 묶음 | **해체** — Pack A에 흡수, 자유도 개방 |
| 연구일지 | 컨설팅 | 컨설팅 | **Pack B (지원사업)** |
| 리터치 | 별도 앱 | 별도 모듈 | **제거** — Pack E의 RETOUCH 모드 |

---

## 7. WI 의존성 그래프

```
WI-616 core-module-system (foundation)
  ├── WI-617 Pack 카탈로그 UI
  ├── WI-618 동적 사이드바
  ├── WI-619 모듈 ReBAC
  ├── WI-620 Multi-org tenancy 모델
  └── WI-621 flowteams 흡수
       └── WI-622~626 각 Pack 모듈 메타데이터 (병렬 가능)

WI-611 image-engine orchestrator (독립)
WI-612 hr-payroll factory (독립)
WI-613 core-design-md (독립)
```

WI-616이 foundation. 나머지는 WI-616 머지 후 병렬 진행 가능.

---

## 8. 1년 후 도달 조건 (v3 기준)

- 단일 axle.io 플랫폼 운영
- 6개 Pack 운영 (모두 install 가능)
- Multi-org tier 운영 (10+ 조직 위탁 관리 검증)
- 외부 1개 모듈 등록 시도 (외부 개발자 module.config.ts 제출 → 검증 → 카탈로그 노출)
- DESIGN.md 3개 theme
- PBC 10개 (Top 3 + billing/erp×2/file-manager/messaging/scheduler/consulting-crm)

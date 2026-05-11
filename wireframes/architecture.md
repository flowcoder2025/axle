# 아키텍처 (v2: 단일 플랫폼 + 모듈)

> v1은 6개 앱 분리 / v2는 1개 앱 + 모듈. 코드 구조와 PBC 위치는 동일하나 **앱 분리 가정 제거**.

---

## 1. 4-Layer (v2)

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 4: Single Platform — apps/web                          │
│   apps/web/                                                   │
│     src/                                                      │
│       app/                  ← Next.js App Router (전 라우트)  │
│         (platform)/        ← 공통 + 모든 모듈 페이지         │
│           dashboard/                                          │
│           clients/  (consulting 모듈)                         │
│           payroll/  (hr 모듈)                                 │
│           create/   (content 모듈)                            │
│           inventory/ (erp 모듈, install 시)                   │
│           ...                                                 │
│         settings/                                             │
│           modules/         ← 모듈 카탈로그                   │
│         admin/                                                │
│       modules/             ← 모듈 메타데이터                 │
│         consulting/module.config.ts                          │
│         hr/module.config.ts                                  │
│         content/module.config.ts                             │
│         erp/module.config.ts                                 │
│         retouch/module.config.ts                             │
│       lib/                                                    │
│         module-registry.ts ← install 상태 + 권한 체크        │
│         sidebar.ts         ← 동적 사이드바 빌더              │
│                                                              │
│   companion apps (별도 배포):                                 │
│     apps/desktop          (Electron 클라이언트)              │
│     apps/agent-bridge     (HTTP AI 서비스)                   │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Packages — 횡단(11) + PBC(3+) + Core(2+)            │
│  ┌─ 횡단 ─────────────────────────────────────────────────┐   │
│  │ ai · auth · crawler · db · docgen · email · matching   │   │
│  │ notification · ocr · storage · ui                      │   │
│  └────────────────────────────────────────────────────────┘   │
│  ┌─ PBC (Phase 19 추출 완료) ──────────────────────────────┐  │
│  │ pbc-image-engine     (WI-611 보강)                      │  │
│  │ pbc-block-builder                                       │  │
│  │ pbc-hr-payroll       (WI-612 보강)                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─ Core ──────────────────────────────────────────────────┐  │
│  │ core-design-md       (WI-613 신규)                      │  │
│  │ core-rebac           (미시작, 향후 분리)                │  │
│  │ core-module-system   (★ WI-616 신규 — 모듈 시스템 자체) │  │
│  └─────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: FDP Core (현행)                                     │
│  Layer 1: Rust 마이크로서비스 (PoC, 3년 후)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 모듈 ⊃ PBC 매트릭스

`●●` 핵심 의존, `●` 사용함, `—` 미사용. `★` WI-611~615 보강 대상.

| 모듈 \ PBC | image-engine | block-builder | hr-payroll | core-design-md ★ | consulting-crm (미추출) | erp-inventory (1년 후) | erp-orders (1년 후) | billing (1년 후) | messaging (1년 후) | scheduler (1년 후) | file-manager (1년 후) |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| M1 컨설팅 | — | ● 서류 | — | ● theme | ●● | — | — | ● | ● | ●● | ● |
| M2 HR | — | — | ●● ★ | ● theme | — | — | — | ● | ● | — | — |
| M3 콘텐츠 | ●● ★ | ●● | — | ● theme | — | — | — | ● | — | — | ● |
| M4 ERP | ● 이미지 보정 | ● 상품 상세 | — | ● theme | — | ●● | ●● | ● | ● | — | ● |
| M5 리터치 | ●● (RETOUCH) | — | — | ● theme | — | — | — | ● | — | — | ● |

**관찰**:
- 모든 모듈이 core-design-md 사용 (theme 갈아끼움)
- 모든 모듈이 1년 후 pbc-billing 의존 (구독 결제)
- image-engine은 콘텐츠(M3) + 리터치(M5)의 핵심 — WI-611 보강 우선순위 높음

---

## 3. 모듈 시스템 구성 요소 (신규)

```
core-module-system (★ WI-616)
├── ModuleConfig 타입 (id, label, icon, nav, widgets, pbc, prismaModels, permissions, onInstall)
├── module-registry.ts
│   ├── registerModule(config)        모듈 등록
│   ├── getInstalledModules(orgId)    조직 install 목록 조회
│   ├── installModule(orgId, moduleId)
│   └── uninstallModule(orgId, moduleId)
├── sidebar.ts
│   └── buildSidebar(org, user) → SidebarSection[]
├── catalog-page.tsx                  모듈 카탈로그 UI (WI-617)
└── permission-resolver.ts            ReBAC scope × 모듈
```

**저장**:
- `OrgModuleInstall` Prisma model: `{ orgId, moduleId, installedAt, settings }`
- 권한은 기존 ReBAC `RelationTuple`에 scope 차원 추가: `(orgId, userId, "hr:write")` 등

---

## 4. 핵심 데이터 흐름 (콘텐츠 모듈 install 후 이미지 생성)

```
사용자: /create 페이지 진입
   ↓
middleware → org module install 체크 → "content" 모듈 install 확인
   ↓
middleware → user permission 체크 → "content:write" 확인
   ↓
페이지 렌더 (page.tsx, RSC)
   ↓ Server Action 호출
@axle/pbc-image-engine.generate(req)    ← ★ WI-611
   ├─ buildPrompt(req)
   ├─ selectProvider(req)
   ├─ provider.generate(...)
   └─ getEstimatedCost(req)
   ↓
저장 (pbc-file-manager) + 크레딧 차감 (pbc-billing)
   ↓
응답 → 사용자 화면에 이미지 표시
```

**install 안 됐을 때**: middleware가 403 + "/settings/modules?focus=content"로 리다이렉트

---

## 5. WI-611~615 → v2에서 의미

| WI | v2 의미 | 유효성 |
|---|---|---|
| WI-611 | M3 콘텐츠 + M5 리터치 모듈의 핵심 의존 PBC 보강 | ✅ 유지 (모델 무관) |
| WI-612 | M2 HR 모듈의 PayrollService 팩토리 | ✅ 유지 |
| WI-613 | 모든 모듈의 theme 갈아끼움 가능하게 | ✅ 유지 |
| WI-614 (이전: showcase 데모) | ❌ 무의미 — 데모가 아니라 모듈 시스템 자체 구축이 필요 | 🔄 재정의 |
| WI-615 (이전: flowteams shell) | ❌ flowteams 자체가 흡수 대상이라 shell 적용은 무의미 | 🔄 재정의 |

---

## 6. 신규 WI 후보 (v2 도입)

| WI | 내용 | 우선순위 |
|---|---|---|
| WI-616-feat | `core-module-system` 패키지 (ModuleConfig + registry) | P0 |
| WI-617-feat | `/settings/modules` 카탈로그 UI | P0 |
| WI-618-feat | 동적 사이드바 빌더 (buildSidebar) | P0 |
| WI-619-feat | 모듈 권한 (ReBAC scope: consulting:*/hr:*/content:*/...) | P0 |
| WI-620-refactor | apps/flowteams → src/modules/hr (라우트 이전 + 디렉토리 제거) | P1 |
| WI-621-feat | 5개 모듈 메타데이터 (consulting/hr/content/erp/retouch module.config.ts) | P1 |
| WI-622-feat | 모듈별 onInstall hook (seed 데이터, default role) | P2 |
| WI-623-feat | 결제 모듈 단위 (Polar subscription per module) | P2 — 1년 후 |

---

## 7. 1년 후 도달 조건 (v2 기준)

- 단일 axle.io 플랫폼 운영
- 5-6개 모듈 운영 가능 (install/uninstall 동작)
- 외부 1개 모듈 등록 시도 (개발자가 module.config.ts 제출 → 검증 → 카탈로그 노출)
- DESIGN.md 3개 theme (FlowCoder default + 2개)
- PBC 10개 (Top 3 + billing/erp×2/file-manager/messaging/scheduler/consulting-crm)

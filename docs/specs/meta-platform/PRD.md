# Meta-Platform Promotion PRD (AXLE Sub-Spec)

> **상태**: ✅ **활성화 가능** (2026-05-04 게이트 통과)
> **작성일**: 2026-05-03 / **게이트 완화**: 2026-05-04
> **유형**: AXLE Sub-Spec (메인 PRD.md를 대체하지 않음)
> **선행 게이트**: Phase 17 (28/28 사실상 완료, WI-210만 미완) + Phase 18 핵심부 완료 (외부 의존 14건은 별도 트랙)
> **선행 분석**: `~/AX/기획/research/modular-platform/` (asset-inventory, axle-baseline-analysis, pbc-extraction-plan)

---

## 0. 본 문서의 위치

이 문서는 **AXLE의 sub-spec**이다. AXLE 본체 `PRD.md`(컨설팅 자동화 플랫폼)와 `.flowset/requirements.md`는 **건드리지 않는다**.

---

## 0.5 v3 모델 정정 (2026-05-11) — 핵심 변경

> **사용자 피드백으로 모델이 크게 정정됨**. v1/v2의 "도메인 앱 분리" 가정은 폐기. 본 PRD의 §3 §4 §9 §11 일부는 v3 정정 사항으로 대체됨. 시각적 정의는 `/Volumes/포터블/AXLE/wireframes/` 참고.

### v1/v2 → v3 변경 요약

| 항목 | v1/v2 (이전 모델) | v3 (정정) |
|---|---|---|
| 배포 단위 | 6개 별도 앱 (axle/flowstudio/flowteams/flowvue/flowretouch/+1) | **단일 플랫폼** (apps/web 하나) |
| FlowStudio/FlowVue/FlowRetouch | apps/* 신규 생성 | **별도 앱 미생성** — 기능을 모듈로 흡수 |
| FlowTeams | apps/flowteams 별도 | **apps/web/src/modules/hr/ 흡수** (WI-621) |
| 분류 단위 | 도메인 앱 | **6 Pack × 35 모듈** (자유 선택) |
| 컨설팅 묶음 | "컨설팅 전용 13 모듈" 가정 | **해체** — 고객/견적/계약/포털 모두 누구나 사용 (clientId/projectId nullable) |
| 연구일지 | 컨설팅 공통 | **Pack B (정부 지원사업)** 이동 |
| 리터치 | 별도 모듈/앱 | **제거** — Pack E의 RETOUCH 모드 흡수 |
| Tenancy | 단일 (자기 조직만) | **2-tier**: Single-org (default) / Multi-org (premium, 별도 요금제) |

### v3 단일 플랫폼 모델 (Odoo-style)

```
axle.io (apps/web 하나)
├── 공통 (항상): 로그인 / 대시보드 / 알림 / 설정 / 관리자
├── Pack A. 비즈니스 운영 (10 modules)  default 추천
├── Pack B. 정부 지원사업 + R&D (6)
├── Pack D. HR (5)                      ★ apps/flowteams 흡수
├── Pack E. 콘텐츠 (4)
├── Pack F. ERP (7)                     1년 후
└── Add-on G. Desktop (3)               Electron 필요

★ Multi-org Tier (별도 요금제):
  - Topbar 조직 스위처 (FlowCoder Inc. ↔ 관리 조직 N개)
  - 적용 모듈: A 재무/분석, B AI매칭/연구일지, D 전체
  - tenantOrgId 데이터 scope
  - ReBAC scope: tenant:* 또는 tenant:<managedOrgId>
```

### v3 성공 기준 (구 §1 §5 대체)

- 단일 플랫폼 (apps/web)에 6 Pack 운영 가능
- 35 모듈 install/uninstall 동작 (개별 + Pack 단위)
- Multi-org tier 운영 검증 (10+ 관리 조직)
- 외부 1개 모듈 등록 시도 (외부 개발자 module.config.ts 제출)
- DESIGN.md 3개 theme
- PBC 10개

### 신규 WI (v3 모듈 시스템)

WI-611~613 (PBC 보강) **유지**. WI-614/615 **재정의 또는 취소** (showcase/flowteams shell은 의미가 달라짐).

| WI | 내용 |
|---|---|
| WI-616 | `core-module-system` 패키지 (ModuleConfig + registry + dependency resolver) |
| WI-617 | `/settings/modules` Pack 카탈로그 UI |
| WI-618 | 동적 사이드바 빌더 (buildSidebar) |
| WI-619 | 모듈 ReBAC (scope: customers:* / payroll:* / ...) |
| WI-620 | Multi-org tenancy 모델 (ManagedOrg + tenantOrgId + 조직 스위처) |
| WI-621 | apps/flowteams → apps/web/src/modules/hr/ 마이그레이션 |
| WI-622~626 | Pack A/B/D/E/G 모듈 메타데이터 (각 module.config.ts) |

### 가격 정책

v3에서 가격 모델 추가됨 (TBD, 별도 라운드):
- Pack 단위 또는 개별 모듈 install
- Multi-org tier 별도 요금 (base + 관리 조직당)
- 상세 가격은 와이어프레임의 `module-catalog.md` 참고 (추정치)


**2026-05-04 갱신**: Phase 17/18 sync 결과(PR #99 `eb71097`) 핵심부가 머지 완료됨. 외부 의존 작업(14건)을 별도 트랙으로 분리하고 메타플랫폼 게이트는 "핵심부 완료"로 완화. Phase 19로의 진입이 가능한 상태.

### 외부 의존 보류 트랙 (메타플랫폼 게이트와 분리)

다음 14건은 외부 시스템(공공포털/스크래퍼) 의존도가 높아 메타플랫폼 추출과 무관하게 별도 진행한다:

- **소부장 인증 (4건)**: WI-305, 306, 307, 308 (산업부 고시 품목 마스터 데이터 + 평가 엔진)
- **연구소 일부 (2건)**: WI-310 (시설 증빙 UI), WI-312 (연구일지 자동 연결)
- **특허 (2건)**: WI-313 (KIPRIS 선행기술 API), WI-314 (특허 명세서 초안 UI)
- **외부 스크래퍼/포털 (5건)**: WI-318-4, 319-1/2 (민원24), 320-1/2 (4대보험)
- **PKCS#12 내부 서명 (1건)**: WI-321

이들 14건은 메타플랫폼 PBC 추출 대상이 아니며, AXLE 컨설팅 도메인의 외부 통합 트랙으로 별도 진행한다.

---

## 1. 프로젝트 개요

- **이름**: AXLE Meta-Platform Promotion
- **목표**: AXLE을 컨설팅 SaaS에서 **다중 도메인 메타플랫폼 monorepo**로 승격. 누적 자산(이미지 엔진 7개, 블록 빌더, HR, ERP)을 PBC(Packaged Business Capability)로 추출하여 재사용 가능한 모듈 카탈로그 구축.
- **대상 사용자**: FlowCoder 팀 (개발), 향후 메타플랫폼 위에서 운영할 SaaS의 최종 사용자
- **성공 기준** (v3 정정 — §0.5 참고):
  - 단일 플랫폼(apps/web)에 6 Pack 운영 가능 + 35 모듈 install/uninstall 동작
  - Multi-org tier 운영 (10+ 관리 조직 위탁 컨설팅 검증)
  - **3개 PBC**가 모듈에서 즉시 사용 가능 (`@axle/pbc-*`)
  - PBC 단위 테스트 커버리지 ≥ 80%
  - 7개 이미지 생성 모드가 단일 `pbc-image-engine.generate()` 호출로 작동
  - DESIGN.md 1개 theme 시범 적용

  > ~~메타플랫폼 위에서 3개 이상 도메인 앱이 동작 (axle/flowstudio/flowteams)~~ — v1/v2 가정 폐기.
  > ~~DESIGN.md 1개 시범 앱에 적용 (FlowStudio v2)~~ — FlowStudio 별도 앱 미생성, theme만 적용.

---

## 2. 기술 스택 (AXLE 상속 + 추가)

### 2.1 상속 (AXLE 현행 그대로)
- **Monorepo**: npm workspaces + Turborepo 2.5
- **언어**: TypeScript 5
- **프레임워크**: Next.js 16 App Router
- **DB**: Supabase PostgreSQL + Prisma 7 Client Engine + Driver Adapter (`@prisma/adapter-pg`)
- **인증**: Auth.js v5 Split Config + ReBAC (`RelationTuple` Google Zanzibar)
- **세션 캐시**: 3-tier (In-Memory LRU → Upstash Redis → DB)
- **인프라**: Vercel + Mac Mini + OCI VM
- **테스트**: Vitest + Playwright
- **UI**: shadcn/ui + Tailwind CSS 4
- **자동 루프**: FlowSet (`flowset.sh`) — 메타플랫폼 진입 시 별도 fix_plan 라인으로 추가

### 2.2 신규 추가
- **DESIGN.md** (Google Labs 공식 포맷) — 브랜드별 theme 갈아끼움
- **Rust 마이크로서비스** — `services/image-engine-rs/`, `services/ocr-engine-rs/` (gRPC, SeaORM 2.0)
- **Schema 분리**: 49 model이 100+로 가면 Prisma multi-schema 도입 검토

### 2.3 거부된 옵션 (decision log)
- ❌ **새 monorepo**: AXLE 인프라 재구축 비용. 거부.
- ❌ **Rust 전면 채택**: ORM 메타프로그래밍 비용 + FDP 자산 폐기. 거부.
- ❌ **AXLE 메인 PRD 덮어쓰기**: Phase 17/18 진행 중. 거부.

---

## 3. 4-Layer 아키텍처 (v3 정정 — §0.5 참고)

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: DESIGN.md theme packs                             │
│   flowcoder-default + (옵션) Pack별 theme 갈아끼움            │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Single Platform + Pack 모듈 시스템                  │
│                                                              │
│   apps/                                                      │
│     ├─ web/         (★ 단일 플랫폼 — 모든 모듈 라우트 호스팅) │
│     │    src/app/(platform)/ 안에 35 모듈 페이지              │
│     │    src/modules/{pack-a,pack-b,pack-d,pack-e,pack-f,pack-g}/ │
│     ├─ desktop/     (현행 유지 — Pack G 모듈 IPC 제공)        │
│     ├─ agent-bridge/(현행 유지 — AI 백그라운드 서비스)         │
│     └─ ~~flowvue/ flowteams/ flowstudio/~~ — v1/v2 폐기, 흡수 │
│                                                              │
│   packages/  [기존 11 횡단 + 신규 PBC]                       │
│     [횡단 — AXLE 현행 11개 유지]                              │
│     ai/  auth/  crawler/  db/  docgen/                       │
│     email/  matching/  notification/  ocr/  storage/  ui/    │
│                                                              │
│     [PBC — 신규]                                              │
│     pbc-image-engine/    (Top 1 — 7개 앱 통합)               │
│     pbc-block-builder/   (Top 2 — 23블록 4 출력)             │
│     pbc-hr-payroll/      (Top 3 — FlowTeams 추출)            │
│                                                              │
│     [Core — 신규]                                             │
│     core-design-md/      (DESIGN.md 로더, ★ WI-613)          │
│     core-module-system/  (★ WI-616, Pack/Module registry)    │
│     core-rebac/          (현 packages/auth ReBAC 로직 추출)  │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: FDP Core (현행)                                    │
│   Next.js 16 + Prisma 7 + Auth.js 5 + ReBAC + 3-tier 세션   │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Rust 마이크로서비스 (gRPC, 신규)                    │
│   services/image-engine-rs/  (Z-Image + FLUX.2)              │
│   services/ocr-engine-rs/    (PaddleOCR-VL)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. L1 도메인 (Phase 19+ 후속 작업)

### L1-A: PBC 추출 (3개)

#### L2-A1: pbc-image-engine
> **상세 계약**: [`./pbc-image-engine.md`](./pbc-image-engine.md)
> 출처: AX Studio + AX Studio Cloud + AX Studio YH + FlowStudio v1/re/v2 + FlowRetouch
> 인터페이스: `ImageProvider` 5종 + `GenerationMode` 7종 + ComfyUI 어댑터 신규
> 기간: 4주

#### L2-A2: pbc-block-builder
> **상세 계약**: [`./pbc-block-builder.md`](./pbc-block-builder.md)
> 출처: FlowStudio v2 23블록 (`lib/detail-page/blocks/`)
> 출력 4종: HTML, Markdown, React, DOCX element
> 기간: 4주

#### L2-A3: pbc-hr-payroll
> **상세 계약**: [`./pbc-hr-payroll.md`](./pbc-hr-payroll.md)
> 출처: FlowTeams (Attendance + Payroll + Leave + AiConsultation)
> FlowTeams를 `apps/flowteams/`로 이전
> 기간: 6주

### L1-B: 코어 인프라 (보조)

#### L2-B1: core-design-md
- DESIGN.md 파서 + 로더
- React 컴포넌트에 디자인 토큰 주입
- 시범: apps/web (FlowCoder default theme)
- WI-613

#### L2-B2: core-rebac
- 현 `packages/auth/` 안의 ReBAC 로직을 분리
- 다른 PBC들이 권한 결정 로직만 import 가능하게
- v3에서 추가: **tenant scope** 지원 (Multi-org tier용 — tenant:* / tenant:<managedOrgId>)

#### L2-B3: core-module-system (★ v3 신규)
- Pack/Module 메타데이터 registry
- ModuleConfig: `{ id, packId, label, route, permission, multiOrg, pbc, deps, prismaModels, onInstall }`
- PackConfig: `{ id, label, modules, pricing, recommended }`
- API: `registerModule` / `installModule` / `installPack` / `buildSidebar(orgId, userId, activeTenant)` / `isMultiOrgActive` / `checkDependencies`
- WI-616

### L1-D: Multi-org Tenancy (★ v3 신규)

#### L2-D1: ManagedOrg 모델 + Tenant scoping
- `model ManagedOrg { id, ownerOrgId, name, status, installedPacks }`
- 모든 multi-org 적용 테이블에 `tenantOrgId` 추가 (self 또는 ManagedOrg.id)
- Topbar 조직 스위처 UI
- ReBAC scope: tenant:* (모든) / tenant:<managedOrgId> (특정)
- 적용 모듈: A 재무/분석, B AI매칭/연구일지, D 전체
- WI-620

### L1-C: Rust 마이크로서비스 (PoC)

#### L2-C1: image-engine-rs
- gRPC 서버 (axum + tonic)
- ComfyUI 워크플로우 호출 래퍼
- SeaORM 2.0으로 metadata DB 접근
- 기존 Python 파이프라인과 성능 비교 fixture

---

## 5. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| **PBC 격리** | PBC는 인증/결제/큐/스토리지에 직접 의존 금지. 횡단 패키지 호출만 허용 |
| **테스트 커버리지** | 각 PBC ≥ 80% (Vitest) |
| **타입 안전** | TypeScript strict, `any` 금지 |
| **빌드 시간** | Turborepo 캐시 hit 시 ≤ 30초 |
| **순환 의존 금지** | PBC 간 의존은 단방향만 (DAG) |
| **Schema 변경 호환성** | 기존 AXLE 49 model에 영향 없도록 PBC 모델은 별도 schema namespace 검토 |
| **DESIGN.md 호환** | Google Labs 공식 포맷 준수 |
| **Rust 적용 범위** | `services/`만. `packages/` Rust 금지 |

---

## 6. 외부 연동 (현행 유지)

- Google GenAI / Vertex AI / OpenRouter (이미지)
- ComfyUI (로컬) / ViewComfy (클라우드, AX Studio Cloud)
- Polar (결제)
- Supabase / Upstash Redis / Resend / Solapi
- Anthropic Claude API / OpenAI / Google Gemini

---

## 7. 진행 룰 (변경 불가)

| 룰 | 근거 |
|---|---|
| **AXLE 메인 PRD/requirements.md 수정 절대 금지** | wi-flowset.md 룰 |
| **동시 진행 PBC ≤ 2개** | Odoo 실패 사례 (10-20x effort) |
| **Phase 17/18 완료 전 시작 금지** | 추출 대상이 안정화돼야 깔끔히 분리 |
| **PBC = 순수 도메인 동작** | 인증/결제/큐는 횡단 패키지 책임 |
| **block-builder는 image-engine 의존 OK** | 1주차 겹침 시작 가능 |
| **Rust 확장 금지** | image/ocr 외 신규 Rust 거부 |

---

## 8. 결정 로그

| 일자 | 결정 | 근거 |
|---|---|---|
| 2026-05-03 | 메타플랫폼 컨셉 진행 | Gartner PBC 정합 (2027 80% composable) |
| 2026-05-03 | AXLE 직접 승격 (vs 새 monorepo) | 80% baseline 검증, 인프라 재구축 비용 |
| 2026-05-03 | Rust 부분 채택 (image/ocr만) | SeaORM 2.0 production-ready, FDP 자산 보존 |
| 2026-05-03 | Phase 17/18 완료 후 진입 | 추출 대상 안정화 필요 |
| 2026-05-03 | Sub-spec 형태 저장 | AXLE 메인 PRD/requirements.md 보호 |
| 2026-05-03 | PBC Top 3 선정 | 재사용 빈도 × 추출 난이도 매트릭스 |
| 2026-05-04 | fix_plan.md sync (PR #99) | recover + reconcile 1회 — Phase 17/18 진행도 정확화 (129건 sync) |
| 2026-05-04 | 외부 의존 14건 별도 트랙 분리 | 메타플랫폼 PBC 추출과 독립 — 무한 대기 방지 |
| 2026-05-04 | 게이트 "핵심부 완료"로 완화 | Phase 17 사실상 완료 + Phase 18 핵심부(벤처/연구소/특허/BUNDLE) 머지 |

---

## 9. 활성화 절차

### 9.1 게이트 통과 확인 (2026-05-04 완료)
- ✅ Phase 17 sync: completed_wis.txt에 WI-201~228 등록 (1건 미완: WI-210 rhwp adapter — 우선순위 낮음)
- ✅ Phase 18 핵심부 sync: 벤처/연구소/특허/BUNDLE/포털스크래퍼 핵심 완료 (PR #99)
- ✅ 외부 의존 14건은 별도 트랙으로 분리

### 9.2 진입 절차 (v3 정정)

**완료된 단계 (~2026-05-07)**:
1. ~~Phase 19 fix_plan 추가~~ ✅ — WI-401~410/501~511/601~610 머지 완료
2. ~~블로커 수정 (B1/B2/S10)~~ ✅ — PR #100 머지
3. 후속 audit (2026-05-07): WI-611~615 추가 (PBC 보강 + 모듈 시스템 도입)

**v3 진입 절차 (2026-05-11~)**:
1. `.flowset/fix_plan.md`에서 WI-614/615 취소 또는 재정의 (의미 달라짐)
2. WI-616~626 신규 등록:
   - WI-616 core-module-system (foundation)
   - WI-617 Pack 카탈로그 UI
   - WI-618 동적 사이드바
   - WI-619 모듈 ReBAC (scope)
   - WI-620 Multi-org tenancy 모델
   - WI-621 apps/flowteams → src/modules/hr 마이그레이션
   - WI-622~626 Pack A/B/D/E/G 모듈 메타데이터
3. Sprint contracts 작성 (`.flowset/contracts/sprint-616.md` ~ `sprint-626.md`)
4. `flowset.sh` 재기동 → WI-611~613 (PBC 보강) → WI-616~626 (모듈 시스템) 순차 진행

### 9.3 외부 의존 트랙 (병렬, 게이트 무관)
- 14건의 외부 시스템 의존 작업은 메타플랫폼 PBC 추출과 독립적으로 진행
- 외부 시스템 안정화 (공공포털 API/스크래퍼 신뢰도) 시점에 재개

---

## 10. 위험 & 대응

| 리스크 | 확률 | 영향 | 대응 |
|---|---|---|---|
| ~~Phase 17/18이 6개월 초과~~ ✅ **해결 (2026-05-04)** | — | — | 외부 의존 14건을 별도 트랙으로 분리하여 게이트 통과 |
| 외부 의존 트랙 (14건) 무한 보류 | 中 | 中 | 분기별 재평가, 외부 API 안정화 시점 식별 |
| 추출 시점에 PBC 후보 코드가 변경됨 | 高 | 中 | 활성화 시점에 본 PRD를 재검토 (절차 9.2) |
| AXLE 컨설팅 색채가 다른 앱 추가에 부담 | 中 | 中 | apps 분리 + packages는 도메인-중립 PBC 우선 |
| FlowTeams가 자체 진행 중이라 추출 불가능 | 高 | 中 | FlowTeams v1 안정화 후 fork 추출 |
| 49 → 100+ model 시 Prisma 한계 | 中 | 中 | multi-schema 또는 도메인별 Prisma client 분리 |
| Rust 마이크로서비스 운영 부담 | 中 | 中 | 첫 PoC만 수행 후 ROI 측정, 확장 보류 가능 |
| 리뷰 블로커 (B1/B2) 미수정 시 PBC 충돌 | 高 | 中 | 절차 9.2.4에 따라 활성화 전 수정 필수 |

---

## 부록 A. 관련 문서

### 본 sub-spec (AXLE 안)
- [`./vision-and-expansion.md`](./vision-and-expansion.md) — 5-year 비전 + 확장 PBC 카탈로그 + 참고 프로젝트 매트릭스 + 거버넌스 + 수익 모델 (2026-05-04 추가)
- [`./pbc-image-engine.md`](./pbc-image-engine.md) — Sprint Contract Top 1
- [`./pbc-block-builder.md`](./pbc-block-builder.md) — Sprint Contract Top 2
- [`./pbc-hr-payroll.md`](./pbc-hr-payroll.md) — Sprint Contract Top 3

### 기획 워크스페이스 (외부)
- `~/AX/기획/research/modular-platform/asset-inventory.md` — 26개 프로젝트 자산 카탈로그
- `~/AX/기획/research/modular-platform/axle-baseline-analysis.md` — AXLE 승격 결정 근거
- `~/AX/기획/research/modular-platform/pbc-extraction-plan.md` — Top 3 Sprint Contracts (원본)
- `~/AX/기획/research/modular-platform/vision-and-expansion.md` — 비전 (정합 본은 AXLE 안에 있음)

### AXLE 본체 (수정 금지)
- `/Volumes/포터블/AXLE/PRD.md` — AXLE 메인 PRD
- `/Volumes/포터블/AXLE/.flowset/requirements.md` — AXLE 사용자 원본 요구사항

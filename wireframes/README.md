# AXLE 메타플랫폼 — 와이어프레임 (v3: 6 Pack + Multi-org Tenancy)

> **작성일**: 2026-05-11
> **버전 노트**:
> - v1: "6개 별도 앱" (잘못)
> - v2: "1개 플랫폼 + 5개 도메인 모듈" (정정 1차)
> - **v3 (현재)**: "1개 플랫폼 + 6 Pack (35 모듈) + Multi-org tenancy 차원"

---

## 핵심 두 줄

> **AXLE은 단일 플랫폼이고, 사용자는 원하는 기능만 모듈/Pack으로 install해서 쓴다.**
> 추가로 **Multi-org tenancy**가 별도 요금제 — 본인 조직 1개만 쓰거나, N개 관리 조직을 위탁 관리할 수 있음.

---

## 보는 순서

1. **[module-catalog.md](./module-catalog.md)** — 35 모듈 + 6 Pack + Multi-org tier 정의
2. **[architecture.md](./architecture.md)** — 4-Layer + Pack ⊃ Module ⊃ PBC 매트릭스
3. **[sitemap.md](./sitemap.md)** — 단일 플랫폼 라우트 + 조직 스위처
4. **[pbc-usage.md](./pbc-usage.md)** — PBC × 모듈 매핑
5. **HTML 와이어프레임** (브라우저로 열기):
   - [shared/shell.html](./shared/shell.html) — Pack-aware 사이드바 + 조직 스위처
   - [platform/dashboard.html](./platform/dashboard.html) — 통합 대시보드
   - [platform/pack-catalog.html](./platform/pack-catalog.html) — Pack/모듈 install/uninstall
   - [platform/org-switcher.html](./platform/org-switcher.html) — Multi-org 동작
   - Pack 상세:
     - [packs/A-business.html](./packs/A-business.html) — 비즈니스 운영 (10 modules, default)
     - [packs/B-rd-support.html](./packs/B-rd-support.html) — 정부 지원사업 + R&D (6, ★ 연구일지 포함)
     - [packs/D-hr.html](./packs/D-hr.html) — HR (5, ★ WI-612 + flowteams 흡수)
     - [packs/E-content.html](./packs/E-content.html) — 콘텐츠 (4, ★ WI-611)
     - [packs/F-erp.html](./packs/F-erp.html) — ERP (7, 1년 후)
     - [packs/G-desktop.html](./packs/G-desktop.html) — Desktop Add-on (3)
   - 동반 앱 (별도 배포):
     - [companion/desktop.html](./companion/desktop.html) — Electron 클라이언트
     - [companion/agent-bridge.html](./companion/agent-bridge.html) — AI 백그라운드 서비스

```bash
open wireframes/README.md
open wireframes/shared/shell.html
open wireframes/platform/dashboard.html
open wireframes/platform/pack-catalog.html
open wireframes/platform/org-switcher.html
```

---

## v2 → v3 변경 요약

| 항목 | v2 | v3 |
|---|---|---|
| 모듈 분류 | 5개 도메인 모듈 | **6 Pack × 35 모듈** |
| 컨설팅 Pack | 13 모듈 묶음 | **해체** — Pack A로 흡수 (자유도 개방) |
| 고객/견적/계약/포털 | 컨설팅 전용 | **누구나** (clientId/projectId nullable) |
| 연구일지 | Pack A 공통 | **Pack B로 이동** (정부 R&D 일지 핵심) |
| 리터치 모듈 | M5 별도 | **제거** — Pack E의 RETOUCH 모드로 흡수 |
| Multi-org | 미정 | **별도 tier** — 재무/분석/B 전체/D 전체 적용 |

---

## Pack 구성 (한눈에)

| Pack | 모듈 수 | 가격 | 다중 조직(★) |
|---|---|---|---|
| **A. 비즈니스 운영** (default) | 10 | ₩59,000 | 재무·분석 |
| **B. 정부 지원사업** | 6 | ₩39,000 | AI 매칭·연구일지 |
| **D. HR** | 5 | ₩49,000 + 직원 수 | 전체 |
| **E. 콘텐츠** | 4 | ₩59,000 + 크레딧 | (불가) |
| **F. ERP** | 7 | ₩89,000 | (불가) |
| **G. Desktop Add-on** | 3 | ₩29,000 | (불가) |
| **Multi-org Tier** | — | TBD | (적용 모듈 위 ★) |

**총 35 modules** (리터치 제거 후).

---

## WI 영향

| WI | v3에서 의미 | 상태 |
|---|---|---|
| WI-611 | Pack E (이미지 생성) 핵심 의존 PBC 보강 | ✅ 유지 |
| WI-612 | Pack D HR (PayrollService 팩토리) | ✅ 유지 |
| WI-613 | core-design-md — Pack별 theme 갈아끼움 | ✅ 유지 |
| WI-614 | (이전 showcase 데모) | 🔄 **재정의** → Pack E 모듈 데모 |
| WI-615 | (이전 flowteams shell) | 🔄 **재정의** → flowteams 흡수 (WI-621) |

### 신규 WI 후보 (모듈 + Multi-org 시스템)

| WI | 내용 |
|---|---|
| WI-616 | `core-module-system` 패키지 (ModuleConfig + registry + dependency resolver) |
| WI-617 | `/settings/modules` Pack 카탈로그 UI |
| WI-618 | 동적 사이드바 빌더 (buildSidebar) |
| WI-619 | 모듈 ReBAC (scope: customers:*/payroll:*/...) |
| WI-620 | **Multi-org tenancy 모델** (tenantOrgId, ManagedOrg, 조직 스위처) |
| WI-621 | apps/flowteams → src/modules/hr 마이그레이션 |
| WI-622 | Pack A 모듈 메타데이터 (10개 module.config.ts) |
| WI-623 | Pack B 모듈 메타데이터 (6개) |
| WI-624 | Pack D 모듈 메타데이터 (5개) |
| WI-625 | Pack E 모듈 메타데이터 (4개) |
| WI-626 | Pack G 모듈 메타데이터 (3개) |

총 11 신규 WI. Pack F (ERP)는 PBC 추출 자체가 1년 후라 후속.

---

## 디렉토리

```
wireframes/
├── README.md                ← 이 파일
├── module-catalog.md        Pack/모듈 정의 + install 흐름 + Multi-org tier
├── architecture.md          4-Layer + Pack × Module × PBC 매트릭스
├── sitemap.md               단일 플랫폼 라우트 + 조직 스위처
├── pbc-usage.md             PBC × 모듈 매핑
├── shared/
│   ├── design-tokens.css    FlowCoder default theme
│   └── shell.html           Pack-aware + 조직 스위처 (★ v3)
├── platform/
│   ├── dashboard.html       통합 대시보드 + Multi-org KPI
│   ├── pack-catalog.html    Pack/모듈 install/uninstall
│   └── org-switcher.html    Multi-org tenancy 동작
├── packs/
│   ├── A-business.html      10 modules
│   ├── B-rd-support.html    6 modules (연구일지 포함)
│   ├── D-hr.html            5 modules (★ WI-612 + flowteams 흡수)
│   ├── E-content.html       4 modules (★ WI-611)
│   ├── F-erp.html           7 modules (1년 후)
│   └── G-desktop.html       3 modules (Add-on)
└── companion/
    ├── desktop.html         Electron 클라이언트 (별도 앱)
    └── agent-bridge.html    HTTP 서비스 (별도 앱)
```

---

## 다음 단계

1. **PRD 수정**: `docs/specs/meta-platform/PRD.md`를 v3 모듈/Pack/Multi-org 모델로 재작성
2. **WI 재정의**: WI-614/615 취소, WI-616~626 sprint contract 작성
3. **`flowset.sh` 자율 루프 가동**: 별도 터미널

---

## 가격 정책 (TBD)

본 와이어프레임에 표시된 가격은 추정치. 실 가격 + Multi-org tier 가격 + 관리 조직 단가는 추후 별도 라운드.

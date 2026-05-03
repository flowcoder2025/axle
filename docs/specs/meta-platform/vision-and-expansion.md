# 메타플랫폼 — 비전 & 확장성 전략

> 작성일: 2026-05-04
> 위치: `~/AX/기획/research/modular-platform/vision-and-expansion.md`
> 정합 산출물 (AXLE 안): `/Volumes/포터블/AXLE/docs/specs/meta-platform/PRD.md`
> 선행 문서: `asset-inventory.md`, `axle-baseline-analysis.md`, `pbc-extraction-plan.md`
> 목적: 메타플랫폼 자체의 5-year 비전, 확장 PBC 카탈로그, 참고 프로젝트 비교, 거버넌스, 수익화 모델 정의

---

## 0. TL;DR

- **비전**: AXLE을 "FlowCoder의 모든 SaaS·도구가 위에서 돌아가는 단일 메타플랫폼"으로 발전. 1년 내 6개 도메인 앱 + 10개 PBC + 1개 마켓플레이스 PoC.
- **확장 원칙**: PBC = 순수 도메인 / 횡단은 packages / 앱은 thin shell / DESIGN.md로 브랜드만 갈아끼움.
- **참고 패턴**: Odoo `_inherit` (메타프로그래밍), Shopify partner ecosystem (네트워크 효과), n8n Function node (인라인 확장), Salesforce AppExchange (마켓플레이스 거버넌스).
- **거부 패턴**: Odoo XML view, Salesforce Apex 벤더 락, SAP HANA 종속, WordPress 코어 수정.
- **수익 모델**: 하이브리드 (내부용 + B2B SaaS per-app + 컨설팅 라이선싱) — 마켓플레이스는 1년 후 고려.
- **거버넌스**: SemVer + ADR + PBC 추가 시 RFC 1주 + 동시 진행 ≤ 2개 강제.
- **첫 6개월 목표**: Top 3 PBC 안정화 + 외부 1개 PBC 등록 시도 (개발자 경험 검증).

---

## 1. 5-Year 비전

### 1.1 비전 선언

> **"FlowCoder가 새 SaaS 아이디어를 받으면 1주 안에 메타플랫폼 위에서 동작 데모가 나온다."**

이를 위해:
- 비즈니스 도메인 PBC가 충분히 축적되어 새 앱은 **조합** 작업이 됨 (zero-code 지점은 아니지만 thin shell)
- DESIGN.md 갈아끼움으로 브랜드 차별화
- 내부 컨설팅 업무 + 외부 파트너 SaaS 모두 같은 monorepo에서 운영

### 1.2 시간축 별 모습

#### 1년 후 (2027-05)
- **앱 6개**: axle / flowstudio / flowteams / flowvue / flowretouch + 1개 신규
- **PBC 10개**: image-engine / block-builder / hr-payroll / billing / erp-inventory / erp-orders / consulting-crm / file-manager / scheduler / messaging
- **외부 의존**: Polar 결제 / 공공 API 통합 안정화
- **DESIGN.md**: 3개 브랜드 theme 운영 (FlowCoder / AX Studio / 파트너 1)
- **사용자 규모**: 컨설팅 팀 5명 + 외부 파트너 1-2팀

#### 3년 후 (2029-05)
- **앱 12-15개**: 신규 도메인(교육/시니어 동반/B2B MRO) 진입
- **PBC 20+개**: 분야별 깊이 (HR 4개, ERP 5개, 콘텐츠 4개, 컨설팅 3개, ...)
- **Rust 마이크로서비스**: image-engine-rs + ocr-engine-rs + 1-2개 추가 (성능 병목 식별 후)
- **마켓플레이스 PoC**: 외부 개발자가 PBC 1개 등록 가능 (read-only 카탈로그)
- **i18n**: ko / en / 일본어 1개 도메인
- **수익 구조**: B2B SaaS 운영 + 컨설팅 라이선싱 + 1-2개 white-label 계약

#### 5년 후 (2031-05)
- **에코시스템**: 외부 개발자 PBC 등록 활성화 (검증 게이트 통과 시)
- **AI 통합 표준**: 모든 PBC가 일관된 AI agent 호출 인터페이스 제공
- **컴플라이언스**: GDPR / K-DPA / 일부 산업 인증 (의료/금융 등 옵션 PBC)
- **운영 규모**: 동시 운영 앱 30+, 월 활성 사용자 100k+
- **수익**: SaaS 매출 + 마켓플레이스 수수료 + 엔터프라이즈 라이선스

### 1.3 사용 시나리오 (5개)

#### S1: "사업계획서 자동화 SaaS" 신규 출시 (1년 후)
1. 컨설턴트가 새 SaaS 아이디어 제출
2. AXLE에서 `apps/biz-plan/` shell 생성 (1일)
3. 기존 PBC 조합: `pbc-block-builder` (사업계획서 블록) + `pbc-image-engine` (도해 생성) + `pbc-billing` (결제) + `pbc-consulting-crm` (고객 관리)
4. DESIGN.md `biz-plan-theme.md` 작성 (1일)
5. 신규 비즈니스 로직만 작성 (3일) → 1주 만에 동작 데모

#### S2: 파트너 White-label 요청 (1.5년 후)
1. 여유솔루션이 자기 브랜드 ERP를 메타플랫폼 위에서 운영하고 싶어함
2. `apps/yeoyou-erp/` 생성 + DESIGN.md `yeoyou-theme.md` 적용
3. 기존 ERP PBC 재활용 (pbc-erp-inventory, pbc-erp-orders, pbc-erp-finance)
4. 도메인 `erp.yeoyou.solutions`로 배포
5. 데이터는 Organization scoped row-level isolation
6. 라이선스 모델: 기본 사용료 + 파트너 매출 N% 분배

#### S3: 외부 개발자 PBC 등록 (3년 후, 마켓플레이스)
1. 외부 개발자가 `pbc-real-estate-listings` (부동산 매물) 작성
2. AXLE 마켓플레이스에 등록 신청
3. 자동 검증 (인터페이스 / 테스트 / 보안)
4. 수동 게이트 (Architectural review + 비즈니스 정책 검토)
5. 승인 후 `apps/realty-saas/` 같은 신규 앱이 즉시 사용
6. 수익 분배: 마켓플레이스 수수료 30% / 개발자 70%

#### S4: AI Agent 일괄 통합 (3-5년 후)
1. Anthropic이 새 모델 출시 → 메타플랫폼의 모든 PBC가 신규 모델 사용
2. `packages/ai/` 단일 어댑터에서 일괄 적용
3. PBC는 인터페이스 변경 없음 — `packages/ai`가 추상화

#### S5: 컴플라이언스 트리거 (5년 후)
1. 의료 데이터를 다루는 신규 SaaS 요구
2. 옵션 PBC `pbc-hipaa-audit-log` 등록 (해당 앱만 사용)
3. Multi-tenancy를 row-level → schema-level isolation으로 승격
4. 다른 앱 영향 0

---

## 2. PBC 카탈로그 로드맵

### 2.1 Top 3 (Phase 19, 6개월) — 확정

| # | PBC | 출처 | 상태 |
|---|---|---|---|
| 1 | `pbc-image-engine` | AX Studio + FlowStudio + FlowRetouch | WI-401~410 등록 |
| 2 | `pbc-block-builder` | FlowStudio v2 21블록 | WI-501~511 등록 |
| 3 | `pbc-hr-payroll` | FlowTeams | WI-601~610 등록 |

### 2.2 Top 10 (1년 후 목표)

| # | PBC | 출처 / 신규 | 우선순위 근거 |
|---|---|---|---|
| 4 | `pbc-billing` | Polar 래퍼 | 거의 완성, 모든 SaaS 필요 |
| 5 | `pbc-consulting-crm` | AXLE web의 clients/contracts/programs | AXLE 핵심 도메인, 추출 가치 명확 |
| 6 | `pbc-erp-inventory` | FlowVue 재고 | 분리 가능한 단일 도메인 |
| 7 | `pbc-erp-orders` | FlowVue 주문 + taekyung-mall | B2B 수요 ↑ |
| 8 | `pbc-file-manager` | AXLE storage 패키지 + AX Studio uploads | 모든 앱이 사용 |
| 9 | `pbc-messaging` | AXLE notification + Solapi/Resend | 횡단 핵심 |
| 10 | `pbc-scheduler` | AXLE calendar | 일정/예약 도메인 |

### 2.3 Top 20 (3년 후 후보)

| # | PBC | 도메인 |
|---|---|---|
| 11 | `pbc-finance-accounting` | 회계/재무제표 |
| 12 | `pbc-tax-filing` | 세무 (한국 한정) |
| 13 | `pbc-document-vault` | 문서 보관 / 서명 |
| 14 | `pbc-meeting-intelligence` | 미팅 녹음/전사/요약 (AXLE meeting 추출) |
| 15 | `pbc-knowledge-rag` | 도메인별 RAG 검색 |
| 16 | `pbc-marketplace-listing` | 외부 판매 자산 |
| 17 | `pbc-education-courses` | 강의 / 학습 (Senior Companion / Kids Coding) |
| 18 | `pbc-iot-telemetry` | 디바이스 데이터 (제조업 AX) |
| 19 | `pbc-vision-quality` | 비전 품질 검사 (제조업) |
| 20 | `pbc-real-estate-listings` | 부동산 (외부 개발자 PoC) |

### 2.4 의존성 DAG

```
[ 횡단 코어 ]
  packages/db ← packages/auth ← core-rebac
  packages/ai
  packages/storage
  packages/notification
  packages/email
  packages/ui

[ 비즈니스 PBC — 단방향 의존 ]
  pbc-billing → packages/auth, packages/db
  pbc-image-engine → (pure, 외부 API만)
  pbc-block-builder → pbc-image-engine? (optional)
  pbc-hr-payroll → packages/db, packages/ai (노무자문)
  pbc-consulting-crm → packages/db, packages/notification
  pbc-erp-inventory → packages/db
  pbc-erp-orders → pbc-erp-inventory, pbc-billing
  pbc-file-manager → packages/storage
  pbc-messaging → packages/notification, packages/email
  pbc-scheduler → packages/db
  pbc-finance-accounting → pbc-erp-orders, pbc-billing
  pbc-tax-filing → pbc-finance-accounting
  pbc-document-vault → pbc-file-manager
  pbc-meeting-intelligence → packages/ai, packages/storage
  pbc-knowledge-rag → packages/ai, packages/db (pgvector)
```

**룰**: PBC 간 의존은 **단방향 DAG만 허용**. 순환 발생 시 PR reject.

### 2.5 우선순위 매트릭스 (재사용 빈도 × ROI × 추출 난이도)

```
재사용 빈도 ↑
   │
   │ pbc-billing       pbc-image-engine
   │ pbc-file-manager  pbc-block-builder
   │ pbc-messaging
   │
   │ pbc-consulting    pbc-hr-payroll
   │   -crm            pbc-erp-inventory
   │ pbc-scheduler     pbc-erp-orders
   │
   │ pbc-knowledge     pbc-finance
   │   -rag            -accounting
   │
   └─────────────────────────────────→ ROI ↑
        (위→아래: 추출 난이도 ↑)
```

---

## 3. 참고 프로젝트 매트릭스

### 3.1 비교 차원

| 차원 | 정의 |
|---|---|
| **확장 단위** | 어떻게 새 기능을 추가? (모듈 / 플러그인 / 노드 / 앱) |
| **데이터 모델 통합** | 어떻게 모듈 간 데이터를 연결? (ORM 상속 / API 호출 / shared DB) |
| **개발자 경험** | 외부 개발자가 만들기 쉬운가? |
| **마켓플레이스 모델** | 어떻게 수익 분배? |
| **벤더 락 정도** | 다른 환경으로 이전 가능한가? |

### 3.2 7개 프로젝트 비교

| 프로젝트 | 확장 단위 | 데이터 통합 | 개발자 경험 | 마켓플레이스 | 벤더 락 |
|---|---|---|---|---|---|
| **Odoo** | Module (Python + XML) | ORM `_inherit` 메타프로그래밍 | 중 (Python 파이썬+XML 학습 부담) | App Store (수익 분배) | 중 (오픈소스지만 Odoo 종속 큼) |
| **Salesforce** | Package (Apex/LWC) | Object metadata, SOQL | 낮음 (Apex 종속) | AppExchange (활성, 수수료 25%) | **매우 큼** (Apex 코드 비호환) |
| **Notion** | Block + Database | Block reference + database relations | 좋음 (사용자 친화) | Limited (template gallery만) | 큼 (export 제한) |
| **n8n** | Custom Node (TypeScript) | 노드 input/output JSON | 좋음 (npm 패키지로 배포) | Community Nodes (무료) | 작음 (self-host 가능) |
| **Shopify** | App (Theme + Function) | GraphQL Admin API | 좋음 (App Bridge SDK) | App Store (활성, 매우 큰 수익) | 중 (Shopify Payments 등 종속) |
| **SAP S/4HANA** | Extension (BTP) | OData service | 매우 낮음 (전문 인력 필수) | SAP Store | **매우 큼** (HANA DB 종속) |
| **WordPress** | Plugin (PHP) | hook + filter API | 매우 좋음 (PHP) | wordpress.org/plugins (무료 + premium) | 작음 (오픈소스, 자유) |

### 3.3 빌릴 것 / 거부할 것 / 우리 선택

| 패턴 | 출처 | 우리 선택 |
|---|---|---|
| **`_inherit` 메타프로그래밍** | Odoo | ⚠️ **부분 채택** — TypeScript에서는 인터페이스 구성으로 흉내 (decorator + composition). Odoo만큼 동적은 아니지만 충분 |
| **모듈 마켓플레이스** | Shopify / Salesforce / WordPress | ✅ **채택** — 3년 후 PoC 목표. 수수료 30%로 시작 |
| **AppExchange 거버넌스** | Salesforce | ✅ **채택** — RFC 1주 + 자동검증 + 수동게이트 |
| **n8n custom node 패턴** | n8n | ✅ **채택** — npm 패키지로 PBC 배포, 외부 개발자 진입 장벽 낮춤 |
| **Plugin hook/filter API** | WordPress | ✅ **채택** — `packages/notification`이 이벤트 발행, PBC가 구독 |
| **Block-based 콘텐츠** | Notion | ✅ **채택** (이미 `pbc-block-builder`로 통합) |
| **Apex 같은 도메인 특화 언어** | Salesforce | ❌ **거부** — TypeScript 강제, 학습 비용 폭증 |
| **HANA DB 종속** | SAP | ❌ **거부** — Postgres 기반 유지 |
| **XML view 정의** | Odoo | ❌ **거부** — React + zod schema로 대체 |
| **PHP 코어 (Hooks 위주)** | WordPress | ❌ **거부** — 타입 안전 부재 |
| **벤더 종속 결제** | Shopify Payments | ❌ **거부** — Polar 어댑터로 분리, 다른 결제 PSP 추가 가능 |

### 3.4 우리만의 차별점

- **TypeScript end-to-end** (DB schema → 인터페이스 → UI 일관)
- **DESIGN.md 표준** (Google Labs 공식 — 다른 메타플랫폼이 아직 채택 안 함)
- **AI Agent 일급** (`packages/ai` 표준 + Claude/OpenAI/Local LLM 어댑터)
- **FlowSet 자동 루프** (개발 자체가 자동화)
- **한국 법규 fixture** (4대보험율 / 소득세 / HWPX) — 한국 시장 특화 강점

---

## 4. 확장 메커니즘

### 4.1 PBC 컨벤션 5원칙

1. **순수 도메인 동작**: 인증·결제·큐·스토리지 직접 의존 금지. 횡단 패키지 호출만.
2. **단방향 의존**: 다른 PBC를 import해도 OK, 단 DAG (순환 금지)
3. **타입 인터페이스로 노출**: 클래스 인스턴스 대신 typed function exports + interface 정의
4. **의존성 주입**: PBC는 `createXxxService(deps: { prisma, ai, ... })` 팩토리 패턴
5. **테스트 가능**: 각 PBC ≥ 80% coverage, 외부 의존은 mock

### 4.2 PBC 템플릿 / 스캐폴딩

```bash
# 향후 추가될 명령 (스캐폴딩 도구)
npm create @axle/pbc -- --name pbc-real-estate-listings

# 자동 생성:
# packages/pbc-real-estate-listings/
# ├── src/
# │   ├── types.ts       (placeholder)
# │   ├── index.ts       (exports)
# │   └── service.ts     (createXxxService factory)
# ├── __tests__/
# ├── package.json       (@axle/pbc-real-estate-listings, deps prefilled)
# ├── tsconfig.json      (extends root)
# ├── README.md          (template)
# └── CHANGELOG.md       (v0.1.0 placeholder)
```

표준 `package.json` 템플릿:
```json
{
  "name": "@axle/pbc-real-estate-listings",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "@axle/db": "*",
    "@axle/auth": "*"
  }
}
```

### 4.3 PBC 라이프사이클

```
v0.1 (alpha)   → 내부 사용만, 인터페이스 자유 변경
v0.5 (beta)    → 1개 앱이 production에서 사용
v1.0 (stable)  → 인터페이스 고정, breaking change는 v2.0으로
v1.x           → 기능 추가만 (호환 유지)
v2.0           → breaking change 허용, 6개월 v1.x 유지 의무
deprecated     → 1년 deprecation period 후 archive
```

### 4.4 외부 개발자 경험

#### 단계별 진입
- **Level 1**: PBC 사용만 (npm install)
- **Level 2**: 자체 PBC 작성 (private)
- **Level 3**: 마켓플레이스 등록 (RFC + 검증 후)

#### 마켓플레이스 등록 절차 (3년 후 활성화)
1. **RFC 제출**: PBC 명세 + 인터페이스 + 의존성
2. **자동 검증**: lint + test (≥80%) + 타입 체크 + license 검증
3. **수동 게이트 (1주)**: Architectural review + 정책 검토 + 비슷한 PBC 중복 확인
4. **승인**: 마켓플레이스 카탈로그 등록 + 버전 관리 시작
5. **수익 분배**: 30% 플랫폼 / 70% 개발자

---

## 5. 비즈니스 모델 옵션

### 5.1 옵션 A: 내부용 only
- **모델**: FlowCoder + 여유솔루션 팀이 컨설팅 효율화에 사용
- **수익**: 컨설팅 매출 증가 (간접)
- **장점**: 거버넌스 부담 0
- **단점**: 메타플랫폼의 핵심 가치(재사용 + 확장) 미실현
- **평가**: 시작 단계로 OK, 3년차에 다른 모델로 전환

### 5.2 옵션 B: B2B SaaS (per-app)
- **모델**: axle.flow-coder.com / flowstudio.flow-coder.com / flowteams.flow-coder.com 각각 SaaS로 운영
- **수익**: 월 구독료 (앱별 / 시트별)
- **장점**: 검증된 모델, Polar 결제 통합 즉시 가능
- **단점**: 메타플랫폼이 사용자에게 보이지 않음 (단지 인프라)
- **평가**: 1년차 핵심 모델

### 5.3 옵션 C: 화이트라벨
- **모델**: 파트너(여유솔루션 등)가 자기 브랜드 SaaS를 메타플랫폼 위에서 운영
- **수익**: 라이선스 + 운영 수수료
- **장점**: B2B 큰 계약, DESIGN.md 차별화 가치 직접 실현
- **단점**: 파트너 의존, 1:1 맞춤
- **평가**: 1.5-2년차 추가

### 5.4 옵션 D: 마켓플레이스
- **모델**: 외부 개발자 PBC 등록, 사용자가 PBC 조합으로 신규 앱 빌드
- **수익**: 마켓플레이스 수수료 (30%)
- **장점**: 네트워크 효과, 자체 성장
- **단점**: 거버넌스 부담 큼, 임계 질량 도달까지 시간
- **평가**: 3년차 PoC, 5년차 본격화

### 5.5 옵션 E: 하이브리드 (추천)
- **시간순 진화**:
  - **Year 1**: 옵션 A (내부) + 옵션 B 시작 (axle.flow-coder.com 1개 SaaS)
  - **Year 2**: 옵션 B 확장 (3-5개 SaaS) + 옵션 C 검증 (화이트라벨 1건)
  - **Year 3**: 옵션 C 확장 (3-5개 파트너) + 옵션 D PoC (마켓플레이스 카탈로그)
  - **Year 5**: 4가지 모델 동시 운영
- **평가**: 가장 현실적. 단계별 검증 + 위험 분산.

---

## 6. 거버넌스

### 6.1 PBC 추가 프로세스

#### 내부 PBC (FlowCoder 팀이 작성)
1. **제안**: GitHub Issue + PBC 한 줄 설명
2. **사전 검토 (1일)**: 비슷한 기존 PBC 있는지, 도메인 중복인지
3. **RFC 작성 (3일)**: 인터페이스 명세 + 의존성 + WI 분해
4. **리드 결정**: Go / No-Go / Wait
5. **fix_plan 등록**: WI 추가 + Sprint Contract (옵션)
6. **구현**: FlowSet 자동 루프

#### 외부 PBC (마켓플레이스 — 3년 후)
1. **RFC 제출** (외부 개발자, 1주)
2. **자동 검증**: 인터페이스 / 테스트 / 보안 스캔
3. **Architectural Review** (FlowCoder 팀, 1주)
4. **승인 / 거절**
5. **마켓플레이스 등록**

### 6.2 버전 관리 (SemVer)

```
v MAJOR . MINOR . PATCH

MAJOR — breaking change (인터페이스 변경, 제거)
MINOR — 기능 추가 (호환)
PATCH — 버그 픽스
```

- 모든 PBC는 `package.json`에 정확한 버전
- `peerDependencies`로 의존 관계 명시 (caret `^` 사용)
- `CHANGELOG.md` 필수 (Keep a Changelog 형식)

### 6.3 Breaking Change 정책

- v1.x 도달 후 breaking change는 **v2.0**으로만
- v2.0 발행 후 **6개월간 v1.x 유지보수 의무**
- v1.x → v2.0 마이그레이션 가이드 필수
- deprecated 인터페이스는 **1년 후 archive**

### 6.4 ADR (Architecture Decision Record)

`docs/adr/` 디렉토리에 결정 기록:
```
docs/adr/
├── 0001-monorepo-baseline.md
├── 0002-pbc-pure-domain.md
├── 0003-rust-microservice-scope.md
├── 0004-design-md-adoption.md
└── ...
```

각 ADR 형식:
```markdown
# ADR-NNN: 제목

## 상태
[Proposed | Accepted | Deprecated | Superseded by ADR-MMM]

## 컨텍스트
무엇이 결정을 필요하게 했나?

## 결정
무엇을 선택했나?

## 결과
어떤 효과가 있나? Trade-offs?

## 대안
거부된 옵션과 이유
```

### 6.5 코드 오너십

`.flowset/ownership.json`에 정의된 오너십 규칙을 PBC별로 확장:
```json
{
  "packages/pbc-image-engine/": ["@flowcoder/team-content"],
  "packages/pbc-hr-payroll/": ["@flowcoder/team-hr"],
  "packages/auth/": ["@flowcoder/team-platform"]
}
```

PreToolUse 훅 (`check-ownership.sh`)이 PR 차단.

---

## 7. Migration Paths

### 7.1 운영 중 SaaS 이전 절차

#### 케이스: FlowVue (운영 중) → AXLE 모노레포 안의 `apps/flowvue/`

**Phase 1 — 코드만 이전 (1주)**
1. FlowVue 저장소 → AXLE의 `apps/flowvue/`로 import
2. AXLE의 횡단 패키지(`@axle/db`, `@axle/auth`, `@axle/ui`)로 의존성 변경
3. 기존 `apps/flowvue/lib/*`는 유지, 점진적 마이그레이션
4. Vercel 프로젝트는 별도 유지 (도메인 보존)

**Phase 2 — DB 정합 (2주)**
5. AXLE 통합 schema에 FlowVue 도메인 섹션 추가 (또는 sub-schema)
6. **데이터 마이그레이션 (zero-downtime)**:
   - Step A: 새 schema 생성 + 데이터 복제 (백그라운드)
   - Step B: 검증 (row 카운트 / hash)
   - Step C: 트래픽 전환 (DNS / Vercel)
   - Step D: 기존 schema deprecate (1주 후 drop)

**Phase 3 — PBC 추출 (3-4주)**
7. FlowVue 비즈니스 로직 → `pbc-erp-inventory` / `pbc-erp-orders`로 추출
8. apps/flowvue는 thin shell이 됨

**Phase 4 — 도메인/URL 보존**
9. `flowvue.flow-coder.com`은 그대로 유지
10. Vercel에서 메타플랫폼의 apps/flowvue를 그 도메인에 매핑

### 7.2 사용자 영향 최소화

- **로그인 세션 유지**: Auth.js v5 표준이라 토큰 호환
- **데이터 0 손실**: zero-downtime DB 마이그레이션
- **URL 보존**: 모든 라우트 동일
- **다운타임**: 최대 5분 (DNS TTL 의존)
- **롤백 플랜**: Vercel 이전 배포로 즉시 롤백, DB는 24시간 보존

---

## 8. Multi-Tenancy 전략

### 8.1 4가지 모델 비교

| 모델 | 격리 강도 | 비용 | 운영 부담 | 적용 |
|---|---|---|---|---|
| Single DB / shared row (현행) | 약함 | 매우 낮음 | 낮음 | 일반 SaaS |
| Single DB / row-level filter (`orgId`) | 중간 | 낮음 | 중간 | 표준 multi-tenancy |
| Single DB / schema per tenant | 강함 | 중간 | 큼 (마이그레이션 N배) | 컴플라이언스 요구 |
| DB per tenant | 매우 강함 | 매우 큼 | 매우 큼 | 엔터프라이즈 only |

### 8.2 권장 전략: Hybrid

#### 기본 (모든 PBC)
- `Organization` 모델 + `orgId` 필수 컬럼
- `RelationTuple` (ReBAC) 기반 row-level 권한 결정
- 모든 쿼리는 `orgId` 필터 강제 (Prisma middleware)

#### 옵션 (특정 도메인만)
- 의료/금융 등 엄격한 격리 필요 시 → schema per tenant 옵션
- `pbc-hipaa-audit-log` 같은 컴플라이언스 PBC는 별도 schema 강제

#### 엔터프라이즈 (5년 후 옵션)
- White-label 파트너용 dedicated DB instance

### 8.3 데이터 격리 / 컴플라이언스

| 표준 | 적용 범위 | 우리 대응 |
|---|---|---|
| **K-DPA (개인정보보호법)** | 모든 한국 사용자 | row-level + 동의 로그 + 삭제권 |
| **GDPR** | EU 사용자 (해당 시) | 옵션 PBC `pbc-gdpr-compliance` |
| **HIPAA** | 의료 도메인 (미래) | 옵션 PBC + schema isolation |
| **SOC2** | 엔터프라이즈 계약 | 5년차 옵션 |

---

## 9. Success KPI

### 9.1 단기 (6개월, 2026-11)
- ✅ Top 3 PBC 추출 완료 (`@axle/pbc-image-engine`, `pbc-block-builder`, `pbc-hr-payroll`)
- ✅ 7개 이미지 생성 앱이 단일 PBC 호출
- ✅ FlowTeams를 `apps/flowteams/`로 이전 + 빌드 통과
- ✅ 단위 테스트 커버리지 ≥ 80% (각 PBC)

### 9.2 중기 (1년, 2027-05)
- ✅ 6개 도메인 앱 동작 (axle / flowstudio / flowteams / flowvue / flowretouch / +1 신규)
- ✅ 10개 PBC 등록
- ✅ DESIGN.md 3개 브랜드 theme 운영
- ✅ Rust 마이크로서비스 1개 production (image-engine-rs)
- ✅ 외부 파트너 1팀 화이트라벨 PoC

### 9.3 장기 (3년, 2029-05)
- ✅ 12-15개 도메인 앱
- ✅ 20+개 PBC
- ✅ 마켓플레이스 PoC (외부 개발자 1-3명 등록)
- ✅ i18n 1개 (일본어 등)
- ✅ 월 활성 사용자 50k+

### 9.4 측정 방법

| KPI | 데이터 출처 |
|---|---|
| PBC 수 | `grep "^@axle/pbc-" packages/*/package.json \| wc -l` |
| 앱 수 | `ls apps/ \| wc -l` |
| 테스트 커버리지 | Vitest coverage report |
| 운영 앱 가용성 | Sentry uptime monitor |
| 사용자 수 | Polar billing + Auth.js session |
| PR 머지 속도 | GitHub Actions |
| FlowSet 자동 머지 비율 | `.flowset/trace.jsonl` |

---

## 10. 비용 모델

### 10.1 인프라 비용 추정 (월간, 2027-05 기준)

| 항목 | 비용 (월 USD) | 비고 |
|---|---|---|
| Vercel Pro (앱 6개) | $200-400 | 트래픽에 따라 |
| Supabase Pro (DB + auth) | $25-100 | 사용량 |
| Upstash Redis | $10-50 | 캐시 |
| OCI VM (크롤러) | $50 | 항상 켜짐 |
| Mac Mini (agent-bridge) | $0 | 자체 하드웨어 |
| 외부 API | $200-500 | OpenAI / Anthropic / Gemini / Resend |
| Sentry / monitoring | $26 | Team plan |
| GitHub Actions | $0-50 | Pro 플랜 안 |
| **합계** | **$510-1180/월** | $6k-14k/년 |

### 10.2 운영 비용

| 항목 | 추정 |
|---|---|
| 개발 인력 | FlowCoder 팀 자체 (이미 비용에 들어감) |
| 외부 컨설팅 | 0 (내부 처리) |
| 라이선스 | $0 (오픈소스 stack) |

### 10.3 PBC 단위 비용 (추출 비용)

| PBC | 추출 시간 | 인력 비용 (FlowCoder 시간 기준) |
|---|---|---|
| pbc-image-engine | 4주 | ~80시간 |
| pbc-block-builder | 4주 | ~80시간 |
| pbc-hr-payroll | 6주 | ~120시간 |
| pbc-billing | 2주 (이미 거의 완성) | ~40시간 |
| 평균 후속 PBC | 3-4주 | ~60-80시간 |

### 10.4 손익분기점 (옵션 B 모델 가정)

- **B2B SaaS 단가 추정**: $50-200/월/사이트
- **고정비**: ~$1,000/월
- **BEP**: 5-20개 사이트 (단가에 따라)
- **목표**: 1년 내 BEP, 2년 내 흑자

---

## 부록 A. 외부 표준 (가이드)

| 표준 | 채택 여부 | 비고 |
|---|---|---|
| OpenAPI 3.x | ✅ Public API 정의 | 모든 PBC가 노출하는 외부 API |
| GraphQL | 🟡 옵션 | 마켓플레이스 단계에서 검토 |
| OAuth 2.0 / OIDC | ✅ 인증 | Auth.js v5 통합 |
| WebAuthn | 🟡 옵션 | 엔터프라이즈 요구 시 |
| SCIM | 🟡 옵션 | 엔터프라이즈 SSO |
| ICalendar (RFC 5545) | ✅ scheduler | 일정 표준 |
| iCalendar / vCard | 🟡 옵션 | scheduler/contacts |
| HL7 FHIR | 🟡 옵션 | 의료 도메인 진입 시 |

---

## 부록 B. AI 통합 표준

### B.1 모든 PBC가 따라야 할 AI 호출 패턴

```typescript
// ❌ 금지 — 직접 SDK 호출
import OpenAI from 'openai';
const client = new OpenAI(...);

// ✅ 채택 — packages/ai 어댑터 통해서만
import { createAiClient } from '@axle/ai';

const ai = createAiClient({
  provider: 'auto',  // 'claude' | 'openai' | 'local-mlx' | 'auto'
  budget: 'standard', // 'cheap' | 'standard' | 'premium'
});

const result = await ai.complete({
  task: 'classify',  // 표준 task 명세
  input: { ... },
});
```

이유:
- 모델 변경 시 한 곳만 수정 (어댑터)
- 비용 추적 일관 (token 카운팅)
- 폴백 로직 표준 (Claude 실패 → OpenAI)
- 로컬 모델(MLX) 우선 라우팅 가능

### B.2 AI Agent 통합 (3년 후 표준)

각 PBC는 `agent-manifest.json`을 노출:
```json
{
  "name": "pbc-image-engine",
  "agent_capabilities": [
    {"task": "generate_image", "input_schema": "...", "output_schema": "..."}
  ]
}
```
이를 통해 Claude / GPT 같은 외부 agent가 PBC를 자동 발견·호출 가능.

---

## 부록 C. 의사결정 추적

| 결정 | 일자 | 위치 |
|---|---|---|
| 메타플랫폼 컨셉 진행 | 2026-05-03 | PRD §8 |
| AXLE 직접 승격 | 2026-05-03 | axle-baseline-analysis.md |
| Rust 부분 채택 (image/ocr만) | 2026-05-03 | PRD §8 |
| Phase 17/18 게이트 완화 | 2026-05-04 | PRD §0 |
| Top 3 PBC 선정 | 2026-05-03 | asset-inventory.md §3 |
| **5-year 비전 정의** | **2026-05-04** | **본 문서 §1** |
| **참고 프로젝트 매트릭스** | **2026-05-04** | **본 문서 §3** |
| **수익 모델 하이브리드 (E)** | **2026-05-04** | **본 문서 §5.5** |
| **거버넌스 SemVer + RFC** | **2026-05-04** | **본 문서 §6** |
| **Multi-tenancy hybrid** | **2026-05-04** | **본 문서 §8.2** |

---

## 부록 D. 다음 행동

이 문서가 전제하는 다음 액션:

1. **단기 (이번 분기)**:
   - Phase 19 진입 후 Top 3 PBC 추출 진행
   - 본 문서를 AXLE `docs/specs/meta-platform/`로 복사 검토

2. **중기 (3-6개월 후)**:
   - PBC 4-7번(billing/consulting-crm/erp-*) RFC 작성 시점
   - DESIGN.md theme 2개 추가 (외부 파트너용 화이트라벨)
   - npm `create @axle/pbc` 스캐폴딩 도구 작성

3. **장기 (1년+)**:
   - 마켓플레이스 PoC 설계
   - i18n 확장 (일본어)
   - 컴플라이언스 PBC (옵션)

---

## 문서 히스토리

| 일자 | 변경 |
|---|---|
| 2026-05-04 | 초안 작성 (10개 섹션 + 4 부록) |

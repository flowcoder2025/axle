# 모듈 카탈로그 v3 (6 Pack × 35 Modules + Multi-org Tier)

> **모델**: 단일 플랫폼 + Odoo-style 모듈 install + Multi-org tenancy 차원
> **단위**: 모듈 = 사이드바 nav 1개 + 라우트 묶음 + 권한 + PBC 의존
> **Pack** = 관련 모듈 번들 (할인 가격)

---

## 0. 두 축

```
              [Module install]
                     ×
              [Tenancy Tier]
       ───────────────────────────
       Single-org           Multi-org
       (default, 무료)      (premium, 별도 요금)
       자기 조직 1개         자기 + N개 관리 조직
```

---

## 1. 모듈 인벤토리 (35개)

### Pack A. 비즈니스 운영 (default 추천)
₩59,000/월 — 10 modules

| ID | 모듈 | 라우트 | 권한 | Multi-org | PBC |
|---|---|---|---|---|---|
| A.01 | 고객/거래처 | /customers | customers:* | — | consulting-crm |
| A.02 | 프로젝트 (+9섹션 SSOT) | /projects | projects:* | — | consulting-crm |
| A.03 | 견적 | /estimates | estimates:* | — | consulting-crm |
| A.04 | 계약 | /contracts | contracts:* | — | consulting-crm |
| A.05 | 서류 + OCR | /documents | documents:* | — | ocr, file-manager |
| A.06 | 외부 포털 | /portal-admin | portal:* | — | — |
| A.07 | 일정 | /calendar | calendar:* | — | scheduler |
| A.08 | 미팅 | /meetings | meetings:* | — | — |
| A.09 | 재무 | /finance | finance:* | ★ | — |
| A.10 | 분석 리포트 | /analytics | analytics:* | ★ | — |

**Hard deps**: 모두 독립 (FK 모두 nullable).
**개별 가격**: 평균 ₩9,000/모듈 (개별 install 시 합산하면 ₩90,000 → Pack 가격 ₩59,000은 34% 할인).

### Pack B. 정부 지원사업 + R&D
₩39,000/월 — 6 modules

| ID | 모듈 | 라우트 | 권한 | Multi-org | PBC |
|---|---|---|---|---|---|
| B.01 | 지원사업 | /programs | programs:* | — | crawler |
| B.02 | AI 매칭 | /matching | matching:* | ★ | matching |
| B.03 | 연구일지 | /journals | journals:* | ★ | ai |
| B.A1 | HWPX 양식 (admin) | /admin/hwpx | platform:admin | — | docgen |
| B.A2 | 체크리스트 (admin) | /admin/checklist | platform:admin | — | — |
| B.A3 | AI 패턴 (admin) | /admin/ai-patterns | platform:admin | — | ai |

**Hard deps**: B.02 → B.01 / B.A2 → B.01 / B.A3 → B.02.

### Pack D. HR
₩49,000/월 + 직원 수 — 5 modules

| ID | 모듈 | 라우트 | 권한 | Multi-org | PBC |
|---|---|---|---|---|---|
| D.01 | 직원 관리 | /employees | hr:admin | ★ | hr-payroll |
| D.02 | 급여 | /payroll | hr:write | ★ | hr-payroll |
| D.03 | 근태 | /attendance | hr:read | ★ | hr-payroll |
| D.04 | 연차 | /leave | hr:read | ★ | hr-payroll |
| D.05 | 노무 자문 | /nomu | hr:read | ★ | hr-payroll, ai |

**Hard deps**: D.02~D.04 → D.01.
**모든 모듈 Multi-org** = HR 위탁 운영 가능 (노무법인 시나리오).

### Pack E. 콘텐츠
₩59,000/월 + 크레딧 — 4 modules

| ID | 모듈 | 라우트 | 권한 | Multi-org | PBC |
|---|---|---|---|---|---|
| E.01 | 이미지 생성 (7 모드) | /create | content:write | — | image-engine |
| E.02 | 빌더 (23 블록) | /builder | content:write | — | block-builder |
| E.03 | 프리셋 | /presets | content:read | — | image-engine |
| E.04 | ComfyUI 워크플로우 (admin) | /workflows | content:admin | — | image-engine |

**Hard deps**: E.03/E.04 → E.01.
**Multi-org 불가** — 콘텐츠 작업은 본인 작업물.

### Pack F. ERP (1년 후)
₩89,000/월 — 7 modules

| ID | 모듈 | 라우트 | Hard dep | Multi-org |
|---|---|---|---|---|
| F.01 | 상품 | /products | — | — |
| F.02 | 재고 | /inventory | F.01 | — |
| F.03 | 거래처 (ERP) | /erp-customers | — | — |
| F.04 | 주문 | /orders | F.01 + F.03 | — |
| F.05 | 배송 | /shipping | F.04 | — |
| F.06 | 발주 | /purchase | F.01 + F.03 | — |
| F.07 | 리포트 | /reports/erp | — | — |

### Add-on G. Desktop
₩29,000/월 (Desktop 라이선스 포함) — 3 modules

| ID | 모듈 | 라우트 | Hard dep | 비고 |
|---|---|---|---|---|
| G.01 | 포털 자동화 | /automation | — | requires Electron |
| G.02 | 공동인증서 | /certs | — | requires Electron |
| G.03 | 녹취 | /recording | — | requires Electron |

---

## 2. Multi-org Tier (별도 요금제)

### Single-org (default, 무료)
- 자기 조직 1개만 관리
- 모든 모듈이 자기 조직 데이터로 동작
- tenantOrgId = currentUserOrgId

### Multi-org (Premium)
- 자기 조직 + N개 관리 조직(ManagedOrg)
- 적용 모듈 (위 ★ 표시):
  - Pack A: 재무(A.09) · 분석(A.10)
  - Pack B: AI 매칭(B.02) · 연구일지(B.03)
  - Pack D: 전체 (D.01~D.05)
- **Topbar 조직 스위처** 활성화 → active tenant 변경
- 데이터는 tenantOrgId로 격리

### 가격 (TBD)
- Base: ₩? /월
- 관리 조직 1개당: ₩? /월
- 추후 결정

---

## 3. Cross-pack Integrations (자동 연결)

| 조합 | 효과 |
|---|---|
| A 견적 + A 고객 | 견적이 고객 단위로 분류 |
| A 견적 + A 재무 | 매출 자동 추적 |
| A 계약 + A 프로젝트 | 계약 = 프로젝트 단위 |
| A 미팅 + G 녹취 | 녹취 자동 첨부 + AI 요약 |
| A 일정 + 모든 모듈 | 마감/이벤트 통합 표시 |
| A 서류 + E 빌더 | 23블록 빌더로 서류 작성 |
| A 서류 + B HWPX | 한글 양식 자동 채움 |
| A 외부 포털 + B 연구일지 | 고객이 직접 일지 작성 |
| B AI 매칭 + A 고객 | 고객 × 공고 매칭 (B2B 시나리오) |
| B AI 매칭 + A 프로젝트 | 프로젝트 × 공고 매칭 |
| B 연구일지 + A 프로젝트 | 일지가 프로젝트 단위 |
| B 연구일지 + E 이미지 | 도해 자동 삽입 |
| B 지원사업 + A 일정 | 마감일 캘린더 자동 등록 |
| D 직원 + A 프로젝트 | 멤버 자동 연결 |
| E 빌더 + F 상품 | 상품 상세페이지 |
| E 이미지 + F 상품 | 상품 이미지 자동 생성 |
| G 포털 자동화 + A 재무 | 세무 정보 자동 매출 매핑 |
| G 포털 자동화 + A 서류 | 공공서류 자동 다운로드 |

---

## 4. install 흐름

```
1. 조직 가입 → 공통 영역만 활성 (사이드바 거의 비어 있음)
2. 관리자가 /settings/modules 진입
3. Pack 또는 개별 모듈 install 클릭
   ├─ Pack: 13~3개 모듈 일괄 등록
   └─ 개별: 1개 모듈만
4. 결제 정보 입력 (없으면)
5. module-registry에 기록
6. 모듈 onInstall hook 실행 (seed 데이터)
7. 사이드바 즉시 갱신
8. Multi-org Tier 별도 install 시:
   ├─ /managed-orgs 페이지에서 관리 조직 추가
   └─ Topbar에 조직 스위처 활성
```

---

## 5. uninstall 처리

| 시점 | 처리 |
|---|---|
| 즉시 | 사이드바 제거, 라우트 403, 결제 중단 |
| 30일 | 데이터 보관 |
| 30일 후 | 사용자 명시적 삭제 요청 시 hard delete |
| 재install (30일 내) | 데이터 복원 |
| 의존 모듈 uninstall | 의존하는 모듈도 자동 uninstall 안내 (cascade 확인) |

---

## 6. Use Case Cheatsheet

| 페르소나 | 추천 install | Multi-org? | 월 가격 (추정) |
|---|---|---|---|
| 일반 사무 회사 | Pack A | × | ₩59,000 |
| 1인 사업자 + 지원사업 | A + B | × | ₩98,000 |
| 스타트업 R&D | A + B | × | ₩98,000 |
| HR 5명 회사 | A + D | × | ₩108,000 + 직원비 |
| 1인 컨설턴트 | A + B | × | ₩98,000 |
| 노무법인 (5개 고객사 HR 위탁) | A + D | ✓ | ₩108,000 + 직원비 + Multi-org |
| 종합 컨설팅 (10개 고객사) | A + B + D + G | ✓ | ₩176,000 + Multi-org |
| 마케팅 에이전시 | A + E | × | ₩118,000 |
| 도소매 | A + F | × | ₩148,000 |
| 제조 + R&D + 직원 30명 | A + B + D + F | × | ₩236,000 + 직원비 |
| 최소 사용 (일정만) | 개별 install (1) | × | ₩6,000 |

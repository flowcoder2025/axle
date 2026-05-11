# 사이트맵 v3 (단일 플랫폼 + Pack 모듈 + Multi-org)

> 활성 Pack/모듈 × 사용자 권한 × active tenant 교차로 동적 생성.

---

## 한눈에

```
axle.io (1개 앱 = apps/web)
├── 공통 (항상 표시)
├── Pack A 모듈 (install 시)
├── Pack B 모듈 (install 시)
├── Pack D 모듈 (install 시)
├── Pack E 모듈 (install 시)
├── Pack F 모듈 (install 시)
├── Pack G 모듈 (install 시, Desktop 필요)
└── 관리자 (PLATFORM_ADMIN만)

★ Multi-org Tier 활성:
   Topbar 조직 스위처 → tenant 전환
   모든 multi-org 모듈 데이터가 active tenant scope
```

---

## 공통 (Core — 항상 활성)

```
/                            → /dashboard 리다이렉트 (로그인 시)
/login /signup /forgot-password /reset-password
/dashboard                   통합 대시보드 (활성 Pack 위젯 합)
/notifications               통합 알림
/settings/
├── /profile                 개인 프로필
├── /organization            조직 정보
├── /team                    팀원 + ReBAC
├── /modules                 ★ Pack 카탈로그
├── /managed-orgs            ★ Multi-org 관리 (premium 활성 시)
├── /billing                 구독 + 사용량
├── /integrations            외부 연동
└── /ai                      AI 모델 설정
/admin/                      PLATFORM_ADMIN only
├── /                        플랫폼 대시보드
├── /organizations [목록][[orgId]]
├── /users [목록][[userId]]
└── (이하 Pack B의 admin 모듈로 이동 — HWPX/체크리스트/AI패턴)
/suspended                   계정 정지
```

---

## Pack A. 비즈니스 운영 (10 modules)

install 시 사이드바 + 라우트 추가:

```
A.01 /customers [목록][new][[id]][[id]/edit]                      고객/거래처
A.02 /projects [목록][new][[id]][[id]/edit]                       프로젝트 (+9섹션 SSOT)
A.03 /estimates [목록][new][[id]][[id]/edit]                      견적
A.04 /contracts [목록][[id]]                                      계약
A.05 /documents [목록][/upload]                                   서류 + OCR
A.06 /portal-admin [목록]                                         외부 포털 (토큰 관리)
     /portal/[token]                                              외부 게스트 (토큰 기반)
       ├── /                                                      포털 메인
       ├── /upload                                                업로드
       ├── /checklist                                             체크리스트
       └── /journal [목록][new]                                   일지 작성
A.07 /calendar                                                     일정
A.08 /meetings [목록][new][[id]][[id]/edit]                       미팅
A.09 /finance [전체][[clientId]]   ★ multi-org                    재무
A.10 /analytics                    ★ multi-org                    분석
```

---

## Pack B. 정부 지원사업 + R&D (6 modules)

```
B.01 /programs [목록][[id]]                                       지원사업 (크롤)
B.02 /matching                     ★ multi-org                    AI 매칭
B.03 /journals [목록][new][[id]]   ★ multi-org                    연구일지
B.A1 /admin/hwpx                                                  HWPX 양식 (admin)
B.A2 /admin/checklist                                             체크리스트 (admin)
B.A3 /admin/ai-patterns                                           AI 패턴 (admin)
```

---

## Pack D. HR (5 modules) — ★ apps/flowteams 흡수

```
D.01 /employees [목록][new][[id]]  ★ multi-org                    직원 관리
D.02 /payroll                      ★ multi-org                    급여 (★ WI-612)
     /payroll/[id]/statement       ★ WI-612                       명세서
D.03 /attendance                   ★ multi-org                    근태 (QR/IP/GPS)
D.04 /leave                        ★ multi-org                    연차
D.05 /nomu                         ★ multi-org                    노무 자문
```

흡수: apps/flowteams/app/{payroll,attendance,leave,nomu}/page.tsx → apps/web/src/app/(platform)/{...}/page.tsx (WI-621).

---

## Pack E. 콘텐츠 (4 modules)

```
E.01 /create                                                       이미지 생성 (7 모드 통합)
     ?mode=CREATE/EDIT/POSTER/DETAIL_EDIT/RETOUCH/SCENE/STYLE
     /gallery (내장)                                                갤러리
E.02 /builder [목록]/[docId]                                       빌더 (23 블록)
E.03 /presets                                                      프리셋
E.04 /workflows                                                    ComfyUI (admin)
```

---

## Pack F. ERP (7 modules) — 1년 후

```
F.01 /products [목록][[id]]
F.02 /inventory [목록][[sku]][/receive][/ship]
F.03 /erp-customers [목록][[id]]
F.04 /orders [목록][new][[id]]
F.05 /shipping
F.06 /purchase
F.07 /reports/erp
```

---

## Add-on G. Desktop (3 modules) — Electron 필요

```
G.01 /automation [목록]                                            포털 자동화
     /automation/hometax /minwon24 /insurance /venturein /koita
G.02 /certs [목록]                                                 공동인증서
G.03 /recording                                                    녹취
```

---

## ★ Multi-org Tier 활성 시 추가

```
Topbar:
  [조직 스위처 ▾]
    - FlowCoder Inc. (본인)
    - ABC Manufacturing (managed)
    - XYZ Tech (managed)
    - + 관리 조직 추가

Settings:
  /settings/managed-orgs            관리 조직 CRUD
  /settings/managed-orgs/[orgId]    관리 조직 상세 (위탁 Pack 설정)
  /settings/managed-orgs/new        신규 등록
```

---

## 동적 사이드바 예시

조직 = FlowCoder Inc. (Pack A + B + D + E + G install, Multi-org 활성, 3 관리 조직 보유).
사용자 = Jerome (모든 권한).
Active tenant = ABC Manufacturing.

```
[ABC Manufacturing managed ▾]              ← Topbar 조직 스위처
─────────────────────────────────
⌂ Dashboard

Pack A. 비즈니스 운영
  고객/거래처 · 프로젝트 · 견적 · 계약 ·
  서류 · 외부 포털 · 일정 · 미팅 ·
  재무 ⊛ · 분석 ⊛

Pack B. 정부 지원사업
  지원사업 · AI 매칭 ⊛ · 연구일지 ⊛

Pack D. HR
  직원 ⊛ · 급여 ⊛ · 근태 ⊛ · 연차 ⊛ · 노무 ⊛

Pack E. 콘텐츠
  이미지 생성 · 빌더 · 프리셋

Add-on G. Desktop
  포털 자동화 · 인증서 · 녹취

(미설치)
  Pack F. ERP

─────────────────────────────────
공통
  알림 · Pack 카탈로그 · 설정

관리자 (조건부)
  HWPX 양식 · 체크리스트 · AI 패턴 ·
  ComfyUI 워크플로우 · 플랫폼 관리

⊛ = Multi-org 적용 — 데이터는 ABC Manufacturing scope
```

---

## 동반 앱 (별도 배포)

### apps/desktop (Electron)
- UI = axle.io 임베드
- 추가: IPC + Tray (recorder/cert/portal/agent)
- 사이트맵 없음 (메인 재사용)

### apps/agent-bridge (HTTP 서비스)
- UI 없음
- HTTP API:
  - GET /health
  - POST /api/ai/run, GET /api/ai/status/:jobId
  - POST /api/transcribe
  - POST /v1/chat/completions

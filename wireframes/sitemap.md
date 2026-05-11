# 사이트맵 — 단일 플랫폼 (v2)

> v1은 앱별 분리 사이트맵, v2는 **활성 모듈에 따른 동적 사이트맵**.

---

## 한눈에

```
axle.io (1개 메인 앱 = apps/web)
├── 공통 (항상 표시)
├── 모듈 1 (install되면 표시)
├── 모듈 2
├── ...
└── 관리자 (PLATFORM_ADMIN만)

apps/desktop      Electron 클라이언트 — UI는 위 axle.io 임베드
apps/agent-bridge HTTP 서비스 — UI 없음
```

---

## 공통 (Core — 항상 활성)

```
/                            로그인된 사용자 → /dashboard 리다이렉트
/login /signup /forgot-password /reset-password
/dashboard                   통합 대시보드 (활성 모듈 위젯 합)
/notifications               통합 알림 (모든 모듈)
/settings/
├── /profile                 개인 프로필
├── /organization            조직 정보
├── /team                    팀원 + ReBAC 역할
├── /modules                 ★ 모듈 카탈로그 (install/uninstall)
├── /billing                 구독 + 사용량
├── /integrations            외부 연동
└── /ai                      AI 모델 설정
/admin/                      PLATFORM_ADMIN only
├── /                        플랫폼 대시보드
├── /organizations [목록][[orgId]]
├── /users [목록][[userId]]
├── /modules-admin           모듈 관리 (전체 조직 × 모듈)
├── /ai-patterns
├── /checklist-templates
└── /hwpx-templates
/portal/[token]              외부 게스트 (토큰 기반)
├── /                        포털 메인
├── /upload                  문서 업로드
├── /checklist               체크리스트
└── /journal [목록][new]
/suspended                   계정 정지
```

---

## M1 컨설팅 모듈 (consulting:*)

install 시 추가되는 라우트 + 사이드바 nav:

```
/clients [목록][new][[id]][[id]/edit]
/projects [목록][new][[id]][[id]/edit]
/estimates [목록][new][[id]][[id]/edit]
/contracts [목록][[id]]
/documents
/programs [목록][[id]]
/calendar
/meetings [목록][new][[id]][[id]/edit]
/journals [목록][new][[id]]
/matching
/finance [전체][[clientId]]
/analytics
```

**Sidebar 섹션 "컨설팅"**: 11 nav 항목
**Prisma 모델**: Client, Project, Estimate, Contract, Program, Meeting, Journal, FinanceTransaction, ...

---

## M2 HR 모듈 (hr:*)

```
/payroll                     급여 (월별 계산)
/payroll/[id]                급여 상세
/payroll/[id]/statement      ★ generateStatement (WI-612)
/attendance                  근태 (QR/IP/GPS/MANUAL)
/leave                       연차 (요청/승인/잔여)
/nomu                        노무 자문 (AI)
/employees [목록][new][[id]]  직원 관리
```

**Sidebar 섹션 "HR"**: 5 nav 항목
**Prisma 모델**: Employee, Payroll, Attendance, LeaveRequest, NomuConsultation

★ flowteams 흡수: 기존 `apps/flowteams/app/*` → 위 경로로 이전 (WI-620).

---

## M3 콘텐츠 모듈 (content:*)

```
/create                      이미지 CREATE
/edit                        이미지 EDIT (in-painting)
/poster                      POSTER
/detail-edit                 DETAIL_EDIT
/retouch                     RETOUCH (Pro/Free)
/scene                       SCENE
/style                       STYLE_TRANSFER
/builder                     상세페이지 빌더 (23블록)
/builder/[docId]
/gallery                     생성 갤러리
/presets                     프리셋
/workflows                   ComfyUI 워크플로우 (admin)
```

**Sidebar 섹션 "콘텐츠"**: 8 nav 항목 (7 mode 페이지를 1개 nav로 묶을 수도 있음 — Generation Studio 하나에서 mode 토글)
**Prisma 모델**: GeneratedImage, BlockComposition, ContentPreset, ContentWorkflow

---

## M4 ERP 모듈 (erp:*) — 1년 후

```
/inventory [목록][[sku]][/receive][/ship]
/orders [목록][new][[id]]
/shipping
/purchase
/customers
/products [목록][[id]]
/reports/erp
```

**Sidebar 섹션 "ERP"**: 7 nav 항목

---

## M5 리터치 모듈 (retouch:*) — 1년 후

```
/retouch/editor [목록][[imageId]]
/retouch/batch
/retouch/presets
/retouch/projects
/retouch/history
```

**Sidebar 섹션 "리터치"**: 5 nav 항목
**참고**: 콘텐츠 모듈이 install돼 있으면 RETOUCH는 이미 사용 가능. 리터치 모듈은 RETOUCH만 필요한 사용자를 위한 슬림 옵션.

---

## 동적 사이드바 렌더링 예시

조직 A가 M1+M2 install, 사용자 X가 hr:read만 보유:

```
사용자 X가 보는 사이드바:
├── ⌂ Dashboard
├── (컨설팅 섹션 안 보임 — X에게 consulting:* 권한 없음)
├── HR
│   ├── 급여 (회색 — write 권한 없음, 직접 URL 시 403)
│   ├── 근태 (정상)
│   ├── 연차 (정상)
│   └── 노무 자문 (정상)
├── (ERP, 리터치, 콘텐츠 안 보임 — 조직이 install 안 함)
├── 공통
│   ├── 알림
│   ├── 모듈 카탈로그 (org-admin만 install 가능)
│   └── 설정
└── (관리자 섹션 안 보임 — X는 platform-admin 아님)
```

---

## 동반 앱 (별도 배포, axle.io와 분리)

### apps/desktop (Electron 클라이언트)
- UI: `axle.io` 임베드 (BrowserView)
- 추가 기능 (모듈과 무관, 항상 활성):
  - IPC: recorder / cert / portal / agent
  - System Tray
- 사이트맵 없음 (메인 앱 사이트맵 재사용)

### apps/agent-bridge (HTTP 서비스)
- UI 없음
- HTTP API:
  - GET /health
  - POST /api/ai/run, GET /api/ai/status/:jobId (Claude MQ)
  - POST /api/transcribe (Whisper)
  - POST /v1/chat/completions (MLX proxy)

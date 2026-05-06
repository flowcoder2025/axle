# AXLE 메타플랫폼 — 전체 사이트맵

> **작성일**: 2026-05-07
> **범위**: 현존 4개 앱 + 미래 3개 도메인 앱 (vision-and-expansion §1.2 기준 1년 목표)
> **시각 와이어프레임**: `wireframes/apps/*.html` 참고

---

## 한눈에

| 앱 | 상태 | 페이지 수 | 핵심 의존 PBC |
|---|---|---|---|
| `apps/web` | 현존 | **58** (5 route group) | (현재 PBC 미사용) → WI-614로 시범 도입 |
| `apps/flowteams` | 현존 | **5** | `@axle/pbc-hr-payroll` (PayrollService 팩토리는 WI-612) |
| `apps/desktop` | 현존 | UI 없음 (renderer = web) | IPC + Tray |
| `apps/agent-bridge` | 현존 | UI 없음 (HTTP 서비스) | MLX + Whisper + Claude MQ |
| `apps/flowstudio` | **미존재** (1년 후) | 예상 ~15 | image-engine + block-builder + design-md |
| `apps/flowvue` | **미존재** (1년 후) | 예상 ~12 | erp-inventory + erp-orders |
| `apps/flowretouch` | **미존재** (1년 후) | 예상 ~7 | image-engine RETOUCH 모드 |

---

## apps/web — 컨설팅 (현존)

### Route Groups
- `(marketing)` — 비인증
- `(auth)` — 인증 페이지
- `(app)` — 인증 + 메인
- `(admin)` — PLATFORM_ADMIN only
- `(portal)` — 외부 토큰 기반

### 트리

```
/                                  (marketing)
/login /signup /forgot-password /reset-password   (auth)

(app) — sidebar 12 메뉴
├── /dashboard
├── /clients [목록][new][[id]][[id]/edit]
├── /projects [목록][new][[id]][[id]/edit]
├── /estimates [목록][new][[id]][[id]/edit]
├── /contracts [목록][[id]]
├── /documents
├── /programs [목록][[id]]
├── /calendar
├── /meetings [목록][new][[id]][[id]/edit]
├── /journals [목록][new][[id]]
├── /matching
├── /finance [전체][[clientId]]
├── /analytics
├── /notifications
└── /settings  (nested 2-column layout)
    ├── /organization (default redirect)
    ├── /team
    ├── /notifications
    ├── /integrations
    └── /ai

(admin) /platform-admin
├── /  (대시보드)
├── /organizations [목록][[orgId]]
├── /users [목록][[userId]]
├── /ai-patterns
├── /checklist-templates
└── /hwpx-templates

(portal) /portal/[token]
├── /
├── /upload
├── /checklist
└── /journal [목록][new]

/suspended
★ /showcase   ← WI-614 신규 (pbc-block-builder 데모)
```

**Sidebar nav 12개**: Dashboard · 고객관리 · 프로젝트 · 서류 · 지원사업 · 매칭 분석 · 일정 · 미팅 · 연구일지 · 재무 · 분석 · 견적/계약
**Footer**: 알림 · 설정 · 관리자 콘솔(조건부)

---

## apps/flowteams — HR (현존, thin shell)

```
/                                  홈 (소개 + 데모 링크 4개)
/payroll                           급여 데모   ← WI-612 변경
/attendance                        근태 데모
/leave                             연차 데모
/nomu                              노무 자문 데모

★ WI-615: 위 5 페이지에 표준 sidebar+topbar 적용
```

**현재 layout**: metadata만 (sidebar/topbar 없음) → **WI-615 후**: SidebarProvider + AppSidebar + TopBar

---

## apps/desktop — Electron (현존, UI는 web 재사용)

페이지가 아닌 IPC 채널 + Tray가 본체.

```
Main Window: 1280×800, contextIsolation=true, URL=process.env.WEB_APP_URL
System Tray: Show / Recording Start-Stop / Quit

IPC channels (window.axle.*):
├── recorder.{start,stop,pause,resume,getState}    음성 녹음 (WAV 출력)
├── cert.{load,list,verify,remove}                 PKCS#12 공인인증서
├── portal.{login,scrape,status,logout}            정부 포털 자동화 (스텁)
│   └── targets: hometax / minwon24 / insurance
└── agent.{health,submit,transcribe}               agent-bridge HTTP 호출
```

---

## apps/agent-bridge — AI 서비스 (현존, UI 없음)

```
HTTP API (PORT 3100):
├── GET  /health
├── POST /api/ai/run                  Claude MQ enqueue
├── GET  /api/ai/status/:jobId        결과 조회
├── POST /api/transcribe              Whisper STT (multipart)
└── POST /v1/chat/completions         MLX OpenAI proxy

Background:
├── MLX server manager (mlx_lm.server)
└── Claude MQ watcher (.claude-mq/inbox→outbox)
```

---

## apps/flowstudio — 미래 (이미지 + 콘텐츠)

```
Sidebar (예상):
├── Generate (7 모드)
│   ├── /create        CREATE
│   ├── /edit          EDIT (in-painting)
│   ├── /poster        POSTER
│   ├── /detail-edit   DETAIL_EDIT
│   ├── /retouch       RETOUCH
│   ├── /scene         SCENE
│   └── /style         STYLE_TRANSFER
├── /builder/[docId]   상세페이지 빌더 (23블록)
└── Library
    ├── /gallery
    ├── /presets
    └── /workflows     ComfyUI workflows
Account: /billing /settings
```

**의존**: `pbc-image-engine` (전체) + `pbc-block-builder` (빌더) + `core-design-md` (전용 theme) + `pbc-billing` (1년 후)

---

## apps/flowvue — 미래 (ERP)

```
Sidebar (예상):
├── /dashboard          ERP KPI
├── /inventory          [목록][[sku]][/receive][/ship]
├── /orders             [목록][[id]][/new]
├── /shipping
├── /purchase
├── /customers
├── /products           상품 카탈로그
├── /reports            매출/재고/고객 분석
└── /settings
```

**의존**: `pbc-erp-inventory` + `pbc-erp-orders` + `pbc-billing` + `pbc-messaging` + `pbc-block-builder` (상품 상세)

---

## apps/flowretouch — 미래 (리터치 전용)

```
Sidebar (예상):
├── /editor/[imageId]   에디터 (3컬럼: Tools / Canvas / Inspector)
├── /batch              배치 처리
├── /presets            Pro / Free / Custom
├── /projects           프로젝트 목록
├── /history            히스토리
└── /billing /settings
```

**의존**: `pbc-image-engine` RETOUCH 모드 단독 (PRO_MODE_SYSTEM_PROMPT) + `core-design-md`

---

## 공통 메타플랫폼 표준

모든 앱은 다음을 따른다 (`docs/specs/meta-platform/app-shell-ux.md`):

1. **Sidebar 1개 + Topbar 1개** 강제 (중복 발명 금지)
2. **6 page patterns**: Dashboard / List / Detail / Form / Settings / Marketing
3. **State 4종**: Loading / Empty / Error / Success
4. **DESIGN.md 토큰만 사용** — 신규 토큰 발명 금지

`wireframes/shared/shell.html` 참고.

# Portal Scraper 아키텍처 설계 검토 (WI-318/319/320)

**날짜**: 2026-04-25
**범위**: 홈택스(WI-318) / 민원24(WI-319) / 4대보험(WI-320) 포털 자동화
**검토 대상**: 기존 Electron Playwright 드라이버 접근 vs `flowvue-scraper` (Python/Windows) 재활용

**확정 상태**: ✅ APPROVED (2026-04-25) — 사용자 승인
- Q1: 옵션 B (flowvue-scraper 확장 + AXLE API)
- Q2: flowvue-scraper 별도 저장소 유지
- Q3: Electron 존치 (subprocess 런처)
- Q4: PoC 먼저 (WI-318a API → WI-318d/e scraper PoC)
- Q5: 파일 스토리지 = Vercel Blob

WI 재분해 결과는 `.flowset/fix_plan.md` (WI-318a~f, 319a~b, 320a~b) 참조.
계약은 `.flowset/contracts/scraper-api.md` + `scraper-data.md` (DRAFT → 실구현 착수 시 동결).

---

## 1. 현재 상태 파악

### 1.1 AXLE 측 (소비자)
- `apps/desktop/src/main/portal/page-objects/{hometax,minwon24,insurance}.ts` **스텁**
- `apps/desktop/src/main/ipc/portal.ts` IPC 라우터 (login/scrape/status/logout)
- `packages/db/prisma/schema.prisma` 내 모델
  - `AutomationLog` — executedAt/type/target/status/resultUrl/errorMessage/detail(Json)
  - `AutoType` enum — `HOMETAX_ISSUE / MINWON24_ISSUE / INSURANCE_ISSUE / PORTAL_UPLOAD / DART_FETCH / CRAWL`
- 웹 API: `GET /api/automation-logs` (읽기 전용, 조회만)
- **`AutomationLog` writer 부재** — 어디서도 HOMETAX_ISSUE/MINWON24_ISSUE/INSURANCE_ISSUE 를 INSERT 하지 않음
- 업무 목적: **증명서 발급 중심** (납세증명/사업자등록/가입자명부 등 PDF 다운로드 + `resultUrl`로 스토리지 참조)

### 1.2 flowvue-scraper 측 (원격 Windows PC)
- 경로: `E:\dev\flowvue-scraper` / WSL `/mnt/e/dev/flowvue-scraper`
- 언어: **Python + uv + Playwright(chromium system channel)**
- 현재 대상: **Hometax 전용**
  - 대상 페이지: 매출세금계산서, 매입세금계산서, 카드매출, 카드매입, 현금영수증 (세금계산서 중심)
  - 증명서 발급은 현재 **미구현**
- 인프라 자산 (재활용 가치 높음)
  - `src/auth/` PFX 인증서 로그인 (`savePfxToWebStorage` → dscert iframe)
  - `src/pages/base.py` WebSquare SPA 네비게이션 (`$c.pp.fn_topMenuOpen`)
  - `src/pages/login.py` — jQuery `blockUI` 해제, 인증서 선택, 비밀번호 입력 자동화
  - `src/repair/tier1.py` OpenAI Vision 기반 셀렉터 자가복구 (캡 3회)
  - `src/selectors/default.json` DOM 셀렉터 맵 + 런타임 갱신
- 런타임 제약 (HomeTax 고유)
  - 반드시 Windows 네이티브 실행 (WSL 불가 — MagicLine `ntsmagiclinenp://` 프로토콜 핸들러)
  - 반드시 시스템 Chrome 채널 (bundled chromium은 ERR_CONNECTION_RESET 차단)
  - **헤드리스 불가** (anti-bot 감지)
  - `wait_for_load_state("networkidle")` 사용 금지 (WebSquare 백그라운드 커넥션이 hang)
- FlowVue 연동 계약 (AXLE엔 존재하지 않음)
  - `X-Scraper-Key` 공유키 헤더
  - `/api/scraper/customers` — 고객 목록 pull
  - `/api/scraper/submit` — 스크랩 레코드 push
  - `/api/scraper/repair` — 셀렉터 복구 이벤트 push
  - `/api/scraper/report` — 세션 요약 push

### 1.3 핵심 gap
| 항목 | flowvue-scraper | AXLE 요구 | 갭 |
|------|-----------------|-----------|-----|
| 포털 범위 | Hometax 전용 | Hometax+민원24+4대보험 | 민원24/4대보험 페이지 신규 |
| 출력 유형 | 세금계산서 행 데이터 | 증명서 PDF 파일 | 다운로드·파일 업로드 플로우 신규 |
| 백엔드 API | `/api/scraper/*` (FlowVue) | `/api/scraper/*` (AXLE에 없음) | AXLE에 해당 라우트 신규 + 공유키 인증 |
| 인증서 관리 | PFX base64 in-memory | `packages/db` `ClientCertificate` 가능 | 키 저장·전달 파이프라인 설계 필요 |
| 실행 주체 | 사용자 Windows PC | 컨설턴트 로컬? 서버? | 배포 모델 확정 필요 |
| 자가복구 | Tier1 (Vision) 구현됨 | 미구현 | 그대로 이식 |

---

## 2. 설계 옵션

### 옵션 A — **기존 Electron + Playwright(TS) 신규 구현** (원래 WI-318~320 계획)
```
Consultant Mac/Windows
  └─ Electron App (apps/desktop)
       └─ Node Main Process
            └─ Playwright (TS) + node-forge (PKCS#12)
                 → 각 포털 사이트
       └─ AXLE Web API (Prisma) — AutomationLog 직접 INSERT
```
**장점**
- 모노레포 안에서 완결 (TS/TypeScript 일관성)
- 사용자는 Electron 앱 하나만 설치
- IPC 계약이 이미 존재 (`portal.ts`)

**단점**
- **HomeTax가 Electron의 bundled Chromium 차단** (flowvue-scraper에서 확인: system Chrome channel 필수) — Electron은 번들된 Chromium 강제 → 홈택스 **작동 안 할 확률 매우 높음**
- MagicLine 인증서 모듈은 Windows 프로토콜 핸들러에 의존 — Mac은 사실상 불가, Windows Electron에서도 `ntsmagiclinenp://` 프로토콜 등록 필요
- WebSquare SPA 고유 제약(네트워크 idle 금지, blockUI 해제 등)을 TS로 재구현
- 자가복구 Vision 로직을 TS로 재구현
- 3개 포털 각각 실 동작 검증에 인증서 + 실 계정 필요

**예상 공수**: 매우 큼. **홈택스 성공 가능성이 낮음.**

---

### 옵션 B — **flowvue-scraper 확장 + AXLE API 신규** ← **권장**
```
Consultant Windows PC (필수)
  ├─ flowvue-scraper (Python, AXLE 모드)
  │    ├─ 공통 infra: auth/login/base/repair/selectors (재활용)
  │    ├─ pages/hometax_certificate.py (신규 — 납세증명/사업자등록)
  │    ├─ pages/minwon24_certificate.py (신규 — 각종 증명서 발급)
  │    ├─ pages/insurance_enrollment.py (신규 — 가입자명부/납부확인)
  │    └─ AxleApiClient (신규, FlowVueClient 패턴 그대로)
  │         ↓ HTTPS (X-Scraper-Key)
  │         ↑ PDF binary + 메타데이터
  │
  ▼
AXLE Web (Vercel)
  ├─ POST /api/scraper/jobs       — 스크래퍼가 받아갈 job pull
  ├─ POST /api/scraper/results    — 결과 PDF upload + AutomationLog INSERT
  ├─ POST /api/scraper/repair     — 셀렉터 복구 이벤트
  └─ POST /api/scraper/report     — 세션 요약
```

**장점**
- 홈택스 **실동작이 검증된 인프라** 그대로 사용 (system Chrome / PFX / WebSquare)
- 민원24/4대보험도 WebSquare 또는 유사 스택 — 동일 base 재활용
- 자가복구 시스템 이미 존재
- 인증서/비밀번호가 **컨설턴트 로컬 PC**에만 존재 → 보안 리스크 최소
- **Electron은 UI/스케줄러만 담당**, 실 자동화는 Python에 위임
- AXLE 서버측은 REST만 담당 → 서버리스와 호환 (Vercel)

**단점**
- 2개 코드베이스 유지 (AXLE TS + flowvue-scraper Python)
- 컨설턴트가 Windows PC **필수** (Mac 사용자 불가)
- flowvue-scraper가 현재 FlowVue 전용 — **AXLE 모드**로 분리 필요 (환경변수 스위치 또는 client plugin 구조)
- 공유키 교체/관리 절차 필요

**예상 공수**: 중간. 공통 인프라 이미 있어서 페이지 3종 + API 4종 + 클라이언트 확장

---

### 옵션 C — **flowvue-scraper 포크 후 AXLE 전용 저장소**
```
axle-scraper (신규 repo, flowvue-scraper 포크)
  └─ flowvue-scraper의 auth/base/repair/selectors만 재활용
  └─ AXLE 특화 pages + AxleApiClient만 남김
```
**장점**: 코드 격리, AXLE 독자 진화 가능
**단점**: 인프라 개선 시 두 저장소 수동 sync. flowvue-scraper 팀(사용자 본인)이 이중 유지.

**평가**: 현 단계(초기 통합)에서는 과설계. 옵션 B 안에서 "AXLE 모드"로 먼저 동작 확인 후, **규모 커지면** 포크로 전환.

---

### 옵션 D — **서버측 자동화 (서버리스 Playwright)**
Vercel 등에서 Playwright 직접 실행 — **탈락**
- HomeTax anti-bot은 IP/브라우저 지문 감지 → 서버 IP 차단 확률 매우 높음
- PFX/비밀번호를 서버에 보관해야 함 → 규제·신뢰 리스크 (의료/금융 자료 포함 시 법적 이슈)
- 헤드리스 불가라 서버리스 불가

---

## 3. 권장안: **옵션 B**

### 3.1 범위 재정의
기존 WI:
- WI-318-feat 홈택스 납세증명/사업자등록증 발급 **Playwright 실구현**
- WI-319-feat 민원24 각종 증명서 발급 **Playwright 실구현**
- WI-320-feat 4대보험 가입자 명부/납부확인 **Playwright 실구현**
- WI-321-feat PKCS#12 공인인증서 실제 비밀번호 검증 + 서명 (node-forge)

**개정 제안**:
- WI-318~320 → **flowvue-scraper 기반 확장**으로 변경
- **WI-321 재검토**: PKCS#12 서명이 AXLE 내부 용도인지 포털 로그인 용도인지 확인 필요. 포털 로그인은 flowvue-scraper에서 이미 PFX 처리 → AXLE `node-forge` 불필요할 수 있음. 내부용(계약서 전자서명 등)이면 독립 WI로 유지.

### 3.2 WI 재분해 (초안)
| WI | 제목 | 영역 |
|----|------|------|
| WI-318a | AXLE `/api/scraper/*` 엔드포인트 4종 신설 (jobs/results/repair/report) + `X-Scraper-Key` 인증 | AXLE 웹 |
| WI-318b | `AutomationLog` writer + `ScraperJob` 모델 신설 (큐) + 파일 업로드(PDF 저장) | AXLE DB/API |
| WI-318c | flowvue-scraper에 `AxleApiClient` 클래스 + 설정 분기(`SCRAPER_MODE=axle`) | scraper |
| WI-318d | flowvue-scraper `pages/hometax_certificate.py` — 납세증명/사업자등록 다운로드 | scraper |
| WI-318e | Electron UI에서 job enqueue (client 선택 → 증명서 유형 선택 → API POST) | desktop |
| WI-318f | 웹에서 AutomationLog 결과 PDF 다운로드 링크 노출 | web |
| WI-319a | flowvue-scraper `pages/minwon24_*.py` | scraper |
| WI-319b | Electron/web UI 민원24 증명서 유형 선택 | web/desktop |
| WI-320a | flowvue-scraper `pages/insurance_*.py` | scraper |
| WI-320b | Electron/web UI 4대보험 조회/발급 | web/desktop |

### 3.3 contracts (신규 필요)
- `.flowset/contracts/scraper-api.md` — AXLE ↔ flowvue-scraper HTTP 계약 (jobs/results/repair/report 스키마, X-Scraper-Key rotation)
- `.flowset/contracts/scraper-data.md` — ScraperJob/AutomationLog 스키마, 파일 스토리지 경로 규칙

### 3.4 핵심 질문 (사용자 확정 필요)
1. **flowvue-scraper 저장소 위치**: 현재 `E:\dev\flowvue-scraper`는 AXLE과 **별개 저장소**인가? 아니면 AXLE 모노레포 내부 `apps/scraper`로 이관할 것인가?
   - 추천: 별개 유지 (Python + Node 혼재 방지) + AXLE `.flowset/rag/` 에 계약서 복제
2. **Electron 앱 역할**: "스크래퍼 런처 + 스케줄러 + 로그뷰어" 로 축소할 것인가? 아니면 완전 제거하고 사용자가 직접 Python 실행하게 할 것인가?
   - 추천: Electron 존치 — 비개발자 컨설턴트 UX. 단, Electron 자체는 Playwright 실행 안 함 (flowvue-scraper를 subprocess로 호출)
3. **파일 스토리지**: 다운로드된 PDF는 어디에?
   - Vercel Blob / Supabase Storage / S3 / 로컬 파일시스템 중 택
4. **공유키 rotation**: `X-Scraper-Key`는 수동 발급 vs 조직별 자동 발급
5. **컨설턴트 PC 요구사항 변경**: Mac 사용자에게도 "Windows PC 필수" 공지 필요. 대안 있는지? (예: Parallels Windows)

### 3.5 검증 전략
- flowvue-scraper의 기존 홈택스 테스트는 FlowVue 스크래핑 대상 — AXLE 증명서 발급은 별도 pytest 필요
- 단위 테스트: API 클라이언트 (mocked httpx) + 페이지 오브젝트 (Playwright fixture)
- 통합 테스트: 사용자 로컬 Windows PC에서 1회 실제 로그인 → 스크린샷 기반 검증
- 회귀 방지: `selectors/default.json` diff 감지 시 PR 알림

---

## 4. 리스크 매트릭스

| 리스크 | 가능성 | 영향 | 완화 |
|-------|------|------|------|
| flowvue-scraper 인프라가 증명서 발급 페이지에 안 맞음 | 중 | 중 | WI-318d 착수 전 1일 PoC |
| 민원24가 홈택스와 다른 스택 | 중 | 중 | 민원24 대상 사전 탐색 — WebSquare 여부 확인 |
| 컨설턴트 Windows PC 관리 부담 | 높음 | 중 | 최소 스펙 문서화, 자동 업데이트 스크립트 |
| X-Scraper-Key 유출 | 낮음 | 매우 높음 | org별 발급, Vercel env에만 저장, log redaction |
| flowvue-scraper가 FlowVue 전용 진화 | 중 | 중 | AXLE 모드 플러그인 격리, 공용 모듈과 분리 |
| PFX/비밀번호 탈취 | 낮음 | 매우 높음 | 메모리 전용, 디스크 저장 금지, 메모리 덤프 방지 옵션 |

---

## 5. 의사결정 요청

다음 선택지 중 결정 필요:

**Q1. 옵션 B로 진행?**
- 예 → WI-318~320 개정 + 신규 WI 쪼개기 + scraper-api.md 계약 작성 착수
- 아니오 → 옵션 A/C 중 택

**Q2. flowvue-scraper 저장소 이관 여부?**
- 별도 유지 (추천)
- AXLE 모노레포 `apps/scraper/`로 이관

**Q3. 배포 모델?**
- (a) Electron 앱이 flowvue-scraper를 subprocess 호출
- (b) flowvue-scraper 독립 실행, Electron은 제거/축소

**Q4. 최우선 순서?**
- (a) 인프라 먼저 (WI-318a/b: API + DB) → 그 다음 스크래퍼 페이지
- (b) 스크래퍼 PoC 먼저 (WI-318d: hometax_certificate 1페이지) → 동작 확인 후 API

**Q5. 파일 스토리지?**
- Vercel Blob (간단)
- Supabase Storage (이미 인프라 있음)
- 기타

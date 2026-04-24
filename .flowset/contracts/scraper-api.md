# Scraper HTTP API Contract

**버전**: 1.0 (2026-04-25)
**양측**: AXLE 웹(Next.js, 서버) ↔ flowvue-scraper (Python, 클라이언트 on Windows PC)
**상태**: DRAFT — 양측 WI 착수 시 동결

---

## 1. 개요

AXLE이 컨설팅 대상 고객의 포털(홈택스/민원24/4대보험) 자동화를 원할 때, 사용자 로컬 Windows PC에서 실행 중인 `flowvue-scraper`(AXLE 모드)가 작업을 가져가 수행하고 결과를 돌려주는 pull 기반 큐 모델.

```
[AXLE Web (Vercel)]                       [Consultant Windows PC]
      │                                         │
      │  1. user clicks "납세증명서 발급"          │
      ├──▶ POST /api/scraper/jobs (enqueue)      │
      │                                         │
      │                                   ┌─────▶ flowvue-scraper loop:
      │                                   │      poll every 30s
      │                                   │
      │◀── GET /api/scraper/jobs/next ────┤
      ├──▶ 200 { job + credentials }      │
      │                                   │      실행 (Playwright)
      │                                   │
      │◀── POST /api/scraper/results ─────┤
      │     (multipart: metadata+PDF)     │
      ├──▶ 200 { automationLogId }        │
      │                                   │
      │                                   │
[Vercel Blob Storage]◀── PDF 업로드 (서버 사이드)
```

---

## 2. 인증

| 항목 | 값 |
|------|----|
| 헤더 | `X-Scraper-Key: <token>` |
| 토큰 | 최소 32바이트 opaque, URL-safe base64 |
| 저장 | `ScraperApiKey` 모델 (해시 저장) |
| 스코프 | 조직(`orgId`)별 발급. 키 하나 = 조직 하나 |
| 발급 | AXLE 어드민 콘솔 → 1회 표시 후 해시 저장 |
| rotation | 수동. 새 키 발급 → 구 키 30분 유예 → 폐기 |
| 폐기 | 즉시 — `revokedAt` 설정 시 401 |
| 유출 감지 | 마지막 사용 IP/UA 기록, 비정상 IP 시 관리자 알림 |

**4xx 응답**: 스크래퍼 버그 (필수 필드 누락, 키 오류) → **재시도 금지**
**5xx 응답**: 서버 이슈 → exponential backoff (1s→30s→5m, 최대 30회)

---

## 3. 엔드포인트

### 3.1 `GET /api/scraper/health`
라이브니스 체크. 스크래퍼가 시작 시 1회 호출.

**응답 200**
```json
{
  "status": "ok",
  "serverTime": "2026-04-25T12:00:00.000Z",
  "version": "1.0.0"
}
```

### 3.2 `POST /api/scraper/jobs` (서버 내부용 — 웹 UI가 job 생성)
**호출자**: AXLE 웹(내부 RPC). 스크래퍼는 호출하지 않음.
**바디**
```json
{
  "orgId": "cuid",
  "clientId": "cuid",
  "type": "HOMETAX_ISSUE | MINWON24_ISSUE | INSURANCE_ISSUE",
  "target": "납세증명서 | 사업자등록증 | 건강보험자격득실확인서 | ...",
  "params": { "year": 2026, "dateFrom": "2026-01-01", "dateTo": "2026-12-31" },
  "credentialsRef": "cuid (ClientCertificate.id)"
}
```
**응답 201**
```json
{ "jobId": "cuid", "status": "QUEUED" }
```

### 3.3 `GET /api/scraper/jobs/next`
**호출자**: flowvue-scraper (polling)
**동작**: QUEUED 중 가장 오래된 1건을 PICKED_UP 으로 전이시키고 credentials 포함하여 반환. 동시성은 DB row-lock.

**응답 200 (job 있음)**
```json
{
  "jobId": "cuid",
  "orgId": "cuid",
  "clientId": "cuid",
  "type": "HOMETAX_ISSUE",
  "target": "납세증명서",
  "params": { "year": 2026 },
  "credentials": {
    "method": "certificate | userpw",
    "pfxBase64": "MII..."   /* method=certificate 일 때 */,
    "certPassword": "..."   /* method=certificate 일 때, 한 번 전달 */,
    "userId": "..."          /* method=userpw 일 때 */,
    "userPw": "..."          /* method=userpw 일 때 */
  },
  "leaseSeconds": 3600
}
```
> `leaseSeconds` 내 결과 미수신 → 서버가 QUEUED 로 복귀 (다른 스크래퍼가 가져감)

**응답 204 (no content)**: 대기 중 job 없음

### 3.4 `POST /api/scraper/results`
**호출자**: flowvue-scraper (작업 완료/실패 시)
**Content-Type**: `multipart/form-data`
**필드**
- `metadata` (string, JSON)
  ```json
  {
    "jobId": "cuid",
    "status": "COMPLETED | FAILED",
    "errorCode": "LOGIN_FAILED | TIMEOUT | SELECTOR_MISSING | NETWORK | UNKNOWN",
    "errorMessage": "...",
    "detail": { "pageUrl": "...", "screenshots": ["blob-url"] },
    "durationMs": 12340
  }
  ```
- `file` (binary, optional) — status=COMPLETED 시 PDF 첨부. status=FAILED 시 생략.

**서버 동작**
1. jobId 검증 (PICKED_UP 상태 + 본인 스크래퍼 키)
2. 파일 있으면 Vercel Blob 업로드 → `resultUrl`
3. `AutomationLog` INSERT (type/target/status/resultUrl/errorMessage/detail=jobId+기타)
4. `ScraperJob` status → COMPLETED/FAILED + `completedAt`

**응답 200**
```json
{
  "automationLogId": "cuid",
  "resultUrl": "https://...blob.vercel-storage.com/...pdf" // null if FAILED
}
```

**응답 409**: 이미 COMPLETED/FAILED 된 job — 재시도하지 말고 무시
**응답 410**: 리스 만료 → 같은 job 다시 픽업해야 함

### 3.5 `POST /api/scraper/repair`
**호출자**: flowvue-scraper (Tier1/Tier2 자가복구 발생 시)
**바디**
```json
{
  "jobId": "cuid",
  "portal": "HOMETAX | MINWON24 | INSURANCE",
  "page": "login | navigation | hometax_certificate",
  "element": "loginButton | dateInput",
  "oldSelector": "#btnLogin",
  "newSelector": "button[data-action='login']",
  "repairedBy": "tier1 | tier2",
  "screenshotBase64": "..."  // optional, <500KB
}
```
**응답 200**: `{ accepted: true }`

서버는 이 이벤트를 `ScraperRepairLog` 테이블에 적재. 관리 콘솔에서 조회.

### 3.6 `POST /api/scraper/report`
**호출자**: flowvue-scraper (세션 종료 시)
**바디**
```json
{
  "scraperInstanceId": "hostname+pid",
  "startedAt": "...",
  "completedAt": "...",
  "jobsProcessed": 5,
  "jobsSucceeded": 4,
  "jobsFailed": 1,
  "repairsTriggered": 2,
  "version": "scraper-axle-0.1.0"
}
```
**응답 200**: `{ accepted: true }`

---

## 4. 보안/개인정보 제약

- 인증서 PFX와 비밀번호는 **응답 바디에만** 실림 (요청 저장 로그 금지)
- AXLE 서버 로그 redaction: `credentials`, `pfxBase64`, `certPassword`, `userPw` 필드는 **로그 출력 금지**
- Sentry / console.log 양쪽 모두 해당 필드 sanitize (기존 log-sanitizer 라이브러리 재활용)
- 스크래퍼는 credentials를 **메모리 내에서만** 보관, 디스크 저장 금지
- AXLE 서버는 `ClientCertificate` 모델에 PFX를 AES-256 암호화 저장 (keyring/env-based master key)
- `/api/scraper/jobs/next` 요청은 rate-limit: 분당 6회 / IP (초당 폴링 방지)
- 결과 PDF는 default-private Blob URL — 만료 설정된 사인 URL만 프론트에 노출

---

## 5. 에러 코드 규약

| HTTP | 의미 | 스크래퍼 대응 |
|------|------|-------------|
| 200/201/204 | 성공 | continue |
| 401 | 인증 실패 | stop, admin 알림 |
| 403 | 권한 없음 (org mismatch 등) | stop |
| 404 | jobId 없음 | drop, continue |
| 409 | 이미 완료된 job | drop, continue |
| 410 | 리스 만료 | 같은 job 재픽업 없이 continue |
| 422 | 스키마 오류 | stop, 버그 리포트 |
| 429 | rate limit | backoff |
| 5xx | 서버 오류 | exponential backoff |

---

## 6. 버전 관리

- 계약 버전은 이 문서 상단 표기
- Breaking change: 새 경로 (`/api/scraper/v2/...`) 병행 + 구버전 60일 유지 후 폐기
- 호환 가능 변경: 필드 추가 (기본값 포함), 양측 파싱 시 알 수 없는 필드 무시

---

## 7. 미결정 항목 (WI 착수 전 확정 필요)

- [ ] scraperInstanceId 할당 방식 (자동생성 vs 등록 필요)
- [ ] 파일 크기 상한 (기본 50MB 제안)
- [ ] Vercel Blob → 추후 S3 migration 경로
- [ ] 로컬 Windows PC ↔ Vercel 네트워크 단절 시 오프라인 큐 (scraper 로컬 SQLite) 필요 여부

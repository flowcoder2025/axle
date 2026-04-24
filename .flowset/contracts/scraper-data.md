# Scraper Data Contract

**버전**: 1.0 (2026-04-25)
**범위**: Prisma 모델, 파일 스토리지, 자격 증명 전달 경로
**상태**: DRAFT — 양측 WI 착수 시 동결

---

## 1. 신규 Prisma 모델

### 1.1 `ScraperJob`
```prisma
model ScraperJob {
  id                String        @id @default(cuid())
  orgId             String
  clientId          String

  type              AutoType      // HOMETAX_ISSUE | MINWON24_ISSUE | INSURANCE_ISSUE
  target            String        // "납세증명서" 등 사람-읽기형
  params            Json          // 포털별 입력 (year/dateRange/documentKind 등)

  status            ScraperJobStatus @default(QUEUED)
  pickedUpAt        DateTime?
  pickedUpBy        String?       // scraperInstanceId
  leaseExpiresAt    DateTime?
  completedAt       DateTime?

  credentialsRef    String        // ClientCertificate.id 또는 ClientPortalAccount.id
  credentialsKind   CredentialsKind  // CERTIFICATE | USERPW

  automationLogId   String?       @unique
  automationLog     AutomationLog? @relation(fields: [automationLogId], references: [id])

  createdBy         String        // User.id
  createdAt         DateTime      @default(now())

  client            Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)
  org               Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, status])
  @@index([status, leaseExpiresAt])  // 스크래퍼 폴링용 + 리스 만료 스위핑
  @@index([clientId])
  @@index([createdBy])
}

enum ScraperJobStatus {
  QUEUED
  PICKED_UP
  RUNNING     // 스크래퍼가 주기적으로 heartbeat — 선택적
  COMPLETED
  FAILED
  EXPIRED     // leaseExpiresAt 초과 시 sweeper 가 설정
  CANCELLED   // 사용자가 중단
}

enum CredentialsKind {
  CERTIFICATE   // PFX + password
  USERPW        // userId + userPw
}
```

### 1.2 `ScraperApiKey`
```prisma
model ScraperApiKey {
  id          String   @id @default(cuid())
  orgId       String
  label       String                      // "main-scraper", "backup-scraper" 등
  tokenHash   String   @unique            // SHA-256(token) — 원본은 발급 시 1회만 표시
  prefix      String                      // 앞 8자 (식별용, 조회 시)
  lastUsedAt  DateTime?
  lastUsedIp  String?
  revokedAt   DateTime?
  createdBy   String
  createdAt   DateTime @default(now())

  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([tokenHash])
}
```

### 1.3 `ClientCertificate`
```prisma
model ClientCertificate {
  id             String    @id @default(cuid())
  clientId       String
  subject        String                       // 인증서 Subject DN
  issuer         String
  serialNumber   String
  validFrom      DateTime
  validTo        DateTime

  pfxEncrypted   Bytes                        // AES-256-GCM 암호화된 PFX
  pfxIv          Bytes
  pfxTag         Bytes
  pwEncrypted    Bytes                        // 암호화된 password
  pwIv           Bytes
  pwTag          Bytes

  createdBy      String
  createdAt      DateTime  @default(now())

  client         Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([validTo])    // 만료 임박 조회
}
```

### 1.4 `ClientPortalAccount`
ID/PW 로그인이 필요한 포털(민원24/4대보험 일부)용.
```prisma
model ClientPortalAccount {
  id          String   @id @default(cuid())
  clientId    String
  portal      PortalKind                      // MINWON24 | INSURANCE
  userId      String
  passwordEnc Bytes                           // AES-256-GCM
  passwordIv  Bytes
  passwordTag Bytes
  createdBy   String
  createdAt   DateTime @default(now())

  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, portal])
  @@index([clientId])
}

enum PortalKind {
  HOMETAX
  MINWON24
  INSURANCE
}
```

### 1.5 `ScraperRepairLog`
```prisma
model ScraperRepairLog {
  id             String   @id @default(cuid())
  jobId          String?                       // nullable — 세션 외 발생 가능
  portal         PortalKind
  page           String
  element        String
  oldSelector    String
  newSelector    String
  repairedBy     String                        // "tier1" | "tier2"
  screenshotUrl  String?                       // Blob url, optional
  createdAt      DateTime @default(now())

  @@index([portal, createdAt])
}
```

### 1.6 `AutomationLog` 확장 (기존)
```prisma
model AutomationLog {
  // ... 기존 필드 ...
  scraperJob    ScraperJob?    // 역방향 관계
}
```
`detail` JSON 내 표준 스키마:
```json
{ "jobId": "...", "scraperVersion": "...", "errorCode": "...", "durationMs": 12340 }
```

---

## 2. `AutoType` 및 관련 enum 변경 없음
기존 `HOMETAX_ISSUE / MINWON24_ISSUE / INSURANCE_ISSUE / PORTAL_UPLOAD / DART_FETCH / CRAWL` 유지. 필요 시 target 문자열로 세분화.

---

## 3. 파일 스토리지 (Vercel Blob)

| 항목 | 값 |
|------|----|
| 공급자 | Vercel Blob |
| 경로 규칙 | `scraper/{orgId}/{yyyy-mm}/{jobId}/{target}.pdf` |
| 파일명 | 한글 포함 허용. 예: `납세증명서.pdf`. 중복 발생 시 `{n}` 서픽스. |
| 가시성 | `private` (기본). 프론트 노출은 서버가 발급한 signed URL (15분 TTL) |
| 보관 기간 | 365일 → cold 이동 검토 (1년 후 수동 정책) |
| 최대 크기 | 단일 파일 50MB |
| 메타 헤더 | `x-axle-client-id`, `x-axle-job-id`, `x-axle-type`, `x-axle-target` |

---

## 4. 자격 증명(Credentials) 흐름

### 4.1 저장 시
1. 사용자(컨설턴트)가 AXLE 웹에서 클라이언트별 인증서 업로드
2. 웹 서버 측에서 master key(`SCRAPER_CRED_MASTER_KEY`, env)로 AES-256-GCM 암호화
3. `ClientCertificate.pfxEncrypted/pwEncrypted` 적재
4. 원본 PFX/PW는 즉시 메모리에서 삭제

### 4.2 전달 시 (스크래퍼로)
1. `GET /api/scraper/jobs/next` 핸들러 내에서만 복호화
2. 응답 JSON에 `credentials.pfxBase64 / certPassword` 삽입 (HTTPS only)
3. 응답 후 메모리에서 즉시 삭제
4. **로그/Sentry/DB에 평문 기록 절대 금지** (log-sanitizer 확장)

### 4.3 스크래퍼 측
1. 수신 즉시 `playwright.savePfxToWebStorage(pfxBase64, pwd)` 호출
2. 작업 종료 시 브라우저 close + 변수 null
3. 디스크 저장 금지, swap 방지 옵션 Windows에서는 한계 존재 — 문서화만

### 4.4 Master key 관리
- env var `SCRAPER_CRED_MASTER_KEY` (32바이트 base64)
- Vercel env에 `Encrypted` 플래그로 저장
- 로테이션 시 re-encrypt migration 필요 (별도 운영 스크립트 WI)

---

## 5. 스크래퍼 폴링/리스 동작

| 상태 전이 | 트리거 |
|----------|--------|
| (create) → QUEUED | 사용자가 UI에서 발급 요청 |
| QUEUED → PICKED_UP | `GET /jobs/next` 응답 성공 |
| PICKED_UP → COMPLETED | `POST /results` status=COMPLETED |
| PICKED_UP → FAILED | `POST /results` status=FAILED |
| PICKED_UP → EXPIRED | `leaseExpiresAt < now()` sweeper (Cron, 1분 주기) |
| EXPIRED → QUEUED | sweeper가 재큐잉 (최대 3회, 이후 FAILED) |
| QUEUED/PICKED_UP → CANCELLED | 사용자가 UI에서 취소 |

`leaseExpiresAt = pickedUpAt + leaseSeconds`. 기본 leaseSeconds = 3600 (1시간).

---

## 6. 미결정 항목

- [ ] PortalKind를 AutoType 과 분리할지 합칠지 (현재 분리 제안: AutoType=의미, PortalKind=사이트)
- [ ] scraperInstanceId 중복 방지 (같은 호스트 2프로세스) — 현재 hostname+pid 만으로 충분한지
- [ ] heartbeat (스크래퍼가 `/jobs/{id}/heartbeat` 주기 호출) — 없으면 lease 만료로 해결, 있으면 중간 FAILED 감지 빠름
- [ ] Credentials expiry 정책 — 인증서 만료 임박 시 자동 알림
- [ ] 다른 기관 공유 인증서(법무/세무사 위임) 대응은 범위 밖 (향후 WI)

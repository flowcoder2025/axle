# AXLE — Consulting Automation Platform Design Spec

> Date: 2026-04-09
> Status: Draft → Pending User Review
> Codename: AXLE (AX + Axle — the axis everything turns on)

---

## 1. Overview

### 1.1 What Is AXLE?

AXLE is a **consulting business automation platform** for government grant consulting, venture/R&D certification, patent filing, and financial advisory. It consolidates scattered workflows (KakaoTalk, email, local folders) into a single system with AI-powered document generation, client management, and intelligent matching.

### 1.2 Users

- **Primary**: FlowCoder + 여유솔루션 consulting team (2-5 people)
- **Secondary**: Client company contacts (document upload, research journal writing)
- **Future**: SaaS expansion for external consultants

### 1.3 Core Value Proposition

| Before (현재) | After (AXLE) |
|--------------|-------------|
| 카톡/메일/폴더에 분산된 정보 | 고객사별 단일 대시보드 |
| 지원사업 수동 검색 | AI 크롤링 + 자동 매칭 추천 |
| 사업계획서 수동 작성 | 이중 엔진 AI 자동 생성 (RAG 초안 + 양식 정밀 편집) |
| 서류 수집 카톡으로 요청 | 토큰 링크 발송 → 업로드 → 자동 확인 |
| 인증 서류 하나씩 직접 신청 | Desktop 자동 발급 (홈택스, 민원24, 4대보험) |
| 미팅 메모 수기 작성 | 녹음 → 전사 → 요약 → 메일 자동 발송 |
| 연구일지 엑셀 관리 | AI 초안 + 웹 작성 + 월간 리포트 |

### 1.4 Business Volume

| 업무 | 빈도 | AI 수준 |
|------|------|---------|
| 사업계획서 | 월 ~10건 | Opus (claude -p) + RAG |
| 벤처+연구소+특허 번들 | 2개월 ~1건 | Haiku/로컬 |
| 재무제표 분석 | 기업당 연 1회 | Haiku |
| 연구일지 | 월간 (고객사당) | 로컬 MLX |

---

## 2. System Architecture

### 2.1 Turborepo Monorepo Structure

```
axle/
├── packages/
│   ├── db/                 Prisma 7 (Client Engine) + pgvector
│   ├── auth/               Auth.js v5 Split Config + ReBAC
│   ├── ai/                 AI Router + RAG + 평가 + 진단
│   ├── email/              Resend + Solapi (메일/SMS/알림톡)
│   ├── storage/            Supabase Storage + 이미지 처리 + PDF미리보기
│   ├── ocr/                문서 OCR + 명함 OCR + Popbill 사업자 검증
│   ├── docgen/             문서 생성 엔진 (사업계획서, 견적서, 계약서, HWPX, 특허)
│   ├── notification/       알림 (인앱 + 푸시 + Telegram + Discord)
│   ├── matching/           지원사업-기업 AI 매칭
│   ├── crawler/            지원사업 자동 크롤링
│   └── ui/                 공유 UI 컴포넌트 (shadcn/ui)
│
├── apps/
│   ├── web/                Next.js 16 → Vercel
│   ├── desktop/            Electron (웹 래핑 + 로컬 기능)
│   ├── agent-bridge/       Node.js → Mac Mini 상시가동
│   └── cron/               Vercel Cron 잡
│
├── turbo.json
└── package.json
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Turborepo Monorepo                         │
│                                                               │
│  packages/ (11개)                                             │
│  ┌────┐ ┌────┐ ┌──┐ ┌─────┐ ┌───────┐ ┌───┐ ┌──────┐       │
│  │ db │ │auth│ │ai│ │email│ │storage│ │ocr│ │docgen│       │
│  └──┬─┘ └──┬─┘ └┬─┘ └──┬──┘ └───┬───┘ └─┬─┘ └──┬───┘       │
│     │      │    │      │        │       │       │            │
│  ┌──────────┐ ┌────────────┐ ┌───────┐                       │
│  │notification│ │  matching  │ │crawler│                       │
│  └─────┬────┘ └─────┬──────┘ └───┬───┘                       │
│        │            │            │                            │
│  ┌─────┐                                                      │
│  │ ui  │                                                      │
│  └──┬──┘                                                      │
│     │                                                         │
│  apps/                                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  web (Next.js 16)                        → Vercel       │ │
│  │  ├── (crm)/          고객사·인물 관리                    │ │
│  │  ├── (projects)/     업무 프로젝트 (7가지 타입)           │ │
│  │  ├── (docs)/         서류 관리·생성·발급                  │ │
│  │  ├── (journal)/      연구일지 작성/관리                   │ │
│  │  ├── (calendar)/     지원사업 + 고객사 일정 통합           │ │
│  │  ├── (finance)/      재무 분석 대시보드                   │ │
│  │  ├── (collab)/       협업 (배정, 코멘트, 핸드오프)         │ │
│  │  ├── (analytics)/    합격률·매출·성과 대시보드             │ │
│  │  ├── (portal)/       고객사 외부 접근 뷰                  │ │
│  │  └── (settings)/     설정·팀·알림 관리                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  desktop (Electron)                     → 로컬 설치      │ │
│  │  ├── BrowserWindow → web 앱 로드                        │ │
│  │  ├── ipc/recorder    미팅 녹음 (네이티브 오디오)           │ │
│  │  ├── ipc/cert        공인인증서 (PKCS#12)                │ │
│  │  ├── ipc/portal      포털 서류 등록 (Playwright)          │ │
│  │  └── ipc/agent       agent-bridge 직접 통신              │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  agent-bridge (Node.js)                 → Mac Mini 상시  │ │
│  │  ├── mlx-server      MLX Hermes 3 프로세스 관리          │ │
│  │  ├── claude-mq       .claude-mq/ 브릿지 (claude -p)     │ │
│  │  ├── ai-router       3-tier AI 전환                     │ │
│  │  ├── browser-auto    Playwright (홈택스, 민원24, 포털)    │ │
│  │  ├── skill-log       업무 패턴 기록 → Unsloth 파인튜닝    │ │
│  │  └── research        자료 조사 파이프라인                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  cron (Vercel Cron)                                     │ │
│  │  ├── doc-reminder      서류 제출 리마인더                 │ │
│  │  ├── deadline-alert    지원사업 마감 알림                  │ │
│  │  ├── journal-remind    연구일지 작성 리마인더              │ │
│  │  ├── schedule-sync     Google Calendar 동기화             │ │
│  │  ├── doc-expiry        서류 만료 알림                     │ │
│  │  ├── crawler-execute   지원사업 크롤링 실행                │ │
│  │  ├── matching-refresh  매칭 결과 갱신                     │ │
│  │  ├── embedding-generate 문서 벡터 생성                    │ │
│  │  └── daily-digest      일일 요약 메일                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

External Services:
├── Supabase (PostgreSQL + pgvector + Storage)
├── Vercel (웹 배포 + Fluid Compute + Cron)
├── Resend (이메일)
├── Solapi (SMS + 카카오 알림톡)
├── Upstash (Redis 세션 캐시 + QStash 잡큐)
├── Claude API / claude -p CLI (복잡 AI 작업)
├── OpenAI (embeddings: text-embedding-3-small)
├── Google Gemini (OCR, 문서 분석)
└── OCI VM (크롤러/임베딩 워커 — FlowMate 공유)
```

### 2.3 AI 3-Tier Architecture

```
┌─────────────────────────────────────────────────┐
│              AI Router (packages/ai)             │
│                                                   │
│  resolveAiTier(jobType, config) → AiTier         │
│                                                   │
│  ┌─────────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ LOCAL_MLX    │ │ API_HAIKU│ │ API_OPUS /    │ │
│  │ Hermes 3 8B │ │ Anthropic│ │ CLI_CLAUDE    │ │
│  │ via mlx-lm  │ │ API      │ │ claude -p     │ │
│  │             │ │          │ │ .claude-mq/   │ │
│  │ 단순 작업:   │ │ 중간:     │ │ 복잡:          │ │
│  │ 연구일지초안 │ │ 요약      │ │ 사업계획서     │ │
│  │ 서류분류    │ │ 재무분석  │ │ 특허명세서     │ │
│  │ 음성메모    │ │ 전사      │ │ 시장조사      │ │
│  └──────┬──────┘ └─────┬────┘ └───────┬───────┘ │
│         │              │              │          │
│         └──── 설정으로 전환 가능 ─────┘          │
│                                                   │
│  SkillPattern 학습 루프:                          │
│  AiJob 완료 → 패턴 추출 → successCount++          │
│  → ≥10회 → Unsloth 파인튜닝 후보                  │
│  → 파인튜닝 완료 → LOCAL_MLX로 자동 승격           │
└─────────────────────────────────────────────────┘
```

### 2.4 Desktop vs Web Feature Matrix

| 기능 | Web | Desktop (Electron) |
|------|:---:|:--:|
| CRM / 프로젝트 / 서류 관리 | ✅ | ✅ |
| 연구일지 작성 | ✅ | ✅ |
| 캘린더 / 일정 | ✅ | ✅ |
| 재무 분석 대시보드 | ✅ | ✅ |
| 로컬 MLX 직접 호출 | ❌ | ✅ (IPC → agent-bridge) |
| 공인인증서 접근 (PKCS#12) | ❌ | ✅ (로컬 파일시스템) |
| 미팅 녹음 (네이티브 마이크) | ⚠️ 제한 | ✅ (네이티브 오디오) |
| 외부 녹음 파일 업로드 | ✅ | ✅ |
| 파일 드래그앤드롭 | ⚠️ 제한 | ✅ (네이티브) |
| 시스템 트레이 알림 | ❌ | ✅ |
| 오프라인 작업 | ❌ | ✅ (SQLite 로컬 캐시) |
| .claude-mq/ 직접 감시 | ❌ | ✅ (Chokidar) |
| 포털 서류 등록 (Playwright) | ❌ | ✅ |
| 홈택스/민원24 서류 발급 | ❌ | ✅ |

---

## 3. Data Model

### 3.1 FDP Foundation (Auth.js v5 + ReBAC)

```prisma
generator client {
  provider   = "prisma-client-js"
  engineType = "client"
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
}

// ===== Auth.js v5 =====
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  name              String?
  image             String?
  password          String?
  emailVerified     DateTime?
  disabled          Boolean   @default(false)

  accounts          Account[]
  orgMembers        OrgMember[]
  notifications     Notification[]
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?

  user              User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([provider, providerAccountId])
}

// ===== Organization =====
model Organization {
  id                String   @id @default(cuid())
  name              String
  settings          Json?
  createdAt         DateTime @default(now())

  members           OrgMember[]
  clients           Client[]
  programs          ProgramInfo[]
  templates         ChecklistTemplate[]
}

model OrgMember {
  id                String  @id @default(cuid())
  orgId             String
  userId            String
  role              OrgRole @default(MEMBER)

  org               Organization @relation(fields: [orgId], references: [id])
  user              User         @relation(fields: [userId], references: [id])
  @@unique([orgId, userId])
}

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
}

// ===== ReBAC =====
model RelationTuple {
  id                String @id @default(cuid())
  namespace         String
  objectId          String
  relation          String
  subjectType       String
  subjectId         String

  @@unique([namespace, objectId, relation, subjectType, subjectId])
  @@index([subjectType, subjectId])
  @@index([namespace, objectId])
}

model RelationDefinition {
  id                String  @id @default(cuid())
  namespace         String
  relation          String
  parentRelation    String?

  @@unique([namespace, relation])
}
```

### 3.2 CRM

```prisma
model Client {
  id                String       @id @default(cuid())
  orgId             String
  name              String
  businessNumber    String?
  ceoName           String?
  industry          String?
  address           String?
  phone             String?
  email             String?
  website           String?
  memo              String?
  status            ClientStatus @default(ACTIVE)
  assignedTo        String?

  // Company enrichment (FlowMate pattern)
  employeeCount     Int?
  capitalAmount     Decimal?
  foundedDate       DateTime?
  region            String?
  isVenture         Boolean      @default(false)
  isInnoBiz         Boolean      @default(false)
  isMainBiz         Boolean      @default(false)
  isSocial          Boolean      @default(false)
  ventureValidUntil DateTime?
  masterProfile     Json?
  profileBlocks     Json?

  contacts          Contact[]
  projects          Project[]
  documents         Document[]
  journals          ResearchJournal[]
  schedules         Schedule[]
  financials        ClientFinancial[]
  financialReports  FinancialReport[]
  achievements      ClientAchievement[]
  certificates      Certificate[]
  embeddings        DocumentEmbedding[]

  org               Organization @relation(fields: [orgId], references: [id])
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  @@index([orgId])
}

enum ClientStatus {
  ACTIVE
  INACTIVE
  PROSPECT
}

model Contact {
  id                String        @id @default(cuid())
  clientId          String
  name              String
  position          String?
  department        String?
  phone             String?
  email             String?
  isPrimary         Boolean       @default(false)
  memo              String?
  source            ContactSource @default(MANUAL)
  businessCardUrl   String?
  isResearcher      Boolean       @default(false)
  researchField     String?

  journals          ResearchJournal[]
  client            Client @relation(fields: [clientId], references: [id])
}

enum ContactSource {
  BUSINESS_CARD
  MANUAL
  IMPORT
}

model ClientFinancial {
  id                String   @id @default(cuid())
  clientId          String
  year              Int
  revenue           Decimal?
  operatingProfit   Decimal?
  netProfit         Decimal?
  totalAssets       Decimal?
  totalLiabilities  Decimal?
  totalEquity       Decimal?
  creditRating      String?
  source            String?

  client            Client @relation(fields: [clientId], references: [id])
  reports           FinancialReport[]
  @@unique([clientId, year])
}

model ClientAchievement {
  id                String          @id @default(cuid())
  clientId          String
  type              AchievementType
  title             String
  date              DateTime?
  amount            Decimal?
  description       String?
  documentId        String?

  client            Client @relation(fields: [clientId], references: [id])
}

enum AchievementType {
  PATENT
  AWARD
  CONTRACT
  INVESTMENT
  CERTIFICATION
}

model Certificate {
  id                String   @id @default(cuid())
  clientId          String
  type              String
  subjectName       String
  serialNumber      String?
  validFrom         DateTime?
  validTo           DateTime?
  storagePath       String?
  isActive          Boolean  @default(true)

  client            Client @relation(fields: [clientId], references: [id])
}
```

### 3.3 Programs & Matching

```prisma
model ProgramInfo {
  id                String          @id @default(cuid())
  orgId             String
  name              String
  agency            String?
  category          ProgramCategory
  announcementUrl   String?
  announcementDocId String?
  applicationStart  DateTime?
  applicationEnd    DateTime?
  maxFunding        Decimal?
  requirements      Json?
  eligibility       Json?
  region            String?
  memo              String?
  isCrawled         Boolean         @default(false)
  crawledAt         DateTime?

  projects          Project[]
  matchingResults   MatchingResult[]
  schedules         Schedule[]
  org               Organization @relation(fields: [orgId], references: [id])
}

enum ProgramCategory {
  STARTUP
  VENTURE
  RND
  CERTIFICATION
  EXPORT
  SMART_FACTORY
  GENERAL
}

model MatchingResult {
  id                String   @id @default(cuid())
  clientId          String
  programId         String
  score             Decimal
  matchReasons      Json?
  disqualifyReasons Json?
  isRelevant        Boolean?
  feedbackNote      String?
  createdAt         DateTime @default(now())

  program           ProgramInfo @relation(fields: [programId], references: [id])
  @@index([clientId])
  @@index([programId])
}
```

### 3.4 Projects & Workflow

```prisma
model Project {
  id                String        @id @default(cuid())
  clientId          String
  programId         String?
  parentId          String?
  type              ProjectType
  title             String
  status            ProjectStatus @default(INTAKE)
  priority          Priority      @default(MEDIUM)
  assignedTo        String?
  dueDate           DateTime?
  submissionDate    DateTime?
  memo              String?
  metadata          Json?

  // Fee tracking
  feeType           FeeType?
  feeAmount         Decimal?
  successRate       Decimal?
  isPaid            Boolean       @default(false)

  children          Project[]       @relation("ProjectTree")
  parent            Project?        @relation("ProjectTree", fields: [parentId], references: [id])
  members           ProjectMember[]
  checklist         ChecklistItem[]
  documents         Document[]
  meetings          Meeting[]
  aiJobs            AiJob[]
  estimates         Estimate[]
  contracts         Contract[]

  client            Client       @relation(fields: [clientId], references: [id])
  program           ProgramInfo? @relation(fields: [programId], references: [id])
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}

enum ProjectType {
  BUSINESS_PLAN
  VENTURE_CERT
  SOBOOJANG_CERT
  RESEARCH_INSTITUTE
  PATENT
  FINANCIAL_ANALYSIS
  RESEARCH_TASK
  BUNDLE
}

enum ProjectStatus {
  INTAKE
  DOC_COLLECTING
  IN_PROGRESS
  REVIEW
  SUBMITTED
  APPROVED
  REJECTED
  COMPLETED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum FeeType {
  FIXED
  SUCCESS_RATE
  MONTHLY
}

model ProjectMember {
  id                String     @id @default(cuid())
  projectId         String
  userId            String
  role              MemberRole @default(MEMBER)

  project           Project @relation(fields: [projectId], references: [id])
  @@unique([projectId, userId])
}

enum MemberRole {
  LEAD
  MEMBER
  VIEWER
}

model ChecklistTemplate {
  id                String      @id @default(cuid())
  orgId             String
  projectType       ProjectType
  name              String
  description       String?
  isRequired        Boolean     @default(true)
  sortOrder         Int         @default(0)

  org               Organization @relation(fields: [orgId], references: [id])
  @@index([orgId, projectType])
}

model ChecklistItem {
  id                String    @id @default(cuid())
  projectId         String
  name              String
  description       String?
  isRequired        Boolean   @default(true)
  status            DocStatus @default(PENDING)
  requestedAt       DateTime?
  uploadedAt        DateTime?
  documentId        String?

  project           Project @relation(fields: [projectId], references: [id])
}

enum DocStatus {
  PENDING
  REQUESTED
  UPLOADED
  VERIFIED
}
```

### 3.5 Documents

```prisma
model Document {
  id                String      @id @default(cuid())
  clientId          String
  projectId         String?
  name              String
  fileUrl           String
  fileType          String
  category          DocCategory
  ocrStatus         OcrStatus   @default(NONE)
  ocrResult         Json?
  uploadToken       String?     @unique
  tokenExpiresAt    DateTime?
  expiresAt         DateTime?
  autoRenew         Boolean     @default(false)
  version           Int         @default(1)
  parentDocId       String?

  client            Client   @relation(fields: [clientId], references: [id])
  project           Project? @relation(fields: [projectId], references: [id])
  createdAt         DateTime @default(now())
}

enum DocCategory {
  INPUT
  OUTPUT
  TEMPLATE
  ISSUED
}

enum OcrStatus {
  NONE
  PROCESSING
  COMPLETED
  FAILED
}
```

### 3.6 Research Journal

```prisma
model ResearchJournal {
  id                   String        @id @default(cuid())
  clientId             String
  researcherContactId  String
  date                 DateTime
  title                String
  content              String
  objectives           String?
  results              String?
  nextSteps            String?
  hours                Decimal?
  attachments          Json?
  status               JournalStatus @default(DRAFT)
  approvedBy           String?
  approvedAt           DateTime?
  aiDraftJobId         String?

  client               Client  @relation(fields: [clientId], references: [id])
  researcher           Contact @relation(fields: [researcherContactId], references: [id])
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

enum JournalStatus {
  DRAFT
  SUBMITTED
  APPROVED
}
```

### 3.7 Meetings

```prisma
model Meeting {
  id                String   @id @default(cuid())
  projectId         String?
  clientId          String
  title             String
  date              DateTime
  location          String?
  recordingUrl      String?

  attendees         MeetingAttendee[]
  transcript        MeetingTranscript?
  actionItems       ActionItem[]
  emailLogs         EmailLog[]

  project           Project? @relation(fields: [projectId], references: [id])
  createdAt         DateTime @default(now())
}

model MeetingAttendee {
  id                String  @id @default(cuid())
  meetingId         String
  contactId         String?
  userId            String?
  name              String
  role              String?

  meeting           Meeting @relation(fields: [meetingId], references: [id])
}

model MeetingTranscript {
  id                String  @id @default(cuid())
  meetingId         String  @unique
  rawTranscript     String
  summary           String?
  keyDecisions      Json?
  sentiment         String?
  aiJobId           String?

  meeting           Meeting @relation(fields: [meetingId], references: [id])
}

model ActionItem {
  id                String       @id @default(cuid())
  meetingId         String
  description       String
  assigneeUserId    String?
  assigneeContactId String?
  dueDate           DateTime?
  status            ActionStatus @default(OPEN)
  linkedChecklistId String?

  meeting           Meeting @relation(fields: [meetingId], references: [id])
}

enum ActionStatus {
  OPEN
  IN_PROGRESS
  DONE
}
```

### 3.8 Estimates & Contracts

```prisma
model Estimate {
  id                String         @id @default(cuid())
  projectId         String?
  clientId          String
  estimateNumber    String         @unique
  items             Json
  totalAmount       Decimal
  taxAmount         Decimal?
  validUntil        DateTime?
  status            EstimateStatus @default(DRAFT)
  documentId        String?
  sentAt            DateTime?

  project           Project? @relation(fields: [projectId], references: [id])
  createdAt         DateTime @default(now())
}

enum EstimateStatus {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
}

model Contract {
  id                String         @id @default(cuid())
  projectId         String?
  clientId          String
  contractNumber    String         @unique
  title             String
  partyA            Json
  partyB            Json
  terms             Json
  totalAmount       Decimal?
  startDate         DateTime?
  endDate           DateTime?
  status            ContractStatus @default(DRAFT)
  documentId        String?
  signedAt          DateTime?

  project           Project? @relation(fields: [projectId], references: [id])
  createdAt         DateTime @default(now())
}

enum ContractStatus {
  DRAFT
  SENT
  SIGNED
  EXPIRED
}
```

### 3.9 Schedule

```prisma
model Schedule {
  id                String       @id @default(cuid())
  orgId             String
  clientId          String?
  projectId         String?
  programId         String?
  title             String
  description       String?
  type              ScheduleType
  startDate         DateTime
  endDate           DateTime?
  isAllDay          Boolean      @default(false)
  reminderDays      Int[]        @default([7, 3, 1])
  googleCalendarId  String?

  program           ProgramInfo? @relation(fields: [programId], references: [id])
  createdAt         DateTime     @default(now())
}

enum ScheduleType {
  DEADLINE
  MEETING
  REMINDER
  PROGRAM_DUE
}
```

### 3.10 Financial Reports

```prisma
model FinancialReport {
  id                  String           @id @default(cuid())
  clientId            String
  clientFinancialId   String?
  year                Int
  analysis            Json?
  adjustments         Json?
  reportUrl           String?

  client              Client           @relation(fields: [clientId], references: [id])
  clientFinancial     ClientFinancial? @relation(fields: [clientFinancialId], references: [id])
  createdAt           DateTime         @default(now())
  @@unique([clientId, year])
}
```

### 3.11 AI & Automation

```prisma
model AiJob {
  id                String     @id @default(cuid())
  projectId         String?
  type              AiJobType
  tier              AiTier
  status            JobStatus  @default(QUEUED)
  input             Json
  output            Json?
  cost              Decimal?
  durationMs        Int?
  errorMessage      String?
  skillPatternId    String?

  skillPattern      SkillPattern? @relation(fields: [skillPatternId], references: [id])
  project           Project?      @relation(fields: [projectId], references: [id])
  createdAt         DateTime      @default(now())
}

enum AiJobType {
  BUSINESS_PLAN
  RESEARCH
  OCR
  TRANSCRIBE
  SUMMARY
  JOURNAL_DRAFT
  FINANCIAL_ANALYSIS
  GAP_DIAGNOSIS
  EVALUATION
  MATCHING
}

enum AiTier {
  LOCAL_MLX
  API_HAIKU
  API_OPUS
  CLI_CLAUDE
}

enum JobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
}

model SkillPattern {
  id                String   @id @default(cuid())
  name              String
  taskType          String
  inputSchema       Json
  outputSchema      Json
  promptTemplate    String?
  successCount      Int      @default(0)
  lastUsedAt        DateTime?
  isFineTuned       Boolean  @default(false)

  aiJobs            AiJob[]
  createdAt         DateTime @default(now())
}

model AutomationLog {
  id                String    @id @default(cuid())
  clientId          String?
  type              AutoType
  target            String
  status            JobStatus
  resultUrl         String?
  errorMessage      String?
  executedAt        DateTime  @default(now())
}

enum AutoType {
  HOMETAX_ISSUE
  MINWON24_ISSUE
  INSURANCE_ISSUE
  PORTAL_UPLOAD
  DART_FETCH
}
```

### 3.12 Notifications & Logs

```prisma
model Notification {
  id                String           @id @default(cuid())
  userId            String
  type              NotificationType
  title             String
  body              String?
  link              String?
  isRead            Boolean          @default(false)

  user              User @relation(fields: [userId], references: [id])
  createdAt         DateTime @default(now())
}

enum NotificationType {
  DOC_REQUESTED
  DOC_UPLOADED
  DOC_EXPIRING
  DEADLINE
  MEETING
  JOURNAL_DUE
  ACTION_ITEM
  PROJECT_ASSIGNED
  MATCHING_RESULT
  AI_JOB_COMPLETE
  AI_JOB_FAILED
  PORTAL_COMPLETE
  HANDOFF
}

model EmailLog {
  id                String    @id @default(cuid())
  meetingId         String?
  clientId          String?
  projectId         String?
  to                String
  subject           String
  type              EmailType
  channel           String    @default("email")
  resendMessageId   String?
  sentAt            DateTime  @default(now())
  openedAt          DateTime?

  meeting           Meeting? @relation(fields: [meetingId], references: [id])
}

enum EmailType {
  DOC_REQUEST
  DOC_PUSH
  MEETING_SUMMARY
  ESTIMATE
  CONTRACT
  JOURNAL_REMINDER
  DEADLINE_ALERT
  MATCHING_DIGEST
  ONBOARDING
}

// RAG embeddings (pgvector)
model DocumentEmbedding {
  id                String @id @default(cuid())
  sourceType        String
  sourceId          String
  content           String
  embedding         Unsupported("vector(1536)")
  metadata          Json?

  @@index([sourceType, sourceId])
}
```

---

## 4. Core Workflows

### 4.0 End-to-End Business Flow

```
미팅 (녹음 → 전사 → 요약 → 액션아이템)
  → 액션아이템에서 프로젝트 자동 생성 제안
  → 승인 시 Project 생성 + ChecklistTemplate 적용

Project lifecycle:
  INTAKE → DOC_COLLECTING → IN_PROGRESS → REVIEW → SUBMITTED → APPROVED/REJECTED → COMPLETED

  INTAKE:          미팅 완료, 프로젝트 접수
  DOC_COLLECTING:  서류 요청 메일 발송, 토큰 업로드 대기
  IN_PROGRESS:     Gap 진단 → 문서 생성 → 자가 평가 → 제출 전 검증
  REVIEW:          컨설턴트 최종 검토
  SUBMITTED:       제출 완료
  APPROVED/REJECTED: 결과 기록
  COMPLETED:       수수료 정산, 프로젝트 아카이브
```

### 4.1 Client Onboarding

```
명함 촬영/수동 입력
  → OCR (packages/ocr, Gemini Vision) → Contact 생성
  → Client 생성 (사업자번호 → Popbill 검증 → DART/신용정보 자동 수집)
  → AI 마스터 프로필 자동 생성 (FlowMate 패턴)
  → 담당 컨설턴트 배정
  → 온보딩 체크리스트 발송 (NDA, 기업정보 양식)
```

### 4.2 Business Plan Project (~10/month)

```
1. 프로젝트 생성
   → ProgramInfo 선택 (자동 크롤링 목록 또는 매칭 추천)
   → ChecklistTemplate → 자동 체크리스트 생성

2. Gap 진단 (FlowMate diagnosis)
   → Client 문서 + ProgramInfo 요건 대조
   → 부족 서류/항목 자동 식별
   → ChecklistItem에 우선순위 반영

3. 서류 수집
   → 체크리스트별 업로드 토큰 생성
   → 서류 요청 메일/SMS/알림톡 발송
   → 고객사가 토큰 링크로 업로드
   → 업로드 시 Notification + 상태 변경
   → 미제출 → cron 자동 리마인더

4. [Desktop] 자동 서류 발급 (선택)
   → browser-auto: 홈택스, 민원24, 4대보험
   → AutomationLog 기록, Document 저장

5. 사업계획서 생성 (이중 엔진)
   → Step 1: FlowMate RAG로 초안 (고객사 벡터 + 성공 사례 참조)
   → Step 2: Program_Docs_Auto로 정밀 편집 (양식 맞춤 + 다이어그램)
   → AiJob 2개 체이닝

6. 자가 평가 (FlowMate evaluation-engine)
   → 평가 기준별 점수 → 약점/개선안
   → 수정 → 재평가 반복

7. 제출 전 검증 (FlowMate verification)
   → 서류 완비 + 양식 적합 + 자격 재확인

8. 제출 → 결과 기록
```

### 4.3 Venture + Institute + Patent Bundle (~1/2months)

```
1. BUNDLE 프로젝트 생성
   → 하위 자동 생성: VENTURE_CERT / RESEARCH_INSTITUTE / PATENT
   → 공통 서류 BUNDLE 레벨에서 1회 수집

2. 각 하위 독립 진행
   → 벤처: 기술성평가서 + HWPX 양식 자동 편집
   → 소부장: 해당 품목 증빙 + 기술자립도 평가
   → 연구소: 연구원 증빙 + 연구시설 + KOITA 신고서
   → 특허: 선행기술 AI 조사 → 명세서 초안

3. [Desktop] 포털 등록 (선택)
   → VENTUREIN / KOITA 시스템 Playwright 자동화
   → AutomationLog 기록

4. BUNDLE 완료 = 하위 전체 COMPLETED 시
```

### 4.4 Research Journal Management

```
1. 연구소 설립 완료 시 or 수동 시작
   → 연구원 (Contact.isResearcher=true) 확정
   → 월간 스케줄 자동 생성 (cron/journal-remind)

2. 작성
   → 직접 작성 or AI 초안 요청
   → AI: AiJob (JOURNAL_DRAFT, LOCAL_MLX/API_HAIKU)
   → 이전 일지 컨텍스트 + 연구 분야 → 초안 생성
   → 수정 → status: SUBMITTED

3. 검토 → 승인 → 월간 리포트 자동 생성 (docgen)

4. SkillPattern 축적 → 반복할수록 AI 품질 향상
```

### 4.5 Meeting → Transcription → Email

```
1. 녹음
   [Desktop] 네이티브 녹음 (Electron recorder)
   [Web] 외부 파일 업로드 (mp3/m4a/wav)
   [Web] 클로바노트 전사 텍스트 붙여넣기

2. 전사: AiJob (TRANSCRIBE, LOCAL_MLX mlx-whisper / API)
   → MeetingTranscript.rawTranscript

3. 요약 + 액션아이템: AiJob (SUMMARY, API_HAIKU)
   → summary, keyDecisions, ActionItem 자동 생성
   → ActionItem → ChecklistItem 연결 가능

4. 참석자 메일 자동 발송 → EmailLog
```

### 4.6 Financial Analysis (annual per client)

```
데이터 수집:
├── 상장사: DART OpenAPI
├── 비상장: 홈택스 스크래핑 (Desktop) / 직접 업로드
└── 수동 입력

→ ClientFinancial 저장
→ AiJob (FINANCIAL_ANALYSIS, API_HAIKU)
→ 지표 분석 (유동비율, 부채비율, ROE 등)
→ 조정 컨설팅 (adjustments)
→ 리포트 생성 (docgen → DOCX)
```

### 4.7 Estimates & Contracts

```
견적서: Client에서 직접 or Project에서 생성
  → 항목 입력 → docgen/estimate → DOCX/PDF
  → 메일 발송 → EmailLog
  → 수락 시 → 계약서 전환 or 프로젝트 자동 생성 제안

계약서: Estimate에서 전환 or 직접 생성
  → docgen/contract → 전자서명 (signature_pad) → DOCX
  → status: DRAFT → SENT → SIGNED
```

### 4.8 AI 3-Tier Routing

```typescript
function resolveAiTier(jobType: AiJobType, config: OrgSettings): AiTier {
  if (config.forceApiMode) return config.defaultApiTier

  switch (jobType) {
    case 'BUSINESS_PLAN':
    case 'PATENT':
    case 'RESEARCH':
      return 'CLI_CLAUDE'

    case 'JOURNAL_DRAFT':
    case 'SUMMARY':
    case 'OCR':
      return isLocalAvailable() ? 'LOCAL_MLX' : 'API_HAIKU'

    case 'TRANSCRIBE':
      return isLocalAvailable() ? 'LOCAL_MLX' : 'API_HAIKU'
      // LOCAL_MLX uses mlx-whisper (pip install mlx-whisper)

    case 'FINANCIAL_ANALYSIS':
    case 'GAP_DIAGNOSIS':
    case 'EVALUATION':
    case 'MATCHING':
      return 'API_HAIKU'

    default:
      return 'API_HAIKU'
  }
}
```

### 4.9 Research Task

```
프로젝트 생성 (RESEARCH_TASK)
  → 조사 항목 정의 (metadata)
  → AiJob (RESEARCH, CLI_CLAUDE)
  → agent-bridge → claude -p / deep-research
  → 웹 검색 + 분석
  → 보고서 생성 → Document (OUTPUT)
  → 다른 프로젝트에 참조 연결 가능
```

### 4.10 Program Schedule Management

```
자동 수집: FlowMate 크롤러 → ProgramInfo 자동 생성
  → applicationEnd → Schedule 자동 생성 (PROGRAM_DUE)
  → reminderDays: [30, 14, 7, 3, 1]

매칭: packages/matching → Client별 추천 지원사업
  → "이 고객사에 이 사업 추천" 알림 → 컨설턴트

캘린더 통합 뷰:
  → 지원사업 마감 + 고객사 일정 + 프로젝트 마일스톤
  → Google Calendar 양방향 동기화
```

### 4.11 Collaboration

```
프로젝트 배정: ProjectMember 추가 → Notification
담당자 변경: AI 자동 요약 → 인수자에게 핸드오프 메일
@멘션: Project.memo에서 → 해당 팀원 Notification
```

### 4.12 Notification Trigger Map

```
이벤트                          → 채널              → 대상
────────────────────────────────────────────────────────────
서류 업로드 완료                 → 인앱 + 이메일       → 담당 컨설턴트
서류 미제출 D-3                 → 이메일 + SMS        → 고객사 담당자
서류 만료 D-30/D-7              → 인앱               → 담당 컨설턴트
지원사업 마감 D-30~D-1          → 인앱 + Telegram     → 담당 컨설턴트
매칭 결과 (새 추천)              → 인앱 + 일일 다이제스트 → 담당 컨설턴트
프로젝트 배정                   → 인앱 + 이메일       → 배정된 팀원
미팅 요약 생성 완료              → 인앱               → 미팅 참석자 (내부)
연구일지 작성 리마인더           → 이메일 + SMS        → 연구원 (고객사)
AI 작업 완료/실패               → 인앱 + Telegram     → 담당 컨설턴트
견적서/계약서 발송               → 이메일              → 고객사
액션아이템 마감 D-1             → 인앱               → 담당자
번들 하위 전체 완료              → 인앱 + Telegram     → LEAD
포털 서류 등록 완료/실패         → 인앱 + Telegram     → 담당 컨설턴트
핸드오프                       → 이메일 + 인앱       → 인수자
```

### SkillPattern Learning Loop (global)

```
모든 AiJob 완료 시:
1. 입력/출력 패턴 추출
2. 기존 SkillPattern 매칭 → 있으면 successCount++
3. 없으면 새 SkillPattern 생성
4. successCount >= 10 → Unsloth 파인튜닝 후보 마킹
5. 파인튜닝 완료 → isFineTuned = true
6. 다음 동일 작업 → LOCAL_MLX로 라우팅 (tier 자동 승격)
```

---

## 5. Module Reuse Map

### 5.1 Summary

```
재사용: ~75%
  FlowVue + Scraper:      25%
  FlowMate:               20%
  FlowCoder_Dashboard:    12%
  Program_Docs_Auto:      10%
  FlowConnect:             5%
  FlowSystem:              3%

신규 개발: ~25%
  AI Router + SkillPattern:  8%
  AXLE 전용 UI:              7%
  agent-bridge (MLX+MQ):     5%
  Electron Desktop IPC:      5%
```

### 5.2 Detailed Mapping

#### packages/db
| Source | Module | Notes |
|--------|--------|-------|
| FlowVue | `prisma.ts` (Driver Adapter) | Model names changed |
| FlowVue | `dal.ts` (Data Access Layer) | Namespace changed |
| FlowCoder_Dashboard | `permissions.ts` (ReBAC) | As-is |
| **New** | AXLE schema | Section 3 above |

#### packages/auth
| Source | Module | Notes |
|--------|--------|-------|
| FlowVue | `auth.ts` + `auth.config.ts` (Split Config) | Provider adjusted |
| FlowVue | `middleware.ts` (Edge) | Route guards |
| FlowVue | `session-cache.ts` (3-tier) | As-is |
| FlowCoder_Dashboard | Onboarding flow | UI redesign |

#### packages/ai
| Source | Module | Notes |
|--------|--------|-------|
| FlowCoder_Dashboard | `lib/ai/transcribe.ts` | Add mlx-whisper local path |
| FlowCoder_Dashboard | `lib/ai/generate-minutes.ts` | Consulting-tuned prompts |
| FlowCoder_Dashboard | `lib/ai/ocr-contract.ts`, `ocr-document.ts` | As-is |
| FlowVue | `lib/ocr/gemini.ts` | Add business card OCR |
| FlowMate | `lib/rag.ts` (RAG system) | pgvector setup included |
| FlowMate | `lib/business-plan-generator.ts` | Integrate with Program_Docs_Auto |
| FlowMate | `lib/evaluation-engine.ts` | Self-evaluation |
| FlowMate | `lib/diagnosis/` | Gap diagnosis → ChecklistItem |
| FlowMate | `lib/verification/` | Pre-submission check |
| **New** | AI Router (3-tier) | MLX ↔ Haiku ↔ Opus |
| **New** | SkillPattern learning | Unsloth integration |
| **New** | claude -p CLI wrapper | .claude-mq/ bridge |

#### packages/email
| Source | Module | Notes |
|--------|--------|-------|
| FlowVue | `lib/email/client.ts` (Resend) | As-is |
| FlowVue | `lib/email/templates/` (@react-email) | Add doc-request, meeting-summary, estimate templates |
| FlowConnect | `lib/messaging.ts` (Solapi SMS + Kakao) | Channel merge |
| FlowVue | `lib/email/unsubscribe.ts` | As-is |
| **New** | EmailLog recording | Send history tracking |

#### packages/storage
| Source | Module | Notes |
|--------|--------|-------|
| FlowCoder_Dashboard | `lib/storage.ts` (Supabase Storage) | Bucket structure |
| FlowConnect | Upload token pattern | Merge into Document.uploadToken |
| FlowVue | `lib/pdf-to-image.ts` | Document preview |
| FlowConnect | `modules/image-processing/` (Sharp) | Upload optimization |
| FlowVue | ShareLink pattern | Client document sharing |

#### packages/ocr
| Source | Module | Notes |
|--------|--------|-------|
| FlowVue | `lib/ocr/gemini.ts` | Extend document types |
| FlowCoder_Dashboard | `lib/ai/ocr-contract.ts` | As-is |
| FlowCoder_Dashboard | `lib/ai/ocr-document.ts` | As-is |
| FlowVue | `lib/tax/popbill-client.ts` | Business number validation |
| **New** | Business card OCR → Contact | Gemini Vision |

#### packages/docgen
| Source | Module | Notes |
|--------|--------|-------|
| Program_Docs_Auto | Full pipeline (PDF parse → research → plan → images → DOCX) | Packageize |
| Program_Docs_Auto | `skills/mark-docx/` | As-is |
| Program_Docs_Auto | `skills/hwpx-editor/` | As-is |
| Program_Docs_Auto | `skills/pdf-to-markdown/` | As-is |
| Program_Docs_Auto | `skills/image-generator/` | As-is |
| FlowMate | `lib/document-parser.ts` + text_parser | HWP/HWPX/PDF extraction |
| FlowMate | `lib/export.ts` | DOCX/PDF/HWP export |
| FlowMate | `lib/documents/analyze.ts` | Document AI analysis |
| FlowVue | html5-qrcode | Document tracking QR |
| **New** | Estimate generator | docx-js based |
| **New** | Contract generator | docx-js based |
| **New** | Journal report generator | Monthly PDF |
| **New** | Patent draft generator | AI + template |
| **New** | Financial report generator | Charts + DOCX |

#### packages/notification
| Source | Module | Notes |
|--------|--------|-------|
| FlowCoder_Dashboard | `lib/notifications/triggers.ts` | Replace trigger map (4.12) |
| FlowCoder_Dashboard | `app/api/notifications/` | Model-adapted |
| FlowVue | `lib/push.ts` (Web Push) | As-is |
| FlowSystem | `lib/telegram.js` | TypeScript conversion |
| FlowMate | `lib/notifications.ts` (Discord + Slack) | Merge channels |

#### packages/matching (NEW)
| Source | Module | Notes |
|--------|--------|-------|
| FlowMate | `lib/matching.ts` (3-stage v3) | Adapt to Client model |
| FlowMate | `lib/project-normalize.ts` | Deduplication |

#### packages/crawler (NEW)
| Source | Module | Notes |
|--------|--------|-------|
| FlowMate | `lib/crawler/worker.ts` | ProgramInfo auto-creation |
| FlowMate | `lib/crawler/project-analyzer.ts` | AI analysis |
| FlowMate | `lib/crawler/playwright-browser.ts` | Memory optimization |
| FlowMate | `deploy/oci/` | OCI worker deployment |

#### packages/ui
| Source | Module | Notes |
|--------|--------|-------|
| FlowVue | `components/ui/` (shadcn/ui) | As-is |
| FlowVue | `components/signature-pad.tsx` | Contract signing |
| FlowCoder_Dashboard | `PipelineKanban.tsx` | Project pipeline |
| FlowCoder_Dashboard | `ActivityTimeline.tsx` | Client activity |
| FlowCoder_Dashboard | `components/meetings/` | Meeting UI |

#### apps/web
| Source | Module | Notes |
|--------|--------|-------|
| FlowVue | App structure (layout, nav, sidebar) | Menu redesign |
| FlowVue | `lib/qstash.ts` | As-is |
| FlowConnect | Google Calendar integration | As-is |
| FlowConnect | `modules/document/` | Checklist integration |
| FlowConnect | `modules/invitation/` | Onboarding invites |
| FlowCoder_Dashboard | `app/api/meetings/jobs/` (QStash chaining) | Pipeline extension |
| FlowCoder_Dashboard | Event Bus (`lib/events/`) | Trigger replacement |
| FlowMate | `hooks/use-user-project.ts` | Workflow state reference |

#### apps/desktop
| Source | Module | Notes |
|--------|--------|-------|
| FlowVue | `flowvue-desktop/electron/` | IPC extension |
| FlowVue Scraper | `src/auth/` | Cert auth (PKCS#12 for Mac) |
| FlowVue Scraper | `src/pages/` | Doc issuance + portal upload |
| FlowVue Scraper | `src/repair/` (Self-repair) | Portal selector changes |
| FlowVue Scraper | `src/orchestrator.py` | Multi-portal pipeline |
| FlowVue Scraper | `selectors/default.json` pattern | Dynamic selector mgmt |
| FlowVue | `lib/tax/crypto.ts` | Certificate crypto |
| FlowSystem | Playwright patterns | Session management |

#### apps/agent-bridge
| Source | Module | Notes |
|--------|--------|-------|
| Previous session design | `.claude-mq/` protocol | Full implementation |
| Previous session design | `status.json` schema | As-is |
| FlowSystem | `roles/` SOUL/IDENTITY | Hermes role definition |
| **New** | MLX server mgmt (mlx-lm serve) | Process manager |
| **New** | mlx-whisper wrapper | Local transcription |
| **New** | SkillPattern collector | AiJob → pattern extraction |

---

## 6. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Turborepo monorepo | Package reuse across projects, independent builds, future SaaS split |
| Backend | FDP (Next.js 16 + Prisma 7 + Supabase + Auth.js v5) | Proven stack, 6 projects validated |
| AI strategy | 3-tier hybrid (MLX ↔ Haiku ↔ Opus) | Cost optimization + quality where needed |
| Local LLM | MLX + Hermes 3 (not Ollama) | Apple Silicon native, 30-50% faster |
| Fine-tuning | Unsloth + SkillPattern | Skill learning from repeated tasks |
| Business plan engine | Dual: FlowMate RAG + Program_Docs_Auto | RAG for context, P_D_A for precision |
| Program discovery | FlowMate crawler (auto) | Replaces manual ProgramInfo entry |
| Desktop | Electron wrapper | Native recording, cert access, portal automation |
| Agent integration | .claude-mq/ file-based MQ | Proven design from previous session |
| DB for FlowMate shared code | Separate DBs, shared packages only | Independence, simpler migration |
| Crawler deployment | OCI VM (shared with FlowMate) | Already deployed, free tier |

---

## 7. Open Items

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | FlowMate와 AXLE DB 통합 시점 결정 | Low | 초기 분리, 필요 시 통합 |
| 2 | text_parser 마이크로서비스 공유 vs 독립 | Low | FlowMate Railway 인스턴스 공유 가능 |
| 3 | Hermes 3 MLX 양자화 모델 선정 | Medium | mlx-community에서 8B Q4 테스트 필요 |
| 4 | 고객사 포털 (portal) 인증 방식 | Low | 토큰 기반 제한 접근, Phase 2 |
| 5 | SaaS 전환 시 멀티테넌트 구조 | Low | Organization 모델로 기반 마련됨 |

---

## 8. Feature Count Summary

```
Total features:        28
Workflows defined:     13 (4.0 ~ 4.12 + SkillPattern loop)
Data models:          ~25 entities
Packages:              11
Apps:                   4 (web, desktop, agent-bridge, cron)
Cron jobs:              9
API route groups:     ~10 (CRM, projects, docs, journal, calendar, finance, collab, analytics, portal, settings)
Notification types:    14
Email types:            9
AI job types:          10
Reuse ratio:           75% reused / 25% new
Source projects:        6 (FlowVue, FlowMate, FlowConnect, FlowCoder_Dashboard, Program_Docs_Auto, FlowSystem)
```

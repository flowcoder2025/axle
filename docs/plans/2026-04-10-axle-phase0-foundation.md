# AXLE Phase 0: Monorepo + Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Turborepo monorepo with database schema, authentication, permissions, and UI foundation so all subsequent phases have a working base to build on.

**Architecture:** Turborepo monorepo with 3 shared packages (db, auth, ui) and 1 app (web). FDP Backend pattern: Next.js 16 + Prisma 7 Client Engine + Supabase PostgreSQL + Auth.js v5 Split Config + ReBAC + Vercel deployment.

**Tech Stack:** Turborepo, Next.js 16, Prisma 7 (Client Engine, Driver Adapter `@prisma/adapter-pg`), Supabase PostgreSQL + pgvector, Auth.js v5 (next-auth 5.x beta), @auth/prisma-adapter, Upstash Redis, shadcn/ui, Tailwind CSS 4, Zod, TypeScript 5, Vitest

---

## File Structure

```
axle/
├── turbo.json
├── package.json                          # Workspace root
├── .env.local                            # Root env (symlinked to .env)
├── .gitignore
├── tsconfig.json                         # Base TS config
│
├── packages/
│   ├── db/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma             # Full AXLE schema (25 models)
│   │   ├── src/
│   │   │   ├── index.ts                  # Public API exports
│   │   │   ├── client.ts                 # Prisma singleton (Driver Adapter)
│   │   │   └── permissions.ts            # ReBAC check/grant/revoke
│   │   └── tests/
│   │       └── permissions.test.ts
│   │
│   ├── auth/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                  # Public API exports
│   │   │   ├── auth.config.ts            # Edge Runtime config
│   │   │   ├── auth.ts                   # Node.js config (providers + adapter)
│   │   │   ├── middleware.ts             # Edge middleware helper
│   │   │   ├── dal.ts                    # Data Access Layer (cached auth)
│   │   │   └── session-cache.ts          # 3-tier hybrid cache
│   │   └── tests/
│   │       └── dal.test.ts
│   │
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── components/
│       │   │   ├── button.tsx
│       │   │   ├── input.tsx
│       │   │   ├── card.tsx
│       │   │   ├── dialog.tsx
│       │   │   ├── dropdown-menu.tsx
│       │   │   ├── label.tsx
│       │   │   ├── table.tsx
│       │   │   ├── badge.tsx
│       │   │   ├── sidebar.tsx
│       │   │   └── toast.tsx
│       │   ├── lib/
│       │   │   └── utils.ts              # cn() helper
│       │   └── globals.css               # Tailwind + design tokens
│       └── tailwind.config.ts
│
├── apps/
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── middleware.ts                  # Auth Edge middleware
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx            # Root layout
│       │   │   ├── page.tsx              # Landing/redirect
│       │   │   ├── (auth)/
│       │   │   │   ├── login/page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── (app)/
│       │   │   │   ├── layout.tsx        # Authenticated layout (sidebar)
│       │   │   │   └── dashboard/
│       │   │   │       └── page.tsx       # Dashboard placeholder
│       │   │   └── api/
│       │   │       └── auth/
│       │   │           └── [...nextauth]/
│       │   │               └── route.ts
│       │   ├── lib/
│       │   │   └── auth-client.ts        # Client-side auth helpers
│       │   └── components/
│       │       ├── app-sidebar.tsx
│       │       └── user-menu.tsx
│       ├── tailwind.config.ts
│       └── vitest.config.ts
│
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-09-axle-design.md
```

---

## Task 1: Turborepo Monorepo Initialization

**Files:**
- Create: `axle/package.json`
- Create: `axle/turbo.json`
- Create: `axle/tsconfig.json`
- Create: `axle/.gitignore`
- Create: `axle/.env.local`

- [ ] **Step 1: Create project directory and initialize git**

```bash
mkdir -p /Volumes/포터블/AX/axle
cd /Volumes/포터블/AX/axle
git init
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "axle",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:generate": "turbo db:generate",
    "db:push": "turbo db:push"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.0"
  },
  "packageManager": "npm@10.9.0"
}
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create base tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.next/
dist/
.turbo/
.env
.env.local
.env.*.local
*.tsbuildinfo
.vercel
prisma/generated/
```

- [ ] **Step 6: Create .env.local template**

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres.xxx:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Upstash Redis (session cache)
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Cron
CRON_SECRET=""
```

- [ ] **Step 7: Create symlink for Prisma CLI**

```bash
cd /Volumes/포터블/AX/axle
ln -s .env.local .env
```

- [ ] **Step 8: Create workspace directories**

```bash
mkdir -p packages/db/src packages/db/prisma packages/db/tests
mkdir -p packages/auth/src packages/auth/tests
mkdir -p packages/ui/src/components packages/ui/src/lib
mkdir -p apps/web/src/app
```

- [ ] **Step 9: Install root dependencies and verify**

```bash
cd /Volumes/포터블/AX/axle
npm install
npx turbo --version
```

Expected: Turbo version printed, no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: initialize Turborepo monorepo structure"
```

---

## Task 2: packages/db — Prisma Schema

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@axle/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./permissions": "./src/permissions.ts"
  },
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.0.0",
    "@prisma/client": "^7.0.0",
    "pg": "^8.16.0"
  },
  "devDependencies": {
    "prisma": "^7.0.0",
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create the full Prisma schema**

Create `packages/db/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  engineType = "client"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ==================== Auth.js v5 ====================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  password      String?
  emailVerified DateTime?
  disabled      Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  orgMembers    OrgMember[]
  notifications Notification[]
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

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([provider, providerAccountId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@id([identifier, token])
}

// ==================== Organization ====================

model Organization {
  id        String   @id @default(cuid())
  name      String
  settings  Json?
  createdAt DateTime @default(now())

  members   OrgMember[]
  clients   Client[]
  programs  ProgramInfo[]
  templates ChecklistTemplate[]
}

model OrgMember {
  id     String  @id @default(cuid())
  orgId  String
  userId String
  role   OrgRole @default(MEMBER)

  org  Organization @relation(fields: [orgId], references: [id])
  user User         @relation(fields: [userId], references: [id])
  @@unique([orgId, userId])
}

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
}

// ==================== ReBAC ====================

model RelationTuple {
  id          String @id @default(cuid())
  namespace   String
  objectId    String
  relation    String
  subjectType String
  subjectId   String

  @@unique([namespace, objectId, relation, subjectType, subjectId])
  @@index([subjectType, subjectId])
  @@index([namespace, objectId])
}

model RelationDefinition {
  id             String  @id @default(cuid())
  namespace      String
  relation       String
  parentRelation String?

  @@unique([namespace, relation])
}

// ==================== CRM ====================

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
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  contacts         Contact[]
  projects         Project[]
  documents        Document[]
  journals         ResearchJournal[]
  schedules        Schedule[]
  financials       ClientFinancial[]
  financialReports FinancialReport[]
  achievements     ClientAchievement[]
  certificates     Certificate[]

  org Organization @relation(fields: [orgId], references: [id])
  @@index([orgId])
}

enum ClientStatus {
  ACTIVE
  INACTIVE
  PROSPECT
}

model Contact {
  id              String        @id @default(cuid())
  clientId        String
  name            String
  position        String?
  department      String?
  phone           String?
  email           String?
  isPrimary       Boolean       @default(false)
  memo            String?
  source          ContactSource @default(MANUAL)
  businessCardUrl String?
  isResearcher    Boolean       @default(false)
  researchField   String?
  createdAt       DateTime      @default(now())

  journals ResearchJournal[]
  client   Client @relation(fields: [clientId], references: [id])
}

enum ContactSource {
  BUSINESS_CARD
  MANUAL
  IMPORT
}

model ClientFinancial {
  id               String   @id @default(cuid())
  clientId         String
  year             Int
  revenue          Decimal?
  operatingProfit  Decimal?
  netProfit        Decimal?
  totalAssets      Decimal?
  totalLiabilities Decimal?
  totalEquity      Decimal?
  creditRating     String?
  source           String?
  createdAt        DateTime @default(now())

  client  Client            @relation(fields: [clientId], references: [id])
  reports FinancialReport[]
  @@unique([clientId, year])
}

model ClientAchievement {
  id          String          @id @default(cuid())
  clientId    String
  type        AchievementType
  title       String
  date        DateTime?
  amount      Decimal?
  description String?
  documentId  String?
  createdAt   DateTime        @default(now())

  client Client @relation(fields: [clientId], references: [id])
}

enum AchievementType {
  PATENT
  AWARD
  CONTRACT
  INVESTMENT
  CERTIFICATION
}

model Certificate {
  id           String    @id @default(cuid())
  clientId     String
  type         String
  subjectName  String
  serialNumber String?
  validFrom    DateTime?
  validTo      DateTime?
  storagePath  String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())

  client Client @relation(fields: [clientId], references: [id])
}

// ==================== Programs & Matching ====================

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
  createdAt         DateTime        @default(now())

  projects        Project[]
  matchingResults MatchingResult[]
  schedules       Schedule[]
  org             Organization @relation(fields: [orgId], references: [id])
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

  program ProgramInfo @relation(fields: [programId], references: [id])
  @@index([clientId])
  @@index([programId])
}

// ==================== Projects ====================

model Project {
  id             String        @id @default(cuid())
  clientId       String
  programId      String?
  parentId       String?
  type           ProjectType
  title          String
  status         ProjectStatus @default(INTAKE)
  priority       Priority      @default(MEDIUM)
  assignedTo     String?
  dueDate        DateTime?
  submissionDate DateTime?
  memo           String?
  metadata       Json?
  feeType        FeeType?
  feeAmount      Decimal?
  successRate    Decimal?
  isPaid         Boolean       @default(false)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  children  Project[]       @relation("ProjectTree")
  parent    Project?        @relation("ProjectTree", fields: [parentId], references: [id])
  members   ProjectMember[]
  checklist ChecklistItem[]
  documents Document[]
  meetings  Meeting[]
  aiJobs    AiJob[]
  estimates Estimate[]
  contracts Contract[]

  client  Client       @relation(fields: [clientId], references: [id])
  program ProgramInfo? @relation(fields: [programId], references: [id])
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
  id        String     @id @default(cuid())
  projectId String
  userId    String
  role      MemberRole @default(MEMBER)

  project Project @relation(fields: [projectId], references: [id])
  @@unique([projectId, userId])
}

enum MemberRole {
  LEAD
  MEMBER
  VIEWER
}

model ChecklistTemplate {
  id          String      @id @default(cuid())
  orgId       String
  projectType ProjectType
  name        String
  description String?
  isRequired  Boolean     @default(true)
  sortOrder   Int         @default(0)

  org Organization @relation(fields: [orgId], references: [id])
  @@index([orgId, projectType])
}

model ChecklistItem {
  id          String    @id @default(cuid())
  projectId   String
  name        String
  description String?
  isRequired  Boolean   @default(true)
  status      DocStatus @default(PENDING)
  requestedAt DateTime?
  uploadedAt  DateTime?
  documentId  String?
  createdAt   DateTime  @default(now())

  project Project @relation(fields: [projectId], references: [id])
}

enum DocStatus {
  PENDING
  REQUESTED
  UPLOADED
  VERIFIED
}

// ==================== Documents ====================

model Document {
  id             String      @id @default(cuid())
  clientId       String
  projectId      String?
  name           String
  fileUrl        String
  fileType       String
  category       DocCategory
  ocrStatus      OcrStatus   @default(NONE)
  ocrResult      Json?
  uploadToken    String?     @unique
  tokenExpiresAt DateTime?
  expiresAt      DateTime?
  autoRenew      Boolean     @default(false)
  version        Int         @default(1)
  parentDocId    String?
  createdAt      DateTime    @default(now())

  client  Client   @relation(fields: [clientId], references: [id])
  project Project? @relation(fields: [projectId], references: [id])
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

// ==================== Research Journal ====================

model ResearchJournal {
  id                  String        @id @default(cuid())
  clientId            String
  researcherContactId String
  date                DateTime
  title               String
  content             String
  objectives          String?
  results             String?
  nextSteps           String?
  hours               Decimal?
  attachments         Json?
  status              JournalStatus @default(DRAFT)
  approvedBy          String?
  approvedAt          DateTime?
  aiDraftJobId        String?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  client     Client  @relation(fields: [clientId], references: [id])
  researcher Contact @relation(fields: [researcherContactId], references: [id])
}

enum JournalStatus {
  DRAFT
  SUBMITTED
  APPROVED
}

// ==================== Meetings ====================

model Meeting {
  id           String   @id @default(cuid())
  projectId    String?
  clientId     String
  title        String
  date         DateTime
  location     String?
  recordingUrl String?
  createdAt    DateTime @default(now())

  attendees  MeetingAttendee[]
  transcript MeetingTranscript?
  actionItems ActionItem[]
  emailLogs  EmailLog[]

  project Project? @relation(fields: [projectId], references: [id])
}

model MeetingAttendee {
  id        String  @id @default(cuid())
  meetingId String
  contactId String?
  userId    String?
  name      String
  role      String?

  meeting Meeting @relation(fields: [meetingId], references: [id])
}

model MeetingTranscript {
  id            String  @id @default(cuid())
  meetingId     String  @unique
  rawTranscript String
  summary       String?
  keyDecisions  Json?
  sentiment     String?
  aiJobId       String?
  createdAt     DateTime @default(now())

  meeting Meeting @relation(fields: [meetingId], references: [id])
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

  meeting Meeting @relation(fields: [meetingId], references: [id])
}

enum ActionStatus {
  OPEN
  IN_PROGRESS
  DONE
}

// ==================== Estimates & Contracts ====================

model Estimate {
  id             String         @id @default(cuid())
  projectId      String?
  clientId       String
  estimateNumber String         @unique
  items          Json
  totalAmount    Decimal
  taxAmount      Decimal?
  validUntil     DateTime?
  status         EstimateStatus @default(DRAFT)
  documentId     String?
  sentAt         DateTime?
  createdAt      DateTime       @default(now())

  project Project? @relation(fields: [projectId], references: [id])
}

enum EstimateStatus {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
}

model Contract {
  id             String         @id @default(cuid())
  projectId      String?
  clientId       String
  contractNumber String         @unique
  title          String
  partyA         Json
  partyB         Json
  terms          Json
  totalAmount    Decimal?
  startDate      DateTime?
  endDate        DateTime?
  status         ContractStatus @default(DRAFT)
  documentId     String?
  signedAt       DateTime?
  createdAt      DateTime       @default(now())

  project Project? @relation(fields: [projectId], references: [id])
}

enum ContractStatus {
  DRAFT
  SENT
  SIGNED
  EXPIRED
}

// ==================== Schedule ====================

model Schedule {
  id               String       @id @default(cuid())
  orgId            String
  clientId         String?
  projectId        String?
  programId        String?
  title            String
  description      String?
  type             ScheduleType
  startDate        DateTime
  endDate          DateTime?
  isAllDay         Boolean      @default(false)
  reminderDays     Int[]        @default([7, 3, 1])
  googleCalendarId String?
  createdAt        DateTime     @default(now())

  program ProgramInfo? @relation(fields: [programId], references: [id])
}

enum ScheduleType {
  DEADLINE
  MEETING
  REMINDER
  PROGRAM_DUE
}

// ==================== Financial Reports ====================

model FinancialReport {
  id                String           @id @default(cuid())
  clientId          String
  clientFinancialId String?
  year              Int
  analysis          Json?
  adjustments       Json?
  reportUrl         String?
  createdAt         DateTime         @default(now())

  client          Client           @relation(fields: [clientId], references: [id])
  clientFinancial ClientFinancial? @relation(fields: [clientFinancialId], references: [id])
  @@unique([clientId, year])
}

// ==================== AI ====================

model AiJob {
  id             String     @id @default(cuid())
  projectId      String?
  type           AiJobType
  tier           AiTier
  status         JobStatus  @default(QUEUED)
  input          Json
  output         Json?
  cost           Decimal?
  durationMs     Int?
  errorMessage   String?
  skillPatternId String?
  createdAt      DateTime   @default(now())

  skillPattern SkillPattern? @relation(fields: [skillPatternId], references: [id])
  project      Project?      @relation(fields: [projectId], references: [id])
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
  id             String    @id @default(cuid())
  name           String
  taskType       String
  inputSchema    Json
  outputSchema   Json
  promptTemplate String?
  successCount   Int       @default(0)
  lastUsedAt     DateTime?
  isFineTuned    Boolean   @default(false)
  createdAt      DateTime  @default(now())

  aiJobs AiJob[]
}

model AutomationLog {
  id           String   @id @default(cuid())
  clientId     String?
  type         AutoType
  target       String
  status       JobStatus
  resultUrl    String?
  errorMessage String?
  executedAt   DateTime @default(now())
}

enum AutoType {
  HOMETAX_ISSUE
  MINWON24_ISSUE
  INSURANCE_ISSUE
  PORTAL_UPLOAD
  DART_FETCH
}

// ==================== Notifications & Logs ====================

model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  body      String?
  link      String?
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  user User @relation(fields: [userId], references: [id])
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
  id              String    @id @default(cuid())
  meetingId       String?
  clientId        String?
  projectId       String?
  to              String
  subject         String
  type            EmailType
  channel         String    @default("email")
  resendMessageId String?
  sentAt          DateTime  @default(now())
  openedAt        DateTime?

  meeting Meeting? @relation(fields: [meetingId], references: [id])
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

// ==================== RAG (pgvector) ====================

model DocumentEmbedding {
  id         String @id @default(cuid())
  sourceType String
  sourceId   String
  content    String
  embedding  Unsupported("vector(1536)")
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([sourceType, sourceId])
}
```

- [ ] **Step 4: Create Prisma client singleton with Driver Adapter**

Create `packages/db/src/client.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Serverless: single connection
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Create public API exports**

Create `packages/db/src/index.ts`:

```typescript
export { prisma } from "./client";
export { check, grant, revoke, listRelations } from "./permissions";
export type {
  User,
  Account,
  Organization,
  OrgMember,
  Client,
  Contact,
  Project,
  Document,
  Meeting,
  AiJob,
  Notification,
  Schedule,
  Estimate,
  Contract,
  ResearchJournal,
  ChecklistItem,
  ChecklistTemplate,
  ProgramInfo,
  MatchingResult,
  ClientFinancial,
  FinancialReport,
  SkillPattern,
} from "@prisma/client";
export {
  OrgRole,
  ClientStatus,
  ContactSource,
  ProjectType,
  ProjectStatus,
  Priority,
  FeeType,
  MemberRole,
  DocStatus,
  DocCategory,
  OcrStatus,
  JournalStatus,
  ActionStatus,
  EstimateStatus,
  ContractStatus,
  ScheduleType,
  ProgramCategory,
  AiJobType,
  AiTier,
  JobStatus,
  AutoType,
  NotificationType,
  EmailType,
  AchievementType,
} from "@prisma/client";
```

- [ ] **Step 6: Install dependencies and generate Prisma client**

```bash
cd /Volumes/포터블/AX/axle
npm install
cd packages/db
npx prisma generate
```

Expected: "✔ Generated Prisma Client" without errors.

- [ ] **Step 7: Push schema to Supabase (requires DATABASE_URL in .env.local)**

```bash
cd /Volumes/포터블/AX/axle/packages/db
npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema." If DATABASE_URL not set, skip — will be done during deployment.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/db/
git commit -m "feat: add packages/db with full AXLE Prisma schema and client singleton"
```

---

## Task 3: packages/db — ReBAC Permissions

**Files:**
- Create: `packages/db/src/permissions.ts`
- Create: `packages/db/tests/permissions.test.ts`

- [ ] **Step 1: Write failing tests for permissions**

Create `packages/db/tests/permissions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma client
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockFindMany = vi.fn();

vi.mock("../src/client", () => ({
  prisma: {
    relationTuple: {
      findFirst: mockFindFirst,
      create: mockCreate,
      delete: mockDelete,
      findMany: mockFindMany,
    },
    relationDefinition: {
      findMany: vi.fn().mockResolvedValue([
        { namespace: "project", relation: "owner", parentRelation: null },
        { namespace: "project", relation: "editor", parentRelation: "owner" },
        { namespace: "project", relation: "viewer", parentRelation: "editor" },
      ]),
    },
  },
}));

import { check, grant, revoke, listRelations } from "../src/permissions";

describe("ReBAC Permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("check", () => {
    it("returns true when exact relation exists", async () => {
      mockFindFirst.mockResolvedValue({ id: "tuple-1" });

      const result = await check("user-1", "project", "proj-1", "editor");
      expect(result).toBe(true);
    });

    it("returns false when no relation exists", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await check("user-1", "project", "proj-1", "editor");
      expect(result).toBe(false);
    });

    it("returns true when parent relation exists (owner inherits editor)", async () => {
      // First call for "editor" returns null, second for "owner" returns tuple
      mockFindFirst
        .mockResolvedValueOnce(null) // editor not found
        .mockResolvedValueOnce({ id: "tuple-2" }); // owner found

      const result = await check("user-1", "project", "proj-1", "editor");
      expect(result).toBe(true);
    });
  });

  describe("grant", () => {
    it("creates a relation tuple", async () => {
      mockCreate.mockResolvedValue({ id: "new-tuple" });

      await grant("project", "proj-1", "editor", "user", "user-1");

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          namespace: "project",
          objectId: "proj-1",
          relation: "editor",
          subjectType: "user",
          subjectId: "user-1",
        },
      });
    });
  });

  describe("revoke", () => {
    it("deletes a relation tuple", async () => {
      mockFindFirst.mockResolvedValue({ id: "tuple-to-delete" });
      mockDelete.mockResolvedValue({});

      await revoke("project", "proj-1", "editor", "user", "user-1");

      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: "tuple-to-delete" },
      });
    });

    it("does nothing if tuple not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      await revoke("project", "proj-1", "editor", "user", "user-1");

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("listRelations", () => {
    it("returns all relations for a subject", async () => {
      mockFindMany.mockResolvedValue([
        { namespace: "project", objectId: "proj-1", relation: "owner" },
        { namespace: "project", objectId: "proj-2", relation: "editor" },
      ]);

      const result = await listRelations("user", "user-1");
      expect(result).toHaveLength(2);
      expect(result[0].relation).toBe("owner");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/db
npx vitest run tests/permissions.test.ts
```

Expected: FAIL — "Cannot find module '../src/permissions'"

- [ ] **Step 3: Implement permissions module**

Create `packages/db/src/permissions.ts`:

```typescript
import { prisma } from "./client";

/**
 * Check if a user has a specific relation to an object.
 * Supports relation inheritance: owner → editor → viewer.
 */
export async function check(
  userId: string,
  namespace: string,
  objectId: string,
  relation: string
): Promise<boolean> {
  // Direct check
  const direct = await prisma.relationTuple.findFirst({
    where: {
      namespace,
      objectId,
      relation,
      subjectType: "user",
      subjectId: userId,
    },
  });

  if (direct) return true;

  // Check parent relations (inheritance chain)
  const definitions = await prisma.relationDefinition.findMany({
    where: { namespace },
  });

  // Build inheritance: find which relation is the parent of the requested one
  const parentOf = new Map<string, string>();
  for (const def of definitions) {
    if (def.parentRelation) {
      parentOf.set(def.relation, def.parentRelation);
    }
  }

  // Walk up: if user has "owner" and we're checking "editor", owner inherits editor
  // We need to find relations that are ancestors of the requested relation
  const ancestors: string[] = [];
  let current: string | undefined = relation;
  while (current) {
    // Find which relation has `current` as its child
    const parentRelation = findParent(definitions, current);
    if (parentRelation) {
      ancestors.push(parentRelation);
      current = parentRelation;
    } else {
      current = undefined;
    }
  }

  if (ancestors.length === 0) return false;

  // Check if user has any ancestor relation
  const inherited = await prisma.relationTuple.findFirst({
    where: {
      namespace,
      objectId,
      relation: { in: ancestors },
      subjectType: "user",
      subjectId: userId,
    },
  });

  return !!inherited;
}

function findParent(
  definitions: Array<{ relation: string; parentRelation: string | null }>,
  childRelation: string
): string | null {
  // Find the relation whose child is `childRelation`
  // parentRelation means "this relation inherits from parentRelation"
  // So if editor.parentRelation = owner, then owner is the parent of editor
  // owner inherits editor's permissions (owner can do everything editor can)
  for (const def of definitions) {
    if (def.parentRelation === null) continue;
    // If def.relation = "editor" and def.parentRelation = "owner",
    // it means owner → editor inheritance
    // So if checking "editor", parent is "owner"
    if (def.relation === childRelation && def.parentRelation) {
      return def.parentRelation;
    }
  }
  return null;
}

/**
 * Grant a relation to a subject on an object.
 */
export async function grant(
  namespace: string,
  objectId: string,
  relation: string,
  subjectType: string,
  subjectId: string
): Promise<void> {
  await prisma.relationTuple.create({
    data: {
      namespace,
      objectId,
      relation,
      subjectType,
      subjectId,
    },
  });
}

/**
 * Revoke a relation from a subject on an object.
 */
export async function revoke(
  namespace: string,
  objectId: string,
  relation: string,
  subjectType: string,
  subjectId: string
): Promise<void> {
  const tuple = await prisma.relationTuple.findFirst({
    where: {
      namespace,
      objectId,
      relation,
      subjectType,
      subjectId,
    },
  });

  if (tuple) {
    await prisma.relationTuple.delete({
      where: { id: tuple.id },
    });
  }
}

/**
 * List all relations for a subject.
 */
export async function listRelations(
  subjectType: string,
  subjectId: string,
  namespace?: string
): Promise<Array<{ namespace: string; objectId: string; relation: string }>> {
  const tuples = await prisma.relationTuple.findMany({
    where: {
      subjectType,
      subjectId,
      ...(namespace ? { namespace } : {}),
    },
    select: {
      namespace: true,
      objectId: true,
      relation: true,
    },
  });

  return tuples;
}
```

- [ ] **Step 4: Create vitest config**

Create `packages/db/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/db
npx vitest run tests/permissions.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/db/src/permissions.ts packages/db/tests/ packages/db/vitest.config.ts
git commit -m "feat: add ReBAC permission system (check/grant/revoke/listRelations)"
```

---

## Task 4: packages/auth — Auth.js v5 Split Config

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/auth.config.ts`
- Create: `packages/auth/src/auth.ts`
- Create: `packages/auth/src/middleware.ts`
- Create: `packages/auth/src/dal.ts`
- Create: `packages/auth/src/session-cache.ts`
- Create: `packages/auth/src/index.ts`

- [ ] **Step 1: Create packages/auth/package.json**

```json
{
  "name": "@axle/auth",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/auth.config.ts",
    "./middleware": "./src/middleware.ts",
    "./dal": "./src/dal.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "next-auth": "5.0.0-beta.30",
    "@auth/prisma-adapter": "^2.10.0",
    "@axle/db": "workspace:*",
    "@upstash/redis": "^1.35.0",
    "bcryptjs": "^3.0.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/auth/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create Edge-compatible auth config**

Create `packages/auth/src/auth.config.ts`:

```typescript
import type { NextAuthConfig } from "next-auth";

/**
 * Edge Runtime compatible config.
 * No Prisma, no DB imports — only JWT validation.
 * Used by middleware.ts for fast (~50ms) auth checks.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnApp = nextUrl.pathname.startsWith("/(app)") ||
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/clients") ||
        nextUrl.pathname.startsWith("/projects");
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnApp) {
        return isLoggedIn;
      }
      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts (Node.js only)
};
```

- [ ] **Step 4: Create Node.js auth config with providers**

Create `packages/auth/src/auth.ts`:

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@axle/db";
import { authConfig } from "./auth.config";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.password) return null;

        const isValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
```

- [ ] **Step 5: Create middleware helper**

Create `packages/auth/src/middleware.ts`:

```typescript
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Edge middleware — uses auth.config.ts only (no Prisma/DB).
 * Import this in apps/web/middleware.ts
 */
export const { auth: authMiddleware } = NextAuth(authConfig);
```

- [ ] **Step 6: Create Data Access Layer**

Create `packages/auth/src/dal.ts`:

```typescript
import { cache } from "react";
import { auth } from "./auth";
import { prisma } from "@axle/db";

/**
 * Server-side auth verification with request-scoped caching.
 * Uses React cache() to deduplicate within a single request.
 */
export const getSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
});

export const getVerifiedUser = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, image: true, disabled: true },
  });

  if (!user || user.disabled) {
    throw new Error("User not found or disabled");
  }

  return user;
});

export const getVerifiedOrgMember = cache(
  async (orgId: string) => {
    const user = await getVerifiedUser();

    const member = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: { orgId, userId: user.id },
      },
      include: { org: true },
    });

    if (!member) {
      throw new Error("Not a member of this organization");
    }

    return { user, member, org: member.org };
  }
);
```

- [ ] **Step 7: Create session cache (3-tier)**

Create `packages/auth/src/session-cache.ts`:

```typescript
import { Redis } from "@upstash/redis";

// Tier 1: In-memory LRU cache
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const MEMORY_TTL_MS = 60_000; // 1 minute
const MAX_MEMORY_ENTRIES = 100;

// Tier 2: Upstash Redis
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export async function getCachedSession(
  userId: string
): Promise<unknown | null> {
  const key = `session:${userId}`;

  // Tier 1: Memory
  const memEntry = memoryCache.get(key);
  if (memEntry && memEntry.expiresAt > Date.now()) {
    return memEntry.data;
  }

  // Tier 2: Redis
  const r = getRedis();
  if (r) {
    const redisData = await r.get(key);
    if (redisData) {
      // Backfill memory
      setMemoryCache(key, redisData);
      return redisData;
    }
  }

  return null;
}

export async function setCachedSession(
  userId: string,
  data: unknown,
  redisTtlSeconds = 300
): Promise<void> {
  const key = `session:${userId}`;

  // Tier 1: Memory
  setMemoryCache(key, data);

  // Tier 2: Redis
  const r = getRedis();
  if (r) {
    await r.set(key, data, { ex: redisTtlSeconds });
  }
}

export async function invalidateSession(userId: string): Promise<void> {
  const key = `session:${userId}`;
  memoryCache.delete(key);

  const r = getRedis();
  if (r) {
    await r.del(key);
  }
}

function setMemoryCache(key: string, data: unknown): void {
  // Evict oldest if at capacity
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });
}
```

- [ ] **Step 8: Create public API exports**

Create `packages/auth/src/index.ts`:

```typescript
export { auth, handlers, signIn, signOut } from "./auth";
export { authConfig } from "./auth.config";
export { authMiddleware } from "./middleware";
export { getSession, getVerifiedUser, getVerifiedOrgMember } from "./dal";
export {
  getCachedSession,
  setCachedSession,
  invalidateSession,
} from "./session-cache";
```

- [ ] **Step 9: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 10: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/auth/
git commit -m "feat: add packages/auth with Auth.js v5 Split Config, DAL, and session cache"
```

---

## Task 5: packages/ui — shadcn/ui Foundation

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/globals.css`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/components/button.tsx`

- [ ] **Step 1: Create packages/ui/package.json**

```json
{
  "name": "@axle/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./globals.css": "./src/globals.css",
    "./button": "./src/components/button.tsx",
    "./input": "./src/components/input.tsx",
    "./card": "./src/components/card.tsx",
    "./label": "./src/components/label.tsx",
    "./badge": "./src/components/badge.tsx",
    "./table": "./src/components/table.tsx",
    "./utils": "./src/lib/utils.ts"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.2.0",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-label": "^2.1.0",
    "lucide-react": "^0.475.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create packages/ui/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create utils.ts (cn helper)**

Create `packages/ui/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Create globals.css with design tokens**

Create `packages/ui/src/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  --color-card: #ffffff;
  --color-card-foreground: #0a0a0a;
  --color-primary: #1d4ed8;
  --color-primary-foreground: #ffffff;
  --color-secondary: #f5f5f5;
  --color-secondary-foreground: #171717;
  --color-muted: #f5f5f5;
  --color-muted-foreground: #737373;
  --color-accent: #f5f5f5;
  --color-accent-foreground: #171717;
  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;
  --color-border: #e5e5e5;
  --color-input: #e5e5e5;
  --color-ring: #1d4ed8;
  --radius: 0.5rem;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  }
}
```

- [ ] **Step 5: Create Button component (shadcn/ui pattern)**

Create `packages/ui/src/components/button.tsx`:

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 6: Create Input component**

Create `packages/ui/src/components/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 7: Create Label component**

Create `packages/ui/src/components/label.tsx`:

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../lib/utils";

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

- [ ] **Step 8: Create Card component**

Create `packages/ui/src/components/card.tsx`:

```tsx
import * as React from "react";
import { cn } from "../lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
```

- [ ] **Step 9: Create Badge component**

Create `packages/ui/src/components/badge.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 10: Create index.ts exports**

Create `packages/ui/src/index.ts`:

```typescript
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { Input } from "./components/input";
export { Label } from "./components/label";
export { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./components/card";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
export { cn } from "./lib/utils";
```

- [ ] **Step 11: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 12: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ui/
git commit -m "feat: add packages/ui with shadcn/ui foundation (Button, Input, Label, Card, Badge)"
```

---

## Task 6: apps/web — Next.js 16 Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/middleware.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/app/(app)/dashboard/page.tsx`
- Create: `apps/web/src/components/app-sidebar.tsx`
- Create: `apps/web/src/components/user-menu.tsx`
- Create: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@axle/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.1.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@axle/db": "workspace:*",
    "@axle/auth": "workspace:*",
    "@axle/ui": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@axle/db", "@axle/auth", "@axle/ui"],
};

export default nextConfig;
```

- [ ] **Step 3: Create apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create Edge middleware**

Create `apps/web/middleware.ts`:

```typescript
import { authMiddleware } from "@axle/auth/middleware";

export default authMiddleware;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
```

- [ ] **Step 5: Create NextAuth API route**

Create `apps/web/src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@axle/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 6: Create root layout**

Create `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "@axle/ui/globals.css";

export const metadata: Metadata = {
  title: "AXLE — Consulting Automation",
  description: "Consulting business automation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create root page (redirect)**

Create `apps/web/src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@axle/auth";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  redirect("/login");
}
```

- [ ] **Step 8: Create auth layout**

Create `apps/web/src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      {children}
    </div>
  );
}
```

- [ ] **Step 9: Create login page**

Create `apps/web/src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@axle/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">AXLE</CardTitle>
        <CardDescription>컨설팅 자동화 플랫폼</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            로그인
          </Button>
        </form>
        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Google로 로그인
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 10: Create app layout with sidebar**

Create `apps/web/src/app/(app)/layout.tsx`:

```tsx
import { getVerifiedUser } from "@axle/auth/dal";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getVerifiedUser();

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b px-6">
          <UserMenu user={user} />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Create sidebar component**

Create `apps/web/src/components/app-sidebar.tsx`:

```tsx
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/clients", label: "고객사", icon: "🏢" },
  { href: "/projects", label: "프로젝트", icon: "📋" },
  { href: "/documents", label: "서류", icon: "📄" },
  { href: "/journal", label: "연구일지", icon: "📓" },
  { href: "/calendar", label: "일정", icon: "📅" },
  { href: "/finance", label: "재무", icon: "💰" },
  { href: "/analytics", label: "성과", icon: "📈" },
];

export function AppSidebar() {
  return (
    <aside className="flex w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/dashboard" className="text-xl font-bold">
          AXLE
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 12: Create user menu component**

Create `apps/web/src/components/user-menu.tsx`:

```tsx
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@axle/ui/button";

interface UserMenuProps {
  user: { id: string; email: string | null; name: string | null };
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {user.name ?? user.email}
      </span>
      <Button variant="ghost" size="sm" onClick={() => signOut()}>
        로그아웃
      </Button>
    </div>
  );
}
```

- [ ] **Step 13: Create dashboard page**

Create `apps/web/src/app/(app)/dashboard/page.tsx`:

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              진행 중 프로젝트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              이번 달 사업계획서
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              미제출 서류
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              다가오는 마감
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 14: Create tailwind config for web app**

Create `apps/web/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
```

- [ ] **Step 15: Install all dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 16: Verify dev server starts**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected: Next.js dev server starts at http://localhost:3000 without build errors. Login page renders.

- [ ] **Step 17: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/
git commit -m "feat: add apps/web with Next.js 16, auth pages, dashboard, and sidebar navigation"
```

---

## Task 7: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify Turborepo build**

```bash
cd /Volumes/포터블/AX/axle
npx turbo build
```

Expected: All packages and apps build without errors.

- [ ] **Step 2: Verify Prisma generate works across workspace**

```bash
cd /Volumes/포터블/AX/axle
npx turbo db:generate
```

Expected: Prisma client generated in packages/db.

- [ ] **Step 3: Run all tests**

```bash
cd /Volumes/포터블/AX/axle
npx turbo test
```

Expected: packages/db permissions tests pass (6/6).

- [ ] **Step 4: Verify package imports work**

Create a temporary test in apps/web:

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors. Imports from @axle/db, @axle/auth, @axle/ui all resolve.

- [ ] **Step 5: If DATABASE_URL is configured, verify db push**

```bash
cd /Volumes/포터블/AX/axle/packages/db
npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 6: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 0 complete — Turborepo + db + auth + ui + web foundation verified"
```

---

## Summary

Phase 0 delivers:
- **Turborepo monorepo** with workspace packages
- **packages/db**: Full 25-model Prisma schema + Driver Adapter singleton + ReBAC permissions (tested)
- **packages/auth**: Auth.js v5 Split Config (Edge + Node.js) + DAL + 3-tier session cache
- **packages/ui**: shadcn/ui foundation (Button, Input, Label, Card, Badge)
- **apps/web**: Next.js 16 with login, dashboard, sidebar, auth middleware

**Next:** Phase 1 (CRM Core) builds on this to add Client/Contact CRUD with business card OCR.

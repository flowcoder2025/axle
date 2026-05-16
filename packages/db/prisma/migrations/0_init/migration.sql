-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
-- pgvector for DocumentEmbedding.embedding (Unsupported("vector(1536)"))
-- HNSW cosine index for kNN search is applied out-of-band via
-- packages/db/sql/2026-04-21-pgvector-hnsw-indexes.sql (CONCURRENTLY can't run inside tx).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('BUSINESS_CARD', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('PATENT', 'AWARD', 'CONTRACT', 'INVESTMENT', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "ProgramCategory" AS ENUM ('STARTUP', 'VENTURE', 'RND', 'CERTIFICATION', 'EXPORT', 'SMART_FACTORY', 'GENERAL');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('BUSINESS_PLAN', 'VENTURE_CERT', 'SOBOOJANG_CERT', 'RESEARCH_INSTITUTE', 'PATENT', 'FINANCIAL_ANALYSIS', 'RESEARCH_TASK', 'BUNDLE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('INTAKE', 'DOC_COLLECTING', 'IN_PROGRESS', 'REVIEW', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('FIXED', 'SUCCESS_RATE', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('LEAD', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DocCategory" AS ENUM ('INPUT', 'OUTPUT', 'TEMPLATE', 'ISSUED');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('NONE', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('PENDING', 'REQUESTED', 'UPLOADED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ChecklistItemType" AS ENUM ('DOCUMENT', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('DEADLINE', 'MEETING', 'REMINDER', 'PROGRAM_DUE');

-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('BUSINESS_PLAN', 'RESEARCH', 'OCR', 'TRANSCRIBE', 'SUMMARY', 'JOURNAL_DRAFT', 'FINANCIAL_ANALYSIS', 'GAP_DIAGNOSIS', 'EVALUATION', 'MATCHING');

-- CreateEnum
CREATE TYPE "AiTier" AS ENUM ('LOCAL_MLX', 'API_HAIKU', 'API_OPUS', 'CLI_CLAUDE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutoType" AS ENUM ('HOMETAX_ISSUE', 'MINWON24_ISSUE', 'INSURANCE_ISSUE', 'PORTAL_UPLOAD', 'DART_FETCH', 'CRAWL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DOC_REQUESTED', 'DOC_UPLOADED', 'DOC_EXPIRING', 'DEADLINE', 'MEETING_NOTIFY', 'JOURNAL_DUE', 'ACTION_ITEM', 'ACTION_ITEM_DUE', 'PROJECT_ASSIGNED', 'MATCHING_RESULT', 'AI_JOB_COMPLETE', 'AI_JOB_FAILED', 'PORTAL_COMPLETE', 'HANDOFF', 'ESTIMATE_SENT', 'BUNDLE_COMPLETE', 'MENTION');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('DOC_REQUEST', 'DOC_PUSH', 'MEETING_SUMMARY', 'ESTIMATE', 'CONTRACT', 'JOURNAL_REMINDER', 'DEADLINE_ALERT', 'MATCHING_DIGEST', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FineTuneStatus" AS ENUM ('IDLE', 'CANDIDATE', 'QUEUED', 'FINE_TUNING', 'COMPLETED', 'PROMOTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PortalTokenScope" AS ENUM ('FULL', 'UPLOAD', 'JOURNAL');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('PAGE_VIEW', 'FEATURE_USE', 'API_CALL', 'SYSTEM', 'BUSINESS');

-- CreateEnum
CREATE TYPE "HwpxTemplateCategory" AS ENUM ('VENTURE', 'SOBOOJANG', 'KOITA', 'OTHER');

-- CreateEnum
CREATE TYPE "ScraperJobStatus" AS ENUM ('QUEUED', 'PICKED_UP', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CredentialsKind" AS ENUM ('CERTIFICATE', 'USERPW');

-- CreateEnum
CREATE TYPE "PortalKind" AS ENUM ('HOMETAX', 'MINWON24', 'INSURANCE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'CONTRACT', 'DAILY', 'PART_TIME');

-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('MONTHLY', 'HOURLY', 'DAILY');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'IP', 'GPS', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('NORMAL', 'LATE', 'EARLY_LEAVE', 'ABSENT');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'CONDOLENCE', 'MATERNITY', 'PATERNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManagedOrgStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('RECEIPT_INTAKE', 'ORDER', 'MANUAL', 'INITIAL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SALE', 'PURCHASE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISCARDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "quotaAiJobs" INTEGER NOT NULL DEFAULT 100,
    "quotaMembers" INTEGER NOT NULL DEFAULT 10,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationTuple" (
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationTuple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessNumber" TEXT,
    "ceoName" TEXT,
    "industry" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "memo" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedToId" TEXT,
    "employeeCount" INTEGER,
    "capitalAmount" DECIMAL(65,30),
    "foundedDate" TIMESTAMP(3),
    "region" TEXT,
    "isVenture" BOOLEAN NOT NULL DEFAULT false,
    "isInnoBiz" BOOLEAN NOT NULL DEFAULT false,
    "isMainBiz" BOOLEAN NOT NULL DEFAULT false,
    "isSocial" BOOLEAN NOT NULL DEFAULT false,
    "ventureValidUntil" TIMESTAMP(3),
    "businessStatus" TEXT,
    "businessVerifiedAt" TIMESTAMP(3),
    "corpCode" TEXT,
    "financialsSyncedAt" TIMESTAMP(3),
    "masterProfile" JSONB,
    "profileBlocks" JSONB,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "businessCardUrl" TEXT,
    "isResearcher" BOOLEAN NOT NULL DEFAULT false,
    "researchField" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFinancial" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "revenue" DECIMAL(65,30),
    "operatingProfit" DECIMAL(65,30),
    "netProfit" DECIMAL(65,30),
    "totalAssets" DECIMAL(65,30),
    "totalLiabilities" DECIMAL(65,30),
    "totalEquity" DECIMAL(65,30),
    "creditRating" TEXT,
    "source" TEXT,

    CONSTRAINT "ClientFinancial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAchievement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "amount" DECIMAL(65,30),
    "description" TEXT,
    "documentId" TEXT,

    CONSTRAINT "ClientAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "serialNumber" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "storagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramInfo" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "agency" TEXT,
    "category" "ProgramCategory" NOT NULL,
    "announcementUrl" TEXT,
    "announcementDocId" TEXT,
    "applicationStart" TIMESTAMP(3),
    "applicationEnd" TIMESTAMP(3),
    "maxFunding" DECIMAL(65,30),
    "requirements" JSONB,
    "eligibility" JSONB,
    "region" TEXT,
    "memo" TEXT,
    "isCrawled" BOOLEAN NOT NULL DEFAULT false,
    "crawledAt" TIMESTAMP(3),
    "source" TEXT,
    "externalId" TEXT,

    CONSTRAINT "ProgramInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchingResult" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,
    "matchReasons" JSONB,
    "disqualifyReasons" JSONB,
    "isRelevant" BOOLEAN,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "programId" TEXT,
    "parentId" TEXT,
    "type" "ProjectType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'INTAKE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "submissionDate" TIMESTAMP(3),
    "memo" TEXT,
    "metadata" JSONB,
    "feeType" "FeeType",
    "feeAmount" DECIMAL(65,30),
    "successRate" DECIMAL(65,30),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "projectType" "ProjectType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "itemType" "ChecklistItemType" NOT NULL DEFAULT 'DOCUMENT',
    "certificateType" TEXT,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "itemType" "ChecklistItemType" NOT NULL DEFAULT 'DOCUMENT',
    "status" "DocStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "certificateId" TEXT,
    "certificateType" TEXT,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "category" "DocCategory" NOT NULL,
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'NONE',
    "ocrResult" JSONB,
    "uploadToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentDocId" TEXT,
    "verifyResult" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentEmbedding" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "DocumentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchJournal" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "researcherContactId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "objectives" TEXT,
    "results" TEXT,
    "nextSteps" TEXT,
    "hours" DECIMAL(65,30),
    "attachments" JSONB,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "aiDraftJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "contactId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTranscript" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "rawTranscript" TEXT NOT NULL,
    "summary" TEXT,
    "keyDecisions" JSONB,
    "sentiment" TEXT,
    "aiJobId" TEXT,

    CONSTRAINT "MeetingTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "assigneeContactId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "linkedChecklistId" TEXT,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "AiJobType" NOT NULL,
    "tier" "AiTier" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "cost" DECIMAL(65,30),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "skillPatternId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPattern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB NOT NULL,
    "promptTemplate" TEXT,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "isFineTuned" BOOLEAN NOT NULL DEFAULT false,
    "status" "FineTuneStatus" NOT NULL DEFAULT 'IDLE',
    "errorMessage" TEXT,
    "sampleInput" JSONB,
    "sampleOutput" JSONB,
    "loraAdapterUrl" TEXT,
    "fineTuneStartedAt" TIMESTAMP(3),
    "fineTuneCompletedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "type" "AutoType" NOT NULL,
    "target" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "resultUrl" TEXT,
    "errorMessage" TEXT,
    "detail" JSONB,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "resendMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "programId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ScheduleType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "reminderDays" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "googleCalendarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientFinancialId" TEXT,
    "year" INTEGER NOT NULL,
    "analysis" JSONB,
    "adjustments" JSONB,
    "reportUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30),
    "validUntil" TIMESTAMP(3),
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "documentId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "partyA" JSONB NOT NULL,
    "partyB" JSONB NOT NULL,
    "terms" JSONB NOT NULL,
    "totalAmount" DECIMAL(65,30),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "documentId" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT NOT NULL,
    "scope" "PortalTokenScope" NOT NULL DEFAULT 'FULL',
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalJournal" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "sessionId" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT,
    "value" DOUBLE PRECISION,
    "path" TEXT,
    "referrer" TEXT,
    "metadata" JSONB,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "orgId" TEXT,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "avgSessionSec" INTEGER NOT NULL DEFAULT 0,
    "projectsCreated" INTEGER NOT NULL DEFAULT 0,
    "documentsProcessed" INTEGER NOT NULL DEFAULT 0,
    "matchingsRun" INTEGER NOT NULL DEFAULT 0,
    "aiJobsTotal" INTEGER NOT NULL DEFAULT 0,
    "aiJobsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiAvgDurationMs" INTEGER NOT NULL DEFAULT 0,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "apiErrors" INTEGER NOT NULL DEFAULT 0,
    "avgResponseMs" INTEGER NOT NULL DEFAULT 0,
    "automationRuns" INTEGER NOT NULL DEFAULT 0,
    "automationFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActionMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "orgId" TEXT,
    "action" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyActionMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HwpxTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "HwpxTemplateCategory" NOT NULL DEFAULT 'OTHER',
    "storageKey" TEXT NOT NULL,
    "fieldMap" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HwpxTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "AutoType" NOT NULL,
    "target" TEXT NOT NULL,
    "params" JSONB,
    "status" "ScraperJobStatus" NOT NULL DEFAULT 'QUEUED',
    "pickedUpAt" TIMESTAMP(3),
    "pickedUpBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "credentialsKind" "CredentialsKind" NOT NULL,
    "credentialsRef" TEXT NOT NULL,
    "automationLogId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScraperJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScraperApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCertificate" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "pfxCiphertext" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "portal" "PortalKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPortalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperRepairLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "portal" "PortalKind" NOT NULL,
    "page" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "oldSelector" TEXT NOT NULL,
    "newSelector" TEXT NOT NULL,
    "repairedBy" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScraperRepairLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "EmploymentType" NOT NULL,
    "salaryType" "SalaryType" NOT NULL,
    "baseSalary" DECIMAL(14,2) NOT NULL,
    "hourlyRate" DECIMAL(12,2),
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "method" "AttendanceMethod" NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'NORMAL',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantOrgId" TEXT,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "insuranceRatesYear" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approverId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NomuConsultation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "redactedQuestion" TEXT NOT NULL,
    "topicCategory" TEXT NOT NULL,
    "topicConfidence" DOUBLE PRECISION NOT NULL,
    "answer" TEXT NOT NULL,
    "citations" TEXT[],
    "validationValid" BOOLEAN,
    "validationReason" TEXT,
    "validationWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NomuConsultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgModuleInstall" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settings" JSONB,

    CONSTRAINT "OrgModuleInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedOrg" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bizRegNumber" TEXT,
    "status" "ManagedOrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "installedPacks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMultiOrgSubscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxManaged" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMultiOrgSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "category" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "source" "ReferenceType",
    "sourceId" TEXT,
    "unitCost" DECIMAL(65,30),
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "counterpartyId" TEXT,
    "counterpartyName" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "ReferenceType",
    "sourceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeDraft" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "blobUrl" TEXT NOT NULL,
    "ocrJson" JSONB NOT NULL,
    "parsedJson" JSONB NOT NULL,
    "matchSuggestions" JSONB NOT NULL,
    "status" "DraftStatus" NOT NULL,
    "confirmedOrderId" TEXT,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "OAuthToken_userId_idx" ON "OAuthToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_userId_provider_key" ON "OAuthToken"("userId", "provider");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "RelationTuple_subjectType_subjectId_idx" ON "RelationTuple"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "RelationTuple_namespace_objectId_relation_idx" ON "RelationTuple"("namespace", "objectId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "RelationTuple_namespace_objectId_relation_subjectType_subje_key" ON "RelationTuple"("namespace", "objectId", "relation", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "Client_orgId_idx" ON "Client"("orgId");

-- CreateIndex
CREATE INDEX "Client_assignedToId_idx" ON "Client"("assignedToId");

-- CreateIndex
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFinancial_clientId_year_key" ON "ClientFinancial"("clientId", "year");

-- CreateIndex
CREATE INDEX "ClientAchievement_clientId_idx" ON "ClientAchievement"("clientId");

-- CreateIndex
CREATE INDEX "Certificate_clientId_idx" ON "Certificate"("clientId");

-- CreateIndex
CREATE INDEX "ProgramInfo_orgId_idx" ON "ProgramInfo"("orgId");

-- CreateIndex
CREATE INDEX "ProgramInfo_source_idx" ON "ProgramInfo"("source");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramInfo_source_externalId_key" ON "ProgramInfo"("source", "externalId");

-- CreateIndex
CREATE INDEX "MatchingResult_clientId_idx" ON "MatchingResult"("clientId");

-- CreateIndex
CREATE INDEX "MatchingResult_programId_idx" ON "MatchingResult"("programId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_programId_idx" ON "Project"("programId");

-- CreateIndex
CREATE INDEX "Project_assignedToId_idx" ON "Project"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_orgId_projectType_idx" ON "ChecklistTemplate"("orgId", "projectType");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_projectType_idx" ON "ChecklistTemplate"("projectType");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistItem_projectId_idx" ON "ChecklistItem"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_uploadToken_key" ON "Document"("uploadToken");

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEmbedding_sourceType_sourceId_key" ON "DocumentEmbedding"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ResearchJournal_clientId_idx" ON "ResearchJournal"("clientId");

-- CreateIndex
CREATE INDEX "ResearchJournal_researcherContactId_idx" ON "ResearchJournal"("researcherContactId");

-- CreateIndex
CREATE INDEX "Meeting_clientId_idx" ON "Meeting"("clientId");

-- CreateIndex
CREATE INDEX "Meeting_projectId_idx" ON "Meeting"("projectId");

-- CreateIndex
CREATE INDEX "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingTranscript_meetingId_key" ON "MeetingTranscript"("meetingId");

-- CreateIndex
CREATE INDEX "ActionItem_meetingId_idx" ON "ActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "AiJob_orgId_idx" ON "AiJob"("orgId");

-- CreateIndex
CREATE INDEX "AiJob_projectId_idx" ON "AiJob"("projectId");

-- CreateIndex
CREATE INDEX "AiJob_type_idx" ON "AiJob"("type");

-- CreateIndex
CREATE INDEX "SkillPattern_status_idx" ON "SkillPattern"("status");

-- CreateIndex
CREATE INDEX "SkillPattern_taskType_status_idx" ON "SkillPattern"("taskType", "status");

-- CreateIndex
CREATE INDEX "AutomationLog_type_status_idx" ON "AutomationLog"("type", "status");

-- CreateIndex
CREATE INDEX "AutomationLog_executedAt_idx" ON "AutomationLog"("executedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "EmailLog_clientId_idx" ON "EmailLog"("clientId");

-- CreateIndex
CREATE INDEX "EmailLog_meetingId_idx" ON "EmailLog"("meetingId");

-- CreateIndex
CREATE INDEX "EmailLog_projectId_idx" ON "EmailLog"("projectId");

-- CreateIndex
CREATE INDEX "Schedule_orgId_idx" ON "Schedule"("orgId");

-- CreateIndex
CREATE INDEX "Schedule_clientId_idx" ON "Schedule"("clientId");

-- CreateIndex
CREATE INDEX "Schedule_programId_idx" ON "Schedule"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialReport_clientId_year_key" ON "FinancialReport"("clientId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");

-- CreateIndex
CREATE INDEX "Estimate_clientId_idx" ON "Estimate"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

-- CreateIndex
CREATE INDEX "ProjectComment_projectId_idx" ON "ProjectComment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectComment_authorId_idx" ON "ProjectComment"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalToken_token_key" ON "PortalToken"("token");

-- CreateIndex
CREATE INDEX "PortalToken_projectId_idx" ON "PortalToken"("projectId");

-- CreateIndex
CREATE INDEX "PortalToken_clientId_idx" ON "PortalToken"("clientId");

-- CreateIndex
CREATE INDEX "PortalJournal_tokenId_idx" ON "PortalJournal"("tokenId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_orgId_createdAt_idx" ON "AnalyticsEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_category_createdAt_idx" ON "AnalyticsEvent"("category", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_action_createdAt_idx" ON "AnalyticsEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyMetric_orgId_date_idx" ON "DailyMetric"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_date_orgId_key" ON "DailyMetric"("date", "orgId");

-- CreateIndex
CREATE INDEX "DailyActionMetric_orgId_date_idx" ON "DailyActionMetric"("orgId", "date");

-- CreateIndex
CREATE INDEX "DailyActionMetric_action_date_idx" ON "DailyActionMetric"("action", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActionMetric_date_orgId_action_key" ON "DailyActionMetric"("date", "orgId", "action");

-- CreateIndex
CREATE INDEX "HwpxTemplate_orgId_category_idx" ON "HwpxTemplate"("orgId", "category");

-- CreateIndex
CREATE INDEX "HwpxTemplate_createdById_idx" ON "HwpxTemplate"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ScraperJob_automationLogId_key" ON "ScraperJob"("automationLogId");

-- CreateIndex
CREATE INDEX "ScraperJob_orgId_status_idx" ON "ScraperJob"("orgId", "status");

-- CreateIndex
CREATE INDEX "ScraperJob_status_leaseExpiresAt_idx" ON "ScraperJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "ScraperJob_clientId_idx" ON "ScraperJob"("clientId");

-- CreateIndex
CREATE INDEX "ScraperJob_createdById_idx" ON "ScraperJob"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ScraperApiKey_tokenHash_key" ON "ScraperApiKey"("tokenHash");

-- CreateIndex
CREATE INDEX "ScraperApiKey_orgId_idx" ON "ScraperApiKey"("orgId");

-- CreateIndex
CREATE INDEX "ScraperApiKey_tokenHash_idx" ON "ScraperApiKey"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientCertificate_clientId_idx" ON "ClientCertificate"("clientId");

-- CreateIndex
CREATE INDEX "ClientCertificate_validTo_idx" ON "ClientCertificate"("validTo");

-- CreateIndex
CREATE INDEX "ClientPortalAccount_clientId_idx" ON "ClientPortalAccount"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccount_clientId_portal_key" ON "ClientPortalAccount"("clientId", "portal");

-- CreateIndex
CREATE INDEX "ScraperRepairLog_portal_createdAt_idx" ON "ScraperRepairLog"("portal", "createdAt");

-- CreateIndex
CREATE INDEX "ScraperRepairLog_jobId_idx" ON "ScraperRepairLog"("jobId");

-- CreateIndex
CREATE INDEX "Employment_organizationId_userId_idx" ON "Employment"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Employment_userId_idx" ON "Employment"("userId");

-- CreateIndex
CREATE INDEX "Attendance_userId_checkInAt_idx" ON "Attendance"("userId", "checkInAt");

-- CreateIndex
CREATE INDEX "Attendance_organizationId_checkInAt_idx" ON "Attendance"("organizationId", "checkInAt");

-- CreateIndex
CREATE INDEX "Payroll_organizationId_periodYear_periodMonth_idx" ON "Payroll"("organizationId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Payroll_tenantOrgId_idx" ON "Payroll"("tenantOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_userId_periodYear_periodMonth_key" ON "Payroll"("userId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "PayrollItem_payrollId_idx" ON "PayrollItem"("payrollId");

-- CreateIndex
CREATE INDEX "Leave_userId_startDate_idx" ON "Leave"("userId", "startDate");

-- CreateIndex
CREATE INDEX "Leave_organizationId_startDate_idx" ON "Leave"("organizationId", "startDate");

-- CreateIndex
CREATE INDEX "NomuConsultation_organizationId_createdAt_idx" ON "NomuConsultation"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkSchedule_organizationId_idx" ON "WorkSchedule"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_userId_dayOfWeek_key" ON "WorkSchedule"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "OrgModuleInstall_orgId_idx" ON "OrgModuleInstall"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgModuleInstall_orgId_moduleId_key" ON "OrgModuleInstall"("orgId", "moduleId");

-- CreateIndex
CREATE INDEX "ManagedOrg_ownerOrgId_idx" ON "ManagedOrg"("ownerOrgId");

-- CreateIndex
CREATE INDEX "ManagedOrg_ownerOrgId_status_idx" ON "ManagedOrg"("ownerOrgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMultiOrgSubscription_orgId_key" ON "OrgMultiOrgSubscription"("orgId");

-- CreateIndex
CREATE INDEX "Product_orgId_name_idx" ON "Product"("orgId", "name");

-- CreateIndex
CREATE INDEX "Product_orgId_archived_idx" ON "Product"("orgId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Product_orgId_sku_key" ON "Product"("orgId", "sku");

-- CreateIndex
CREATE INDEX "InventoryMovement_orgId_productId_occurredAt_idx" ON "InventoryMovement"("orgId", "productId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_orgId_occurredAt_idx" ON "InventoryMovement"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "Order_orgId_type_occurredAt_idx" ON "Order"("orgId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "IntakeDraft_orgId_status_createdAt_idx" ON "IntakeDraft"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeDraft_orgId_userId_status_idx" ON "IntakeDraft"("orgId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeDraft_confirmedOrderId_key" ON "IntakeDraft"("confirmedOrderId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFinancial" ADD CONSTRAINT "ClientFinancial_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAchievement" ADD CONSTRAINT "ClientAchievement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramInfo" ADD CONSTRAINT "ProgramInfo_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingResult" ADD CONSTRAINT "MatchingResult_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ProgramInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchJournal" ADD CONSTRAINT "ResearchJournal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchJournal" ADD CONSTRAINT "ResearchJournal_researcherContactId_fkey" FOREIGN KEY ("researcherContactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_skillPatternId_fkey" FOREIGN KEY ("skillPatternId") REFERENCES "SkillPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ProgramInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReport" ADD CONSTRAINT "FinancialReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReport" ADD CONSTRAINT "FinancialReport_clientFinancialId_fkey" FOREIGN KEY ("clientFinancialId") REFERENCES "ClientFinancial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalJournal" ADD CONSTRAINT "PortalJournal_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "PortalToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HwpxTemplate" ADD CONSTRAINT "HwpxTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HwpxTemplate" ADD CONSTRAINT "HwpxTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperJob" ADD CONSTRAINT "ScraperJob_automationLogId_fkey" FOREIGN KEY ("automationLogId") REFERENCES "AutomationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperJob" ADD CONSTRAINT "ScraperJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperJob" ADD CONSTRAINT "ScraperJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperApiKey" ADD CONSTRAINT "ScraperApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCertificate" ADD CONSTRAINT "ClientCertificate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccount" ADD CONSTRAINT "ClientPortalAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NomuConsultation" ADD CONSTRAINT "NomuConsultation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NomuConsultation" ADD CONSTRAINT "NomuConsultation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeDraft" ADD CONSTRAINT "IntakeDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


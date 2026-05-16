-- Phase 21 — ERP Amplification (WI-721)
-- ErpCounterparty + ChartOfAccounts + CounterpartyMergeLog + CounterpartyBackfillBatch
-- docs/specs/2026-05-17-phase21-erp-amplification-design.md §4

-- CreateEnum
CREATE TYPE "CounterpartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "CoaCategory" AS ENUM ('REVENUE', 'COGS', 'OPEX', 'NON_OPERATING', 'OTHER');

-- CreateEnum
CREATE TYPE "BackfillStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ErpCounterparty" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "bizRegNo" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "type" "CounterpartyType" NOT NULL,
    "defaultCoaCode" TEXT,
    "deletedAt" TIMESTAMP(3),
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpCounterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CoaCategory" NOT NULL,
    "parentCode" TEXT,
    "source" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounterpartyMergeLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "mergedFromId" TEXT NOT NULL,
    "mergedIntoId" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "performedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounterpartyMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounterpartyBackfillBatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "BackfillStatus" NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "processedOrders" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "pendingReview" INTEGER NOT NULL DEFAULT 0,
    "lastOrderId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "CounterpartyBackfillBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErpCounterparty_orgId_normalizedName_idx" ON "ErpCounterparty"("orgId", "normalizedName");

-- CreateIndex
CREATE INDEX "ErpCounterparty_orgId_type_idx" ON "ErpCounterparty"("orgId", "type");

-- CreateIndex
-- Partial unique: bizRegNo가 있는 row끼리만 unique (NULL은 중복 허용)
-- Prisma schema는 partial unique를 직접 표현 못해 raw SQL로 추가
CREATE UNIQUE INDEX "ErpCounterparty_orgId_bizRegNo_uniq" ON "ErpCounterparty"("orgId", "bizRegNo") WHERE "bizRegNo" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ChartOfAccounts_orgId_category_idx" ON "ChartOfAccounts"("orgId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccounts_orgId_code_key" ON "ChartOfAccounts"("orgId", "code");

-- CreateIndex
CREATE INDEX "CounterpartyMergeLog_orgId_performedAt_idx" ON "CounterpartyMergeLog"("orgId", "performedAt");

-- CreateIndex
CREATE INDEX "CounterpartyBackfillBatch_orgId_status_idx" ON "CounterpartyBackfillBatch"("orgId", "status");

-- AddForeignKey
ALTER TABLE "CounterpartyMergeLog" ADD CONSTRAINT "CounterpartyMergeLog_mergedFromId_fkey" FOREIGN KEY ("mergedFromId") REFERENCES "ErpCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterpartyMergeLog" ADD CONSTRAINT "CounterpartyMergeLog_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "ErpCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

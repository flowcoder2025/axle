-- Phase 21 — ERP Amplification (WI-731-feat)
-- Add REPORT_EXPORT enum value to AiJobType so the new
-- `/api/erp/reports/export` route can queue render jobs through the
-- existing AiJob infrastructure.
--
-- Postgres allows ALTER TYPE ... ADD VALUE inside the implicit Prisma
-- migration transaction as long as the new value isn't inserted in the
-- same transaction. This migration only adds the value; no AiJob row is
-- written with REPORT_EXPORT until the runtime route runs.

-- AlterEnum
ALTER TYPE "AiJobType" ADD VALUE 'REPORT_EXPORT';

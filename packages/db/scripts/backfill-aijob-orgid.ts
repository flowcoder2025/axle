/**
 * Backfill AiJob.orgId from project.client.orgId for existing rows.
 *
 * Safe to re-run: only updates rows where orgId IS NULL AND a project+client exists.
 * Rows with projectId=null stay as orgId=null (nothing to infer from).
 *
 * Usage:
 *   npx tsx packages/db/scripts/backfill-aijob-orgid.ts
 */
import { prisma } from "../src/index.js";

async function main() {
  console.log("[backfill-aijob-orgid] Starting backfill…");

  const result = await prisma.$executeRawUnsafe(`
    UPDATE "AiJob"
    SET "orgId" = c."orgId"
    FROM "Project" p
    JOIN "Client" c ON c."id" = p."clientId"
    WHERE "AiJob"."projectId" = p."id"
      AND "AiJob"."orgId" IS NULL
  `);

  console.log(`[backfill-aijob-orgid] Updated ${result} rows.`);

  const orphans = await prisma.aiJob.count({ where: { orgId: null } });
  console.log(`[backfill-aijob-orgid] Remaining orgId=NULL rows: ${orphans}`);
  console.log("[backfill-aijob-orgid] Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-aijob-orgid] Failed:", err);
    process.exit(1);
  });

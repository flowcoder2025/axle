/**
 * CLI wrapper around `runBackfillChunk` (Phase 21 WI-723b).
 *
 * Usage:
 *   pnpm exec tsx apps/web/scripts/backfill-counterparty.ts \
 *     --org-id <orgId> [--dry-run] [--chunk-size 1000] [--max-chunks 100]
 *
 * `--dry-run` runs the same matching logic but performs no UPDATE statements
 * and emits a JSON summary to stdout. Safe to run against production.
 *
 * Without `--dry-run` the script creates (or resumes) a `CounterpartyBackfillBatch`
 * for the org and loops `runBackfillChunk` until it reports `finished=true`,
 * or `--max-chunks` is reached. The checkpoint (`lastOrderId`) lets you stop
 * the script with Ctrl-C and resume by re-running with the same `--org-id`.
 */

import { prisma } from "@axle/db";
import {
  runBackfillChunk,
  startOrResumeBatch,
  type BackfillChunkResult,
} from "../lib/erp/backfill";

interface CliArgs {
  orgId: string;
  dryRun: boolean;
  chunkSize: number;
  maxChunks: number;
  notes: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    orgId: "",
    dryRun: false,
    chunkSize: 1000,
    maxChunks: 1000,
    notes: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--org-id") out.orgId = argv[++i] ?? "";
    else if (arg === "--chunk-size") out.chunkSize = Number(argv[++i] ?? "1000");
    else if (arg === "--max-chunks") out.maxChunks = Number(argv[++i] ?? "1000");
    else if (arg === "--notes") out.notes = argv[++i] ?? null;
    else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      console.error(`unknown arg: ${arg}`);
      printHelpAndExit(1);
    }
  }
  if (!out.orgId) {
    console.error("--org-id is required");
    printHelpAndExit(1);
  }
  if (!Number.isFinite(out.chunkSize) || out.chunkSize <= 0) {
    console.error("--chunk-size must be a positive integer");
    process.exit(1);
  }
  return out;
}

function printHelpAndExit(code = 0): never {
  console.log(
    `Usage: tsx apps/web/scripts/backfill-counterparty.ts --org-id <id> [--dry-run] [--chunk-size 1000] [--max-chunks 1000] [--notes "..."]`,
  );
  process.exit(code);
}

async function main() {
  const args = parseArgs(process.argv);

  const { batchId, resumed } = await startOrResumeBatch(prisma, {
    orgId: args.orgId,
    notes: args.notes,
  });

  const totals = { processed: 0, matched: 0, pendingReview: 0 };
  let finalResult: BackfillChunkResult | null = null;
  let chunkCount = 0;

  for (; chunkCount < args.maxChunks; chunkCount += 1) {
    const result = await runBackfillChunk(
      {
        orgId: args.orgId,
        batchId,
        chunkSize: args.chunkSize,
        dryRun: args.dryRun,
      },
      prisma,
    );
    finalResult = result;

    if (result.lockBusy) {
      console.error(
        JSON.stringify({
          ok: false,
          reason: "lock_busy",
          message: "another backfill is running for this org",
          batchId,
        }),
      );
      process.exit(2);
    }

    totals.processed += result.processed;
    totals.matched += result.matched;
    totals.pendingReview += result.pendingReview;

    if (result.finished) break;
    // For dry-run we have no real checkpoint persistence, so processing one
    // chunk only is a valid behavior — but for completeness we still loop.
    if (args.dryRun && result.processed === 0) break;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: args.dryRun,
        batchId,
        resumed,
        chunksRun: chunkCount + (finalResult ? 1 : 0),
        finished: finalResult?.finished ?? false,
        totals,
        lastOrderId: finalResult?.lastOrderId ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    process.exit(1);
  });

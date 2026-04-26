import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { authenticateScraper } from "@/lib/scraper-auth";
import { decryptCredential, decryptCredentialBytes } from "@/lib/scraper-crypto";
import { handleInternalError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const LEASE_SECONDS = 3600;

interface CertCredentials {
  method: "certificate";
  pfxBase64: string;
  certPassword: string;
}

interface UserPwCredentials {
  method: "userpw";
  userId: string;
  userPw: string;
}

type Credentials = CertCredentials | UserPwCredentials;

/**
 * GET /api/scraper/jobs/next
 *
 * Scraper polls. Atomically picks oldest QUEUED ScraperJob in the calling
 * org's scope, transitions to PICKED_UP with leaseExpiresAt, decrypts
 * credentials, returns full payload.
 *
 * - 200 { jobId, ..., credentials, leaseSeconds } — job dispensed
 * - 204 — no jobs available
 * - 401 — auth failure (handled by middleware)
 *
 * Concurrency: a transactional `findFirst` + `update` would race. Postgres
 * `SELECT ... FOR UPDATE SKIP LOCKED` is the safe pattern. Implemented via
 * a raw query inside an interactive transaction.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateScraper(req);
  if (!auth.ok) return auth.response;

  try {
    const job = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM "ScraperJob"
        WHERE "orgId" = ${auth.orgId}
          AND "status" = 'QUEUED'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);
      if (rows.length === 0) return null;
      const jobId = rows[0].id;

      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + LEASE_SECONDS * 1000);

      const updated = await tx.scraperJob.update({
        where: { id: jobId },
        data: {
          status: "PICKED_UP",
          pickedUpAt: now,
          pickedUpBy: auth.apiKeyId,
          leaseExpiresAt,
        },
      });

      return updated;
    });

    if (!job) {
      return new NextResponse(null, { status: 204 });
    }

    const credentials = await loadCredentials(job.credentialsKind, job.credentialsRef);
    if (!credentials) {
      // Job's credentials disappeared between enqueue and pickup. Mark FAILED.
      await prisma.scraperJob.update({
        where: { id: job.id },
        data: { status: "FAILED", completedAt: new Date() },
      });
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({
      jobId: job.id,
      orgId: job.orgId,
      clientId: job.clientId,
      type: job.type,
      target: job.target,
      params: job.params ?? {},
      credentials,
      leaseSeconds: LEASE_SECONDS,
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

async function loadCredentials(
  kind: "CERTIFICATE" | "USERPW",
  ref: string,
): Promise<Credentials | null> {
  if (kind === "CERTIFICATE") {
    const cert = await prisma.clientCertificate.findUnique({ where: { id: ref } });
    if (!cert) return null;
    const pfxBytes = decryptCredentialBytes(cert.pfxCiphertext);
    return {
      method: "certificate",
      pfxBase64: pfxBytes.toString("base64"),
      certPassword: decryptCredential(cert.passwordCiphertext),
    };
  }
  const account = await prisma.clientPortalAccount.findUnique({ where: { id: ref } });
  if (!account) return null;
  return {
    method: "userpw",
    userId: account.userId,
    userPw: decryptCredential(account.passwordCiphertext),
  };
}

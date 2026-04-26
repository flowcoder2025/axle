import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@axle/db";

/**
 * X-Scraper-Key authentication middleware.
 *
 * - Header: X-Scraper-Key: <opaque token>
 * - Server compares SHA-256(token) against ScraperApiKey.tokenHash
 * - Updates lastUsedAt + lastUsedIp on success
 * - Rejects revoked keys (revokedAt != null)
 *
 * See .flowset/contracts/scraper-api.md §2.
 */

export interface ScraperAuthSuccess {
  ok: true;
  orgId: string;
  apiKeyId: string;
}

export interface ScraperAuthFailure {
  ok: false;
  response: Response;
}

export type ScraperAuthResult = ScraperAuthSuccess | ScraperAuthFailure;

function unauthorized(message: string): Response {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message } },
    { status: 401 },
  );
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export function hashScraperToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function authenticateScraper(req: NextRequest): Promise<ScraperAuthResult> {
  const token = req.headers.get("x-scraper-key");
  if (!token) {
    return { ok: false, response: unauthorized("Missing X-Scraper-Key header") };
  }
  if (token.length < 32) {
    return { ok: false, response: unauthorized("Invalid X-Scraper-Key") };
  }

  const tokenHash = hashScraperToken(token);
  const apiKey = await prisma.scraperApiKey.findUnique({ where: { tokenHash } });

  if (!apiKey) {
    return { ok: false, response: unauthorized("Invalid X-Scraper-Key") };
  }
  if (apiKey.revokedAt) {
    return { ok: false, response: unauthorized("X-Scraper-Key revoked") };
  }

  // Fire-and-forget update of usage metadata. Errors are logged but not blocking.
  prisma.scraperApiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(), lastUsedIp: clientIp(req) },
    })
    .catch((err) => {
      console.error("scraper-auth: lastUsedAt update failed", err);
    });

  return { ok: true, orgId: apiKey.orgId, apiKeyId: apiKey.id };
}

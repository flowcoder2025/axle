/**
 * ClientFinancial Sync (WI-227)
 *
 * DART OpenAPI 에서 연도별 재무제표를 당겨와 ClientFinancial 테이블에 upsert.
 * - Client.corpCode 가 없으면 CORPCODE 카탈로그에서 이름 기반 매칭 후 Client 에 저장.
 * - 매 년도마다 fetchAnnualFinancials 호출 → (year, revenue, operatingProfit, netProfit,
 *   totalAssets, totalLiabilities, totalEquity) 로 upsert.
 * - AutomationLog 는 fetchAnnualFinancials 내부에서 DART_FETCH 타입으로 자동 기록.
 */

import { prisma } from "@axle/db";
import {
  fetchAnnualFinancials,
  fetchCompanyCodes,
  findCorpCodeByBusinessNumber,
  type DartFinancialData,
} from "./dart-financial";

export interface SyncYearResult {
  year: number;
  status: "OK" | "FAILED";
  error?: string;
  data?: Pick<
    DartFinancialData,
    | "revenue"
    | "operatingProfit"
    | "netProfit"
    | "totalAssets"
    | "totalLiabilities"
    | "totalEquity"
  >;
}

export interface SyncClientFinancialsResult {
  clientId: string;
  corpCode: string | null;
  resolvedCorpName: string | null;
  years: SyncYearResult[];
  syncedAt: Date;
}

export class CorpCodeResolutionError extends Error {
  constructor(public readonly clientId: string) {
    super(`No DART corp_code could be resolved for client ${clientId}`);
    this.name = "CorpCodeResolutionError";
  }
}

/**
 * Resolves and persists Client.corpCode if missing.
 * Returns the corp_code in use, or null if resolution failed.
 */
async function resolveCorpCode(client: {
  id: string;
  name: string;
  corpCode: string | null;
  businessNumber: string | null;
}): Promise<{ corpCode: string | null; resolvedName: string | null }> {
  if (client.corpCode) return { corpCode: client.corpCode, resolvedName: null };

  const list = await fetchCompanyCodes();
  const match = findCorpCodeByBusinessNumber(
    client.businessNumber ?? client.name,
    list,
    client.name
  );
  if (!match) return { corpCode: null, resolvedName: null };

  await prisma.client.update({
    where: { id: client.id },
    data: { corpCode: match.corpCode },
  });

  return { corpCode: match.corpCode, resolvedName: match.name };
}

/**
 * Sync DART annual financials for a client.
 *
 * @param clientId target client id (must belong to caller's org — caller enforces)
 * @param years    business years to fetch (e.g. [2022, 2023])
 */
export async function syncClientFinancials(
  clientId: string,
  years: number[]
): Promise<SyncClientFinancialsResult> {
  if (!Array.isArray(years) || years.length === 0) {
    throw new Error("years must be a non-empty array");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      corpCode: true,
      businessNumber: true,
    },
  });
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const resolved = await resolveCorpCode(client);
  if (!resolved.corpCode) {
    throw new CorpCodeResolutionError(client.id);
  }

  const corpCode = resolved.corpCode;
  const results: SyncYearResult[] = [];

  for (const year of years) {
    try {
      const data = await fetchAnnualFinancials(corpCode, year, client.id);

      await prisma.clientFinancial.upsert({
        where: { clientId_year: { clientId: client.id, year } },
        create: {
          clientId: client.id,
          year,
          revenue: data.revenue ?? null,
          operatingProfit: data.operatingProfit ?? null,
          netProfit: data.netProfit ?? null,
          totalAssets: data.totalAssets ?? null,
          totalLiabilities: data.totalLiabilities ?? null,
          totalEquity: data.totalEquity ?? null,
          source: data.source,
        },
        update: {
          revenue: data.revenue ?? null,
          operatingProfit: data.operatingProfit ?? null,
          netProfit: data.netProfit ?? null,
          totalAssets: data.totalAssets ?? null,
          totalLiabilities: data.totalLiabilities ?? null,
          totalEquity: data.totalEquity ?? null,
          source: data.source,
        },
      });

      results.push({
        year,
        status: "OK",
        data: {
          revenue: data.revenue,
          operatingProfit: data.operatingProfit,
          netProfit: data.netProfit,
          totalAssets: data.totalAssets,
          totalLiabilities: data.totalLiabilities,
          totalEquity: data.totalEquity,
        },
      });
    } catch (err) {
      results.push({
        year,
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const syncedAt = new Date();
  await prisma.client.update({
    where: { id: client.id },
    data: { financialsSyncedAt: syncedAt },
  });

  return {
    clientId: client.id,
    corpCode,
    resolvedCorpName: resolved.resolvedName,
    years: results,
    syncedAt,
  };
}

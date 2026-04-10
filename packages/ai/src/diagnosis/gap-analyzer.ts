import { prisma } from "@axle/db";

export interface GapAnalysisInput {
  clientId: string;
  programId: string;
}

export interface GapItem {
  category: string; // e.g., '서류', '자격', '재무', '기술'
  item: string; // specific missing item
  severity: "critical" | "major" | "minor";
  description: string;
  recommendation: string;
}

export interface GapResult {
  gaps: GapItem[];
  readiness: number; // 0-100 score
  summary: string;
}

// Category weights for readiness score calculation
const SEVERITY_PENALTY: Record<GapItem["severity"], number> = {
  critical: 20,
  major: 10,
  minor: 3,
};

/**
 * Fetch client data: documents, financials, certifications.
 */
async function fetchClientData(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      industry: true,
      isVenture: true,
      isInnoBiz: true,
      isMainBiz: true,
      isSocial: true,
      ventureValidUntil: true,
      employeeCount: true,
      capitalAmount: true,
      foundedDate: true,
      region: true,
      masterProfile: true,
      financials: {
        orderBy: { year: "desc" },
        take: 1,
        select: {
          year: true,
          revenue: true,
          operatingProfit: true,
          netProfit: true,
          totalAssets: true,
          totalLiabilities: true,
          totalEquity: true,
          creditRating: true,
        },
      },
      certificates: {
        where: { isActive: true },
        select: { type: true, validTo: true, isActive: true },
      },
      documents: {
        select: { category: true, name: true },
      },
    },
  });
}

/**
 * Fetch program requirements and eligibility criteria.
 */
async function fetchProgramInfo(programId: string) {
  return prisma.programInfo.findUnique({
    where: { id: programId },
    select: {
      id: true,
      name: true,
      agency: true,
      category: true,
      requirements: true,
      eligibility: true,
      maxFunding: true,
      region: true,
    },
  });
}

/**
 * Normalize a JSON value to a plain object or null.
 */
function toObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Check document gaps: required doc categories vs what the client has uploaded.
 */
function detectDocumentGaps(
  clientDocs: Array<{ category: string; name: string }>,
  requirements: Record<string, unknown> | null
): GapItem[] {
  const gaps: GapItem[] = [];

  const requiredDocs: string[] =
    Array.isArray(requirements?.["requiredDocuments"])
      ? (requirements["requiredDocuments"] as string[])
      : [];

  if (requiredDocs.length === 0) return gaps;

  const clientCategories = new Set(clientDocs.map((d) => d.category));

  for (const doc of requiredDocs) {
    if (!clientCategories.has(doc)) {
      gaps.push({
        category: "서류",
        item: doc,
        severity: "critical",
        description: `필수 서류 '${doc}'가 등록되어 있지 않습니다.`,
        recommendation: `'${doc}' 서류를 준비하여 업로드하세요.`,
      });
    }
  }

  return gaps;
}

/**
 * Check certification gaps: required cert types vs what the client holds.
 */
function detectCertificationGaps(
  certificates: Array<{ type: string; validTo: Date | null; isActive: boolean }>,
  eligibility: Record<string, unknown> | null,
  now: Date
): GapItem[] {
  const gaps: GapItem[] = [];

  const requiredCerts: string[] =
    Array.isArray(eligibility?.["requiredCertifications"])
      ? (eligibility["requiredCertifications"] as string[])
      : [];

  if (requiredCerts.length === 0) return gaps;

  const activeCertTypes = new Set(
    certificates
      .filter((c) => c.isActive && (c.validTo === null || c.validTo > now))
      .map((c) => c.type)
  );

  for (const certType of requiredCerts) {
    if (!activeCertTypes.has(certType)) {
      gaps.push({
        category: "자격",
        item: certType,
        severity: "critical",
        description: `필수 자격/인증 '${certType}'이 없거나 유효하지 않습니다.`,
        recommendation: `'${certType}' 인증을 취득하거나 갱신하세요.`,
      });
    }
  }

  return gaps;
}

/**
 * Check financial gaps: minimum revenue, positive profit, debt ratio, etc.
 */
function detectFinancialGaps(
  financial: {
    revenue: { toNumber(): number } | null;
    operatingProfit: { toNumber(): number } | null;
    netProfit: { toNumber(): number } | null;
    totalAssets: { toNumber(): number } | null;
    totalLiabilities: { toNumber(): number } | null;
  } | undefined,
  eligibility: Record<string, unknown> | null
): GapItem[] {
  const gaps: GapItem[] = [];

  if (!financial) {
    gaps.push({
      category: "재무",
      item: "재무 데이터 없음",
      severity: "major",
      description: "최근 연도 재무 데이터가 등록되어 있지 않습니다.",
      recommendation: "재무제표를 등록하세요.",
    });
    return gaps;
  }

  const minRevenue =
    typeof eligibility?.["minRevenue"] === "number"
      ? (eligibility["minRevenue"] as number)
      : null;

  const revenue = financial.revenue?.toNumber() ?? 0;
  if (minRevenue !== null && revenue < minRevenue) {
    gaps.push({
      category: "재무",
      item: "매출액 미달",
      severity: "major",
      description: `최소 매출 요건 ${minRevenue.toLocaleString()}원 미충족 (현재: ${revenue.toLocaleString()}원).`,
      recommendation: "매출 실적을 개선하거나 해당 요건이 없는 프로그램을 검토하세요.",
    });
  }

  const netProfit = financial.netProfit?.toNumber() ?? null;
  if (
    netProfit !== null &&
    netProfit < 0 &&
    eligibility?.["requireProfitable"] === true
  ) {
    gaps.push({
      category: "재무",
      item: "당기순손실",
      severity: "major",
      description: "당기순손실 상태입니다. 본 프로그램은 수익성 요건이 있습니다.",
      recommendation: "수익성 개선 계획을 수립하거나 손실 원인을 문서화하세요.",
    });
  }

  const totalAssets = financial.totalAssets?.toNumber() ?? 0;
  const totalLiabilities = financial.totalLiabilities?.toNumber() ?? 0;
  if (totalAssets > 0) {
    const debtRatio = totalLiabilities / totalAssets;
    const maxDebtRatio =
      typeof eligibility?.["maxDebtRatio"] === "number"
        ? (eligibility["maxDebtRatio"] as number)
        : null;
    if (maxDebtRatio !== null && debtRatio > maxDebtRatio) {
      gaps.push({
        category: "재무",
        item: "부채비율 초과",
        severity: "major",
        description: `부채비율 ${(debtRatio * 100).toFixed(1)}%가 허용 한도 ${(maxDebtRatio * 100).toFixed(1)}%를 초과합니다.`,
        recommendation: "부채를 상환하거나 자본을 확충하세요.",
      });
    }
  }

  return gaps;
}

/**
 * Check technical / profile gaps: venture status, employee count, etc.
 */
function detectTechnicalGaps(
  client: {
    isVenture: boolean;
    isInnoBiz: boolean;
    employeeCount: number | null;
    foundedDate: Date | null;
  },
  eligibility: Record<string, unknown> | null
): GapItem[] {
  const gaps: GapItem[] = [];

  if (eligibility?.["requireVenture"] === true && !client.isVenture) {
    gaps.push({
      category: "기술",
      item: "벤처기업 인증 필요",
      severity: "critical",
      description: "본 프로그램은 벤처기업 인증이 필수입니다.",
      recommendation: "벤처기업 인증을 취득하세요.",
    });
  }

  if (eligibility?.["requireInnoBiz"] === true && !client.isInnoBiz) {
    gaps.push({
      category: "기술",
      item: "이노비즈 인증 필요",
      severity: "major",
      description: "본 프로그램은 이노비즈 인증이 권장됩니다.",
      recommendation: "이노비즈 인증을 취득하세요.",
    });
  }

  const minEmployees =
    typeof eligibility?.["minEmployees"] === "number"
      ? (eligibility["minEmployees"] as number)
      : null;

  if (minEmployees !== null) {
    const count = client.employeeCount ?? 0;
    if (count < minEmployees) {
      gaps.push({
        category: "기술",
        item: "고용 인원 미달",
        severity: "minor",
        description: `최소 고용 인원 ${minEmployees}명 미충족 (현재: ${count}명).`,
        recommendation: "인력을 확보하거나 채용 계획을 수립하세요.",
      });
    }
  }

  return gaps;
}

/**
 * Calculate readiness score (0-100) from detected gaps.
 */
function calculateReadiness(gaps: GapItem[]): number {
  const totalPenalty = gaps.reduce(
    (sum, g) => sum + SEVERITY_PENALTY[g.severity],
    0
  );
  return Math.max(0, 100 - totalPenalty);
}

/**
 * Analyze gaps between a client and a program's requirements.
 *
 * Phase 5: rule-based comparison using structured DB fields.
 * Phase 14: AI-powered deep analysis via agent-bridge.
 */
export async function analyzeGaps(input: GapAnalysisInput): Promise<GapResult> {
  const [client, program] = await Promise.all([
    fetchClientData(input.clientId),
    fetchProgramInfo(input.programId),
  ]);

  if (!client) {
    return {
      gaps: [
        {
          category: "서류",
          item: "클라이언트 없음",
          severity: "critical",
          description: `clientId '${input.clientId}'에 해당하는 클라이언트가 없습니다.`,
          recommendation: "올바른 클라이언트를 선택하세요.",
        },
      ],
      readiness: 0,
      summary: "클라이언트 정보를 찾을 수 없습니다.",
    };
  }

  if (!program) {
    return {
      gaps: [
        {
          category: "서류",
          item: "프로그램 없음",
          severity: "critical",
          description: `programId '${input.programId}'에 해당하는 프로그램이 없습니다.`,
          recommendation: "올바른 프로그램을 선택하세요.",
        },
      ],
      readiness: 0,
      summary: "프로그램 정보를 찾을 수 없습니다.",
    };
  }

  const now = new Date();
  const requirements = toObject(program.requirements);
  const eligibility = toObject(program.eligibility);

  // TODO(Phase 14): integrate RAG-powered deep analysis via agent-bridge.
  // Semantic search will enrich gap analysis with learned program context.

  const gaps: GapItem[] = [
    ...detectDocumentGaps(client.documents, requirements),
    ...detectCertificationGaps(client.certificates, eligibility, now),
    ...detectFinancialGaps(client.financials[0], eligibility),
    ...detectTechnicalGaps(client, eligibility),
  ];

  const readiness = calculateReadiness(gaps);

  const criticalCount = gaps.filter((g) => g.severity === "critical").length;
  const majorCount = gaps.filter((g) => g.severity === "major").length;

  let summary: string;
  if (gaps.length === 0) {
    summary = `${client.name}은(는) '${program.name}' 신청 요건을 모두 충족합니다.`;
  } else {
    summary = `${client.name}의 '${program.name}' 준비도: ${readiness}점. ` +
      `중요 미충족 항목 ${criticalCount}건, 주요 미충족 항목 ${majorCount}건이 있습니다.`;
  }

  return { gaps, readiness, summary };
}

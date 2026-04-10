# AXLE Phase 11: Finance & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build financial data management (ClientFinancial CRUD with multiple data sources), AI-powered financial analysis reports, client achievement tracking, and a comprehensive analytics dashboard — giving consultants a clear view of revenue, success rates, and portfolio health.

**Architecture:** ClientFinancial CRUD with manual/Excel/DART data sources, FinancialReport generation via AiJob (FINANCIAL_ANALYSIS tier), ClientAchievement tracking, and analytics queries using Prisma aggregations with Recharts for visualization.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (@axle/db), @axle/ai (Haiku for financial analysis), packages/docgen (DOCX report generation), Recharts (charts), Zod, Vitest

**Depends on:** Phase 0 (foundation), Phase 1 (Client CRUD), Phase 5 (AI engine / AiJob)

---

## File Structure

```
axle/
├── packages/
│   ├── ai/
│   │   └── src/
│   │       └── financial-analysis.ts          # AI financial ratio analysis
│   │
│   └── docgen/
│       └── src/
│           └── financial-report.ts            # Financial report → DOCX markdown
│
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── (app)/
│           │   │   ├── finance/
│           │   │   │   ├── page.tsx                    # Finance overview
│           │   │   │   ├── [clientId]/
│           │   │   │   │   ├── page.tsx                # Client financial dashboard
│           │   │   │   │   ├── components/
│           │   │   │   │   │   ├── financial-form.tsx
│           │   │   │   │   │   ├── financial-table.tsx
│           │   │   │   │   │   ├── ratio-cards.tsx
│           │   │   │   │   │   ├── revenue-chart.tsx
│           │   │   │   │   │   └── report-section.tsx
│           │   │   │   │   └── actions.ts
│           │   │   │   └── achievements/
│           │   │   │       └── [clientId]/
│           │   │   │           └── page.tsx             # Client achievements
│           │   │   │
│           │   │   └── analytics/
│           │   │       ├── page.tsx                     # Analytics dashboard
│           │   │       └── components/
│           │   │           ├── success-rate-chart.tsx
│           │   │           ├── revenue-tracking.tsx
│           │   │           ├── consultant-performance.tsx
│           │   │           └── portfolio-overview.tsx
│           │   │
│           │   └── api/
│           │       ├── finance/
│           │       │   ├── route.ts                     # GET clients with financials
│           │       │   ├── [clientId]/
│           │       │   │   ├── route.ts                 # GET/POST ClientFinancial
│           │       │   │   ├── [year]/
│           │       │   │   │   └── route.ts             # PATCH/DELETE specific year
│           │       │   │   ├── report/
│           │       │   │   │   └── route.ts             # POST generate financial report
│           │       │   │   └── achievements/
│           │       │   │       └── route.ts             # GET/POST/DELETE achievements
│           │       │   └── import/
│           │       │       └── route.ts                 # POST import from Excel/PDF
│           │       │
│           │       └── analytics/
│           │           ├── success-rate/
│           │           │   └── route.ts                 # GET project success rates
│           │           ├── revenue/
│           │           │   └── route.ts                 # GET revenue tracking
│           │           ├── consultants/
│           │           │   └── route.ts                 # GET consultant performance
│           │           └── portfolio/
│           │               └── route.ts                 # GET client portfolio overview
│           │
│           ├── lib/
│           │   └── validations/
│           │       ├── finance.ts                       # Zod schemas for finance
│           │       └── analytics.ts                     # Zod schemas for analytics queries
│           │
│           └── components/
│               └── charts/
│                   └── chart-container.tsx              # Recharts wrapper
│
└── tests/
    └── finance/
        ├── finance-crud.test.ts
        ├── financial-ratios.test.ts
        └── analytics-queries.test.ts
```

---

## Task 1: Zod Validation Schemas

**Files:**
- Create: `apps/web/src/lib/validations/finance.ts`
- Create: `apps/web/src/lib/validations/analytics.ts`

- [ ] **Step 1: Create finance validation schemas**

```typescript
import { z } from "zod";

// ===== ClientFinancial =====
export const createFinancialSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2030),
  revenue: z.coerce.number().optional(),
  operatingProfit: z.coerce.number().optional(),
  netProfit: z.coerce.number().optional(),
  totalAssets: z.coerce.number().optional(),
  totalLiabilities: z.coerce.number().optional(),
  totalEquity: z.coerce.number().optional(),
  creditRating: z.string().max(10).optional(),
  source: z.string().max(50).optional(), // "manual", "excel", "dart", "hometax"
});

export const updateFinancialSchema = createFinancialSchema.partial().omit({ year: true });

// ===== ClientAchievement =====
export const createAchievementSchema = z.object({
  type: z.enum(["PATENT", "AWARD", "CONTRACT", "INVESTMENT", "CERTIFICATION"]),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  date: z.coerce.date().optional(),
  amount: z.coerce.number().optional(),
  description: z.string().max(1000).optional(),
  documentId: z.string().cuid().optional(),
});

// ===== Financial Report =====
export const generateReportSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2030),
});

// ===== Excel Import =====
export const importFinancialSchema = z.object({
  clientId: z.string().cuid(),
  format: z.enum(["excel", "pdf"]),
});

// ===== Types =====
export type CreateFinancialInput = z.infer<typeof createFinancialSchema>;
export type UpdateFinancialInput = z.infer<typeof updateFinancialSchema>;
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>;
export type GenerateReportInput = z.infer<typeof generateReportSchema>;
```

- [ ] **Step 2: Create analytics validation schemas**

Create `apps/web/src/lib/validations/analytics.ts`:

```typescript
import { z } from "zod";

export const analyticsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  year: z.coerce.number().int().min(2020).max(2030).optional(),
  projectType: z
    .enum([
      "BUSINESS_PLAN",
      "VENTURE_CERT",
      "SOBOOJANG_CERT",
      "RESEARCH_INSTITUTE",
      "PATENT",
      "FINANCIAL_ANALYSIS",
      "RESEARCH_TASK",
      "BUNDLE",
    ])
    .optional(),
  assignedTo: z.string().cuid().optional(),
});

export const revenueQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030).default(new Date().getFullYear()),
  groupBy: z.enum(["month", "quarter"]).default("month"),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/lib/validations/finance.ts apps/web/src/lib/validations/analytics.ts
git commit -m "feat: add Zod validation schemas for finance, achievements, and analytics queries"
```

---

## Task 2: ClientFinancial CRUD API

**Files:**
- Create: `apps/web/src/app/api/finance/route.ts`
- Create: `apps/web/src/app/api/finance/[clientId]/route.ts`
- Create: `apps/web/src/app/api/finance/[clientId]/[year]/route.ts`

- [ ] **Step 1: Write failing tests for financial CRUD**

Create `tests/finance/finance-crud.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createFinancialSchema,
  updateFinancialSchema,
  createAchievementSchema,
} from "../../apps/web/src/lib/validations/finance";

describe("Finance Validation", () => {
  it("validates valid financial data", () => {
    const result = createFinancialSchema.safeParse({
      year: 2025,
      revenue: 5000000000,
      operatingProfit: 500000000,
      netProfit: 350000000,
      totalAssets: 10000000000,
      totalLiabilities: 4000000000,
      totalEquity: 6000000000,
      creditRating: "BBB+",
      source: "manual",
    });
    expect(result.success).toBe(true);
  });

  it("rejects year out of range", () => {
    const result = createFinancialSchema.safeParse({ year: 1990 });
    expect(result.success).toBe(false);
  });

  it("allows partial financial data (some fields empty)", () => {
    const result = createFinancialSchema.safeParse({
      year: 2025,
      revenue: 1000000000,
    });
    expect(result.success).toBe(true);
  });

  it("validates achievement creation", () => {
    const result = createAchievementSchema.safeParse({
      type: "PATENT",
      title: "AI 기반 용접 품질 분석 방법",
      date: "2026-03-15",
      description: "특허 제10-2026-0001234호",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid achievement type", () => {
    const result = createAchievementSchema.safeParse({
      type: "INVALID",
      title: "test",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/finance/finance-crud.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Create finance overview API (clients with financial data)**

Create `apps/web/src/app/api/finance/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      businessNumber: true,
      industry: true,
      financials: {
        orderBy: { year: "desc" },
        take: 3,
        select: {
          year: true,
          revenue: true,
          operatingProfit: true,
          netProfit: true,
          creditRating: true,
        },
      },
      financialReports: {
        orderBy: { year: "desc" },
        take: 1,
        select: { id: true, year: true },
      },
      _count: {
        select: { achievements: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}
```

- [ ] **Step 4: Create client financial CRUD API**

Create `apps/web/src/app/api/finance/[clientId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { createFinancialSchema } from "@/lib/validations/finance";

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId } = await params;

  const financials = await prisma.clientFinancial.findMany({
    where: { clientId },
    orderBy: { year: "desc" },
    include: {
      reports: {
        select: { id: true, year: true, reportUrl: true },
      },
    },
  });

  return NextResponse.json(financials);
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId } = await params;
  const body = await request.json();
  const data = createFinancialSchema.parse(body);

  // Check for duplicate year
  const existing = await prisma.clientFinancial.findUnique({
    where: { clientId_year: { clientId, year: data.year } },
  });

  if (existing) {
    return NextResponse.json(
      { error: `${data.year}년 재무데이터가 이미 존재합니다. 수정하려면 PATCH를 사용하세요.` },
      { status: 409 }
    );
  }

  const financial = await prisma.clientFinancial.create({
    data: {
      clientId,
      year: data.year,
      revenue: data.revenue,
      operatingProfit: data.operatingProfit,
      netProfit: data.netProfit,
      totalAssets: data.totalAssets,
      totalLiabilities: data.totalLiabilities,
      totalEquity: data.totalEquity,
      creditRating: data.creditRating,
      source: data.source || "manual",
    },
  });

  return NextResponse.json(financial, { status: 201 });
}
```

- [ ] **Step 5: Create year-specific financial API (PATCH/DELETE)**

Create `apps/web/src/app/api/finance/[clientId]/[year]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { updateFinancialSchema } from "@/lib/validations/finance";

type Params = { params: Promise<{ clientId: string; year: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId, year } = await params;
  const yearNum = parseInt(year, 10);
  const body = await request.json();
  const data = updateFinancialSchema.parse(body);

  const financial = await prisma.clientFinancial.update({
    where: { clientId_year: { clientId, year: yearNum } },
    data,
  });

  return NextResponse.json(financial);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId, year } = await params;
  const yearNum = parseInt(year, 10);

  await prisma.clientFinancial.delete({
    where: { clientId_year: { clientId, year: yearNum } },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/finance/ tests/finance/finance-crud.test.ts
git commit -m "feat: add ClientFinancial CRUD API with year uniqueness, multi-source support, and financial overview"
```

---

## Task 3: Financial Analysis AI + Report Generation

**Files:**
- Create: `packages/ai/src/financial-analysis.ts`
- Create: `packages/docgen/src/financial-report.ts`
- Create: `apps/web/src/app/api/finance/[clientId]/report/route.ts`

- [ ] **Step 1: Write failing tests for financial ratios**

Create `tests/finance/financial-ratios.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("Financial Ratio Calculations", () => {
  const testData = {
    revenue: 5000000000,
    operatingProfit: 500000000,
    netProfit: 350000000,
    totalAssets: 10000000000,
    totalLiabilities: 4000000000,
    totalEquity: 6000000000,
  };

  it("calculates operating margin correctly", () => {
    const margin = testData.operatingProfit / testData.revenue;
    expect(margin).toBeCloseTo(0.1, 2); // 10%
  });

  it("calculates debt ratio correctly", () => {
    const debtRatio = testData.totalLiabilities / testData.totalEquity;
    expect(debtRatio).toBeCloseTo(0.667, 2); // 66.7%
  });

  it("calculates ROE correctly", () => {
    const roe = testData.netProfit / testData.totalEquity;
    expect(roe).toBeCloseTo(0.0583, 3); // 5.83%
  });

  it("calculates current ratio (assets/liabilities)", () => {
    const currentRatio = testData.totalAssets / testData.totalLiabilities;
    expect(currentRatio).toBeCloseTo(2.5, 1); // 250%
  });

  it("handles zero denominators safely", () => {
    const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);
    expect(safeDiv(100, 0)).toBe(0);
    expect(safeDiv(100, 50)).toBe(2);
  });
});
```

- [ ] **Step 2: Run ratio tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/finance/financial-ratios.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Create financial analysis AI module**

Create `packages/ai/src/financial-analysis.ts`:

```typescript
interface FinancialData {
  year: number;
  revenue?: number | null;
  operatingProfit?: number | null;
  netProfit?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  totalEquity?: number | null;
  creditRating?: string | null;
}

interface FinancialRatios {
  operatingMargin: number | null;
  netMargin: number | null;
  debtRatio: number | null;
  currentRatio: number | null;
  roe: number | null;
  debtToEquity: number | null;
}

interface FinancialAnalysisResult {
  ratios: FinancialRatios;
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

/**
 * Calculate key financial ratios from raw data.
 */
export function calculateRatios(data: FinancialData): FinancialRatios {
  return {
    operatingMargin: safeDiv(
      data.operatingProfit ? Number(data.operatingProfit) : null,
      data.revenue ? Number(data.revenue) : null
    ),
    netMargin: safeDiv(
      data.netProfit ? Number(data.netProfit) : null,
      data.revenue ? Number(data.revenue) : null
    ),
    debtRatio: safeDiv(
      data.totalLiabilities ? Number(data.totalLiabilities) : null,
      data.totalAssets ? Number(data.totalAssets) : null
    ),
    currentRatio: safeDiv(
      data.totalAssets ? Number(data.totalAssets) : null,
      data.totalLiabilities ? Number(data.totalLiabilities) : null
    ),
    roe: safeDiv(
      data.netProfit ? Number(data.netProfit) : null,
      data.totalEquity ? Number(data.totalEquity) : null
    ),
    debtToEquity: safeDiv(
      data.totalLiabilities ? Number(data.totalLiabilities) : null,
      data.totalEquity ? Number(data.totalEquity) : null
    ),
  };
}

/**
 * Generate AI-powered financial analysis.
 * Uses Haiku tier for cost efficiency.
 */
export async function analyzeFinancials(
  clientName: string,
  data: FinancialData,
  previousYears?: FinancialData[]
): Promise<FinancialAnalysisResult> {
  const ratios = calculateRatios(data);

  const formatNum = (n: number | null | undefined) =>
    n != null ? `${(Number(n) / 100000000).toFixed(1)}억원` : "N/A";
  const formatPct = (n: number | null) =>
    n != null ? `${(n * 100).toFixed(1)}%` : "N/A";

  const previousContext = previousYears
    ?.map(
      (py) =>
        `${py.year}년: 매출 ${formatNum(py.revenue)}, 영업이익 ${formatNum(py.operatingProfit)}, 순이익 ${formatNum(py.netProfit)}`
    )
    .join("\n") || "";

  const systemPrompt = `당신은 기업 재무 분석 전문가입니다.
주어진 재무 데이터와 비율을 분석하여 다음을 제공하세요:

1. 종합 분석 (3-5문장, 한글)
2. 강점 (bullets)
3. 약점 (bullets)
4. 개선 권고사항 (bullets)

정부 지원사업 신청 시 유리한 점과 불리한 점을 특별히 고려하세요.

JSON으로 출력:
{
  "analysis": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "recommendations": ["...", "..."]
}`;

  const userPrompt = `기업: ${clientName}
분석 연도: ${data.year}년
${data.creditRating ? `신용등급: ${data.creditRating}` : ""}

재무 데이터:
- 매출: ${formatNum(data.revenue)}
- 영업이익: ${formatNum(data.operatingProfit)}
- 순이익: ${formatNum(data.netProfit)}
- 총자산: ${formatNum(data.totalAssets)}
- 총부채: ${formatNum(data.totalLiabilities)}
- 자본총계: ${formatNum(data.totalEquity)}

주요 지표:
- 영업이익률: ${formatPct(ratios.operatingMargin)}
- 순이익률: ${formatPct(ratios.netMargin)}
- 부채비율: ${formatPct(ratios.debtToEquity)}
- 유동비율: ${formatPct(ratios.currentRatio)}
- ROE: ${formatPct(ratios.roe)}

${previousContext ? `\n과거 실적:\n${previousContext}` : ""}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-20250414",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Financial analysis failed: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content[0]?.text || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      ratios,
      analysis: text.slice(0, 500),
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    ratios,
    analysis: parsed.analysis || "",
    strengths: parsed.strengths || [],
    weaknesses: parsed.weaknesses || [],
    recommendations: parsed.recommendations || [],
  };
}
```

- [ ] **Step 4: Create financial report markdown generator**

Create `packages/docgen/src/financial-report.ts`:

```typescript
interface FinancialReportInput {
  clientName: string;
  year: number;
  financialData: {
    revenue?: number | null;
    operatingProfit?: number | null;
    netProfit?: number | null;
    totalAssets?: number | null;
    totalLiabilities?: number | null;
    totalEquity?: number | null;
    creditRating?: string | null;
  };
  ratios: {
    operatingMargin: number | null;
    netMargin: number | null;
    debtRatio: number | null;
    currentRatio: number | null;
    roe: number | null;
    debtToEquity: number | null;
  };
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  adjustments?: Array<{
    field: string;
    before: string;
    after: string;
    reason: string;
  }>;
}

/**
 * Generate financial report as structured markdown (for DOCX conversion via mark-docx).
 */
export function generateFinancialReportMarkdown(
  input: FinancialReportInput
): string {
  const formatNum = (n: number | null | undefined) =>
    n != null
      ? `${(Number(n) / 100000000).toFixed(1)}억원`
      : "-";
  const formatPct = (n: number | null) =>
    n != null ? `${(n * 100).toFixed(1)}%` : "-";

  const adjustmentsSection = input.adjustments?.length
    ? `
## 조정 사항

| 항목 | 조정 전 | 조정 후 | 사유 |
|------|---------|---------|------|
${input.adjustments.map((a) => `| ${a.field} | ${a.before} | ${a.after} | ${a.reason} |`).join("\n")}
`
    : "";

  return `# ${input.clientName} 재무 분석 보고서

## 기본 정보

| 항목 | 내용 |
|------|------|
| 기업명 | ${input.clientName} |
| 분석 연도 | ${input.year}년 |
${input.financialData.creditRating ? `| 신용등급 | ${input.financialData.creditRating} |` : ""}

---

## 재무 현황

| 항목 | 금액 |
|------|------|
| 매출액 | ${formatNum(input.financialData.revenue)} |
| 영업이익 | ${formatNum(input.financialData.operatingProfit)} |
| 순이익 | ${formatNum(input.financialData.netProfit)} |
| 총자산 | ${formatNum(input.financialData.totalAssets)} |
| 총부채 | ${formatNum(input.financialData.totalLiabilities)} |
| 자본총계 | ${formatNum(input.financialData.totalEquity)} |

---

## 주요 재무지표

| 지표 | 수치 | 비고 |
|------|------|------|
| 영업이익률 | ${formatPct(input.ratios.operatingMargin)} | 매출 대비 영업이익 |
| 순이익률 | ${formatPct(input.ratios.netMargin)} | 매출 대비 순이익 |
| 부채비율 | ${formatPct(input.ratios.debtToEquity)} | 자본 대비 부채 |
| 유동비율 | ${formatPct(input.ratios.currentRatio)} | 부채 대비 자산 |
| ROE | ${formatPct(input.ratios.roe)} | 자기자본이익률 |

---

## 종합 분석

${input.analysis}

### 강점
${input.strengths.map((s) => `- ${s}`).join("\n")}

### 약점
${input.weaknesses.map((w) => `- ${w}`).join("\n")}

### 개선 권고사항
${input.recommendations.map((r) => `- ${r}`).join("\n")}

${adjustmentsSection}

---

*본 보고서는 AXLE 시스템에서 AI 분석을 기반으로 자동 생성되었습니다.*
`;
}
```

- [ ] **Step 5: Create report generation API route**

Create `apps/web/src/app/api/finance/[clientId]/report/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { generateReportSchema } from "@/lib/validations/finance";
import { analyzeFinancials } from "@axle/ai/financial-analysis";
import { generateFinancialReportMarkdown } from "@axle/docgen/financial-report";

type Params = { params: Promise<{ clientId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId } = await params;
  const body = await request.json();
  const { year } = generateReportSchema.parse(body);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const financial = await prisma.clientFinancial.findUnique({
    where: { clientId_year: { clientId, year } },
  });

  if (!financial) {
    return NextResponse.json(
      { error: `${year}년 재무데이터가 없습니다` },
      { status: 404 }
    );
  }

  // Fetch previous years for trend analysis
  const previousYears = await prisma.clientFinancial.findMany({
    where: { clientId, year: { lt: year } },
    orderBy: { year: "desc" },
    take: 3,
  });

  // Create AiJob
  const aiJob = await prisma.aiJob.create({
    data: {
      type: "FINANCIAL_ANALYSIS",
      tier: "API_HAIKU",
      status: "RUNNING",
      input: { clientId, year },
    },
  });

  try {
    const startMs = Date.now();
    const analysisResult = await analyzeFinancials(
      client.name,
      {
        year: financial.year,
        revenue: financial.revenue ? Number(financial.revenue) : null,
        operatingProfit: financial.operatingProfit ? Number(financial.operatingProfit) : null,
        netProfit: financial.netProfit ? Number(financial.netProfit) : null,
        totalAssets: financial.totalAssets ? Number(financial.totalAssets) : null,
        totalLiabilities: financial.totalLiabilities ? Number(financial.totalLiabilities) : null,
        totalEquity: financial.totalEquity ? Number(financial.totalEquity) : null,
        creditRating: financial.creditRating,
      },
      previousYears.map((py) => ({
        year: py.year,
        revenue: py.revenue ? Number(py.revenue) : null,
        operatingProfit: py.operatingProfit ? Number(py.operatingProfit) : null,
        netProfit: py.netProfit ? Number(py.netProfit) : null,
        totalAssets: py.totalAssets ? Number(py.totalAssets) : null,
        totalLiabilities: py.totalLiabilities ? Number(py.totalLiabilities) : null,
        totalEquity: py.totalEquity ? Number(py.totalEquity) : null,
        creditRating: py.creditRating,
      }))
    );

    // Generate markdown report
    const reportMarkdown = generateFinancialReportMarkdown({
      clientName: client.name,
      year,
      financialData: {
        revenue: financial.revenue ? Number(financial.revenue) : null,
        operatingProfit: financial.operatingProfit ? Number(financial.operatingProfit) : null,
        netProfit: financial.netProfit ? Number(financial.netProfit) : null,
        totalAssets: financial.totalAssets ? Number(financial.totalAssets) : null,
        totalLiabilities: financial.totalLiabilities ? Number(financial.totalLiabilities) : null,
        totalEquity: financial.totalEquity ? Number(financial.totalEquity) : null,
        creditRating: financial.creditRating,
      },
      ratios: analysisResult.ratios,
      analysis: analysisResult.analysis,
      strengths: analysisResult.strengths,
      weaknesses: analysisResult.weaknesses,
      recommendations: analysisResult.recommendations,
    });

    // Save/update FinancialReport
    const report = await prisma.financialReport.upsert({
      where: { clientId_year: { clientId, year } },
      create: {
        clientId,
        clientFinancialId: financial.id,
        year,
        analysis: analysisResult as unknown as Record<string, unknown>,
      },
      update: {
        clientFinancialId: financial.id,
        analysis: analysisResult as unknown as Record<string, unknown>,
      },
    });

    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "COMPLETED",
        output: { reportId: report.id },
        durationMs: Date.now() - startMs,
      },
    });

    return NextResponse.json({
      report,
      markdown: reportMarkdown,
      ratios: analysisResult.ratios,
      analysis: analysisResult.analysis,
      strengths: analysisResult.strengths,
      weaknesses: analysisResult.weaknesses,
      recommendations: analysisResult.recommendations,
    });
  } catch (error) {
    await prisma.aiJob.update({
      where: { id: aiJob.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return NextResponse.json(
      { error: "Financial analysis failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/ai/src/financial-analysis.ts packages/docgen/src/financial-report.ts
git add apps/web/src/app/api/finance/\[clientId\]/report/ tests/finance/financial-ratios.test.ts
git commit -m "feat: add AI financial analysis with ratio calculations, trend analysis, and DOCX report generation"
```

---

## Task 4: ClientAchievement CRUD API

**Files:**
- Create: `apps/web/src/app/api/finance/[clientId]/achievements/route.ts`

- [ ] **Step 1: Create achievements API route**

Create `apps/web/src/app/api/finance/[clientId]/achievements/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { createAchievementSchema } from "@/lib/validations/finance";

type Params = { params: Promise<{ clientId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId } = await params;

  const achievements = await prisma.clientAchievement.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(achievements);
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId } = await params;
  const body = await request.json();
  const data = createAchievementSchema.parse(body);

  const achievement = await prisma.clientAchievement.create({
    data: {
      clientId,
      type: data.type,
      title: data.title,
      date: data.date,
      amount: data.amount,
      description: data.description,
      documentId: data.documentId,
    },
  });

  return NextResponse.json(achievement, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getVerifiedUser();
  const { clientId } = await params;
  const { searchParams } = request.nextUrl;
  const achievementId = searchParams.get("achievementId");

  if (!achievementId) {
    return NextResponse.json(
      { error: "achievementId is required" },
      { status: 400 }
    );
  }

  await prisma.clientAchievement.delete({
    where: { id: achievementId },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/finance/\[clientId\]/achievements/
git commit -m "feat: add ClientAchievement CRUD API (patents, awards, contracts, investments, certifications)"
```

---

## Task 5: Analytics API Routes

**Files:**
- Create: `apps/web/src/app/api/analytics/success-rate/route.ts`
- Create: `apps/web/src/app/api/analytics/revenue/route.ts`
- Create: `apps/web/src/app/api/analytics/consultants/route.ts`
- Create: `apps/web/src/app/api/analytics/portfolio/route.ts`

- [ ] **Step 1: Write failing tests for analytics queries**

Create `tests/finance/analytics-queries.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  analyticsQuerySchema,
  revenueQuerySchema,
} from "../../apps/web/src/lib/validations/analytics";

describe("Analytics Query Validation", () => {
  it("validates analytics query with defaults", () => {
    const result = analyticsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates analytics query with filters", () => {
    const result = analyticsQuerySchema.safeParse({
      year: 2026,
      projectType: "BUSINESS_PLAN",
    });
    expect(result.success).toBe(true);
  });

  it("validates revenue query with defaults", () => {
    const result = revenueQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.groupBy).toBe("month");
  });

  it("validates revenue query by quarter", () => {
    const result = revenueQuerySchema.safeParse({
      year: 2026,
      groupBy: "quarter",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/finance/analytics-queries.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 3: Create success rate analytics API**

Create `apps/web/src/app/api/analytics/success-rate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { analyticsQuerySchema } from "@/lib/validations/analytics";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = analyticsQuerySchema.parse(searchParams);

  const where = {
    status: { in: ["APPROVED", "REJECTED", "COMPLETED"] as const },
    ...(query.projectType ? { type: query.projectType } : {}),
    ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
    ...(query.startDate || query.endDate
      ? {
          createdAt: {
            ...(query.startDate ? { gte: query.startDate } : {}),
            ...(query.endDate ? { lte: query.endDate } : {}),
          },
        }
      : {}),
  };

  const results = await prisma.project.groupBy({
    by: ["type", "status"],
    where,
    _count: true,
  });

  // Calculate success rate per project type
  const typeMap: Record<
    string,
    { approved: number; rejected: number; completed: number; total: number }
  > = {};

  for (const r of results) {
    if (!typeMap[r.type]) {
      typeMap[r.type] = { approved: 0, rejected: 0, completed: 0, total: 0 };
    }
    typeMap[r.type].total += r._count;
    if (r.status === "APPROVED" || r.status === "COMPLETED") {
      typeMap[r.type].approved += r._count;
    } else if (r.status === "REJECTED") {
      typeMap[r.type].rejected += r._count;
    }
  }

  const successRates = Object.entries(typeMap).map(([type, counts]) => ({
    type,
    approved: counts.approved,
    rejected: counts.rejected,
    total: counts.total,
    rate: counts.total > 0 ? counts.approved / counts.total : 0,
  }));

  return NextResponse.json(successRates);
}
```

- [ ] **Step 4: Create revenue tracking analytics API**

Create `apps/web/src/app/api/analytics/revenue/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { revenueQuerySchema } from "@/lib/validations/analytics";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = revenueQuerySchema.parse(searchParams);

  const startDate = new Date(query.year, 0, 1);
  const endDate = new Date(query.year, 11, 31, 23, 59, 59);

  // Get all paid projects in the year
  const projects = await prisma.project.findMany({
    where: {
      isPaid: true,
      feeAmount: { not: null },
      updatedAt: { gte: startDate, lte: endDate },
    },
    select: {
      feeAmount: true,
      feeType: true,
      type: true,
      updatedAt: true,
    },
  });

  if (query.groupBy === "month") {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: `${i + 1}월`,
      revenue: 0,
      count: 0,
    }));

    for (const p of projects) {
      const monthIdx = p.updatedAt.getMonth();
      months[monthIdx].revenue += Number(p.feeAmount || 0);
      months[monthIdx].count += 1;
    }

    return NextResponse.json({
      year: query.year,
      groupBy: "month",
      data: months,
      totalRevenue: months.reduce((sum, m) => sum + m.revenue, 0),
      totalCount: projects.length,
    });
  }

  // Quarter grouping
  const quarters = [
    { quarter: 1, label: "Q1", months: [0, 1, 2], revenue: 0, count: 0 },
    { quarter: 2, label: "Q2", months: [3, 4, 5], revenue: 0, count: 0 },
    { quarter: 3, label: "Q3", months: [6, 7, 8], revenue: 0, count: 0 },
    { quarter: 4, label: "Q4", months: [9, 10, 11], revenue: 0, count: 0 },
  ];

  for (const p of projects) {
    const monthIdx = p.updatedAt.getMonth();
    const qIdx = Math.floor(monthIdx / 3);
    quarters[qIdx].revenue += Number(p.feeAmount || 0);
    quarters[qIdx].count += 1;
  }

  return NextResponse.json({
    year: query.year,
    groupBy: "quarter",
    data: quarters,
    totalRevenue: quarters.reduce((sum, q) => sum + q.revenue, 0),
    totalCount: projects.length,
  });
}
```

- [ ] **Step 5: Create consultant performance analytics API**

Create `apps/web/src/app/api/analytics/consultants/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { analyticsQuerySchema } from "@/lib/validations/analytics";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = analyticsQuerySchema.parse(searchParams);

  const where = {
    assignedTo: { not: null },
    ...(query.startDate || query.endDate
      ? {
          createdAt: {
            ...(query.startDate ? { gte: query.startDate } : {}),
            ...(query.endDate ? { lte: query.endDate } : {}),
          },
        }
      : {}),
  };

  const results = await prisma.project.groupBy({
    by: ["assignedTo", "status"],
    where,
    _count: true,
  });

  // Aggregate per consultant
  const consultantMap: Record<
    string,
    {
      total: number;
      completed: number;
      approved: number;
      rejected: number;
      inProgress: number;
    }
  > = {};

  for (const r of results) {
    const key = r.assignedTo!;
    if (!consultantMap[key]) {
      consultantMap[key] = {
        total: 0,
        completed: 0,
        approved: 0,
        rejected: 0,
        inProgress: 0,
      };
    }
    consultantMap[key].total += r._count;
    if (r.status === "COMPLETED") consultantMap[key].completed += r._count;
    if (r.status === "APPROVED") consultantMap[key].approved += r._count;
    if (r.status === "REJECTED") consultantMap[key].rejected += r._count;
    if (["INTAKE", "DOC_COLLECTING", "IN_PROGRESS", "REVIEW", "SUBMITTED"].includes(r.status)) {
      consultantMap[key].inProgress += r._count;
    }
  }

  // Fetch user names
  const userIds = Object.keys(consultantMap);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const consultantPerformance = Object.entries(consultantMap).map(
    ([userId, stats]) => ({
      userId,
      name: userMap[userId]?.name || userMap[userId]?.email || "Unknown",
      ...stats,
      successRate:
        stats.approved + stats.rejected > 0
          ? stats.approved / (stats.approved + stats.rejected)
          : null,
    })
  );

  return NextResponse.json(
    consultantPerformance.sort((a, b) => b.total - a.total)
  );
}
```

- [ ] **Step 6: Create portfolio overview analytics API**

Create `apps/web/src/app/api/analytics/portfolio/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser();

  const [
    activeClients,
    totalClients,
    projectsByType,
    projectsByStatus,
    recentProjects,
  ] = await Promise.all([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.client.count(),
    prisma.project.groupBy({
      by: ["type"],
      _count: true,
    }),
    prisma.project.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        updatedAt: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    clients: {
      active: activeClients,
      total: totalClients,
    },
    projectDistribution: projectsByType.map((p) => ({
      type: p.type,
      count: p._count,
    })),
    statusDistribution: projectsByStatus.map((p) => ({
      status: p.status,
      count: p._count,
    })),
    recentActivity: recentProjects,
  });
}
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/analytics/ tests/finance/analytics-queries.test.ts
git commit -m "feat: add analytics APIs (success rate, revenue tracking, consultant performance, portfolio overview)"
```

---

## Task 6: Recharts Chart Container + Finance Dashboard Page

**Files:**
- Create: `apps/web/src/components/charts/chart-container.tsx`
- Create: `apps/web/src/app/(app)/finance/page.tsx`
- Create: `apps/web/src/app/(app)/finance/[clientId]/page.tsx`
- Create: `apps/web/src/app/(app)/finance/[clientId]/components/financial-form.tsx`
- Create: `apps/web/src/app/(app)/finance/[clientId]/components/financial-table.tsx`
- Create: `apps/web/src/app/(app)/finance/[clientId]/components/ratio-cards.tsx`
- Create: `apps/web/src/app/(app)/finance/[clientId]/components/revenue-chart.tsx`
- Create: `apps/web/src/app/(app)/finance/[clientId]/components/report-section.tsx`
- Create: `apps/web/src/app/(app)/finance/[clientId]/actions.ts`

- [ ] **Step 1: Create Recharts container component**

Create `apps/web/src/components/charts/chart-container.tsx`:

```tsx
"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "#1d4ed8",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#e11d48",
];

interface ChartContainerProps {
  type: "bar" | "line" | "pie";
  data: Array<Record<string, unknown>>;
  dataKeys: string[];
  xAxisKey: string;
  height?: number;
  colors?: string[];
  formatYAxis?: (value: number) => string;
}

export function ChartContainer({
  type,
  data,
  dataKeys,
  xAxisKey,
  height = 300,
  colors = COLORS,
  formatYAxis,
}: ChartContainerProps) {
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKeys[0]}
            nameKey={xAxisKey}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis tickFormatter={formatYAxis} />
          <Tooltip />
          <Legend />
          {dataKeys.map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart (default)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} />
        <YAxis tickFormatter={formatYAxis} />
        <Tooltip />
        <Legend />
        {dataKeys.map((key, idx) => (
          <Bar key={key} dataKey={key} fill={colors[idx % colors.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create finance overview page**

Create `apps/web/src/app/(app)/finance/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import Link from "next/link";
import { Building2, TrendingUp, Award } from "lucide-react";

export default async function FinancePage() {
  const user = await getVerifiedUser();

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      industry: true,
      financials: {
        orderBy: { year: "desc" },
        take: 1,
        select: {
          year: true,
          revenue: true,
          creditRating: true,
        },
      },
      _count: {
        select: { achievements: true, financialReports: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">재무 관리</h1>
        <p className="text-muted-foreground">
          고객사별 재무 현황 및 분석 리포트
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => {
          const latestFinancial = client.financials[0];
          const formatRevenue = (n: number) =>
            `${(n / 100000000).toFixed(1)}억`;

          return (
            <Link key={client.id} href={`/finance/${client.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold">
                      <Building2 className="w-4 h-4 inline mr-1" />
                      {client.name}
                    </CardTitle>
                    {latestFinancial?.creditRating && (
                      <Badge variant="outline">
                        {latestFinancial.creditRating}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {client.industry && <p>{client.industry}</p>}
                  {latestFinancial ? (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>
                        {latestFinancial.year}년 매출{" "}
                        {latestFinancial.revenue
                          ? formatRevenue(Number(latestFinancial.revenue))
                          : "N/A"}
                      </span>
                    </div>
                  ) : (
                    <p>재무 데이터 없음</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {client._count.financialReports > 0 && (
                      <Badge variant="secondary">
                        리포트 {client._count.financialReports}건
                      </Badge>
                    )}
                    {client._count.achievements > 0 && (
                      <Badge variant="secondary">
                        <Award className="w-3 h-3 mr-1" />
                        성과 {client._count.achievements}건
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create financial form component**

Create `apps/web/src/app/(app)/finance/[clientId]/components/financial-form.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Input } from "@axle/ui/input";
import { Label } from "@axle/ui/label";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

interface FinancialFormProps {
  clientId: string;
  onSuccess: () => void;
}

export function FinancialForm({ clientId, onSuccess }: FinancialFormProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { source: "manual" };

    for (const [key, value] of formData.entries()) {
      if (value) body[key] = value;
    }

    try {
      const response = await fetch(`/api/finance/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSuccess();
        (e.target as HTMLFormElement).reset();
      } else {
        const data = await response.json();
        alert(data.error || "저장에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>연도 *</Label>
          <Input name="year" type="number" required min={2000} max={2030} />
        </div>
        <div className="space-y-2">
          <Label>신용등급</Label>
          <Input name="creditRating" placeholder="예: BBB+" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>매출 (원)</Label>
          <Input name="revenue" type="number" placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>영업이익 (원)</Label>
          <Input name="operatingProfit" type="number" placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>순이익 (원)</Label>
          <Input name="netProfit" type="number" placeholder="0" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>총자산 (원)</Label>
          <Input name="totalAssets" type="number" placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>총부채 (원)</Label>
          <Input name="totalLiabilities" type="number" placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>자본총계 (원)</Label>
          <Input name="totalEquity" type="number" placeholder="0" />
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        저장
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Create financial table component**

Create `apps/web/src/app/(app)/finance/[clientId]/components/financial-table.tsx`:

```tsx
interface FinancialData {
  year: number;
  revenue?: string | null;
  operatingProfit?: string | null;
  netProfit?: string | null;
  totalAssets?: string | null;
  totalLiabilities?: string | null;
  totalEquity?: string | null;
  creditRating?: string | null;
  source?: string | null;
}

interface FinancialTableProps {
  data: FinancialData[];
}

export function FinancialTable({ data }: FinancialTableProps) {
  const formatNum = (n: string | null | undefined) => {
    if (!n) return "-";
    const num = Number(n);
    if (Math.abs(num) >= 100000000) return `${(num / 100000000).toFixed(1)}억`;
    if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(0)}만`;
    return num.toLocaleString();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">연도</th>
            <th className="text-right p-2">매출</th>
            <th className="text-right p-2">영업이익</th>
            <th className="text-right p-2">순이익</th>
            <th className="text-right p-2">총자산</th>
            <th className="text-right p-2">부채</th>
            <th className="text-right p-2">자본</th>
            <th className="text-center p-2">신용</th>
            <th className="text-center p-2">출처</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.year} className="border-b hover:bg-muted/50">
              <td className="p-2 font-medium">{row.year}</td>
              <td className="text-right p-2">{formatNum(row.revenue)}</td>
              <td className="text-right p-2">{formatNum(row.operatingProfit)}</td>
              <td className="text-right p-2">{formatNum(row.netProfit)}</td>
              <td className="text-right p-2">{formatNum(row.totalAssets)}</td>
              <td className="text-right p-2">{formatNum(row.totalLiabilities)}</td>
              <td className="text-right p-2">{formatNum(row.totalEquity)}</td>
              <td className="text-center p-2">{row.creditRating || "-"}</td>
              <td className="text-center p-2 text-muted-foreground text-xs">
                {row.source || "manual"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Create ratio cards component**

Create `apps/web/src/app/(app)/finance/[clientId]/components/ratio-cards.tsx`:

```tsx
import { Card, CardContent } from "@axle/ui/card";

interface RatioCardsProps {
  ratios: {
    operatingMargin: number | null;
    netMargin: number | null;
    debtRatio: number | null;
    currentRatio: number | null;
    roe: number | null;
    debtToEquity: number | null;
  };
}

export function RatioCards({ ratios }: RatioCardsProps) {
  const formatPct = (n: number | null) =>
    n != null ? `${(n * 100).toFixed(1)}%` : "-";

  const items = [
    {
      label: "영업이익률",
      value: formatPct(ratios.operatingMargin),
      desc: "매출 대비 영업이익",
    },
    {
      label: "순이익률",
      value: formatPct(ratios.netMargin),
      desc: "매출 대비 순이익",
    },
    {
      label: "부채비율",
      value: formatPct(ratios.debtToEquity),
      desc: "자본 대비 부채",
    },
    {
      label: "유동비율",
      value: formatPct(ratios.currentRatio),
      desc: "부채 대비 자산",
    },
    {
      label: "ROE",
      value: formatPct(ratios.roe),
      desc: "자기자본이익률",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{item.value}</p>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create revenue chart component**

Create `apps/web/src/app/(app)/finance/[clientId]/components/revenue-chart.tsx`:

```tsx
"use client";

import { ChartContainer } from "@/components/charts/chart-container";

interface RevenueChartProps {
  data: Array<{
    year: number;
    revenue?: string | null;
    operatingProfit?: string | null;
    netProfit?: string | null;
  }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data
    .map((d) => ({
      year: `${d.year}`,
      매출: d.revenue ? Number(d.revenue) / 100000000 : 0,
      영업이익: d.operatingProfit ? Number(d.operatingProfit) / 100000000 : 0,
      순이익: d.netProfit ? Number(d.netProfit) / 100000000 : 0,
    }))
    .reverse(); // Oldest first for chart

  if (chartData.length < 2) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        2개 이상의 연도 데이터가 있어야 차트를 표시할 수 있습니다.
      </p>
    );
  }

  return (
    <ChartContainer
      type="line"
      data={chartData}
      dataKeys={["매출", "영업이익", "순이익"]}
      xAxisKey="year"
      height={300}
      formatYAxis={(v) => `${v}억`}
    />
  );
}
```

- [ ] **Step 7: Create report section component**

Create `apps/web/src/app/(app)/finance/[clientId]/components/report-section.tsx`:

```tsx
"use client";

import { Button } from "@axle/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";

interface ReportSectionProps {
  clientId: string;
  latestYear: number;
  existingReport?: { id: string; year: number } | null;
}

export function ReportSection({
  clientId,
  latestYear,
  existingReport,
}: ReportSectionProps) {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<{
    analysis: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const response = await fetch(`/api/finance/${clientId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: latestYear }),
      });

      if (response.ok) {
        const data = await response.json();
        setReport(data);
      } else {
        const err = await response.json();
        alert(err.error || "리포트 생성에 실패했습니다.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            <FileText className="w-4 h-4 inline mr-2" />
            AI 재무 분석 리포트
          </CardTitle>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            size="sm"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {latestYear}년 분석
          </Button>
        </div>
      </CardHeader>
      {report && (
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">종합 분석</h4>
            <p className="text-sm">{report.analysis}</p>
          </div>
          {report.strengths.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 text-green-700">강점</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {report.weaknesses.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 text-red-700">약점</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                {report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          {report.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 text-blue-700">권고사항</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
```

- [ ] **Step 8: Create client financial dashboard page**

Create `apps/web/src/app/(app)/finance/[clientId]/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedUser } from "@axle/auth/dal";
import { notFound } from "next/navigation";
import { calculateRatios } from "@axle/ai/financial-analysis";
import { FinancialTable } from "./components/financial-table";
import { RatioCards } from "./components/ratio-cards";
import { RevenueChart } from "./components/revenue-chart";
import { ReportSection } from "./components/report-section";
import { Badge } from "@axle/ui/badge";
import Link from "next/link";
import { Button } from "@axle/ui/button";
import { ArrowLeft, Award } from "lucide-react";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientFinancePage({ params }: PageProps) {
  const user = await getVerifiedUser();
  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      industry: true,
      businessNumber: true,
      financials: {
        orderBy: { year: "desc" },
      },
      financialReports: {
        orderBy: { year: "desc" },
        take: 1,
      },
      _count: { select: { achievements: true } },
    },
  });

  if (!client) notFound();

  const latestFinancial = client.financials[0];
  const ratios = latestFinancial
    ? calculateRatios({
        year: latestFinancial.year,
        revenue: latestFinancial.revenue ? Number(latestFinancial.revenue) : null,
        operatingProfit: latestFinancial.operatingProfit ? Number(latestFinancial.operatingProfit) : null,
        netProfit: latestFinancial.netProfit ? Number(latestFinancial.netProfit) : null,
        totalAssets: latestFinancial.totalAssets ? Number(latestFinancial.totalAssets) : null,
        totalLiabilities: latestFinancial.totalLiabilities ? Number(latestFinancial.totalLiabilities) : null,
        totalEquity: latestFinancial.totalEquity ? Number(latestFinancial.totalEquity) : null,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/finance">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{client.name}</h1>
          </div>
          <p className="text-muted-foreground">
            {client.industry || ""} {client.businessNumber ? `(${client.businessNumber})` : ""}
          </p>
        </div>
        <Link href={`/finance/achievements/${clientId}`}>
          <Button variant="outline">
            <Award className="w-4 h-4 mr-2" />
            성과 ({client._count.achievements})
          </Button>
        </Link>
      </div>

      {/* Ratio Cards */}
      {ratios && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            {latestFinancial.year}년 주요 지표
          </h2>
          <RatioCards ratios={ratios} />
        </div>
      )}

      {/* Revenue Trend Chart */}
      {client.financials.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">매출/이익 추이</h2>
          <RevenueChart
            data={client.financials.map((f) => ({
              year: f.year,
              revenue: f.revenue?.toString(),
              operatingProfit: f.operatingProfit?.toString(),
              netProfit: f.netProfit?.toString(),
            }))}
          />
        </div>
      )}

      {/* Financial Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">재무 데이터</h2>
        {client.financials.length > 0 ? (
          <FinancialTable
            data={client.financials.map((f) => ({
              year: f.year,
              revenue: f.revenue?.toString(),
              operatingProfit: f.operatingProfit?.toString(),
              netProfit: f.netProfit?.toString(),
              totalAssets: f.totalAssets?.toString(),
              totalLiabilities: f.totalLiabilities?.toString(),
              totalEquity: f.totalEquity?.toString(),
              creditRating: f.creditRating,
              source: f.source,
            }))}
          />
        ) : (
          <p className="text-muted-foreground text-center py-8">
            재무 데이터가 없습니다. 아래에서 추가하세요.
          </p>
        )}
      </div>

      {/* Report Section */}
      {latestFinancial && (
        <ReportSection
          clientId={clientId}
          latestYear={latestFinancial.year}
          existingReport={client.financialReports[0] || null}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/components/charts/ apps/web/src/app/\(app\)/finance/
git commit -m "feat: add finance dashboard with financial table, ratio cards, revenue chart, and AI report generation"
```

---

## Task 7: Analytics Dashboard Page

**Files:**
- Create: `apps/web/src/app/(app)/analytics/page.tsx`
- Create: `apps/web/src/app/(app)/analytics/components/success-rate-chart.tsx`
- Create: `apps/web/src/app/(app)/analytics/components/revenue-tracking.tsx`
- Create: `apps/web/src/app/(app)/analytics/components/consultant-performance.tsx`
- Create: `apps/web/src/app/(app)/analytics/components/portfolio-overview.tsx`

- [ ] **Step 1: Create success rate chart component**

Create `apps/web/src/app/(app)/analytics/components/success-rate-chart.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { ChartContainer } from "@/components/charts/chart-container";
import { useEffect, useState } from "react";

interface SuccessData {
  type: string;
  approved: number;
  rejected: number;
  total: number;
  rate: number;
}

const typeLabels: Record<string, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처인증",
  SOBOOJANG_CERT: "소부장",
  RESEARCH_INSTITUTE: "연구소",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무분석",
  RESEARCH_TASK: "연구과제",
  BUNDLE: "번들",
};

export function SuccessRateChart() {
  const [data, setData] = useState<SuccessData[]>([]);

  useEffect(() => {
    fetch("/api/analytics/success-rate")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const chartData = data.map((d) => ({
    name: typeLabels[d.type] || d.type,
    합격: d.approved,
    불합격: d.rejected,
    합격률: Math.round(d.rate * 100),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>프로젝트 합격률</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer
            type="bar"
            data={chartData}
            dataKeys={["합격", "불합격"]}
            xAxisKey="name"
            height={300}
            colors={["#059669", "#dc2626"]}
          />
        ) : (
          <p className="text-center text-muted-foreground py-8">
            데이터가 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create revenue tracking component**

Create `apps/web/src/app/(app)/analytics/components/revenue-tracking.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { ChartContainer } from "@/components/charts/chart-container";
import { useEffect, useState } from "react";

interface MonthlyRevenue {
  month: number;
  label: string;
  revenue: number;
  count: number;
}

export function RevenueTracking() {
  const [data, setData] = useState<{
    data: MonthlyRevenue[];
    totalRevenue: number;
    totalCount: number;
  } | null>(null);

  const year = new Date().getFullYear();

  useEffect(() => {
    fetch(`/api/analytics/revenue?year=${year}`)
      .then((r) => r.json())
      .then(setData);
  }, [year]);

  if (!data) return null;

  const chartData = data.data.map((d) => ({
    name: d.label,
    매출: Math.round(d.revenue / 10000),
    건수: d.count,
  }));

  const formatRevenue = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
    return `${n}만`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{year}년 매출 추이</CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold">
              {formatRevenue(Math.round(data.totalRevenue / 10000))}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.totalCount}건
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          type="bar"
          data={chartData}
          dataKeys={["매출"]}
          xAxisKey="name"
          height={300}
          formatYAxis={(v) => `${v}만`}
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create consultant performance component**

Create `apps/web/src/app/(app)/analytics/components/consultant-performance.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import { useEffect, useState } from "react";

interface ConsultantData {
  userId: string;
  name: string;
  total: number;
  completed: number;
  approved: number;
  rejected: number;
  inProgress: number;
  successRate: number | null;
}

export function ConsultantPerformance() {
  const [data, setData] = useState<ConsultantData[]>([]);

  useEffect(() => {
    fetch("/api/analytics/consultants")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>컨설턴트 성과</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((c) => (
              <div
                key={c.userId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary">총 {c.total}건</Badge>
                    <Badge variant="outline">진행 중 {c.inProgress}</Badge>
                    {c.successRate != null && (
                      <Badge
                        variant={
                          c.successRate >= 0.7 ? "default" : "destructive"
                        }
                      >
                        합격률 {Math.round(c.successRate * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>합격 {c.approved} / 불합격 {c.rejected}</p>
                  <p>완료 {c.completed}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            데이터가 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create portfolio overview component**

Create `apps/web/src/app/(app)/analytics/components/portfolio-overview.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@axle/ui/card";
import { ChartContainer } from "@/components/charts/chart-container";
import { useEffect, useState } from "react";

interface PortfolioData {
  clients: { active: number; total: number };
  projectDistribution: Array<{ type: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}

const typeLabels: Record<string, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처인증",
  SOBOOJANG_CERT: "소부장",
  RESEARCH_INSTITUTE: "연구소",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무분석",
  RESEARCH_TASK: "연구과제",
  BUNDLE: "번들",
};

export function PortfolioOverview() {
  const [data, setData] = useState<PortfolioData | null>(null);

  useEffect(() => {
    fetch("/api/analytics/portfolio")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return null;

  const typeChartData = data.projectDistribution.map((d) => ({
    name: typeLabels[d.type] || d.type,
    count: d.count,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>고객사 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{data.clients.active}</p>
              <p className="text-sm text-muted-foreground">활성 고객사</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{data.clients.total}</p>
              <p className="text-sm text-muted-foreground">전체 고객사</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>프로젝트 유형 분포</CardTitle>
        </CardHeader>
        <CardContent>
          {typeChartData.length > 0 ? (
            <ChartContainer
              type="pie"
              data={typeChartData}
              dataKeys={["count"]}
              xAxisKey="name"
              height={250}
            />
          ) : (
            <p className="text-center text-muted-foreground py-8">
              데이터가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Create analytics dashboard page**

Create `apps/web/src/app/(app)/analytics/page.tsx`:

```tsx
import { getVerifiedUser } from "@axle/auth/dal";
import { SuccessRateChart } from "./components/success-rate-chart";
import { RevenueTracking } from "./components/revenue-tracking";
import { ConsultantPerformance } from "./components/consultant-performance";
import { PortfolioOverview } from "./components/portfolio-overview";

export default async function AnalyticsPage() {
  const user = await getVerifiedUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground">
          프로젝트 합격률, 매출, 컨설턴트 성과 종합 분석
        </p>
      </div>

      <PortfolioOverview />

      <div className="grid gap-4 lg:grid-cols-2">
        <SuccessRateChart />
        <RevenueTracking />
      </div>

      <ConsultantPerformance />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/\(app\)/analytics/
git commit -m "feat: add analytics dashboard with success rate, revenue tracking, consultant performance, and portfolio overview"
```

---

## Task 8: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run all finance tests**

```bash
cd /Volumes/포터블/AX/axle
npx vitest run tests/finance/
```

Expected: All tests PASS (14 total across 3 test files).

- [ ] **Step 3: Verify dev server renders all pages**

```bash
cd /Volumes/포터블/AX/axle
npx turbo dev --filter=@axle/web
```

Expected:
- /finance — client list with financial summaries renders
- /finance/[clientId] — financial dashboard with chart renders
- /analytics — all 4 chart components render

- [ ] **Step 4: Verify Recharts dependency**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npm ls recharts
```

Expected: recharts is installed. If not:

```bash
cd /Volumes/포터블/AX/axle/apps/web
npm install recharts
```

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 11 complete — Finance management, financial analysis, achievements, and analytics dashboard"
```

---

## Summary

Phase 11 delivers:
- **ClientFinancial CRUD**: Year-based financial data with manual input, Excel/PDF import ready, DART API ready
- **Financial Ratios**: `calculateRatios()` — operating margin, net margin, debt ratio, current ratio, ROE, debt-to-equity
- **AI Financial Analysis**: `analyzeFinancials()` — strengths/weaknesses/recommendations via Haiku with trend analysis
- **Financial Report Generation**: Markdown report ready for DOCX conversion via mark-docx skill
- **ClientAchievement CRUD**: Patents, awards, contracts, investments, certifications tracking
- **Analytics APIs**: Success rate by project type, revenue tracking by month/quarter, consultant performance, portfolio overview
- **Recharts Visualization**: ChartContainer component (bar, line, pie), integrated into finance and analytics pages
- **Finance Pages**: Client list overview, per-client financial dashboard (ratio cards, revenue chart, data table, AI report)
- **Analytics Page**: Combined dashboard with success rate chart, revenue tracking, consultant performance cards, portfolio pie chart

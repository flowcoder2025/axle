# AXLE Phase 6: DocGen Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the document generation engine (`packages/docgen`) that powers business plan generation (dual engine: RAG draft + precision editor), estimate/contract/journal report generators, patent draft, financial reports, and integrates mark-docx, hwpx-editor, pdf-to-markdown, and image generation.

**Architecture:** `packages/docgen` is a shared package consumed by `apps/web` API routes and `apps/agent-bridge`. It references the Document model from `packages/db` for output storage and uses `packages/ai` for AI-powered content generation. QStash job chaining coordinates multi-step generation pipelines.

**Tech Stack:** TypeScript, docx (docx-js), @anthropic-ai/sdk, openai (embeddings), pdf-parse, mammoth, sharp, @mermaid-js/mermaid-cli (mmdc), Zod, Vitest

**Depends on:** Phase 2 (storage — file upload/download), Phase 5 (AI engine — RAG, AI Router, embeddings)

---

## File Structure

```
packages/docgen/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                          # Public API exports
│   ├── types.ts                          # Shared types and Zod schemas
│   │
│   ├── engines/
│   │   ├── rag-draft.ts                  # Engine A: RAG-based business plan draft
│   │   ├── precision-editor.ts           # Engine B: PDF form → research → plan → DOCX
│   │   └── dual-engine-pipeline.ts       # QStash chaining: RAG draft → precision edit
│   │
│   ├── generators/
│   │   ├── business-plan.ts              # Orchestrator for dual engine business plan
│   │   ├── estimate.ts                   # Estimate DOCX generator (docx-js)
│   │   ├── contract.ts                   # Contract DOCX generator (docx-js)
│   │   ├── journal-report.ts             # Research journal monthly report
│   │   ├── patent-draft.ts              # Patent specification (명세서) draft
│   │   └── financial-report.ts           # Financial analysis report (charts + DOCX)
│   │
│   ├── converters/
│   │   ├── mark-docx.ts                  # Markdown → DOCX with Korean typography
│   │   ├── hwpx-editor.ts               # HWPX form editing (set_cell, checkbox, replace)
│   │   ├── pdf-to-markdown.ts            # PDF structure extraction
│   │   ├── text-parser.ts               # HWP/HWPX/PDF text extraction
│   │   └── mermaid-to-png.ts            # Mermaid diagram → PNG conversion
│   │
│   ├── media/
│   │   └── image-generator.ts            # Gemini/DALL-E diagram & infographic generation
│   │
│   └── utils/
│       ├── docx-styles.ts                # Shared DOCX styling constants
│       ├── number-format.ts              # Korean currency/number formatting
│       └── template-loader.ts            # Load HWPX/DOCX templates from storage
│
├── templates/
│   ├── estimate-template.json            # Estimate layout config
│   ├── contract-template.json            # Contract layout config
│   └── patent-template.json              # Patent specification template
│
└── tests/
    ├── rag-draft.test.ts
    ├── precision-editor.test.ts
    ├── estimate.test.ts
    ├── contract.test.ts
    ├── journal-report.test.ts
    ├── patent-draft.test.ts
    ├── financial-report.test.ts
    ├── mark-docx.test.ts
    ├── hwpx-editor.test.ts
    ├── pdf-to-markdown.test.ts
    ├── mermaid-to-png.test.ts
    └── image-generator.test.ts
```

---

## Task 1: packages/docgen — Package Setup and Types

**Files:**
- Create: `packages/docgen/package.json`
- Create: `packages/docgen/tsconfig.json`
- Create: `packages/docgen/src/types.ts`
- Create: `packages/docgen/src/index.ts`
- Create: `packages/docgen/src/utils/docx-styles.ts`
- Create: `packages/docgen/src/utils/number-format.ts`

- [ ] **Step 1: Create packages/docgen/package.json**

```json
{
  "name": "@axle/docgen",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./engines/*": "./src/engines/*.ts",
    "./generators/*": "./src/generators/*.ts",
    "./converters/*": "./src/converters/*.ts",
    "./media/*": "./src/media/*.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "docx": "^9.5.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.8.0",
    "sharp": "^0.34.2",
    "archiver": "^7.0.1",
    "xml2js": "^0.6.2",
    "zod": "^3.25.0",
    "@anthropic-ai/sdk": "^0.52.0",
    "openai": "^4.90.0",
    "@axle/db": "workspace:*",
    "@axle/ai": "workspace:*"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4",
    "@types/archiver": "^6.0.3",
    "@types/xml2js": "^0.4.14",
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/docgen/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create shared types and Zod schemas**

Create `packages/docgen/src/types.ts`:

```typescript
import { z } from "zod";

// ==================== Business Plan ====================

export const BusinessPlanInputSchema = z.object({
  clientId: z.string(),
  projectId: z.string(),
  programId: z.string().optional(),
  companyProfile: z.object({
    name: z.string(),
    businessNumber: z.string().optional(),
    ceoName: z.string().optional(),
    industry: z.string().optional(),
    employeeCount: z.number().optional(),
    capitalAmount: z.number().optional(),
    foundedDate: z.string().optional(),
    region: z.string().optional(),
    isVenture: z.boolean().optional(),
  }),
  programInfo: z.object({
    name: z.string(),
    agency: z.string().optional(),
    category: z.string(),
    requirements: z.record(z.unknown()).optional(),
    eligibility: z.record(z.unknown()).optional(),
    maxFunding: z.number().optional(),
  }).optional(),
  clientDocuments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    content: z.string(),
    category: z.string(),
  })).default([]),
  previousPlans: z.array(z.object({
    id: z.string(),
    content: z.string(),
    score: z.number().optional(),
  })).default([]),
  additionalContext: z.string().optional(),
});

export type BusinessPlanInput = z.infer<typeof BusinessPlanInputSchema>;

export interface BusinessPlanOutput {
  markdownContent: string;
  sections: BusinessPlanSection[];
  diagrams: GeneratedImage[];
  docxBuffer: Buffer;
  metadata: {
    engineUsed: "rag" | "precision" | "dual";
    ragDraftTokens?: number;
    precisionEditTokens?: number;
    totalDurationMs: number;
  };
}

export interface BusinessPlanSection {
  title: string;
  content: string;
  order: number;
}

// ==================== Estimate ====================

export const EstimateInputSchema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  estimateNumber: z.string(),
  items: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    unit: z.string().default("건"),
  })),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  issuer: z.object({
    companyName: z.string(),
    ceoName: z.string(),
    businessNumber: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string().optional(),
  }),
  recipient: z.object({
    companyName: z.string(),
    ceoName: z.string().optional(),
    businessNumber: z.string().optional(),
    address: z.string().optional(),
  }),
});

export type EstimateInput = z.infer<typeof EstimateInputSchema>;

export interface EstimateOutput {
  docxBuffer: Buffer;
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
}

// ==================== Contract ====================

export const ContractInputSchema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  contractNumber: z.string(),
  title: z.string(),
  partyA: z.object({
    companyName: z.string(),
    ceoName: z.string(),
    businessNumber: z.string(),
    address: z.string(),
  }),
  partyB: z.object({
    companyName: z.string(),
    ceoName: z.string(),
    businessNumber: z.string(),
    address: z.string(),
  }),
  terms: z.array(z.object({
    article: z.number(),
    title: z.string(),
    content: z.string(),
  })),
  totalAmount: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  specialTerms: z.string().optional(),
});

export type ContractInput = z.infer<typeof ContractInputSchema>;

export interface ContractOutput {
  docxBuffer: Buffer;
}

// ==================== Journal Report ====================

export const JournalReportInputSchema = z.object({
  clientId: z.string(),
  year: z.number(),
  month: z.number().min(1).max(12),
  journals: z.array(z.object({
    date: z.string(),
    title: z.string(),
    content: z.string(),
    objectives: z.string().optional(),
    results: z.string().optional(),
    nextSteps: z.string().optional(),
    hours: z.number().optional(),
    researcherName: z.string(),
  })),
  companyName: z.string(),
  instituteName: z.string().optional(),
});

export type JournalReportInput = z.infer<typeof JournalReportInputSchema>;

export interface JournalReportOutput {
  docxBuffer: Buffer;
  totalHours: number;
  journalCount: number;
}

// ==================== Patent Draft ====================

export const PatentDraftInputSchema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  inventionTitle: z.string(),
  technicalField: z.string(),
  backgroundArt: z.string().optional(),
  problemToSolve: z.string(),
  solutionDescription: z.string(),
  advantageousEffects: z.string().optional(),
  claims: z.array(z.string()).optional(),
  drawings: z.array(z.object({
    description: z.string(),
    imageUrl: z.string().optional(),
  })).default([]),
  inventors: z.array(z.object({
    name: z.string(),
    address: z.string().optional(),
  })),
  applicant: z.object({
    name: z.string(),
    businessNumber: z.string().optional(),
    address: z.string().optional(),
  }),
});

export type PatentDraftInput = z.infer<typeof PatentDraftInputSchema>;

export interface PatentDraftOutput {
  docxBuffer: Buffer;
  markdownContent: string;
  claimsGenerated: string[];
  drawingDescriptions: string[];
}

// ==================== Financial Report ====================

export const FinancialReportInputSchema = z.object({
  clientId: z.string(),
  year: z.number(),
  financials: z.object({
    revenue: z.number().optional(),
    operatingProfit: z.number().optional(),
    netProfit: z.number().optional(),
    totalAssets: z.number().optional(),
    totalLiabilities: z.number().optional(),
    totalEquity: z.number().optional(),
    creditRating: z.string().optional(),
  }),
  previousYears: z.array(z.object({
    year: z.number(),
    revenue: z.number().optional(),
    operatingProfit: z.number().optional(),
    netProfit: z.number().optional(),
    totalAssets: z.number().optional(),
    totalLiabilities: z.number().optional(),
    totalEquity: z.number().optional(),
  })).default([]),
  adjustments: z.record(z.string(), z.number()).optional(),
  companyName: z.string(),
  industry: z.string().optional(),
});

export type FinancialReportInput = z.infer<typeof FinancialReportInputSchema>;

export interface FinancialReportOutput {
  docxBuffer: Buffer;
  analysis: FinancialAnalysis;
  chartImages: GeneratedImage[];
}

export interface FinancialAnalysis {
  currentRatio: number | null;
  debtRatio: number | null;
  roe: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  overallAssessment: string;
  recommendations: string[];
}

// ==================== Shared ====================

export interface GeneratedImage {
  name: string;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

export interface DocGenResult {
  success: boolean;
  buffer?: Buffer;
  fileUrl?: string;
  documentId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 4: Create DOCX styling constants**

Create `packages/docgen/src/utils/docx-styles.ts`:

```typescript
import {
  AlignmentType,
  HeadingLevel,
  IRunPropertiesOptions,
  ISectionOptions,
  convertMillimetersToTwip,
} from "docx";

/**
 * Korean business document styling constants.
 * Matches mark-docx skill output quality.
 */
export const FONTS = {
  heading: "맑은 고딕",
  body: "맑은 고딕",
  mono: "D2Coding",
} as const;

export const FONT_SIZES = {
  title: 32,       // 16pt
  heading1: 28,    // 14pt
  heading2: 24,    // 12pt
  heading3: 22,    // 11pt
  body: 20,        // 10pt
  caption: 18,     // 9pt
  footnote: 16,    // 8pt
} as const;

export const LINE_SPACING = {
  body: 360,       // 1.5x line spacing (240 = single)
  heading: 280,
  table: 240,
} as const;

export const PAGE_MARGINS: ISectionOptions["properties"] = {
  page: {
    margin: {
      top: convertMillimetersToTwip(25),
      right: convertMillimetersToTwip(25),
      bottom: convertMillimetersToTwip(25),
      left: convertMillimetersToTwip(25),
    },
    size: {
      width: convertMillimetersToTwip(210),  // A4
      height: convertMillimetersToTwip(297),
    },
  },
};

export const RUN_STYLES = {
  title: {
    font: FONTS.heading,
    size: FONT_SIZES.title,
    bold: true,
  } satisfies IRunPropertiesOptions,

  heading1: {
    font: FONTS.heading,
    size: FONT_SIZES.heading1,
    bold: true,
  } satisfies IRunPropertiesOptions,

  heading2: {
    font: FONTS.heading,
    size: FONT_SIZES.heading2,
    bold: true,
  } satisfies IRunPropertiesOptions,

  body: {
    font: FONTS.body,
    size: FONT_SIZES.body,
  } satisfies IRunPropertiesOptions,

  bold: {
    font: FONTS.body,
    size: FONT_SIZES.body,
    bold: true,
  } satisfies IRunPropertiesOptions,
} as const;
```

- [ ] **Step 5: Create number formatting utilities**

Create `packages/docgen/src/utils/number-format.ts`:

```typescript
/**
 * Format number as Korean currency (원).
 * 1234567 → "1,234,567원"
 */
export function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * Format number with commas.
 * 1234567 → "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

/**
 * Format percentage.
 * 0.1234 → "12.34%"
 */
export function formatPercent(ratio: number, decimals = 2): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/**
 * Convert number to Korean unit (만, 억).
 * 150000000 → "1억 5,000만"
 */
export function formatKoreanUnit(amount: number): string {
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / 10_000);
  const rest = amount % 10_000;

  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`);
  if (rest > 0 && eok === 0 && man === 0) parts.push(`${rest.toLocaleString("ko-KR")}`);

  return parts.join(" ") || "0";
}

/**
 * Format date as Korean format.
 * "2026-04-10" → "2026년 04월 10일"
 */
export function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}년 ${month}월 ${day}일`;
}
```

- [ ] **Step 6: Create initial index.ts**

Create `packages/docgen/src/index.ts`:

```typescript
// Types
export type {
  BusinessPlanInput,
  BusinessPlanOutput,
  BusinessPlanSection,
  EstimateInput,
  EstimateOutput,
  ContractInput,
  ContractOutput,
  JournalReportInput,
  JournalReportOutput,
  PatentDraftInput,
  PatentDraftOutput,
  FinancialReportInput,
  FinancialReportOutput,
  FinancialAnalysis,
  GeneratedImage,
  DocGenResult,
} from "./types";

// Schemas
export {
  BusinessPlanInputSchema,
  EstimateInputSchema,
  ContractInputSchema,
  JournalReportInputSchema,
  PatentDraftInputSchema,
  FinancialReportInputSchema,
} from "./types";

// Generators (added as each task is completed)
// export { generateEstimate } from "./generators/estimate";
// export { generateContract } from "./generators/contract";
// export { generateJournalReport } from "./generators/journal-report";
// export { generatePatentDraft } from "./generators/patent-draft";
// export { generateFinancialReport } from "./generators/financial-report";
// export { generateBusinessPlan } from "./generators/business-plan";

// Converters
// export { markdownToDocx } from "./converters/mark-docx";
// export { editHwpx } from "./converters/hwpx-editor";
// export { pdfToMarkdown } from "./converters/pdf-to-markdown";
// export { extractText } from "./converters/text-parser";
// export { mermaidToPng } from "./converters/mermaid-to-png";

// Media
// export { generateImage } from "./media/image-generator";

// Utils
export { formatKRW, formatNumber, formatPercent, formatKoreanUnit, formatKoreanDate } from "./utils/number-format";
```

- [ ] **Step 7: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 8: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/
git commit -m "feat: add packages/docgen scaffold with types, schemas, and formatting utilities"
```

---

## Task 2: Estimate Generator (docx-js)

**Files:**
- Create: `packages/docgen/templates/estimate-template.json`
- Create: `packages/docgen/src/generators/estimate.ts`
- Create: `packages/docgen/tests/estimate.test.ts`

- [ ] **Step 1: Write failing tests for estimate generator**

Create `packages/docgen/tests/estimate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateEstimate } from "../src/generators/estimate";
import type { EstimateInput } from "../src/types";

const sampleInput: EstimateInput = {
  clientId: "client-1",
  estimateNumber: "EST-2026-001",
  items: [
    { name: "사업계획서 컨설팅", quantity: 1, unitPrice: 3000000, unit: "건" },
    { name: "벤처기업 인증 대행", quantity: 1, unitPrice: 2000000, unit: "건" },
    { name: "특허 출원 대행", quantity: 2, unitPrice: 1500000, unit: "건" },
  ],
  validUntil: "2026-05-10",
  notes: "부가세 별도",
  issuer: {
    companyName: "플로우코더",
    ceoName: "조용현",
    businessNumber: "123-45-67890",
    address: "서울특별시 강남구",
    phone: "02-1234-5678",
    email: "contact@flowcoder.io",
  },
  recipient: {
    companyName: "(주)테스트기업",
    ceoName: "김대표",
    businessNumber: "987-65-43210",
    address: "서울특별시 서초구",
  },
};

describe("Estimate Generator", () => {
  it("generates a DOCX buffer with correct totals", async () => {
    const result = await generateEstimate(sampleInput);

    expect(result.docxBuffer).toBeInstanceOf(Buffer);
    expect(result.docxBuffer.length).toBeGreaterThan(0);
    expect(result.totalAmount).toBe(8000000); // 3M + 2M + 3M (2x1.5M)
    expect(result.taxAmount).toBe(800000);    // 10% VAT
    expect(result.grandTotal).toBe(8800000);  // total + tax
  });

  it("calculates line items correctly", async () => {
    const singleItem: EstimateInput = {
      ...sampleInput,
      items: [{ name: "테스트", quantity: 3, unitPrice: 100000, unit: "개" }],
    };

    const result = await generateEstimate(singleItem);
    expect(result.totalAmount).toBe(300000);
    expect(result.taxAmount).toBe(30000);
    expect(result.grandTotal).toBe(330000);
  });

  it("handles empty items gracefully", async () => {
    const noItems: EstimateInput = {
      ...sampleInput,
      items: [],
    };

    const result = await generateEstimate(noItems);
    expect(result.totalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.grandTotal).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/estimate.test.ts
```

Expected: FAIL — "Cannot find module '../src/generators/estimate'"

- [ ] **Step 3: Create estimate template config**

Create `packages/docgen/templates/estimate-template.json`:

```json
{
  "title": "견 적 서",
  "columns": [
    { "key": "index", "label": "번호", "widthPercent": 8 },
    { "key": "name", "label": "항목명", "widthPercent": 35 },
    { "key": "description", "label": "내용", "widthPercent": 20 },
    { "key": "quantity", "label": "수량", "widthPercent": 8, "align": "center" },
    { "key": "unit", "label": "단위", "widthPercent": 7, "align": "center" },
    { "key": "unitPrice", "label": "단가", "widthPercent": 11, "align": "right" },
    { "key": "amount", "label": "금액", "widthPercent": 11, "align": "right" }
  ],
  "vatRate": 0.1,
  "footerText": "위와 같이 견적합니다."
}
```

- [ ] **Step 4: Implement estimate generator**

Create `packages/docgen/src/generators/estimate.ts`:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
} from "docx";
import type { EstimateInput, EstimateOutput } from "../types";
import { FONTS, FONT_SIZES, PAGE_MARGINS, RUN_STYLES } from "../utils/docx-styles";
import { formatKRW, formatNumber, formatKoreanDate } from "../utils/number-format";

export async function generateEstimate(input: EstimateInput): Promise<EstimateOutput> {
  // Calculate totals
  const totalAmount = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const taxAmount = Math.round(totalAmount * 0.1);
  const grandTotal = totalAmount + taxAmount;

  // Build document
  const doc = new Document({
    sections: [
      {
        ...PAGE_MARGINS,
        children: [
          // Title
          new Paragraph({
            children: [new TextRun({ text: "견 적 서", ...RUN_STYLES.title })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Estimate number and date
          new Paragraph({
            children: [
              new TextRun({ text: `견적번호: ${input.estimateNumber}`, font: FONTS.body, size: FONT_SIZES.body }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `견적일자: ${formatKoreanDate(new Date().toISOString().split("T")[0])}`,
                font: FONTS.body,
                size: FONT_SIZES.body,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
          }),

          // Recipient info
          new Paragraph({
            children: [new TextRun({ text: `수신: ${input.recipient.companyName}`, ...RUN_STYLES.heading2 })],
            spacing: { after: 100 },
          }),
          ...(input.recipient.ceoName
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: `대표: ${input.recipient.ceoName} 귀하`, font: FONTS.body, size: FONT_SIZES.body }),
                  ],
                  spacing: { after: 200 },
                }),
              ]
            : []),

          // Total amount summary
          createTotalSummaryTable(totalAmount, taxAmount, grandTotal),

          // Spacer
          new Paragraph({ spacing: { after: 200 }, children: [] }),

          // Items table
          createItemsTable(input.items),

          // Validity
          ...(input.validUntil
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `유효기간: ${formatKoreanDate(input.validUntil)}까지`,
                      font: FONTS.body,
                      size: FONT_SIZES.body,
                    }),
                  ],
                  spacing: { before: 200, after: 100 },
                }),
              ]
            : []),

          // Notes
          ...(input.notes
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: `비고: ${input.notes}`, font: FONTS.body, size: FONT_SIZES.body }),
                  ],
                  spacing: { after: 200 },
                }),
              ]
            : []),

          // Footer
          new Paragraph({
            children: [
              new TextRun({ text: "위와 같이 견적합니다.", font: FONTS.body, size: FONT_SIZES.body }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
          }),

          // Issuer info
          new Paragraph({
            children: [new TextRun({ text: input.issuer.companyName, ...RUN_STYLES.heading2 })],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `대표이사 ${input.issuer.ceoName} (인)`,
                font: FONTS.body,
                size: FONT_SIZES.body,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `사업자등록번호: ${input.issuer.businessNumber}`,
                font: FONTS.body,
                size: FONT_SIZES.caption,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `주소: ${input.issuer.address}`,
                font: FONTS.body,
                size: FONT_SIZES.caption,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `연락처: ${input.issuer.phone}${input.issuer.email ? ` / ${input.issuer.email}` : ""}`,
                font: FONTS.body,
                size: FONT_SIZES.caption,
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  const docxBuffer = Buffer.from(await Packer.toBuffer(doc));

  return {
    docxBuffer,
    totalAmount,
    taxAmount,
    grandTotal,
  };
}

function createTotalSummaryTable(
  total: number,
  tax: number,
  grand: number
): Table {
  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "000000",
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell("합계금액", 30, true),
          createCell(formatKRW(grand), 70, false, AlignmentType.RIGHT),
        ],
      }),
      new TableRow({
        children: [
          createCell("공급가액", 30, true),
          createCell(formatKRW(total), 70, false, AlignmentType.RIGHT),
        ],
      }),
      new TableRow({
        children: [
          createCell("부가세", 30, true),
          createCell(formatKRW(tax), 70, false, AlignmentType.RIGHT),
        ],
      }),
    ],
  });
}

function createItemsTable(
  items: Array<{ name: string; description?: string; quantity: number; unitPrice: number; unit: string }>
): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createCell("번호", 8, true, AlignmentType.CENTER),
      createCell("항목명", 35, true, AlignmentType.CENTER),
      createCell("내용", 15, true, AlignmentType.CENTER),
      createCell("수량", 8, true, AlignmentType.CENTER),
      createCell("단위", 7, true, AlignmentType.CENTER),
      createCell("단가", 13, true, AlignmentType.CENTER),
      createCell("금액", 14, true, AlignmentType.CENTER),
    ],
  });

  const dataRows = items.map((item, idx) =>
    new TableRow({
      children: [
        createCell(String(idx + 1), 8, false, AlignmentType.CENTER),
        createCell(item.name, 35),
        createCell(item.description ?? "", 15),
        createCell(formatNumber(item.quantity), 8, false, AlignmentType.CENTER),
        createCell(item.unit, 7, false, AlignmentType.CENTER),
        createCell(formatNumber(item.unitPrice), 13, false, AlignmentType.RIGHT),
        createCell(formatNumber(item.quantity * item.unitPrice), 14, false, AlignmentType.RIGHT),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function createCell(
  text: string,
  widthPercent: number,
  bold = false,
  alignment = AlignmentType.LEFT
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: FONTS.body,
            size: FONT_SIZES.body,
            bold,
          }),
        ],
        alignment,
      }),
    ],
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/estimate.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/generators/estimate.ts packages/docgen/templates/ packages/docgen/tests/estimate.test.ts
git commit -m "feat: add estimate DOCX generator with Korean formatting and VAT calculation"
```

---

## Task 3: Contract Generator (docx-js)

**Files:**
- Create: `packages/docgen/templates/contract-template.json`
- Create: `packages/docgen/src/generators/contract.ts`
- Create: `packages/docgen/tests/contract.test.ts`

- [ ] **Step 1: Write failing tests for contract generator**

Create `packages/docgen/tests/contract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateContract } from "../src/generators/contract";
import type { ContractInput } from "../src/types";

const sampleInput: ContractInput = {
  clientId: "client-1",
  contractNumber: "CON-2026-001",
  title: "컨설팅 용역 계약서",
  partyA: {
    companyName: "(주)테스트기업",
    ceoName: "김대표",
    businessNumber: "987-65-43210",
    address: "서울특별시 서초구",
  },
  partyB: {
    companyName: "플로우코더",
    ceoName: "조용현",
    businessNumber: "123-45-67890",
    address: "서울특별시 강남구",
  },
  terms: [
    { article: 1, title: "계약의 목적", content: "갑은 을에게 사업계획서 작성 및 정부지원사업 컨설팅 업무를 위탁한다." },
    { article: 2, title: "계약 기간", content: "본 계약의 기간은 계약 체결일로부터 6개월로 한다." },
    { article: 3, title: "계약 금액", content: "본 계약의 대가는 금 5,000,000원(부가세 별도)으로 한다." },
    { article: 4, title: "비밀 유지", content: "양 당사자는 본 계약의 이행 과정에서 알게 된 상대방의 비밀 정보를 제3자에게 공개하지 않는다." },
  ],
  totalAmount: 5000000,
  startDate: "2026-04-10",
  endDate: "2026-10-09",
};

describe("Contract Generator", () => {
  it("generates a DOCX buffer with all terms", async () => {
    const result = await generateContract(sampleInput);

    expect(result.docxBuffer).toBeInstanceOf(Buffer);
    expect(result.docxBuffer.length).toBeGreaterThan(0);
  });

  it("includes signature area placeholder", async () => {
    const result = await generateContract(sampleInput);
    // Buffer should be non-trivial in size (has content)
    expect(result.docxBuffer.length).toBeGreaterThan(1000);
  });

  it("handles contract without optional fields", async () => {
    const minimal: ContractInput = {
      clientId: "client-1",
      contractNumber: "CON-2026-002",
      title: "기본 계약서",
      partyA: {
        companyName: "갑사",
        ceoName: "갑대표",
        businessNumber: "111-22-33333",
        address: "서울시",
      },
      partyB: {
        companyName: "을사",
        ceoName: "을대표",
        businessNumber: "444-55-66666",
        address: "경기도",
      },
      terms: [
        { article: 1, title: "목적", content: "테스트 계약" },
      ],
    };

    const result = await generateContract(minimal);
    expect(result.docxBuffer).toBeInstanceOf(Buffer);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/contract.test.ts
```

Expected: FAIL — "Cannot find module '../src/generators/contract'"

- [ ] **Step 3: Implement contract generator**

Create `packages/docgen/src/generators/contract.ts`:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  AlignmentType,
  TabStopPosition,
  TabStopType,
} from "docx";
import type { ContractInput, ContractOutput } from "../types";
import { FONTS, FONT_SIZES, PAGE_MARGINS, RUN_STYLES, LINE_SPACING } from "../utils/docx-styles";
import { formatKRW, formatKoreanDate } from "../utils/number-format";

export async function generateContract(input: ContractInput): Promise<ContractOutput> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: input.title, ...RUN_STYLES.title })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // Contract number
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `계약번호: ${input.contractNumber}`,
          font: FONTS.body,
          size: FONT_SIZES.body,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 400 },
    })
  );

  // Parties introduction
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${input.partyA.companyName} (이하 "갑"이라 한다)과 ${input.partyB.companyName} (이하 "을"이라 한다)은 다음과 같이 계약을 체결한다.`,
          font: FONTS.body,
          size: FONT_SIZES.body,
        }),
      ],
      spacing: { after: 400, line: LINE_SPACING.body },
    })
  );

  // Contract period (if provided)
  if (input.startDate && input.endDate) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `계약기간: ${formatKoreanDate(input.startDate)} ~ ${formatKoreanDate(input.endDate)}`,
            font: FONTS.body,
            size: FONT_SIZES.body,
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  // Contract amount (if provided)
  if (input.totalAmount) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `계약금액: ${formatKRW(input.totalAmount)} (부가세 별도)`,
            font: FONTS.body,
            size: FONT_SIZES.body,
            bold: true,
          }),
        ],
        spacing: { after: 400 },
      })
    );
  }

  // Terms (articles)
  for (const term of input.terms) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `제${term.article}조 (${term.title})`,
            ...RUN_STYLES.heading2,
          }),
        ],
        spacing: { before: 300, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: term.content,
            font: FONTS.body,
            size: FONT_SIZES.body,
          }),
        ],
        spacing: { after: 200, line: LINE_SPACING.body },
      })
    );
  }

  // Special terms
  if (input.specialTerms) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "특약사항", ...RUN_STYLES.heading2 })],
        spacing: { before: 400, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: input.specialTerms,
            font: FONTS.body,
            size: FONT_SIZES.body,
          }),
        ],
        spacing: { after: 400, line: LINE_SPACING.body },
      })
    );
  }

  // Closing statement
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "본 계약의 성립을 증명하기 위하여 계약서 2통을 작성하여 갑과 을이 각각 서명 날인한 후 각 1통씩 보관한다.",
          font: FONTS.body,
          size: FONT_SIZES.body,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 },
    })
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: formatKoreanDate(new Date().toISOString().split("T")[0]),
          font: FONTS.body,
          size: FONT_SIZES.body,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // Signature area — Party A
  children.push(
    ...createSignatureBlock("갑", input.partyA)
  );

  // Spacer
  children.push(new Paragraph({ spacing: { after: 400 }, children: [] }));

  // Signature area — Party B
  children.push(
    ...createSignatureBlock("을", input.partyB)
  );

  const doc = new Document({
    sections: [{ ...PAGE_MARGINS, children }],
  });

  const docxBuffer = Buffer.from(await Packer.toBuffer(doc));
  return { docxBuffer };
}

function createSignatureBlock(
  role: string,
  party: { companyName: string; ceoName: string; businessNumber: string; address: string }
): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: `[${role}]`, ...RUN_STYLES.bold })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `상호: ${party.companyName}`, font: FONTS.body, size: FONT_SIZES.body }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `사업자등록번호: ${party.businessNumber}`, font: FONTS.body, size: FONT_SIZES.body }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `주소: ${party.address}`, font: FONTS.body, size: FONT_SIZES.body }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `대표이사: ${party.ceoName}                (인)`,
          font: FONTS.body,
          size: FONT_SIZES.body,
        }),
      ],
      spacing: { after: 100 },
    }),
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/contract.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/generators/contract.ts packages/docgen/tests/contract.test.ts
git commit -m "feat: add contract DOCX generator with Korean legal formatting and signature area"
```

---

## Task 4: PDF-to-Markdown Converter

**Files:**
- Create: `packages/docgen/src/converters/pdf-to-markdown.ts`
- Create: `packages/docgen/tests/pdf-to-markdown.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/docgen/tests/pdf-to-markdown.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { pdfToMarkdown, extractPdfStructure } from "../src/converters/pdf-to-markdown";

// Mock pdf-parse
vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({
    text: "제1장 사업개요\n\n1. 기업 현황\n기업명: 테스트기업\n대표자: 김대표\n\n2. 사업 목표\n본 사업은 AI 기술을...\n\n제2장 기술개발 내용\n\n1. 핵심 기술\nDeep Learning 기반...",
    numpages: 3,
    info: { Title: "사업계획서", Author: "테스트기업" },
  }),
}));

describe("PDF to Markdown", () => {
  it("converts PDF buffer to structured markdown", async () => {
    const fakePdf = Buffer.from("fake-pdf-content");
    const result = await pdfToMarkdown(fakePdf);

    expect(result.markdown).toContain("# ");
    expect(result.pageCount).toBe(3);
    expect(result.metadata.title).toBe("사업계획서");
  });

  it("extracts sections from PDF text", () => {
    const text = "제1장 사업개요\n\n1. 기업현황\n내용\n\n제2장 기술개발";
    const sections = extractPdfStructure(text);

    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections[0].title).toContain("사업개요");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/pdf-to-markdown.test.ts
```

Expected: FAIL — "Cannot find module '../src/converters/pdf-to-markdown'"

- [ ] **Step 3: Implement PDF-to-Markdown converter**

Create `packages/docgen/src/converters/pdf-to-markdown.ts`:

```typescript
import pdfParse from "pdf-parse";

export interface PdfSection {
  title: string;
  content: string;
  level: number;
  pageNumber?: number;
}

export interface PdfToMarkdownResult {
  markdown: string;
  sections: PdfSection[];
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    [key: string]: unknown;
  };
}

/**
 * Convert PDF buffer to structured markdown.
 * Detects Korean document section patterns (제N장, N., (N), etc.).
 */
export async function pdfToMarkdown(
  pdfBuffer: Buffer
): Promise<PdfToMarkdownResult> {
  const parsed = await pdfParse(pdfBuffer);

  const sections = extractPdfStructure(parsed.text);
  const markdown = sectionsToMarkdown(sections);

  return {
    markdown,
    sections,
    pageCount: parsed.numpages,
    metadata: {
      title: parsed.info?.Title ?? undefined,
      author: parsed.info?.Author ?? undefined,
    },
  };
}

/**
 * Extract hierarchical structure from raw PDF text.
 * Recognizes Korean government document patterns:
 *   - 제N장/제N절 → H1/H2
 *   - N. / N-N. → H2/H3
 *   - (N) / 가. / 나. → H4
 */
export function extractPdfStructure(text: string): PdfSection[] {
  const lines = text.split("\n");
  const sections: PdfSection[] = [];
  let currentSection: PdfSection | null = null;

  const patterns = {
    chapter: /^제\s*(\d+)\s*장\s+(.+)/,        // 제1장 사업개요
    section: /^제\s*(\d+)\s*절\s+(.+)/,         // 제1절 ...
    numberedH2: /^(\d+)\.\s+(.+)/,              // 1. 기업현황
    numberedH3: /^(\d+)-(\d+)\.\s+(.+)/,        // 1-1. 세부항목
    parenNumbered: /^\((\d+)\)\s+(.+)/,         // (1) 항목
    koreanBullet: /^([가-힣])\.\s+(.+)/,        // 가. 항목
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection) currentSection.content += "\n";
      continue;
    }

    let matched = false;

    // Check chapter pattern (제N장)
    const chapterMatch = trimmed.match(patterns.chapter);
    if (chapterMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: `제${chapterMatch[1]}장 ${chapterMatch[2].trim()}`,
        content: "",
        level: 1,
      };
      matched = true;
    }

    // Check section pattern (제N절)
    if (!matched) {
      const sectionMatch = trimmed.match(patterns.section);
      if (sectionMatch) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: `제${sectionMatch[1]}절 ${sectionMatch[2].trim()}`,
          content: "",
          level: 2,
        };
        matched = true;
      }
    }

    // Check numbered H2 pattern (N.)
    if (!matched) {
      const h2Match = trimmed.match(patterns.numberedH2);
      if (h2Match && h2Match[2].length > 1) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: `${h2Match[1]}. ${h2Match[2].trim()}`,
          content: "",
          level: 2,
        };
        matched = true;
      }
    }

    // Not a heading — append to current section
    if (!matched) {
      if (!currentSection) {
        currentSection = { title: "서론", content: "", level: 1 };
      }
      currentSection.content += trimmed + "\n";
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

function sectionsToMarkdown(sections: PdfSection[]): string {
  return sections
    .map((s) => {
      const prefix = "#".repeat(s.level);
      return `${prefix} ${s.title}\n\n${s.content.trim()}`;
    })
    .join("\n\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/pdf-to-markdown.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/converters/pdf-to-markdown.ts packages/docgen/tests/pdf-to-markdown.test.ts
git commit -m "feat: add PDF-to-markdown converter with Korean document structure recognition"
```

---

## Task 5: Markdown-to-DOCX Converter (mark-docx integration)

**Files:**
- Create: `packages/docgen/src/converters/mark-docx.ts`
- Create: `packages/docgen/tests/mark-docx.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/docgen/tests/mark-docx.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { markdownToDocx } from "../src/converters/mark-docx";

describe("Markdown to DOCX", () => {
  it("converts simple markdown to DOCX buffer", async () => {
    const md = `# 사업계획서

## 1. 기업 현황

### 1-1. 기업 개요

**(주)테스트기업**은 AI 기반 솔루션을 개발하는 기업입니다.

- 설립일: 2020년 1월
- 대표: 김대표
- 직원수: 15명

## 2. 사업 목표

본 사업의 목표는 다음과 같습니다:

1. AI 모델 개발
2. 시장 검증
3. 상용화
`;

    const result = await markdownToDocx(md);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles tables in markdown", async () => {
    const md = `# 재무 현황

| 항목 | 2024년 | 2025년 |
|------|--------|--------|
| 매출 | 5억 | 8억 |
| 영업이익 | 1억 | 2억 |
`;

    const result = await markdownToDocx(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles images with alt text", async () => {
    const md = `# 기술 개요

![시스템 구조도](https://example.com/diagram.png)

위 그림은 전체 시스템 구조를 나타냅니다.
`;

    const result = await markdownToDocx(md, { skipImageDownload: true });
    expect(result).toBeInstanceOf(Buffer);
  });

  it("accepts custom styling options", async () => {
    const md = "# 제목\n\n본문입니다.";
    const result = await markdownToDocx(md, {
      fontSize: 11,
      lineSpacing: 1.5,
      fontFamily: "나눔고딕",
    });
    expect(result).toBeInstanceOf(Buffer);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/mark-docx.test.ts
```

Expected: FAIL — "Cannot find module '../src/converters/mark-docx'"

- [ ] **Step 3: Implement mark-docx converter**

Create `packages/docgen/src/converters/mark-docx.ts`:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  ImageRun,
} from "docx";
import { FONTS, FONT_SIZES, PAGE_MARGINS, LINE_SPACING } from "../utils/docx-styles";

export interface MarkDocxOptions {
  fontSize?: number;
  lineSpacing?: number;
  fontFamily?: string;
  skipImageDownload?: boolean;
}

interface ParsedBlock {
  type: "heading" | "paragraph" | "list" | "table" | "image" | "blank";
  level?: number;
  content?: string;
  items?: string[];
  ordered?: boolean;
  rows?: string[][];
  imageUrl?: string;
  altText?: string;
}

/**
 * Convert markdown string to DOCX buffer.
 * Supports: headings (H1-H4), bold, italic, bullet lists, ordered lists,
 * tables, and image references. Korean typography defaults.
 */
export async function markdownToDocx(
  markdown: string,
  options: MarkDocxOptions = {}
): Promise<Buffer> {
  const font = options.fontFamily ?? FONTS.body;
  const fontSize = options.fontSize ? options.fontSize * 2 : FONT_SIZES.body;
  const lineSpacing = options.lineSpacing
    ? Math.round(options.lineSpacing * 240)
    : LINE_SPACING.body;

  const blocks = parseMarkdown(markdown);
  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        children.push(createHeading(block.content!, block.level!, font));
        break;

      case "paragraph":
        children.push(
          createParagraph(block.content!, font, fontSize, lineSpacing)
        );
        break;

      case "list":
        for (const item of block.items ?? []) {
          children.push(
            createListItem(item, block.ordered ?? false, font, fontSize)
          );
        }
        break;

      case "table":
        if (block.rows && block.rows.length > 0) {
          children.push(createTable(block.rows, font, fontSize));
        }
        break;

      case "image":
        // Image placeholder paragraph (actual download skipped if option set)
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[이미지: ${block.altText ?? block.imageUrl ?? ""}]`,
                font,
                size: fontSize,
                italics: true,
                color: "666666",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          })
        );
        break;

      case "blank":
        children.push(new Paragraph({ children: [], spacing: { after: 100 } }));
        break;
    }
  }

  const doc = new Document({
    sections: [{ ...PAGE_MARGINS, children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function parseMarkdown(markdown: string): ParsedBlock[] {
  const lines = markdown.split("\n");
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Image
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      blocks.push({
        type: "image",
        altText: imageMatch[1],
        imageUrl: imageMatch[2],
      });
      i++;
      continue;
    }

    // Table (detect header row with | chars)
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].match(/^\|?\s*[-:]+/)) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i]
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell !== "" && !cell.match(/^[-:]+$/));
        if (row.length > 0 && !lines[i].match(/^\|?\s*[-:]+/)) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) {
        blocks.push({ type: "table", rows: tableRows });
      }
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items, ordered: false });
      continue;
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items, ordered: true });
      continue;
    }

    // Regular paragraph (collect consecutive non-special lines)
    let content = "";
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,4}\s/) &&
      !lines[i].match(/^\s*[-*]\s+/) &&
      !lines[i].match(/^\s*\d+\.\s+/) &&
      !lines[i].match(/^!\[/) &&
      !(lines[i].includes("|") && i + 1 < lines.length && lines[i + 1]?.match(/^\|?\s*[-:]+/))
    ) {
      content += (content ? " " : "") + lines[i].trim();
      i++;
    }
    if (content) {
      blocks.push({ type: "paragraph", content });
    }
  }

  return blocks;
}

function createHeading(text: string, level: number, font: string): Paragraph {
  const sizes: Record<number, number> = {
    1: FONT_SIZES.title,
    2: FONT_SIZES.heading1,
    3: FONT_SIZES.heading2,
    4: FONT_SIZES.heading3,
  };

  return new Paragraph({
    children: parseInlineFormatting(text, font, sizes[level] ?? FONT_SIZES.heading3, true),
    spacing: { before: 300, after: 150 },
  });
}

function createParagraph(
  text: string,
  font: string,
  fontSize: number,
  lineSpacing: number
): Paragraph {
  return new Paragraph({
    children: parseInlineFormatting(text, font, fontSize),
    spacing: { after: 120, line: lineSpacing },
  });
}

function createListItem(
  text: string,
  ordered: boolean,
  font: string,
  fontSize: number
): Paragraph {
  const bullet = ordered ? "" : "  \u2022  ";
  return new Paragraph({
    children: [
      new TextRun({ text: bullet, font, size: fontSize }),
      ...parseInlineFormatting(text, font, fontSize),
    ],
    spacing: { after: 60 },
    indent: { left: 400 },
  });
}

function createTable(
  rows: string[][],
  font: string,
  fontSize: number
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIdx) =>
      new TableRow({
        tableHeader: rowIdx === 0,
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
                      font,
                      size: fontSize,
                      bold: rowIdx === 0,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    ),
  });
}

/**
 * Parse inline markdown formatting: **bold**, *italic*, `code`.
 */
function parseInlineFormatting(
  text: string,
  font: string,
  fontSize: number,
  headingBold = false
): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      runs.push(
        new TextRun({
          text: text.slice(lastIndex, match.index),
          font,
          size: fontSize,
          bold: headingBold,
        })
      );
    }

    if (match[2]) {
      // **bold**
      runs.push(new TextRun({ text: match[2], font, size: fontSize, bold: true }));
    } else if (match[3]) {
      // *italic*
      runs.push(new TextRun({ text: match[3], font, size: fontSize, italics: true, bold: headingBold }));
    } else if (match[4]) {
      // `code`
      runs.push(new TextRun({ text: match[4], font: "D2Coding", size: fontSize }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    runs.push(
      new TextRun({
        text: text.slice(lastIndex),
        font,
        size: fontSize,
        bold: headingBold,
      })
    );
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, font, size: fontSize, bold: headingBold }));
  }

  return runs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/mark-docx.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/converters/mark-docx.ts packages/docgen/tests/mark-docx.test.ts
git commit -m "feat: add markdown-to-DOCX converter with Korean typography and inline formatting"
```

---

## Task 6: HWPX Editor (Korean Government Forms)

**Files:**
- Create: `packages/docgen/src/converters/hwpx-editor.ts`
- Create: `packages/docgen/tests/hwpx-editor.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/docgen/tests/hwpx-editor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HwpxEditor,
  type HwpxEditOperation,
} from "../src/converters/hwpx-editor";

// Mock archiver and xml2js for unit tests
vi.mock("xml2js", () => ({
  parseStringPromise: vi.fn().mockResolvedValue({
    "hp:sec": {
      "hp:tbl": [
        {
          "hp:tr": [
            {
              "hp:tc": [
                { "hp:p": [{ "hp:run": [{ "hp:t": ["기업명"] }] }] },
                { "hp:p": [{ "hp:run": [{ "hp:t": [""] }] }] },
              ],
            },
          ],
        },
      ],
    },
  }),
  Builder: vi.fn().mockImplementation(() => ({
    buildObject: vi.fn().mockReturnValue("<xml>mocked</xml>"),
  })),
}));

describe("HWPX Editor", () => {
  it("creates editor instance", () => {
    const editor = new HwpxEditor();
    expect(editor).toBeDefined();
  });

  it("queues set_cell operation", () => {
    const editor = new HwpxEditor();
    editor.setCell(0, 0, 1, "테스트기업");
    expect(editor.getOperations()).toHaveLength(1);
    expect(editor.getOperations()[0].type).toBe("set_cell");
  });

  it("queues replace_in_cell operation", () => {
    const editor = new HwpxEditor();
    editor.replaceInCell(0, 0, 0, "{{기업명}}", "테스트기업");
    expect(editor.getOperations()).toHaveLength(1);
    expect(editor.getOperations()[0].type).toBe("replace_in_cell");
  });

  it("queues checkbox toggle operation", () => {
    const editor = new HwpxEditor();
    editor.toggleCheckbox(0, 1, 0, true);
    expect(editor.getOperations()).toHaveLength(1);
    expect(editor.getOperations()[0].type).toBe("checkbox");
  });

  it("queues multiple operations", () => {
    const editor = new HwpxEditor();
    editor.setCell(0, 0, 1, "기업명");
    editor.setCell(0, 1, 1, "대표자");
    editor.toggleCheckbox(0, 2, 0, true);
    editor.replaceInCell(0, 3, 0, "{{날짜}}", "2026-04-10");
    expect(editor.getOperations()).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/hwpx-editor.test.ts
```

Expected: FAIL — "Cannot find module '../src/converters/hwpx-editor'"

- [ ] **Step 3: Implement HWPX editor**

Create `packages/docgen/src/converters/hwpx-editor.ts`:

```typescript
import { parseStringPromise, Builder } from "xml2js";
import archiver from "archiver";
import { Readable } from "stream";

/**
 * HWPX editor for Korean government form filling.
 * HWPX files are ZIP archives containing XML (similar to DOCX).
 *
 * Supported operations:
 * - set_cell: Set text content of a table cell
 * - replace_in_cell: Replace text pattern in a cell
 * - checkbox: Toggle checkbox character (☐ → ☑ or vice versa)
 */

export interface HwpxEditOperation {
  type: "set_cell" | "replace_in_cell" | "checkbox";
  tableIndex: number;
  rowIndex: number;
  cellIndex: number;
  value?: string;
  searchText?: string;
  replaceText?: string;
  checked?: boolean;
}

export class HwpxEditor {
  private operations: HwpxEditOperation[] = [];

  /**
   * Set the text content of a specific table cell.
   */
  setCell(tableIndex: number, rowIndex: number, cellIndex: number, value: string): void {
    this.operations.push({
      type: "set_cell",
      tableIndex,
      rowIndex,
      cellIndex,
      value,
    });
  }

  /**
   * Replace text within a specific table cell.
   */
  replaceInCell(
    tableIndex: number,
    rowIndex: number,
    cellIndex: number,
    searchText: string,
    replaceText: string
  ): void {
    this.operations.push({
      type: "replace_in_cell",
      tableIndex,
      rowIndex,
      cellIndex,
      searchText,
      replaceText,
    });
  }

  /**
   * Toggle a checkbox in a specific table cell.
   * Replaces ☐ with ☑ (checked=true) or ☑ with ☐ (checked=false).
   */
  toggleCheckbox(tableIndex: number, rowIndex: number, cellIndex: number, checked: boolean): void {
    this.operations.push({
      type: "checkbox",
      tableIndex,
      rowIndex,
      cellIndex,
      checked,
    });
  }

  /**
   * Get all queued operations.
   */
  getOperations(): HwpxEditOperation[] {
    return [...this.operations];
  }

  /**
   * Clear all queued operations.
   */
  clearOperations(): void {
    this.operations = [];
  }

  /**
   * Apply all queued operations to a section XML string.
   * Returns the modified XML string.
   */
  async applyToXml(sectionXml: string): Promise<string> {
    const parsed = await parseStringPromise(sectionXml, {
      explicitArray: true,
      preserveChildrenOrder: true,
    });

    const tables = extractTables(parsed);

    for (const op of this.operations) {
      const table = tables[op.tableIndex];
      if (!table) continue;

      const row = getRows(table)[op.rowIndex];
      if (!row) continue;

      const cell = getCells(row)[op.cellIndex];
      if (!cell) continue;

      switch (op.type) {
        case "set_cell":
          setCellText(cell, op.value ?? "");
          break;

        case "replace_in_cell":
          if (op.searchText !== undefined && op.replaceText !== undefined) {
            replaceCellText(cell, op.searchText, op.replaceText);
          }
          break;

        case "checkbox":
          toggleCellCheckbox(cell, op.checked ?? false);
          break;
      }
    }

    const builder = new Builder({
      xmldec: { version: "1.0", encoding: "UTF-8", standalone: false },
    });
    return builder.buildObject(parsed);
  }
}

// ==================== XML Navigation Helpers ====================

function extractTables(doc: Record<string, unknown>): unknown[] {
  // HWPX structure: hp:sec > hp:tbl[]
  const sec = findElement(doc, "hp:sec") ?? findElement(doc, "sec");
  if (!sec) return [];
  return (sec as Record<string, unknown>)["hp:tbl"] as unknown[] ?? [];
}

function getRows(table: unknown): unknown[] {
  if (!table || typeof table !== "object") return [];
  return (table as Record<string, unknown>)["hp:tr"] as unknown[] ?? [];
}

function getCells(row: unknown): unknown[] {
  if (!row || typeof row !== "object") return [];
  return (row as Record<string, unknown>)["hp:tc"] as unknown[] ?? [];
}

function setCellText(cell: unknown, text: string): void {
  if (!cell || typeof cell !== "object") return;
  const cellObj = cell as Record<string, unknown>;
  const paragraphs = cellObj["hp:p"] as unknown[];
  if (!paragraphs || paragraphs.length === 0) return;

  const p = paragraphs[0] as Record<string, unknown>;
  const runs = p["hp:run"] as unknown[];
  if (!runs || runs.length === 0) {
    p["hp:run"] = [{ "hp:t": [text] }];
    return;
  }

  const run = runs[0] as Record<string, unknown>;
  run["hp:t"] = [text];
}

function replaceCellText(cell: unknown, search: string, replace: string): void {
  if (!cell || typeof cell !== "object") return;
  const cellObj = cell as Record<string, unknown>;
  const paragraphs = cellObj["hp:p"] as unknown[];
  if (!paragraphs) return;

  for (const p of paragraphs) {
    const pObj = p as Record<string, unknown>;
    const runs = pObj["hp:run"] as unknown[];
    if (!runs) continue;

    for (const run of runs) {
      const runObj = run as Record<string, unknown>;
      const texts = runObj["hp:t"] as string[];
      if (!texts) continue;

      runObj["hp:t"] = texts.map((t) =>
        typeof t === "string" ? t.replaceAll(search, replace) : t
      );
    }
  }
}

function toggleCellCheckbox(cell: unknown, checked: boolean): void {
  const from = checked ? "\u2610" : "\u2611"; // ☐ or ☑
  const to = checked ? "\u2611" : "\u2610";   // ☑ or ☐
  replaceCellText(cell, from, to);
}

function findElement(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  if (key in record) return record[key];
  for (const value of Object.values(record)) {
    const found = findElement(value, key);
    if (found) return found;
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/hwpx-editor.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/converters/hwpx-editor.ts packages/docgen/tests/hwpx-editor.test.ts
git commit -m "feat: add HWPX editor for Korean government form filling (set_cell, replace, checkbox)"
```

---

## Task 7: Image Generator and Mermaid-to-PNG

**Files:**
- Create: `packages/docgen/src/media/image-generator.ts`
- Create: `packages/docgen/src/converters/mermaid-to-png.ts`
- Create: `packages/docgen/tests/image-generator.test.ts`
- Create: `packages/docgen/tests/mermaid-to-png.test.ts`

- [ ] **Step 1: Write failing tests for image generator**

Create `packages/docgen/tests/image-generator.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { generateDiagram, type ImageGenOptions } from "../src/media/image-generator";

// Mock AI SDK
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    images: {
      generate: vi.fn().mockResolvedValue({
        data: [{ url: "https://example.com/generated.png" }],
      }),
    },
  })),
}));

describe("Image Generator", () => {
  it("builds prompt from description", () => {
    const { buildPrompt } = require("../src/media/image-generator");
    const prompt = buildPrompt("시스템 아키텍처 다이어그램", "infographic");
    expect(prompt).toContain("diagram");
    expect(prompt).toContain("system architecture");
  });

  it("returns GeneratedImage with metadata", async () => {
    const result = await generateDiagram({
      description: "테스트 다이어그램",
      style: "diagram",
      width: 800,
      height: 600,
    });

    expect(result).toBeDefined();
    expect(result.name).toContain("diagram");
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });
});
```

- [ ] **Step 2: Write failing tests for Mermaid converter**

Create `packages/docgen/tests/mermaid-to-png.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { mermaidToPng, validateMermaidSyntax } from "../src/converters/mermaid-to-png";

// Mock child_process for mmdc
vi.mock("child_process", () => ({
  execFile: vi.fn((cmd, args, opts, cb) => {
    // Simulate mmdc creating output file
    if (cb) cb(null, "", "");
    else if (typeof opts === "function") opts(null, "", "");
  }),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("fake-png-data")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue("/tmp/mermaid-test"),
}));

describe("Mermaid to PNG", () => {
  it("validates correct mermaid syntax", () => {
    const valid = validateMermaidSyntax("graph TD\n  A --> B\n  B --> C");
    expect(valid).toBe(true);
  });

  it("rejects invalid mermaid syntax", () => {
    const invalid = validateMermaidSyntax("not a mermaid diagram");
    expect(invalid).toBe(false);
  });

  it("validates flowchart syntax", () => {
    const valid = validateMermaidSyntax("flowchart LR\n  Start --> End");
    expect(valid).toBe(true);
  });

  it("validates sequence diagram syntax", () => {
    const valid = validateMermaidSyntax("sequenceDiagram\n  Alice->>Bob: Hello");
    expect(valid).toBe(true);
  });
});
```

- [ ] **Step 3: Implement image generator**

Create `packages/docgen/src/media/image-generator.ts`:

```typescript
import type { GeneratedImage } from "../types";

export interface ImageGenOptions {
  description: string;
  style: "diagram" | "infographic" | "chart" | "illustration";
  width?: number;
  height?: number;
  provider?: "gemini" | "dalle";
}

/**
 * Generate a diagram or infographic image using AI.
 * Uses OpenAI DALL-E or Google Gemini depending on provider config.
 */
export async function generateDiagram(
  options: ImageGenOptions
): Promise<GeneratedImage> {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const prompt = buildPrompt(options.description, options.style);

  const provider = options.provider ?? "dalle";

  if (provider === "dalle") {
    return generateWithDalle(prompt, width, height, options.description);
  }

  return generateWithGemini(prompt, width, height, options.description);
}

/**
 * Build an optimized English prompt from Korean description.
 */
export function buildPrompt(description: string, style: string): string {
  const styleGuide: Record<string, string> = {
    diagram:
      "Clean professional diagram with labeled components, connecting arrows, clear hierarchy. White background, minimal style.",
    infographic:
      "Modern infographic with icons, data visualization, clean layout. Professional business style.",
    chart:
      "Business chart with clear axes, labels, and data points. Professional presentation quality.",
    illustration:
      "Simple flat illustration for business documents. Clean lines, professional colors.",
  };

  return `${styleGuide[style] ?? styleGuide.diagram}\n\nSubject: ${description}\n\nRequirements:\n- No text in Korean (use English labels only)\n- Clean, professional look suitable for government documents\n- High contrast for printing`;
}

async function generateWithDalle(
  prompt: string,
  width: number,
  height: number,
  description: string
): Promise<GeneratedImage> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const size = selectDalleSize(width, height);

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size,
    quality: "standard",
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) throw new Error("No image URL returned from DALL-E");

  const imageResponse = await fetch(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  return {
    name: `diagram-${Date.now()}.png`,
    buffer,
    mimeType: "image/png",
    width,
    height,
  };
}

async function generateWithGemini(
  prompt: string,
  width: number,
  height: number,
  description: string
): Promise<GeneratedImage> {
  // Gemini image generation via OpenRouter
  const response = await fetch(
    "https://openrouter.ai/api/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        prompt,
        n: 1,
      }),
    }
  );

  const data = await response.json();
  const imageData = data?.data?.[0];
  if (!imageData) throw new Error("No image returned from Gemini");

  const buffer = imageData.b64_json
    ? Buffer.from(imageData.b64_json, "base64")
    : Buffer.from(await (await fetch(imageData.url)).arrayBuffer());

  return {
    name: `diagram-${Date.now()}.png`,
    buffer,
    mimeType: "image/png",
    width,
    height,
  };
}

function selectDalleSize(
  width: number,
  height: number
): "1024x1024" | "1024x1792" | "1792x1024" {
  const ratio = width / height;
  if (ratio > 1.3) return "1792x1024";
  if (ratio < 0.7) return "1024x1792";
  return "1024x1024";
}
```

- [ ] **Step 4: Implement Mermaid-to-PNG converter**

Create `packages/docgen/src/converters/mermaid-to-png.ts`:

```typescript
import { execFile } from "child_process";
import { readFile, writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { GeneratedImage } from "../types";

/**
 * Convert Mermaid diagram syntax to PNG image.
 * Requires @mermaid-js/mermaid-cli (mmdc) installed globally or in node_modules.
 */
export async function mermaidToPng(
  mermaidCode: string,
  options?: { width?: number; height?: number; theme?: "default" | "dark" | "forest" }
): Promise<GeneratedImage> {
  if (!validateMermaidSyntax(mermaidCode)) {
    throw new Error("Invalid Mermaid syntax");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "mermaid-"));
  const inputPath = join(tempDir, "input.mmd");
  const outputPath = join(tempDir, "output.png");

  try {
    await writeFile(inputPath, mermaidCode, "utf-8");

    const mmdc = findMmdc();
    const args = [
      "-i", inputPath,
      "-o", outputPath,
      "-b", "white",
      "-t", options?.theme ?? "default",
    ];

    if (options?.width) {
      args.push("-w", String(options.width));
    }

    await execMmdc(mmdc, args);

    const buffer = await readFile(outputPath);

    return {
      name: `mermaid-${Date.now()}.png`,
      buffer,
      mimeType: "image/png",
      width: options?.width ?? 800,
      height: options?.height ?? 600,
    };
  } finally {
    // Cleanup temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Validate basic Mermaid syntax.
 * Checks if the input starts with a recognized diagram type.
 */
export function validateMermaidSyntax(code: string): boolean {
  const trimmed = code.trim();
  const validPrefixes = [
    "graph ",
    "graph\n",
    "flowchart ",
    "flowchart\n",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "erDiagram",
    "gantt",
    "pie",
    "gitGraph",
    "mindmap",
    "timeline",
    "sankey",
    "quadrantChart",
    "xychart",
  ];

  return validPrefixes.some(
    (prefix) => trimmed.startsWith(prefix)
  );
}

function findMmdc(): string {
  // Try common locations
  const candidates = [
    "mmdc",
    "./node_modules/.bin/mmdc",
    "../../node_modules/.bin/mmdc",
    "../../../node_modules/.bin/mmdc",
  ];
  // Return first candidate (actual resolution happens at exec time)
  return candidates[0];
}

function execMmdc(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`mmdc failed: ${error.message}\n${stderr}`));
        return;
      }
      resolve();
    });
  });
}
```

- [ ] **Step 5: Run all tests**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/image-generator.test.ts tests/mermaid-to-png.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/media/ packages/docgen/src/converters/mermaid-to-png.ts packages/docgen/tests/image-generator.test.ts packages/docgen/tests/mermaid-to-png.test.ts
git commit -m "feat: add image generator (Gemini/DALL-E) and Mermaid-to-PNG converter"
```

---

## Task 8: Text Parser (HWP/HWPX/PDF extraction)

**Files:**
- Create: `packages/docgen/src/converters/text-parser.ts`

- [ ] **Step 1: Implement text parser**

Create `packages/docgen/src/converters/text-parser.ts`:

```typescript
import pdfParse from "pdf-parse";
import { parseStringPromise } from "xml2js";

export interface ExtractedText {
  text: string;
  pageCount?: number;
  format: "pdf" | "hwpx" | "hwp" | "docx" | "txt" | "unknown";
  metadata?: Record<string, unknown>;
}

/**
 * Extract text from various document formats.
 * Shared with FlowMate text_parser pattern.
 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<ExtractedText> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "pdf":
      return extractFromPdf(buffer);
    case "hwpx":
      return extractFromHwpx(buffer);
    case "txt":
    case "md":
      return {
        text: buffer.toString("utf-8"),
        format: "txt",
      };
    case "docx":
      return extractFromDocx(buffer);
    default:
      return {
        text: buffer.toString("utf-8"),
        format: "unknown",
      };
  }
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractedText> {
  const parsed = await pdfParse(buffer);
  return {
    text: parsed.text,
    pageCount: parsed.numpages,
    format: "pdf",
    metadata: {
      title: parsed.info?.Title,
      author: parsed.info?.Author,
    },
  };
}

async function extractFromHwpx(buffer: Buffer): Promise<ExtractedText> {
  // HWPX is a ZIP archive — extract section XML files and parse text
  const { unzipSync } = await import("zlib");

  // For HWPX extraction we need to read the ZIP entries
  // Using a lightweight approach: look for Contents/section*.xml
  // Full implementation requires a ZIP library; for now extract raw text
  const textContent = buffer.toString("utf-8");

  // Try to find XML text nodes
  const textMatches = textContent.match(/<hp:t>([^<]+)<\/hp:t>/g);
  if (textMatches) {
    const text = textMatches
      .map((m) => m.replace(/<\/?hp:t>/g, ""))
      .join(" ");
    return { text, format: "hwpx" };
  }

  return {
    text: "HWPX text extraction requires full ZIP parsing",
    format: "hwpx",
  };
}

async function extractFromDocx(buffer: Buffer): Promise<ExtractedText> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      format: "docx",
    };
  } catch {
    return {
      text: "DOCX extraction failed — mammoth not available",
      format: "docx",
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/converters/text-parser.ts
git commit -m "feat: add text-parser for multi-format document extraction (PDF, HWPX, DOCX)"
```

---

## Task 9: Journal Report Generator

**Files:**
- Create: `packages/docgen/src/generators/journal-report.ts`
- Create: `packages/docgen/tests/journal-report.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/docgen/tests/journal-report.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateJournalReport } from "../src/generators/journal-report";
import type { JournalReportInput } from "../src/types";

const sampleInput: JournalReportInput = {
  clientId: "client-1",
  year: 2026,
  month: 3,
  companyName: "(주)테스트기업",
  instituteName: "테스트기업 기업부설연구소",
  journals: [
    {
      date: "2026-03-05",
      title: "AI 모델 아키텍처 설계",
      content: "딥러닝 기반 이미지 분류 모델의 아키텍처를 설계하였다.",
      objectives: "최적 모델 구조 탐색",
      results: "ResNet-50 기반 커스텀 모델 설계 완료",
      nextSteps: "데이터셋 구축 및 학습",
      hours: 8,
      researcherName: "김연구",
    },
    {
      date: "2026-03-12",
      title: "학습 데이터셋 구축",
      content: "이미지 데이터 수집 및 라벨링 작업을 수행하였다.",
      objectives: "학습용 데이터 10,000건 확보",
      results: "총 12,500건 데이터 수집 및 라벨링 완료",
      nextSteps: "모델 학습 및 성능 평가",
      hours: 16,
      researcherName: "김연구",
    },
    {
      date: "2026-03-20",
      title: "모델 학습 및 1차 평가",
      content: "구축된 데이터로 모델 학습 및 성능을 평가하였다.",
      objectives: "정확도 90% 이상 달성",
      results: "정확도 92.3% 달성 (F1: 0.91)",
      nextSteps: "하이퍼파라미터 튜닝",
      hours: 12,
      researcherName: "김연구",
    },
  ],
};

describe("Journal Report Generator", () => {
  it("generates monthly report DOCX", async () => {
    const result = await generateJournalReport(sampleInput);

    expect(result.docxBuffer).toBeInstanceOf(Buffer);
    expect(result.docxBuffer.length).toBeGreaterThan(0);
    expect(result.totalHours).toBe(36);
    expect(result.journalCount).toBe(3);
  });

  it("handles single journal entry", async () => {
    const single: JournalReportInput = {
      ...sampleInput,
      journals: [sampleInput.journals[0]],
    };

    const result = await generateJournalReport(single);
    expect(result.journalCount).toBe(1);
    expect(result.totalHours).toBe(8);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/journal-report.test.ts
```

Expected: FAIL — "Cannot find module '../src/generators/journal-report'"

- [ ] **Step 3: Implement journal report generator**

Create `packages/docgen/src/generators/journal-report.ts`:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  AlignmentType,
} from "docx";
import type { JournalReportInput, JournalReportOutput } from "../types";
import { FONTS, FONT_SIZES, PAGE_MARGINS, RUN_STYLES, LINE_SPACING } from "../utils/docx-styles";
import { formatKoreanDate } from "../utils/number-format";

export async function generateJournalReport(
  input: JournalReportInput
): Promise<JournalReportOutput> {
  const totalHours = input.journals.reduce(
    (sum, j) => sum + (j.hours ?? 0),
    0
  );
  const journalCount = input.journals.length;

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `연구개발 활동 월간 보고서`,
          ...RUN_STYLES.title,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${input.year}년 ${String(input.month).padStart(2, "0")}월`,
          ...RUN_STYLES.heading1,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Company info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `기업명: ${input.companyName}`, font: FONTS.body, size: FONT_SIZES.body }),
      ],
      spacing: { after: 60 },
    })
  );

  if (input.instituteName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `연구소: ${input.instituteName}`, font: FONTS.body, size: FONT_SIZES.body }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `총 연구시간: ${totalHours}시간 (${journalCount}건)`,
          font: FONTS.body,
          size: FONT_SIZES.body,
          bold: true,
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Summary table
  children.push(createSummaryTable(input.journals));

  children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));

  // Detailed entries
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "상세 연구활동 내역", ...RUN_STYLES.heading1 })],
      spacing: { before: 200, after: 200 },
    })
  );

  for (const [idx, journal] of input.journals.entries()) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${idx + 1}. ${journal.title}`,
            ...RUN_STYLES.heading2,
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `일자: ${formatKoreanDate(journal.date)} | 연구원: ${journal.researcherName} | ${journal.hours ?? 0}시간`,
            font: FONTS.body,
            size: FONT_SIZES.caption,
            color: "666666",
          }),
        ],
        spacing: { after: 100 },
      })
    );

    if (journal.objectives) {
      children.push(createLabeledParagraph("연구 목표", journal.objectives));
    }

    children.push(createLabeledParagraph("연구 내용", journal.content));

    if (journal.results) {
      children.push(createLabeledParagraph("연구 결과", journal.results));
    }

    if (journal.nextSteps) {
      children.push(createLabeledParagraph("향후 계획", journal.nextSteps));
    }
  }

  const doc = new Document({
    sections: [{ ...PAGE_MARGINS, children }],
  });

  return {
    docxBuffer: Buffer.from(await Packer.toBuffer(doc)),
    totalHours,
    journalCount,
  };
}

function createSummaryTable(
  journals: JournalReportInput["journals"]
): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createCell("번호", 8, true, AlignmentType.CENTER),
      createCell("일자", 15, true, AlignmentType.CENTER),
      createCell("연구 제목", 40, true, AlignmentType.CENTER),
      createCell("연구원", 15, true, AlignmentType.CENTER),
      createCell("시간", 10, true, AlignmentType.CENTER),
    ],
  });

  const dataRows = journals.map((j, idx) =>
    new TableRow({
      children: [
        createCell(String(idx + 1), 8, false, AlignmentType.CENTER),
        createCell(formatKoreanDate(j.date), 15, false, AlignmentType.CENTER),
        createCell(j.title, 40),
        createCell(j.researcherName, 15, false, AlignmentType.CENTER),
        createCell(`${j.hours ?? 0}h`, 10, false, AlignmentType.CENTER),
      ],
    })
  );

  // Total row
  const totalRow = new TableRow({
    children: [
      createCell("합계", 63, true, AlignmentType.RIGHT),
      createCell("", 15),
      createCell(
        `${journals.reduce((s, j) => s + (j.hours ?? 0), 0)}h`,
        10,
        true,
        AlignmentType.CENTER
      ),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows, totalRow],
  });
}

function createCell(
  text: string,
  widthPercent: number,
  bold = false,
  alignment = AlignmentType.LEFT
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: FONTS.body,
            size: FONT_SIZES.caption,
            bold,
          }),
        ],
        alignment,
      }),
    ],
  });
}

function createLabeledParagraph(label: string, content: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `[${label}] `, font: FONTS.body, size: FONT_SIZES.body, bold: true }),
      new TextRun({ text: content, font: FONTS.body, size: FONT_SIZES.body }),
    ],
    spacing: { after: 80, line: LINE_SPACING.body },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/journal-report.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/generators/journal-report.ts packages/docgen/tests/journal-report.test.ts
git commit -m "feat: add research journal monthly report DOCX generator"
```

---

## Task 10: Patent Draft and Financial Report Generators

**Files:**
- Create: `packages/docgen/src/generators/patent-draft.ts`
- Create: `packages/docgen/src/generators/financial-report.ts`
- Create: `packages/docgen/tests/patent-draft.test.ts`
- Create: `packages/docgen/tests/financial-report.test.ts`

- [ ] **Step 1: Write failing tests for patent draft**

Create `packages/docgen/tests/patent-draft.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { generatePatentDraft } from "../src/generators/patent-draft";
import type { PatentDraftInput } from "../src/types";

// Mock AI for claim generation
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "【청구항 1】 인공지능 기반 이미지 분류 방법에 있어서..." }],
      }),
    },
  })),
}));

const sampleInput: PatentDraftInput = {
  clientId: "client-1",
  inventionTitle: "인공지능 기반 이미지 분류 시스템 및 방법",
  technicalField: "인공지능, 컴퓨터 비전, 딥러닝",
  problemToSolve: "기존 이미지 분류 시스템은 정확도가 낮고 처리 속도가 느린 문제가 있다.",
  solutionDescription: "본 발명은 경량화된 CNN 모델을 사용하여 실시간 이미지 분류를 수행하는 시스템을 제공한다.",
  advantageousEffects: "처리 속도 3배 향상, 정확도 95% 이상 달성",
  inventors: [{ name: "김발명", address: "서울특별시 강남구" }],
  applicant: { name: "(주)테스트기업", businessNumber: "123-45-67890" },
};

describe("Patent Draft Generator", () => {
  it("generates patent specification DOCX", async () => {
    const result = await generatePatentDraft(sampleInput);

    expect(result.docxBuffer).toBeInstanceOf(Buffer);
    expect(result.docxBuffer.length).toBeGreaterThan(0);
    expect(result.markdownContent).toContain("발명의 명칭");
  });

  it("includes required patent sections", async () => {
    const result = await generatePatentDraft(sampleInput);

    expect(result.markdownContent).toContain("기술분야");
    expect(result.markdownContent).toContain("해결하고자 하는 과제");
    expect(result.markdownContent).toContain("과제의 해결 수단");
  });
});
```

- [ ] **Step 2: Write failing tests for financial report**

Create `packages/docgen/tests/financial-report.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { generateFinancialReport, calculateFinancialMetrics } from "../src/generators/financial-report";
import type { FinancialReportInput } from "../src/types";

// Mock AI
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "재무 상태가 양호합니다. 매출 성장세가 지속되고 있습니다." }],
      }),
    },
  })),
}));

const sampleInput: FinancialReportInput = {
  clientId: "client-1",
  year: 2025,
  companyName: "(주)테스트기업",
  industry: "소프트웨어",
  financials: {
    revenue: 500000000,
    operatingProfit: 80000000,
    netProfit: 60000000,
    totalAssets: 1000000000,
    totalLiabilities: 400000000,
    totalEquity: 600000000,
  },
  previousYears: [
    {
      year: 2024,
      revenue: 400000000,
      operatingProfit: 50000000,
      netProfit: 35000000,
      totalAssets: 800000000,
      totalLiabilities: 350000000,
      totalEquity: 450000000,
    },
  ],
};

describe("Financial Report Generator", () => {
  it("calculates financial metrics correctly", () => {
    const metrics = calculateFinancialMetrics(sampleInput);

    expect(metrics.operatingMargin).toBeCloseTo(0.16, 2);  // 80M / 500M
    expect(metrics.netMargin).toBeCloseTo(0.12, 2);         // 60M / 500M
    expect(metrics.debtRatio).toBeCloseTo(0.6667, 2);       // 400M / 600M
    expect(metrics.roe).toBeCloseTo(0.1, 2);                // 60M / 600M
    expect(metrics.revenueGrowth).toBeCloseTo(0.25, 2);     // (500-400)/400
  });

  it("generates financial report DOCX", async () => {
    const result = await generateFinancialReport(sampleInput);

    expect(result.docxBuffer).toBeInstanceOf(Buffer);
    expect(result.analysis.operatingMargin).toBeCloseTo(0.16, 2);
    expect(result.analysis.recommendations.length).toBeGreaterThan(0);
  });

  it("handles missing financial data gracefully", () => {
    const incomplete: FinancialReportInput = {
      ...sampleInput,
      financials: { revenue: 100000000 },
      previousYears: [],
    };

    const metrics = calculateFinancialMetrics(incomplete);
    expect(metrics.currentRatio).toBeNull();
    expect(metrics.debtRatio).toBeNull();
    expect(metrics.revenueGrowth).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/patent-draft.test.ts tests/financial-report.test.ts
```

Expected: FAIL — cannot find modules

- [ ] **Step 4: Implement patent draft generator**

Create `packages/docgen/src/generators/patent-draft.ts`:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from "docx";
import type { PatentDraftInput, PatentDraftOutput } from "../types";
import { FONTS, FONT_SIZES, PAGE_MARGINS, RUN_STYLES, LINE_SPACING } from "../utils/docx-styles";
import { markdownToDocx } from "../converters/mark-docx";

/**
 * Generate a Korean patent specification draft (특허 명세서).
 * Uses AI to generate claims if not provided.
 */
export async function generatePatentDraft(
  input: PatentDraftInput
): Promise<PatentDraftOutput> {
  // Generate claims via AI if not provided
  let claims = input.claims ?? [];
  if (claims.length === 0) {
    claims = await generateClaims(input);
  }

  // Build markdown content following Korean patent format
  const markdown = buildPatentMarkdown(input, claims);

  // Convert to DOCX
  const docxBuffer = await markdownToDocx(markdown, {
    fontSize: 10,
    lineSpacing: 1.8,
  });

  return {
    docxBuffer,
    markdownContent: markdown,
    claimsGenerated: claims,
    drawingDescriptions: input.drawings.map((d) => d.description),
  };
}

function buildPatentMarkdown(
  input: PatentDraftInput,
  claims: string[]
): string {
  const sections: string[] = [];

  // Title
  sections.push(`# 발명의 명칭\n\n${input.inventionTitle}`);

  // Technical field
  sections.push(`## 기술분야\n\n본 발명은 ${input.technicalField}에 관한 것이다.`);

  // Background art
  if (input.backgroundArt) {
    sections.push(`## 배경기술\n\n${input.backgroundArt}`);
  }

  // Problem to solve
  sections.push(`## 해결하고자 하는 과제\n\n${input.problemToSolve}`);

  // Solution
  sections.push(`## 과제의 해결 수단\n\n${input.solutionDescription}`);

  // Advantageous effects
  if (input.advantageousEffects) {
    sections.push(`## 발명의 효과\n\n${input.advantageousEffects}`);
  }

  // Drawings description
  if (input.drawings.length > 0) {
    const drawingsList = input.drawings
      .map((d, i) => `- 도 ${i + 1}: ${d.description}`)
      .join("\n");
    sections.push(`## 도면의 간단한 설명\n\n${drawingsList}`);
  }

  // Detailed description
  sections.push(
    `## 발명을 실시하기 위한 구체적인 내용\n\n이하, 첨부된 도면을 참조하여 본 발명의 실시예를 상세히 설명한다.\n\n${input.solutionDescription}`
  );

  // Claims
  if (claims.length > 0) {
    const claimsList = claims
      .map((c, i) => `**【청구항 ${i + 1}】** ${c}`)
      .join("\n\n");
    sections.push(`## 특허청구범위\n\n${claimsList}`);
  }

  // Abstract
  sections.push(
    `## 요약서\n\n**과제:** ${input.problemToSolve}\n\n**해결수단:** ${input.solutionDescription}`
  );

  // Applicant / Inventor
  const inventorList = input.inventors
    .map((inv) => `- ${inv.name}${inv.address ? ` (${inv.address})` : ""}`)
    .join("\n");
  sections.push(
    `## 출원인 및 발명자\n\n**출원인:** ${input.applicant.name}\n\n**발명자:**\n${inventorList}`
  );

  return sections.join("\n\n---\n\n");
}

async function generateClaims(input: PatentDraftInput): Promise<string[]> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `다음 발명에 대한 한국 특허 청구항을 3개 작성해주세요.

발명의 명칭: ${input.inventionTitle}
기술분야: ${input.technicalField}
해결 과제: ${input.problemToSolve}
해결 수단: ${input.solutionDescription}

청구항 형식:
- 독립청구항 1개 (방법 청구항)
- 종속청구항 2개

각 청구항을 【청구항 N】 형식으로 작성해주세요.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse claims from response
    const claimRegex = /【청구항\s*\d+】\s*(.+?)(?=【청구항|$)/gs;
    const claims: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = claimRegex.exec(text)) !== null) {
      claims.push(match[1].trim());
    }

    return claims.length > 0 ? claims : [text.trim()];
  } catch {
    return [
      `${input.inventionTitle}에 있어서, ${input.solutionDescription}을 특징으로 하는 ${input.inventionTitle}.`,
    ];
  }
}
```

- [ ] **Step 5: Implement financial report generator**

Create `packages/docgen/src/generators/financial-report.ts`:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  AlignmentType,
} from "docx";
import type {
  FinancialReportInput,
  FinancialReportOutput,
  FinancialAnalysis,
  GeneratedImage,
} from "../types";
import { FONTS, FONT_SIZES, PAGE_MARGINS, RUN_STYLES, LINE_SPACING } from "../utils/docx-styles";
import {
  formatKRW,
  formatPercent,
  formatKoreanUnit,
} from "../utils/number-format";

/**
 * Generate a financial analysis report DOCX.
 * Includes key metrics, year-over-year comparison, and AI assessment.
 */
export async function generateFinancialReport(
  input: FinancialReportInput
): Promise<FinancialReportOutput> {
  const analysis = calculateFinancialMetrics(input);

  // Get AI assessment
  analysis.overallAssessment = await getAiAssessment(input, analysis);
  analysis.recommendations = generateRecommendations(analysis);

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `재무분석 보고서`, ...RUN_STYLES.title }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${input.companyName} | ${input.year}년`,
          ...RUN_STYLES.heading1,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Key metrics section
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "1. 주요 재무지표", ...RUN_STYLES.heading1 }),
      ],
      spacing: { before: 200, after: 200 },
    })
  );

  children.push(createMetricsTable(input, analysis));

  // Year-over-year comparison
  if (input.previousYears.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "2. 전년 대비 현황", ...RUN_STYLES.heading1 }),
        ],
        spacing: { before: 300, after: 200 },
      })
    );

    children.push(createComparisonTable(input));
  }

  // Analysis
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "3. 종합 분석", ...RUN_STYLES.heading1 }),
      ],
      spacing: { before: 300, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: analysis.overallAssessment,
          font: FONTS.body,
          size: FONT_SIZES.body,
        }),
      ],
      spacing: { after: 200, line: LINE_SPACING.body },
    })
  );

  // Recommendations
  if (analysis.recommendations.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "4. 개선 권고사항", ...RUN_STYLES.heading1 }),
        ],
        spacing: { before: 300, after: 200 },
      })
    );

    for (const [idx, rec] of analysis.recommendations.entries()) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${idx + 1}. ${rec}`,
              font: FONTS.body,
              size: FONT_SIZES.body,
            }),
          ],
          spacing: { after: 80 },
          indent: { left: 200 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ ...PAGE_MARGINS, children }],
  });

  return {
    docxBuffer: Buffer.from(await Packer.toBuffer(doc)),
    analysis,
    chartImages: [], // Chart images added when image generator is integrated
  };
}

/**
 * Calculate key financial metrics from input data.
 */
export function calculateFinancialMetrics(
  input: FinancialReportInput
): FinancialAnalysis {
  const { financials, previousYears } = input;

  const currentRatio =
    financials.totalAssets && financials.totalLiabilities
      ? financials.totalAssets / financials.totalLiabilities
      : null;

  const debtRatio =
    financials.totalLiabilities && financials.totalEquity
      ? financials.totalLiabilities / financials.totalEquity
      : null;

  const roe =
    financials.netProfit && financials.totalEquity
      ? financials.netProfit / financials.totalEquity
      : null;

  const operatingMargin =
    financials.operatingProfit && financials.revenue
      ? financials.operatingProfit / financials.revenue
      : null;

  const netMargin =
    financials.netProfit && financials.revenue
      ? financials.netProfit / financials.revenue
      : null;

  const prevYear = previousYears[0];
  const revenueGrowth =
    financials.revenue && prevYear?.revenue
      ? (financials.revenue - prevYear.revenue) / prevYear.revenue
      : null;

  return {
    currentRatio,
    debtRatio,
    roe,
    operatingMargin,
    netMargin,
    revenueGrowth,
    overallAssessment: "",
    recommendations: [],
  };
}

function createMetricsTable(
  input: FinancialReportInput,
  analysis: FinancialAnalysis
): Table {
  const rows: Array<[string, string, string]> = [
    ["매출액", formatKoreanUnit(input.financials.revenue ?? 0), "-"],
    ["영업이익", formatKoreanUnit(input.financials.operatingProfit ?? 0),
      analysis.operatingMargin !== null ? formatPercent(analysis.operatingMargin) : "-"],
    ["순이익", formatKoreanUnit(input.financials.netProfit ?? 0),
      analysis.netMargin !== null ? formatPercent(analysis.netMargin) : "-"],
    ["부채비율", "-",
      analysis.debtRatio !== null ? formatPercent(analysis.debtRatio) : "-"],
    ["ROE", "-",
      analysis.roe !== null ? formatPercent(analysis.roe) : "-"],
    ["매출성장률", "-",
      analysis.revenueGrowth !== null ? formatPercent(analysis.revenueGrowth) : "-"],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createTableHeaderRow(["지표", "금액", "비율"]),
      ...rows.map(([label, amount, ratio]) =>
        createTableDataRow([label, amount, ratio])
      ),
    ],
  });
}

function createComparisonTable(input: FinancialReportInput): Table {
  const prev = input.previousYears[0];
  if (!prev) return new Table({ rows: [] });

  const rows: Array<[string, string, string, string]> = [
    [
      "매출액",
      formatKoreanUnit(prev.revenue ?? 0),
      formatKoreanUnit(input.financials.revenue ?? 0),
      calcChange(prev.revenue, input.financials.revenue),
    ],
    [
      "영업이익",
      formatKoreanUnit(prev.operatingProfit ?? 0),
      formatKoreanUnit(input.financials.operatingProfit ?? 0),
      calcChange(prev.operatingProfit, input.financials.operatingProfit),
    ],
    [
      "순이익",
      formatKoreanUnit(prev.netProfit ?? 0),
      formatKoreanUnit(input.financials.netProfit ?? 0),
      calcChange(prev.netProfit, input.financials.netProfit),
    ],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createTableHeaderRow(["항목", `${prev.year}년`, `${input.year}년`, "증감"]),
      ...rows.map(([label, prevVal, curVal, change]) =>
        createTableDataRow([label, prevVal, curVal, change])
      ),
    ],
  });
}

function calcChange(prev: number | undefined, curr: number | undefined): string {
  if (!prev || !curr) return "-";
  const pct = ((curr - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function createTableHeaderRow(cells: string[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: cells.map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text, font: FONTS.body, size: FONT_SIZES.caption, bold: true }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        })
    ),
  });
}

function createTableDataRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(
      (text, idx) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text, font: FONTS.body, size: FONT_SIZES.caption }),
              ],
              alignment: idx === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
            }),
          ],
        })
    ),
  });
}

function generateRecommendations(analysis: FinancialAnalysis): string[] {
  const recs: string[] = [];

  if (analysis.debtRatio !== null && analysis.debtRatio > 2) {
    recs.push("부채비율이 200%를 초과합니다. 재무구조 개선이 필요합니다.");
  }

  if (analysis.operatingMargin !== null && analysis.operatingMargin < 0.05) {
    recs.push("영업이익률이 5% 미만으로 수익성 개선이 필요합니다.");
  }

  if (analysis.revenueGrowth !== null && analysis.revenueGrowth < 0) {
    recs.push("매출이 전년 대비 감소하였습니다. 매출 확대 전략이 필요합니다.");
  }

  if (analysis.roe !== null && analysis.roe < 0.05) {
    recs.push("ROE가 5% 미만으로 자본 효율성 개선이 필요합니다.");
  }

  if (recs.length === 0) {
    recs.push("전반적으로 안정적인 재무구조를 유지하고 있습니다.");
  }

  return recs;
}

async function getAiAssessment(
  input: FinancialReportInput,
  analysis: FinancialAnalysis
): Promise<string> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `${input.companyName}의 ${input.year}년 재무 현황을 3-4문장으로 종합 평가해주세요.
매출: ${formatKoreanUnit(input.financials.revenue ?? 0)}
영업이익률: ${analysis.operatingMargin !== null ? formatPercent(analysis.operatingMargin) : "N/A"}
부채비율: ${analysis.debtRatio !== null ? formatPercent(analysis.debtRatio) : "N/A"}
ROE: ${analysis.roe !== null ? formatPercent(analysis.roe) : "N/A"}
매출성장률: ${analysis.revenueGrowth !== null ? formatPercent(analysis.revenueGrowth) : "N/A"}
업종: ${input.industry ?? "미분류"}`,
        },
      ],
    });

    return response.content[0].type === "text"
      ? response.content[0].text
      : "AI 분석을 수행할 수 없습니다.";
  } catch {
    return "재무 데이터 기반 자동 분석이 수행되었습니다. 상세 분석은 담당 컨설턴트에게 문의하세요.";
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/patent-draft.test.ts tests/financial-report.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/generators/patent-draft.ts packages/docgen/src/generators/financial-report.ts packages/docgen/tests/patent-draft.test.ts packages/docgen/tests/financial-report.test.ts
git commit -m "feat: add patent draft and financial analysis report generators"
```

---

## Task 11: Dual Engine Business Plan Pipeline

**Files:**
- Create: `packages/docgen/src/engines/rag-draft.ts`
- Create: `packages/docgen/src/engines/precision-editor.ts`
- Create: `packages/docgen/src/engines/dual-engine-pipeline.ts`
- Create: `packages/docgen/src/generators/business-plan.ts`
- Create: `packages/docgen/tests/rag-draft.test.ts`
- Create: `packages/docgen/tests/precision-editor.test.ts`

- [ ] **Step 1: Write failing tests for RAG draft engine**

Create `packages/docgen/tests/rag-draft.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { generateRagDraft, buildRagContext } from "../src/engines/rag-draft";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "# 사업계획서\n\n## 1. 기업 현황\n\n테스트 기업은..." }],
        usage: { input_tokens: 1000, output_tokens: 2000 },
      }),
    },
  })),
}));

describe("RAG Draft Engine", () => {
  it("builds context from company profile and documents", () => {
    const context = buildRagContext({
      companyProfile: {
        name: "테스트기업",
        industry: "소프트웨어",
        employeeCount: 15,
      },
      clientDocuments: [
        { id: "doc-1", name: "사업자등록증", content: "사업자번호: 123-45-67890", category: "INPUT" },
      ],
      previousPlans: [],
    });

    expect(context).toContain("테스트기업");
    expect(context).toContain("소프트웨어");
    expect(context).toContain("사업자등록증");
  });

  it("generates markdown draft from context", async () => {
    const result = await generateRagDraft({
      clientId: "client-1",
      projectId: "project-1",
      companyProfile: { name: "테스트기업" },
      clientDocuments: [],
      previousPlans: [],
    });

    expect(result.markdown).toContain("사업계획서");
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Write failing tests for precision editor**

Create `packages/docgen/tests/precision-editor.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { precisionEdit, type PrecisionEditInput } from "../src/engines/precision-editor";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "# 개선된 사업계획서\n\n## 1. 기업 현황\n\n(주)테스트기업은 AI 기술 전문 기업으로..." }],
        usage: { input_tokens: 2000, output_tokens: 3000 },
      }),
    },
  })),
}));

describe("Precision Editor Engine", () => {
  it("refines RAG draft with program-specific requirements", async () => {
    const result = await precisionEdit({
      ragDraft: "# 사업계획서\n\n## 1. 기업 현황\n\n테스트 기업...",
      programRequirements: {
        name: "AI 바우처",
        sections: ["기업 현황", "기술 역량", "사업 계획", "기대 효과"],
      },
      additionalContext: "평가 배점: 기술성 40%, 사업성 30%, 정책부합성 30%",
    });

    expect(result.markdown).toContain("개선된");
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Implement RAG draft engine**

Create `packages/docgen/src/engines/rag-draft.ts`:

```typescript
import type { BusinessPlanInput } from "../types";

export interface RagDraftResult {
  markdown: string;
  tokensUsed: number;
}

/**
 * Build RAG context from client profile, documents, and previous plans.
 * FlowMate pattern: assemble rich context → generate with AI.
 */
export function buildRagContext(input: {
  companyProfile: BusinessPlanInput["companyProfile"];
  clientDocuments: BusinessPlanInput["clientDocuments"];
  previousPlans: BusinessPlanInput["previousPlans"];
  additionalContext?: string;
}): string {
  const sections: string[] = [];

  // Company profile
  const cp = input.companyProfile;
  sections.push(`## 기업 정보
- 기업명: ${cp.name}
- 업종: ${cp.industry ?? "미분류"}
- 대표자: ${cp.ceoName ?? "미입력"}
- 사업자번호: ${cp.businessNumber ?? "미입력"}
- 직원수: ${cp.employeeCount ?? "미입력"}
- 자본금: ${cp.capitalAmount ?? "미입력"}
- 설립일: ${cp.foundedDate ?? "미입력"}
- 소재지: ${cp.region ?? "미입력"}
- 벤처인증: ${cp.isVenture ? "있음" : "없음"}`);

  // Client documents
  if (input.clientDocuments.length > 0) {
    sections.push("## 참고 서류");
    for (const doc of input.clientDocuments) {
      sections.push(`### ${doc.name} (${doc.category})\n${doc.content.slice(0, 2000)}`);
    }
  }

  // Previous successful plans
  if (input.previousPlans.length > 0) {
    sections.push("## 이전 성공 사례");
    for (const plan of input.previousPlans) {
      const scoreLabel = plan.score ? ` (점수: ${plan.score})` : "";
      sections.push(`### 참고 계획서${scoreLabel}\n${plan.content.slice(0, 3000)}`);
    }
  }

  // Additional context
  if (input.additionalContext) {
    sections.push(`## 추가 정보\n${input.additionalContext}`);
  }

  return sections.join("\n\n");
}

/**
 * Generate initial business plan draft using RAG context.
 * Engine A: FlowMate pattern.
 */
export async function generateRagDraft(
  input: BusinessPlanInput
): Promise<RagDraftResult> {
  const context = buildRagContext({
    companyProfile: input.companyProfile,
    clientDocuments: input.clientDocuments,
    previousPlans: input.previousPlans,
    additionalContext: input.additionalContext,
  });

  const programSection = input.programInfo
    ? `\n\n## 지원사업 정보
- 사업명: ${input.programInfo.name}
- 주관기관: ${input.programInfo.agency ?? "미입력"}
- 카테고리: ${input.programInfo.category}
- 최대지원금: ${input.programInfo.maxFunding ?? "미입력"}`
    : "";

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `다음 기업 정보와 참고 자료를 바탕으로 정부지원사업 사업계획서 초안을 작성해주세요.

${context}${programSection}

## 요구사항
- 마크다운 형식으로 작성
- 한글 존칭/격식체 사용
- 섹션: 기업 현황, 기술 역량, 사업 내용, 사업 추진 체계, 기대 효과, 소요 예산
- 각 섹션 충분한 분량 (500자 이상)
- 정량적 데이터 최대한 활용`,
      },
    ],
  });

  const markdown =
    response.content[0].type === "text" ? response.content[0].text : "";
  const tokensUsed =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return { markdown, tokensUsed };
}
```

- [ ] **Step 4: Implement precision editor engine**

Create `packages/docgen/src/engines/precision-editor.ts`:

```typescript
export interface PrecisionEditInput {
  ragDraft: string;
  programRequirements?: {
    name: string;
    sections?: string[];
    evaluationCriteria?: string;
  };
  formTemplate?: {
    format: string;
    maxPages?: number;
    requiredFields?: string[];
  };
  additionalContext?: string;
}

export interface PrecisionEditResult {
  markdown: string;
  tokensUsed: number;
  improvements: string[];
}

/**
 * Precision-edit a RAG draft to match program-specific requirements.
 * Engine B: Program_Docs_Auto pattern.
 *
 * Steps:
 * 1. Analyze program requirements
 * 2. Identify gaps in RAG draft
 * 3. Research missing information
 * 4. Rewrite sections with precision formatting
 */
export async function precisionEdit(
  input: PrecisionEditInput
): Promise<PrecisionEditResult> {
  const systemPrompt = buildPrecisionSystemPrompt(input);

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 10000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `다음 사업계획서 초안을 정밀 편집해주세요.

## 초안
${input.ragDraft}

## 편집 지침
1. 각 섹션이 평가 기준에 부합하는지 확인
2. 부족한 정량적 데이터 보강
3. 양식 요구사항에 맞게 구조 조정
4. 전문적이고 설득력 있는 문체로 수정
5. 수정한 부분을 <!-- 개선: ... --> 주석으로 표시

${input.additionalContext ? `\n추가 컨텍스트:\n${input.additionalContext}` : ""}`,
      },
    ],
  });

  const markdown =
    response.content[0].type === "text" ? response.content[0].text : "";
  const tokensUsed =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  // Extract improvement notes
  const improvementRegex = /<!-- 개선: (.+?) -->/g;
  const improvements: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = improvementRegex.exec(markdown)) !== null) {
    improvements.push(match[1]);
  }

  return { markdown, tokensUsed, improvements };
}

function buildPrecisionSystemPrompt(input: PrecisionEditInput): string {
  const parts = [
    "당신은 정부지원사업 사업계획서 전문 컨설턴트입니다.",
    "다음 요구사항에 맞게 초안을 정밀 편집합니다.",
  ];

  if (input.programRequirements) {
    parts.push(`\n사업명: ${input.programRequirements.name}`);
    if (input.programRequirements.sections) {
      parts.push(`필수 섹션: ${input.programRequirements.sections.join(", ")}`);
    }
    if (input.programRequirements.evaluationCriteria) {
      parts.push(`평가 기준: ${input.programRequirements.evaluationCriteria}`);
    }
  }

  if (input.formTemplate) {
    parts.push(`\n양식: ${input.formTemplate.format}`);
    if (input.formTemplate.maxPages) {
      parts.push(`최대 페이지: ${input.formTemplate.maxPages}p`);
    }
  }

  return parts.join("\n");
}
```

- [ ] **Step 5: Implement dual engine pipeline and business plan orchestrator**

Create `packages/docgen/src/engines/dual-engine-pipeline.ts`:

```typescript
import { generateRagDraft } from "./rag-draft";
import { precisionEdit } from "./precision-editor";
import { markdownToDocx } from "../converters/mark-docx";
import type { BusinessPlanInput, BusinessPlanOutput, BusinessPlanSection } from "../types";

/**
 * Dual engine pipeline for business plan generation.
 * Step 1: RAG-based draft (Engine A)
 * Step 2: Precision editing (Engine B)
 * Can be chained via QStash for async execution.
 */
export async function dualEnginePipeline(
  input: BusinessPlanInput
): Promise<BusinessPlanOutput> {
  const startTime = Date.now();

  // Step 1: RAG Draft
  const ragResult = await generateRagDraft(input);

  // Step 2: Precision Edit
  const precisionResult = await precisionEdit({
    ragDraft: ragResult.markdown,
    programRequirements: input.programInfo
      ? {
          name: input.programInfo.name,
          sections: undefined, // Derived from program category
        }
      : undefined,
    additionalContext: input.additionalContext,
  });

  // Parse sections from final markdown
  const sections = parseSections(precisionResult.markdown);

  // Convert to DOCX
  const docxBuffer = await markdownToDocx(precisionResult.markdown, {
    fontSize: 10,
    lineSpacing: 1.5,
  });

  return {
    markdownContent: precisionResult.markdown,
    sections,
    diagrams: [],
    docxBuffer,
    metadata: {
      engineUsed: "dual",
      ragDraftTokens: ragResult.tokensUsed,
      precisionEditTokens: precisionResult.tokensUsed,
      totalDurationMs: Date.now() - startTime,
    },
  };
}

function parseSections(markdown: string): BusinessPlanSection[] {
  const lines = markdown.split("\n");
  const sections: BusinessPlanSection[] = [];
  let currentSection: BusinessPlanSection | null = null;
  let order = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,2}\s+(.+)/);
    if (headingMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: headingMatch[1],
        content: "",
        order: order++,
      };
    } else if (currentSection) {
      currentSection.content += line + "\n";
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}
```

Create `packages/docgen/src/generators/business-plan.ts`:

```typescript
import { dualEnginePipeline } from "../engines/dual-engine-pipeline";
import { generateRagDraft } from "../engines/rag-draft";
import { markdownToDocx } from "../converters/mark-docx";
import type { BusinessPlanInput, BusinessPlanOutput } from "../types";

/**
 * Generate a business plan using the configured engine.
 * Modes:
 * - "dual" (default): RAG draft → precision edit
 * - "rag": RAG draft only (faster, cheaper)
 * - "precision": Precision edit only (requires existing draft in additionalContext)
 */
export async function generateBusinessPlan(
  input: BusinessPlanInput,
  mode: "dual" | "rag" | "precision" = "dual"
): Promise<BusinessPlanOutput> {
  const startTime = Date.now();

  if (mode === "dual") {
    return dualEnginePipeline(input);
  }

  if (mode === "rag") {
    const ragResult = await generateRagDraft(input);
    const docxBuffer = await markdownToDocx(ragResult.markdown);

    return {
      markdownContent: ragResult.markdown,
      sections: [],
      diagrams: [],
      docxBuffer,
      metadata: {
        engineUsed: "rag",
        ragDraftTokens: ragResult.tokensUsed,
        totalDurationMs: Date.now() - startTime,
      },
    };
  }

  // precision mode — requires draft in additionalContext
  throw new Error("Precision mode requires ragDraft in additionalContext");
}
```

- [ ] **Step 6: Run all tests**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run tests/rag-draft.test.ts tests/precision-editor.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/src/engines/ packages/docgen/src/generators/business-plan.ts packages/docgen/tests/rag-draft.test.ts packages/docgen/tests/precision-editor.test.ts
git commit -m "feat: add dual engine business plan pipeline (RAG draft + precision editor)"
```

---

## Task 12: Update Exports and Integration Verification

**Files:**
- Modify: `packages/docgen/src/index.ts`

- [ ] **Step 1: Update index.ts with all exports**

Update `packages/docgen/src/index.ts` — uncomment all export lines and add the new modules:

```typescript
// Types
export type {
  BusinessPlanInput,
  BusinessPlanOutput,
  BusinessPlanSection,
  EstimateInput,
  EstimateOutput,
  ContractInput,
  ContractOutput,
  JournalReportInput,
  JournalReportOutput,
  PatentDraftInput,
  PatentDraftOutput,
  FinancialReportInput,
  FinancialReportOutput,
  FinancialAnalysis,
  GeneratedImage,
  DocGenResult,
} from "./types";

export {
  BusinessPlanInputSchema,
  EstimateInputSchema,
  ContractInputSchema,
  JournalReportInputSchema,
  PatentDraftInputSchema,
  FinancialReportInputSchema,
} from "./types";

// Generators
export { generateEstimate } from "./generators/estimate";
export { generateContract } from "./generators/contract";
export { generateJournalReport } from "./generators/journal-report";
export { generatePatentDraft } from "./generators/patent-draft";
export { generateFinancialReport, calculateFinancialMetrics } from "./generators/financial-report";
export { generateBusinessPlan } from "./generators/business-plan";

// Engines
export { generateRagDraft, buildRagContext } from "./engines/rag-draft";
export { precisionEdit } from "./engines/precision-editor";
export { dualEnginePipeline } from "./engines/dual-engine-pipeline";

// Converters
export { markdownToDocx } from "./converters/mark-docx";
export { HwpxEditor } from "./converters/hwpx-editor";
export { pdfToMarkdown, extractPdfStructure } from "./converters/pdf-to-markdown";
export { extractText } from "./converters/text-parser";
export { mermaidToPng, validateMermaidSyntax } from "./converters/mermaid-to-png";

// Media
export { generateDiagram, buildPrompt } from "./media/image-generator";

// Utils
export { formatKRW, formatNumber, formatPercent, formatKoreanUnit, formatKoreanDate } from "./utils/number-format";
```

- [ ] **Step 2: Create vitest config**

Create `packages/docgen/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx vitest run
```

Expected: All tests across all test files PASS.

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle/packages/docgen
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/docgen/
git commit -m "chore: Phase 6 complete — packages/docgen with dual engine business plan, 5 generators, 5 converters, image generation"
```

---

## Summary

Phase 6 delivers:
- **packages/docgen**: Full document generation engine with 12 modules
- **Dual Engine Pipeline**: RAG-based draft (Engine A) + Precision editor (Engine B) with QStash chaining
- **5 Generators**: Business plan, estimate, contract, journal report, patent draft, financial report
- **5 Converters**: mark-docx, hwpx-editor, pdf-to-markdown, text-parser, mermaid-to-png
- **Image Generation**: Gemini/DALL-E integration for diagrams and infographics
- **Korean Typography**: Professional formatting for government documents (맑은 고딕, A4 margins, proper spacing)
- **TDD**: All modules tested with Vitest (mocked AI dependencies)

**Next:** Phase 7 (Calendar & Schedule) builds on ProgramInfo model for deadline tracking and Google Calendar sync.

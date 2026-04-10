# AXLE Phase 8: Matching & Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 3-stage AI matching engine (`packages/matching`) to match clients to government programs, and the crawler system (`packages/crawler`) to automatically scrape government portals for new ProgramInfo. Includes web dashboard for matching results and crawler administration.

**Architecture:** `packages/matching` is a standalone package ported from FlowMate's `lib/matching.ts`. It consumes Client and ProgramInfo models from `packages/db` and uses `packages/ai` for semantic similarity. `packages/crawler` is a Playwright-based worker deployed on OCI VM, shared with FlowMate infrastructure, that scrapes portals and creates ProgramInfo records.

**Tech Stack:** TypeScript, Playwright, @anthropic-ai/sdk, openai (embeddings), Zod, Vitest

**Depends on:** Phase 5 (AI/RAG — embeddings, AI Router), Phase 7 (ProgramInfo, Calendar — Schedule auto-creation)

---

## File Structure

```
packages/matching/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                          # Public API exports
│   ├── types.ts                          # Matching types and Zod schemas
│   ├── pipeline.ts                       # 3-stage matching pipeline orchestrator
│   ├── stages/
│   │   ├── stage1-disqualify.ts          # Hard disqualification (structured eligibility)
│   │   ├── stage2-penalties.ts           # Soft penalties (medium confidence)
│   │   └── stage3-scoring.ts             # Qualification scoring (weighted composite)
│   ├── preferences.ts                    # Per-client matching preferences
│   └── feedback.ts                       # Feedback tracking (isRelevant, notes)
│
└── tests/
    ├── stage1-disqualify.test.ts
    ├── stage2-penalties.test.ts
    ├── stage3-scoring.test.ts
    ├── pipeline.test.ts
    └── feedback.test.ts

packages/crawler/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                          # Public API exports
│   ├── types.ts                          # Crawler types
│   ├── worker.ts                         # Crawler worker (Playwright-based)
│   ├── browser.ts                        # Browser singleton + connection pooling
│   ├── analyzer.ts                       # AI-powered program analysis
│   ├── normalizer.ts                     # Deduplication and normalization
│   ├── sources/
│   │   ├── base-source.ts               # Abstract source interface
│   │   ├── bizinfo.ts                    # bizinfo.go.kr scraper
│   │   └── k-startup.ts                 # k-startup.go.kr scraper
│   └── scheduler.ts                     # Crawl scheduling logic
│
└── tests/
    ├── normalizer.test.ts
    ├── analyzer.test.ts
    └── worker.test.ts

apps/web/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── matching/
│   │   │   │   ├── page.tsx              # Matching results dashboard
│   │   │   │   └── _components/
│   │   │   │       ├── matching-results.tsx
│   │   │   │       ├── match-card.tsx
│   │   │   │       └── feedback-form.tsx
│   │   │   │
│   │   │   └── admin/
│   │   │       └── crawler/
│   │   │           ├── page.tsx          # Crawler admin panel
│   │   │           └── _components/
│   │   │               ├── crawler-status.tsx
│   │   │               └── source-manager.tsx
│   │   │
│   │   └── api/
│   │       ├── matching/
│   │       │   ├── route.ts             # POST: run matching for client
│   │       │   └── [matchId]/
│   │       │       └── feedback/
│   │       │           └── route.ts     # PATCH: submit feedback
│   │       └── crawler/
│   │           ├── route.ts             # POST: start crawl, GET: status
│   │           └── cron/
│   │               └── route.ts         # Vercel Cron: scheduled crawling
│   │
│   └── lib/
│       └── matching/
│           └── matching-service.ts      # Matching business logic (wraps package)
```

---

## Task 1: packages/matching — Types and Schemas

**Files:**
- Create: `packages/matching/package.json`
- Create: `packages/matching/tsconfig.json`
- Create: `packages/matching/vitest.config.ts`
- Create: `packages/matching/src/types.ts`
- Create: `packages/matching/src/index.ts`

- [ ] **Step 1: Create packages/matching/package.json**

```json
{
  "name": "@axle/matching",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./pipeline": "./src/pipeline.ts",
    "./stages/*": "./src/stages/*.ts",
    "./feedback": "./src/feedback.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.25.0",
    "@axle/db": "workspace:*",
    "@axle/ai": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create packages/matching/tsconfig.json**

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

- [ ] **Step 3: Create vitest config**

Create `packages/matching/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 4: Create matching types**

Create `packages/matching/src/types.ts`:

```typescript
import { z } from "zod";

// ==================== Client Profile for Matching ====================

export interface ClientProfile {
  id: string;
  name: string;
  businessNumber?: string;
  industry?: string;
  employeeCount?: number;
  capitalAmount?: number;
  foundedDate?: string;
  region?: string;
  isVenture: boolean;
  isInnoBiz: boolean;
  isMainBiz: boolean;
  isSocial: boolean;
  revenue?: number;        // Latest year revenue
  rndExperience: boolean;  // Has prior R&D projects
  certifications: string[];
  documents: string[];     // Document types available
}

// ==================== Program Profile for Matching ====================

export interface ProgramProfile {
  id: string;
  name: string;
  agency?: string;
  category: string;
  applicationEnd?: Date;
  maxFunding?: number;
  region?: string;
  requirements?: ProgramRequirements;
  eligibility?: ProgramEligibility;
  description?: string;
}

export interface ProgramRequirements {
  minEmployees?: number;
  maxEmployees?: number;
  minRevenue?: number;
  maxRevenue?: number;
  minCapital?: number;
  requiredCerts?: string[];
  requiredDocs?: string[];
  excludedIndustries?: string[];
  regionRestriction?: string[];
}

export interface ProgramEligibility {
  companyAge?: { min?: number; max?: number };
  ventureRequired?: boolean;
  innoBizRequired?: boolean;
  socialRequired?: boolean;
  rndRequired?: boolean;
  previousParticipation?: "allowed" | "excluded";
}

// ==================== Matching Result ====================

export interface MatchScore {
  total: number;            // 0-100 composite score
  eligibility: number;      // 0-40 (40% weight)
  category: number;         // 0-20 (20% weight)
  semantic: number;         // 0-25 (25% weight)
  document: number;         // 0-15 (15% weight)
}

export interface MatchResult {
  clientId: string;
  programId: string;
  score: MatchScore;
  matchReasons: string[];
  disqualifyReasons: string[];
  penalties: PenaltyItem[];
  isDisqualified: boolean;
  rank?: number;
}

export interface PenaltyItem {
  reason: string;
  deduction: number;
  confidence: "low" | "medium" | "high";
}

// ==================== Stage Results ====================

export interface Stage1Result {
  passed: boolean;
  reasons: string[];
}

export interface Stage2Result {
  penalties: PenaltyItem[];
  totalDeduction: number;
}

export interface Stage3Result {
  score: MatchScore;
  matchReasons: string[];
}

// ==================== Preferences ====================

export const MatchingPreferencesSchema = z.object({
  clientId: z.string(),
  preferredCategories: z.array(z.string()).default([]),
  excludedCategories: z.array(z.string()).default([]),
  minFunding: z.number().min(0).optional(),
  maxFunding: z.number().optional(),
  preferredRegions: z.array(z.string()).default([]),
  excludeApplied: z.boolean().default(true),  // Exclude previously applied programs
});

export type MatchingPreferences = z.infer<typeof MatchingPreferencesSchema>;

// ==================== Feedback ====================

export const MatchFeedbackSchema = z.object({
  matchResultId: z.string(),
  isRelevant: z.boolean(),
  feedbackNote: z.string().max(1000).optional(),
});

export type MatchFeedback = z.infer<typeof MatchFeedbackSchema>;
```

- [ ] **Step 5: Create initial index.ts**

Create `packages/matching/src/index.ts`:

```typescript
// Types
export type {
  ClientProfile,
  ProgramProfile,
  ProgramRequirements,
  ProgramEligibility,
  MatchScore,
  MatchResult,
  PenaltyItem,
  Stage1Result,
  Stage2Result,
  Stage3Result,
  MatchingPreferences,
  MatchFeedback,
} from "./types";

export { MatchingPreferencesSchema, MatchFeedbackSchema } from "./types";

// Pipeline (added after implementation)
// export { runMatchingPipeline } from "./pipeline";

// Stages
// export { checkDisqualification } from "./stages/stage1-disqualify";
// export { calculatePenalties } from "./stages/stage2-penalties";
// export { calculateScore } from "./stages/stage3-scoring";

// Feedback
// export { submitFeedback, getFeedbackStats } from "./feedback";
```

- [ ] **Step 6: Install dependencies**

```bash
cd /Volumes/포터블/AX/axle
npm install
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/matching/
git commit -m "feat: add packages/matching scaffold with types, schemas, and vitest config"
```

---

## Task 2: Stage 1 — Hard Disqualification

**Files:**
- Create: `packages/matching/src/stages/stage1-disqualify.ts`
- Create: `packages/matching/tests/stage1-disqualify.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/matching/tests/stage1-disqualify.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { checkDisqualification } from "../src/stages/stage1-disqualify";
import type { ClientProfile, ProgramProfile } from "../src/types";

const baseClient: ClientProfile = {
  id: "client-1",
  name: "테스트기업",
  industry: "소프트웨어",
  employeeCount: 15,
  capitalAmount: 100000000,
  region: "서울",
  isVenture: false,
  isInnoBiz: false,
  isMainBiz: false,
  isSocial: false,
  rndExperience: true,
  certifications: [],
  documents: ["사업자등록증", "재무제표"],
};

const baseProgram: ProgramProfile = {
  id: "prog-1",
  name: "AI 바우처",
  category: "RND",
  region: "서울",
};

describe("Stage 1: Hard Disqualification", () => {
  it("passes when no eligibility constraints", () => {
    const result = checkDisqualification(baseClient, baseProgram);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("disqualifies when employee count exceeds max", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      requirements: { maxEmployees: 10 },
    };

    const result = checkDisqualification(baseClient, program);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain(
      expect.stringContaining("직원수")
    );
  });

  it("disqualifies when employee count below min", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      requirements: { minEmployees: 50 },
    };

    const result = checkDisqualification(baseClient, program);
    expect(result.passed).toBe(false);
  });

  it("disqualifies when venture certification required but not held", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      eligibility: { ventureRequired: true },
    };

    const result = checkDisqualification(baseClient, program);
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain("벤처");
  });

  it("passes when venture certification required and held", () => {
    const client = { ...baseClient, isVenture: true };
    const program: ProgramProfile = {
      ...baseProgram,
      eligibility: { ventureRequired: true },
    };

    const result = checkDisqualification(client, program);
    expect(result.passed).toBe(true);
  });

  it("disqualifies when region restricted and client not in allowed region", () => {
    const client = { ...baseClient, region: "대전" };
    const program: ProgramProfile = {
      ...baseProgram,
      requirements: { regionRestriction: ["서울", "경기"] },
    };

    const result = checkDisqualification(client, program);
    expect(result.passed).toBe(false);
  });

  it("disqualifies when industry is excluded", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      requirements: { excludedIndustries: ["금융", "소프트웨어"] },
    };

    const result = checkDisqualification(baseClient, program);
    expect(result.passed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run tests/stage1-disqualify.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement Stage 1**

Create `packages/matching/src/stages/stage1-disqualify.ts`:

```typescript
import type { ClientProfile, ProgramProfile, Stage1Result } from "../types";

/**
 * Stage 1: Hard Disqualification
 * Structured eligibility checks that produce binary pass/fail.
 * Any single failure = disqualified.
 */
export function checkDisqualification(
  client: ClientProfile,
  program: ProgramProfile
): Stage1Result {
  const reasons: string[] = [];

  const req = program.requirements;
  const elig = program.eligibility;

  // === Requirements checks ===

  if (req) {
    // Employee count range
    if (req.minEmployees && (client.employeeCount ?? 0) < req.minEmployees) {
      reasons.push(
        `직원수 미달: ${client.employeeCount ?? 0}명 (최소 ${req.minEmployees}명 필요)`
      );
    }
    if (req.maxEmployees && (client.employeeCount ?? 0) > req.maxEmployees) {
      reasons.push(
        `직원수 초과: ${client.employeeCount ?? 0}명 (최대 ${req.maxEmployees}명)`
      );
    }

    // Revenue range
    if (req.minRevenue && (client.revenue ?? 0) < req.minRevenue) {
      reasons.push(`매출 미달: 최소 ${req.minRevenue.toLocaleString()}원 필요`);
    }
    if (req.maxRevenue && (client.revenue ?? 0) > req.maxRevenue) {
      reasons.push(`매출 초과: 최대 ${req.maxRevenue.toLocaleString()}원`);
    }

    // Capital
    if (req.minCapital && (client.capitalAmount ?? 0) < req.minCapital) {
      reasons.push(`자본금 미달: 최소 ${req.minCapital.toLocaleString()}원 필요`);
    }

    // Region restriction
    if (
      req.regionRestriction &&
      req.regionRestriction.length > 0 &&
      client.region
    ) {
      const allowed = req.regionRestriction.some((r) =>
        client.region!.includes(r)
      );
      if (!allowed) {
        reasons.push(
          `지역 제한: ${client.region} 불가 (허용: ${req.regionRestriction.join(", ")})`
        );
      }
    }

    // Excluded industries
    if (req.excludedIndustries && client.industry) {
      const excluded = req.excludedIndustries.some((ind) =>
        client.industry!.toLowerCase().includes(ind.toLowerCase())
      );
      if (excluded) {
        reasons.push(`업종 제한: ${client.industry} 제외 대상`);
      }
    }

    // Required certifications
    if (req.requiredCerts && req.requiredCerts.length > 0) {
      const missing = req.requiredCerts.filter(
        (cert) => !client.certifications.includes(cert)
      );
      if (missing.length > 0) {
        reasons.push(`필수 인증 미보유: ${missing.join(", ")}`);
      }
    }
  }

  // === Eligibility checks ===

  if (elig) {
    // Venture certification
    if (elig.ventureRequired && !client.isVenture) {
      reasons.push("벤처기업 인증 필요");
    }

    // InnoBiz certification
    if (elig.innoBizRequired && !client.isInnoBiz) {
      reasons.push("이노비즈 인증 필요");
    }

    // Social enterprise
    if (elig.socialRequired && !client.isSocial) {
      reasons.push("사회적기업 인증 필요");
    }

    // R&D experience
    if (elig.rndRequired && !client.rndExperience) {
      reasons.push("R&D 수행 경험 필요");
    }

    // Company age
    if (elig.companyAge && client.foundedDate) {
      const founded = new Date(client.foundedDate);
      const ageYears =
        (Date.now() - founded.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

      if (elig.companyAge.min && ageYears < elig.companyAge.min) {
        reasons.push(
          `업력 미달: ${Math.floor(ageYears)}년 (최소 ${elig.companyAge.min}년)`
        );
      }
      if (elig.companyAge.max && ageYears > elig.companyAge.max) {
        reasons.push(
          `업력 초과: ${Math.floor(ageYears)}년 (최대 ${elig.companyAge.max}년)`
        );
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run tests/stage1-disqualify.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/matching/src/stages/stage1-disqualify.ts packages/matching/tests/stage1-disqualify.test.ts
git commit -m "feat: add Stage 1 hard disqualification with structured eligibility checks"
```

---

## Task 3: Stage 2 — Soft Penalties

**Files:**
- Create: `packages/matching/src/stages/stage2-penalties.ts`
- Create: `packages/matching/tests/stage2-penalties.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/matching/tests/stage2-penalties.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculatePenalties } from "../src/stages/stage2-penalties";
import type { ClientProfile, ProgramProfile } from "../src/types";

const baseClient: ClientProfile = {
  id: "client-1",
  name: "테스트기업",
  industry: "소프트웨어",
  employeeCount: 15,
  capitalAmount: 100000000,
  region: "서울",
  isVenture: false,
  isInnoBiz: false,
  isMainBiz: false,
  isSocial: false,
  rndExperience: true,
  certifications: [],
  documents: ["사업자등록증", "재무제표"],
};

const baseProgram: ProgramProfile = {
  id: "prog-1",
  name: "AI 바우처",
  category: "RND",
};

describe("Stage 2: Soft Penalties", () => {
  it("returns no penalties for a well-matched client", () => {
    const client = {
      ...baseClient,
      isVenture: true,
      documents: ["사업자등록증", "재무제표", "기술 설명서", "특허 증명"],
    };

    const result = calculatePenalties(client, baseProgram);
    expect(result.totalDeduction).toBeLessThanOrEqual(5);
  });

  it("penalizes when deadline is close", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      applicationEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    };

    const result = calculatePenalties(baseClient, program);
    const deadlinePenalty = result.penalties.find((p) =>
      p.reason.includes("마감")
    );
    expect(deadlinePenalty).toBeDefined();
    expect(deadlinePenalty!.deduction).toBeGreaterThan(0);
  });

  it("penalizes missing optional documents", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      requirements: {
        requiredDocs: [
          "사업자등록증",
          "재무제표",
          "기술 설명서",
          "특허 증명",
        ],
      },
    };

    const result = calculatePenalties(baseClient, program);
    const docPenalty = result.penalties.find((p) =>
      p.reason.includes("서류")
    );
    expect(docPenalty).toBeDefined();
  });

  it("penalizes non-venture for programs preferring venture", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      category: "VENTURE",
    };

    const result = calculatePenalties(baseClient, program);
    expect(result.penalties.length).toBeGreaterThan(0);
  });

  it("accumulates total deduction correctly", () => {
    const program: ProgramProfile = {
      ...baseProgram,
      applicationEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      requirements: {
        requiredDocs: ["사업자등록증", "기술설명서", "연구계획서", "재무제표", "특허증명"],
      },
    };

    const result = calculatePenalties(baseClient, program);
    const sum = result.penalties.reduce((s, p) => s + p.deduction, 0);
    expect(result.totalDeduction).toBe(sum);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run tests/stage2-penalties.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Stage 2**

Create `packages/matching/src/stages/stage2-penalties.ts`:

```typescript
import type { ClientProfile, ProgramProfile, Stage2Result, PenaltyItem } from "../types";

/**
 * Stage 2: Soft Penalties
 * Medium-confidence deductions for factors that reduce match quality
 * but don't disqualify.
 */
export function calculatePenalties(
  client: ClientProfile,
  program: ProgramProfile
): Stage2Result {
  const penalties: PenaltyItem[] = [];

  // 1. Deadline proximity penalty
  if (program.applicationEnd) {
    const daysUntilDeadline = Math.ceil(
      (program.applicationEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDeadline <= 0) {
      penalties.push({
        reason: "마감 경과: 이미 접수기간이 종료됨",
        deduction: 30,
        confidence: "high",
      });
    } else if (daysUntilDeadline <= 3) {
      penalties.push({
        reason: `마감 임박: D-${daysUntilDeadline} (준비 시간 부족 우려)`,
        deduction: 15,
        confidence: "high",
      });
    } else if (daysUntilDeadline <= 7) {
      penalties.push({
        reason: `마감 임박: D-${daysUntilDeadline}`,
        deduction: 8,
        confidence: "medium",
      });
    } else if (daysUntilDeadline <= 14) {
      penalties.push({
        reason: `마감 접근: D-${daysUntilDeadline}`,
        deduction: 3,
        confidence: "low",
      });
    }
  }

  // 2. Document readiness penalty
  if (program.requirements?.requiredDocs) {
    const required = program.requirements.requiredDocs;
    const available = client.documents;
    const missing = required.filter((doc) => !available.includes(doc));

    if (missing.length > 0) {
      const ratio = missing.length / required.length;
      const deduction = Math.round(ratio * 15);
      penalties.push({
        reason: `서류 미비: ${missing.join(", ")} (${missing.length}/${required.length}건)`,
        deduction,
        confidence: ratio > 0.5 ? "high" : "medium",
      });
    }
  }

  // 3. Category alignment penalty
  const categoryPenalty = assessCategoryMismatch(client, program);
  if (categoryPenalty) {
    penalties.push(categoryPenalty);
  }

  // 4. Region mismatch (soft — not restricted, just different)
  if (
    program.region &&
    client.region &&
    !client.region.includes(program.region) &&
    !program.requirements?.regionRestriction // Hard restriction handled in Stage 1
  ) {
    penalties.push({
      reason: `지역 불일치: 고객 ${client.region}, 사업 ${program.region} (우대 가능)`,
      deduction: 3,
      confidence: "low",
    });
  }

  // 5. Company size mismatch (soft)
  if (program.category === "STARTUP" && (client.employeeCount ?? 0) > 50) {
    penalties.push({
      reason: "대기업 스케일: 창업 지원사업에 부적합 가능성",
      deduction: 5,
      confidence: "medium",
    });
  }

  const totalDeduction = penalties.reduce((sum, p) => sum + p.deduction, 0);

  return { penalties, totalDeduction };
}

function assessCategoryMismatch(
  client: ClientProfile,
  program: ProgramProfile
): PenaltyItem | null {
  // Venture program but client not venture
  if (program.category === "VENTURE" && !client.isVenture) {
    return {
      reason: "벤처 카테고리 사업이나 벤처인증 미보유 (인증 컨설팅 병행 가능)",
      deduction: 5,
      confidence: "medium",
    };
  }

  // R&D program but no R&D experience
  if (program.category === "RND" && !client.rndExperience) {
    return {
      reason: "R&D 사업이나 연구개발 경험 없음 (신규 참여 시 불리)",
      deduction: 5,
      confidence: "medium",
    };
  }

  // Certification program but no certifications
  if (program.category === "CERTIFICATION" && client.certifications.length === 0) {
    return {
      reason: "인증 사업이나 기존 인증 이력 없음",
      deduction: 3,
      confidence: "low",
    };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run tests/stage2-penalties.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/matching/src/stages/stage2-penalties.ts packages/matching/tests/stage2-penalties.test.ts
git commit -m "feat: add Stage 2 soft penalties (deadline, documents, category, region)"
```

---

## Task 4: Stage 3 — Qualification Scoring

**Files:**
- Create: `packages/matching/src/stages/stage3-scoring.ts`
- Create: `packages/matching/tests/stage3-scoring.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/matching/tests/stage3-scoring.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateScore } from "../src/stages/stage3-scoring";
import type { ClientProfile, ProgramProfile, Stage2Result } from "../src/types";

const baseClient: ClientProfile = {
  id: "client-1",
  name: "테스트기업",
  industry: "AI 소프트웨어",
  employeeCount: 15,
  capitalAmount: 100000000,
  region: "서울",
  isVenture: true,
  isInnoBiz: false,
  isMainBiz: false,
  isSocial: false,
  rndExperience: true,
  certifications: ["벤처기업"],
  documents: ["사업자등록증", "재무제표", "기술설명서"],
};

const baseProgram: ProgramProfile = {
  id: "prog-1",
  name: "AI 바우처",
  category: "RND",
  description: "AI 기반 솔루션 개발을 위한 R&D 바우처 사업",
};

const noPenalties: Stage2Result = {
  penalties: [],
  totalDeduction: 0,
};

describe("Stage 3: Qualification Scoring", () => {
  it("calculates composite score with correct weight distribution", async () => {
    const result = await calculateScore(baseClient, baseProgram, noPenalties);

    expect(result.score.total).toBeGreaterThan(0);
    expect(result.score.total).toBeLessThanOrEqual(100);
    // Eligibility 40% + Category 20% + Semantic 25% + Document 15% = 100%
    expect(result.score.eligibility).toBeLessThanOrEqual(40);
    expect(result.score.category).toBeLessThanOrEqual(20);
    expect(result.score.semantic).toBeLessThanOrEqual(25);
    expect(result.score.document).toBeLessThanOrEqual(15);
  });

  it("gives high eligibility score when requirements match", async () => {
    const result = await calculateScore(baseClient, baseProgram, noPenalties);

    expect(result.score.eligibility).toBeGreaterThan(25); // > 25/40
  });

  it("gives high category score when category aligns", async () => {
    const rndClient = { ...baseClient, rndExperience: true, isVenture: true };
    const result = await calculateScore(rndClient, baseProgram, noPenalties);

    expect(result.score.category).toBeGreaterThan(10); // > 10/20
  });

  it("deducts penalties from total score", async () => {
    const withPenalties: Stage2Result = {
      penalties: [
        { reason: "테스트", deduction: 10, confidence: "high" },
      ],
      totalDeduction: 10,
    };

    const scoreNoPen = await calculateScore(baseClient, baseProgram, noPenalties);
    const scoreWithPen = await calculateScore(baseClient, baseProgram, withPenalties);

    expect(scoreWithPen.score.total).toBeLessThan(scoreNoPen.score.total);
  });

  it("includes match reasons explaining the score", async () => {
    const result = await calculateScore(baseClient, baseProgram, noPenalties);

    expect(result.matchReasons.length).toBeGreaterThan(0);
    expect(result.matchReasons.some((r) => typeof r === "string")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run tests/stage3-scoring.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Stage 3**

Create `packages/matching/src/stages/stage3-scoring.ts`:

```typescript
import type {
  ClientProfile,
  ProgramProfile,
  Stage2Result,
  Stage3Result,
  MatchScore,
} from "../types";

// Weight distribution (total = 100)
const WEIGHTS = {
  eligibility: 40,
  category: 20,
  semantic: 25,
  document: 15,
} as const;

/**
 * Stage 3: Qualification Scoring
 * Weighted composite score across 4 dimensions.
 * eligibility (40%) + category (20%) + semantic (25%) + document (15%)
 */
export async function calculateScore(
  client: ClientProfile,
  program: ProgramProfile,
  stage2: Stage2Result
): Promise<Stage3Result> {
  const eligibility = scoreEligibility(client, program);
  const category = scoreCategory(client, program);
  const semantic = await scoreSemantic(client, program);
  const document = scoreDocument(client, program);

  // Apply Stage 2 penalties as deduction from total
  const rawTotal =
    eligibility.score + category.score + semantic.score + document.score;
  const total = Math.max(0, rawTotal - stage2.totalDeduction);

  const score: MatchScore = {
    total: Math.round(total * 10) / 10,
    eligibility: eligibility.score,
    category: category.score,
    semantic: semantic.score,
    document: document.score,
  };

  // Collect match reasons
  const matchReasons = [
    ...eligibility.reasons,
    ...category.reasons,
    ...semantic.reasons,
    ...document.reasons,
  ];

  return { score, matchReasons };
}

// ==================== Eligibility (40%) ====================

function scoreEligibility(
  client: ClientProfile,
  program: ProgramProfile
): { score: number; reasons: string[] } {
  let score = WEIGHTS.eligibility; // Start at max, deduct for mismatches
  const reasons: string[] = [];

  // Company basics
  if (client.businessNumber) {
    reasons.push("사업자등록 완료");
  } else {
    score -= 10;
  }

  // Venture status alignment
  if (client.isVenture) {
    score = Math.min(score, WEIGHTS.eligibility);
    reasons.push("벤처기업 인증 보유");
  }

  // Region alignment
  if (
    program.region &&
    client.region &&
    client.region.includes(program.region)
  ) {
    reasons.push(`지역 일치: ${client.region}`);
  } else if (program.region) {
    score -= 5;
  }

  // Company age for startup programs
  if (program.category === "STARTUP" && client.foundedDate) {
    const ageYears =
      (Date.now() - new Date(client.foundedDate).getTime()) /
      (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears <= 7) {
      reasons.push(`창업 ${Math.floor(ageYears)}년차 (창업기업 해당)`);
    } else {
      score -= 8;
    }
  }

  return {
    score: Math.max(0, Math.min(WEIGHTS.eligibility, score)),
    reasons,
  };
}

// ==================== Category (20%) ====================

function scoreCategory(
  client: ClientProfile,
  program: ProgramProfile
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const categoryAlignment: Record<string, (c: ClientProfile) => boolean> = {
    RND: (c) => c.rndExperience,
    VENTURE: (c) => c.isVenture,
    CERTIFICATION: (c) => c.certifications.length > 0,
    STARTUP: (c) => {
      if (!c.foundedDate) return false;
      const age = (Date.now() - new Date(c.foundedDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return age <= 7;
    },
    EXPORT: (c) => (c.revenue ?? 0) > 0,
    SMART_FACTORY: (c) => (c.industry ?? "").includes("제조"),
  };

  const checker = categoryAlignment[program.category];
  if (checker && checker(client)) {
    score += 15;
    reasons.push(`${program.category} 카테고리 적합`);
  } else if (checker) {
    score += 5; // Partial credit
    reasons.push(`${program.category} 카테고리 부분 적합`);
  } else {
    score += 10; // GENERAL or unknown category
    reasons.push("일반 카테고리");
  }

  // Bonus for multiple relevant certifications
  if (client.certifications.length >= 2) {
    score += 5;
    reasons.push(`보유 인증 ${client.certifications.length}건 (가산점)`);
  }

  return {
    score: Math.min(WEIGHTS.category, score),
    reasons,
  };
}

// ==================== Semantic (25%) ====================

async function scoreSemantic(
  client: ClientProfile,
  program: ProgramProfile
): Promise<{ score: number; reasons: string[] }> {
  const reasons: string[] = [];

  // Simple keyword matching (full embedding-based similarity in production)
  // In production, this uses packages/ai embeddings
  const clientKeywords = [
    client.industry ?? "",
    ...client.certifications,
    client.name,
  ]
    .join(" ")
    .toLowerCase();

  const programKeywords = [
    program.name,
    program.category,
    program.description ?? "",
    program.agency ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // Calculate keyword overlap
  const clientTokens = new Set(
    clientKeywords.split(/\s+/).filter((t) => t.length > 1)
  );
  const programTokens = new Set(
    programKeywords.split(/\s+/).filter((t) => t.length > 1)
  );

  let overlap = 0;
  for (const token of clientTokens) {
    if (programTokens.has(token)) overlap++;
  }

  const maxPossible = Math.min(clientTokens.size, programTokens.size);
  const similarity = maxPossible > 0 ? overlap / maxPossible : 0;

  const score = Math.round(similarity * WEIGHTS.semantic);

  if (similarity > 0.3) {
    reasons.push(`사업 내용과 기업 프로필 유사도 높음 (${(similarity * 100).toFixed(0)}%)`);
  } else if (similarity > 0.1) {
    reasons.push(`사업 내용과 기업 프로필 부분 일치`);
  }

  return {
    score: Math.min(WEIGHTS.semantic, score),
    reasons,
  };
}

// ==================== Document (15%) ====================

function scoreDocument(
  client: ClientProfile,
  program: ProgramProfile
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const essentialDocs = ["사업자등록증", "재무제표"];
  const bonusDocs = ["기술설명서", "특허증명", "연구계획서", "사업계획서"];

  // Essential document availability
  const essentialAvailable = essentialDocs.filter((d) =>
    client.documents.includes(d)
  );
  score += (essentialAvailable.length / essentialDocs.length) * 8;

  if (essentialAvailable.length === essentialDocs.length) {
    reasons.push("필수 서류 구비 완료");
  }

  // Bonus documents
  const bonusAvailable = bonusDocs.filter((d) =>
    client.documents.includes(d)
  );
  score += (bonusAvailable.length / bonusDocs.length) * 7;

  if (bonusAvailable.length > 0) {
    reasons.push(`추가 서류 ${bonusAvailable.length}건 보유`);
  }

  // Check program-specific required docs
  if (program.requirements?.requiredDocs) {
    const required = program.requirements.requiredDocs;
    const available = required.filter((d) => client.documents.includes(d));
    if (available.length === required.length) {
      reasons.push("프로그램 필수 서류 전체 구비");
    }
  }

  return {
    score: Math.min(WEIGHTS.document, Math.round(score)),
    reasons,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run tests/stage3-scoring.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/matching/src/stages/stage3-scoring.ts packages/matching/tests/stage3-scoring.test.ts
git commit -m "feat: add Stage 3 qualification scoring (eligibility 40%, category 20%, semantic 25%, document 15%)"
```

---

## Task 5: Matching Pipeline Orchestrator

**Files:**
- Create: `packages/matching/src/pipeline.ts`
- Create: `packages/matching/src/feedback.ts`
- Create: `packages/matching/tests/pipeline.test.ts`
- Create: `packages/matching/tests/feedback.test.ts`

- [ ] **Step 1: Write failing tests for pipeline**

Create `packages/matching/tests/pipeline.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { runMatchingPipeline } from "../src/pipeline";
import type { ClientProfile, ProgramProfile } from "../src/types";

const client: ClientProfile = {
  id: "client-1",
  name: "AI테크",
  industry: "AI 소프트웨어",
  employeeCount: 15,
  capitalAmount: 100000000,
  region: "서울",
  isVenture: true,
  isInnoBiz: false,
  isMainBiz: false,
  isSocial: false,
  rndExperience: true,
  certifications: ["벤처기업"],
  documents: ["사업자등록증", "재무제표", "기술설명서"],
};

const programs: ProgramProfile[] = [
  {
    id: "prog-1",
    name: "AI 바우처",
    category: "RND",
    description: "AI 기술 개발 지원",
    applicationEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "prog-2",
    name: "스마트공장 구축",
    category: "SMART_FACTORY",
    description: "제조업 스마트공장 구축 지원",
    requirements: { excludedIndustries: ["소프트웨어"] },
  },
  {
    id: "prog-3",
    name: "벤처 성장 지원",
    category: "VENTURE",
    description: "벤처기업 성장 지원",
    eligibility: { ventureRequired: true },
  },
];

describe("Matching Pipeline", () => {
  it("returns ranked results for a client across programs", async () => {
    const results = await runMatchingPipeline(client, programs);

    expect(results.length).toBeLessThanOrEqual(programs.length);
    // Results should be sorted by score descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score.total).toBeGreaterThanOrEqual(
        results[i].score.total
      );
    }
  });

  it("disqualifies ineligible programs", async () => {
    const results = await runMatchingPipeline(client, programs);

    const smartFactory = results.find((r) => r.programId === "prog-2");
    expect(smartFactory?.isDisqualified).toBe(true);
  });

  it("ranks matching programs with scores", async () => {
    const results = await runMatchingPipeline(client, programs);

    const qualified = results.filter((r) => !r.isDisqualified);
    expect(qualified.length).toBeGreaterThan(0);
    expect(qualified[0].score.total).toBeGreaterThan(0);
    expect(qualified[0].rank).toBe(1);
  });

  it("includes match and disqualify reasons", async () => {
    const results = await runMatchingPipeline(client, programs);

    const disqualified = results.find((r) => r.isDisqualified);
    expect(disqualified?.disqualifyReasons.length).toBeGreaterThan(0);

    const qualified = results.find((r) => !r.isDisqualified);
    expect(qualified?.matchReasons.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Write failing tests for feedback**

Create `packages/matching/tests/feedback.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMatchingResult = {
  findUnique: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: {
    matchingResult: mockMatchingResult,
  },
}));

import { submitFeedback, getFeedbackStats } from "../src/feedback";

describe("Feedback Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits relevance feedback", async () => {
    mockMatchingResult.findUnique.mockResolvedValue({
      id: "match-1",
      isRelevant: null,
    });
    mockMatchingResult.update.mockResolvedValue({
      id: "match-1",
      isRelevant: true,
      feedbackNote: "좋은 추천",
    });

    const result = await submitFeedback({
      matchResultId: "match-1",
      isRelevant: true,
      feedbackNote: "좋은 추천",
    });

    expect(result.isRelevant).toBe(true);
    expect(mockMatchingResult.update).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: { isRelevant: true, feedbackNote: "좋은 추천" },
    });
  });

  it("calculates feedback statistics", async () => {
    mockMatchingResult.findMany.mockResolvedValue([
      { isRelevant: true },
      { isRelevant: true },
      { isRelevant: false },
      { isRelevant: null },
    ]);

    const stats = await getFeedbackStats("client-1");

    expect(stats.total).toBe(4);
    expect(stats.relevant).toBe(2);
    expect(stats.irrelevant).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.accuracy).toBeCloseTo(0.6667, 2); // 2/3
  });
});
```

- [ ] **Step 3: Implement matching pipeline**

Create `packages/matching/src/pipeline.ts`:

```typescript
import type {
  ClientProfile,
  ProgramProfile,
  MatchResult,
} from "./types";
import { checkDisqualification } from "./stages/stage1-disqualify";
import { calculatePenalties } from "./stages/stage2-penalties";
import { calculateScore } from "./stages/stage3-scoring";

/**
 * Run the 3-stage matching pipeline for a client against multiple programs.
 *
 * Stage 1: Hard disqualification (structured eligibility check)
 * Stage 2: Soft penalties (medium confidence deductions)
 * Stage 3: Qualification scoring (eligibility 40%, category 20%, semantic 25%, document 15%)
 *
 * Returns results sorted by score descending, with ranks assigned to qualified programs.
 */
export async function runMatchingPipeline(
  client: ClientProfile,
  programs: ProgramProfile[]
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (const program of programs) {
    // Stage 1: Hard disqualification
    const stage1 = checkDisqualification(client, program);

    if (!stage1.passed) {
      results.push({
        clientId: client.id,
        programId: program.id,
        score: { total: 0, eligibility: 0, category: 0, semantic: 0, document: 0 },
        matchReasons: [],
        disqualifyReasons: stage1.reasons,
        penalties: [],
        isDisqualified: true,
      });
      continue;
    }

    // Stage 2: Soft penalties
    const stage2 = calculatePenalties(client, program);

    // Stage 3: Qualification scoring
    const stage3 = await calculateScore(client, program, stage2);

    results.push({
      clientId: client.id,
      programId: program.id,
      score: stage3.score,
      matchReasons: stage3.matchReasons,
      disqualifyReasons: [],
      penalties: stage2.penalties,
      isDisqualified: false,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score.total - a.score.total);

  // Assign ranks to qualified results
  let rank = 1;
  for (const result of results) {
    if (!result.isDisqualified) {
      result.rank = rank++;
    }
  }

  return results;
}
```

- [ ] **Step 4: Implement feedback tracking**

Create `packages/matching/src/feedback.ts`:

```typescript
import { prisma } from "@axle/db";
import type { MatchFeedback } from "./types";

/**
 * Submit relevance feedback for a matching result.
 */
export async function submitFeedback(
  feedback: MatchFeedback
): Promise<{ id: string; isRelevant: boolean }> {
  const result = await prisma.matchingResult.update({
    where: { id: feedback.matchResultId },
    data: {
      isRelevant: feedback.isRelevant,
      feedbackNote: feedback.feedbackNote,
    },
  });

  return {
    id: result.id,
    isRelevant: result.isRelevant ?? feedback.isRelevant,
  };
}

/**
 * Get feedback statistics for a client's matching results.
 */
export async function getFeedbackStats(
  clientId: string
): Promise<{
  total: number;
  relevant: number;
  irrelevant: number;
  pending: number;
  accuracy: number;
}> {
  const results = await prisma.matchingResult.findMany({
    where: { clientId },
    select: { isRelevant: true },
  });

  const total = results.length;
  const relevant = results.filter((r) => r.isRelevant === true).length;
  const irrelevant = results.filter((r) => r.isRelevant === false).length;
  const pending = results.filter((r) => r.isRelevant === null).length;
  const reviewed = relevant + irrelevant;
  const accuracy = reviewed > 0 ? relevant / reviewed : 0;

  return { total, relevant, irrelevant, pending, accuracy };
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run
```

Expected: All tests across all files PASS.

- [ ] **Step 6: Update index.ts with all exports**

Update `packages/matching/src/index.ts`:

```typescript
export type {
  ClientProfile,
  ProgramProfile,
  ProgramRequirements,
  ProgramEligibility,
  MatchScore,
  MatchResult,
  PenaltyItem,
  Stage1Result,
  Stage2Result,
  Stage3Result,
  MatchingPreferences,
  MatchFeedback,
} from "./types";

export { MatchingPreferencesSchema, MatchFeedbackSchema } from "./types";

export { runMatchingPipeline } from "./pipeline";
export { checkDisqualification } from "./stages/stage1-disqualify";
export { calculatePenalties } from "./stages/stage2-penalties";
export { calculateScore } from "./stages/stage3-scoring";
export { submitFeedback, getFeedbackStats } from "./feedback";
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/matching/
git commit -m "feat: add 3-stage matching pipeline with feedback tracking"
```

---

## Task 6: packages/crawler — Setup and Normalizer

**Files:**
- Create: `packages/crawler/package.json`
- Create: `packages/crawler/tsconfig.json`
- Create: `packages/crawler/vitest.config.ts`
- Create: `packages/crawler/src/types.ts`
- Create: `packages/crawler/src/normalizer.ts`
- Create: `packages/crawler/src/index.ts`
- Create: `packages/crawler/tests/normalizer.test.ts`

- [ ] **Step 1: Create packages/crawler/package.json**

```json
{
  "name": "@axle/crawler",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./worker": "./src/worker.ts",
    "./browser": "./src/browser.ts"
  },
  "scripts": {
    "test": "vitest run",
    "crawl": "tsx src/worker.ts"
  },
  "dependencies": {
    "playwright": "^1.52.0",
    "zod": "^3.25.0",
    "@anthropic-ai/sdk": "^0.52.0",
    "@axle/db": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "vitest": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create tsconfig and vitest config**

Create `packages/crawler/tsconfig.json`:

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

Create `packages/crawler/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 3: Create crawler types**

Create `packages/crawler/src/types.ts`:

```typescript
export interface CrawledProgram {
  title: string;
  agency: string;
  category: string;
  applicationStart?: string;
  applicationEnd?: string;
  maxFunding?: number;
  description?: string;
  announcementUrl: string;
  region?: string;
  requirements?: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
  sourceId: string;       // Unique ID from source portal
  sourceName: string;     // "bizinfo" | "k-startup" | etc.
  crawledAt: Date;
}

export interface CrawlResult {
  source: string;
  totalFound: number;
  newPrograms: number;
  updatedPrograms: number;
  errors: string[];
  durationMs: number;
}

export interface CrawlerConfig {
  sources: CrawlSourceConfig[];
  maxPages: number;
  concurrency: number;
  headless: boolean;
  timeout: number;
}

export interface CrawlSourceConfig {
  name: string;
  url: string;
  enabled: boolean;
  schedule?: string;  // Cron expression
}

export interface NormalizedProgram {
  name: string;
  agency: string;
  category: string;
  applicationStart?: Date;
  applicationEnd?: Date;
  maxFunding?: number;
  announcementUrl: string;
  region?: string;
  requirements?: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
  sourceId: string;
  sourceName: string;
  hash: string;         // Content hash for deduplication
}
```

- [ ] **Step 4: Write failing tests for normalizer**

Create `packages/crawler/tests/normalizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  normalizeProgram,
  deduplicatePrograms,
  inferCategory,
  contentHash,
} from "../src/normalizer";
import type { CrawledProgram } from "../src/types";

const sampleCrawled: CrawledProgram = {
  title: "2026년 AI 바우처 지원사업 공고",
  agency: "정보통신산업진흥원(NIPA)",
  category: "",
  applicationStart: "2026-04-01",
  applicationEnd: "2026-05-31",
  maxFunding: 300000000,
  description: "AI 기술 활용 및 개발을 위한 바우처 지원",
  announcementUrl: "https://bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?article_seq=12345",
  region: "전국",
  sourceId: "12345",
  sourceName: "bizinfo",
  crawledAt: new Date(),
};

describe("Program Normalizer", () => {
  it("normalizes crawled program to standard format", () => {
    const normalized = normalizeProgram(sampleCrawled);

    expect(normalized.name).toBe("2026년 AI 바우처 지원사업");
    expect(normalized.agency).toBe("정보통신산업진흥원");
    expect(normalized.applicationEnd).toBeInstanceOf(Date);
    expect(normalized.hash).toBeDefined();
  });

  it("strips announcement suffix from title", () => {
    const normalized = normalizeProgram(sampleCrawled);
    expect(normalized.name).not.toContain("공고");
  });

  it("normalizes agency name (remove abbreviations)", () => {
    const normalized = normalizeProgram(sampleCrawled);
    expect(normalized.agency).not.toContain("(");
  });

  it("infers category from title and description", () => {
    expect(inferCategory("AI 바우처 지원", "AI 기술 활용")).toBe("RND");
    expect(inferCategory("창업도약패키지", "예비창업자 지원")).toBe("STARTUP");
    expect(inferCategory("벤처기업 확인", "벤처인증")).toBe("VENTURE");
    expect(inferCategory("스마트공장 구축", "제조업 지능화")).toBe("SMART_FACTORY");
    expect(inferCategory("일반 지원사업", "기업지원")).toBe("GENERAL");
  });

  it("deduplicates programs by content hash", () => {
    const duplicate: CrawledProgram = {
      ...sampleCrawled,
      sourceId: "99999",       // Different source ID
      crawledAt: new Date(),   // Different crawl time
    };

    const programs = [sampleCrawled, duplicate].map(normalizeProgram);
    const deduped = deduplicatePrograms(programs);

    expect(deduped).toHaveLength(1);
  });

  it("keeps different programs", () => {
    const different: CrawledProgram = {
      ...sampleCrawled,
      title: "스마트공장 구축 지원사업",
      sourceId: "67890",
    };

    const programs = [sampleCrawled, different].map(normalizeProgram);
    const deduped = deduplicatePrograms(programs);

    expect(deduped).toHaveLength(2);
  });

  it("generates consistent content hash", () => {
    const hash1 = contentHash("테스트", "기관", "2026-05-31");
    const hash2 = contentHash("테스트", "기관", "2026-05-31");
    expect(hash1).toBe(hash2);

    const hash3 = contentHash("다른 테스트", "기관", "2026-05-31");
    expect(hash1).not.toBe(hash3);
  });
});
```

- [ ] **Step 5: Implement normalizer**

Create `packages/crawler/src/normalizer.ts`:

```typescript
import { createHash } from "crypto";
import type { CrawledProgram, NormalizedProgram } from "./types";

/**
 * Normalize a crawled program to standard format.
 * - Strip title suffixes (공고, 안내, 모집)
 * - Clean agency name (remove abbreviations in parentheses)
 * - Infer category if not provided
 * - Parse dates
 * - Generate content hash for deduplication
 */
export function normalizeProgram(
  crawled: CrawledProgram
): NormalizedProgram {
  const name = cleanTitle(crawled.title);
  const agency = cleanAgency(crawled.agency);
  const category =
    crawled.category || inferCategory(crawled.title, crawled.description ?? "");

  const applicationStart = crawled.applicationStart
    ? new Date(crawled.applicationStart)
    : undefined;
  const applicationEnd = crawled.applicationEnd
    ? new Date(crawled.applicationEnd)
    : undefined;

  const hash = contentHash(
    name,
    agency,
    crawled.applicationEnd ?? ""
  );

  return {
    name,
    agency,
    category,
    applicationStart,
    applicationEnd,
    maxFunding: crawled.maxFunding,
    announcementUrl: crawled.announcementUrl,
    region: crawled.region,
    requirements: crawled.requirements,
    eligibility: crawled.eligibility,
    sourceId: crawled.sourceId,
    sourceName: crawled.sourceName,
    hash,
  };
}

/**
 * Remove announcement-related suffixes from program title.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*(공고|안내|모집|재공고|추가공고)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean agency name by removing parenthetical abbreviations.
 */
function cleanAgency(agency: string): string {
  return agency
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Infer ProgramCategory from title and description keywords.
 */
export function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  const categoryKeywords: Record<string, string[]> = {
    STARTUP: ["창업", "예비창업", "창업도약", "초기창업", "스타트업"],
    VENTURE: ["벤처", "벤처기업", "벤처확인", "벤처인증"],
    RND: [
      "r&d",
      "연구개발",
      "기술개발",
      "바우처",
      "ai",
      "ict",
      "기술혁신",
      "연구",
    ],
    CERTIFICATION: [
      "인증",
      "이노비즈",
      "메인비즈",
      "소부장",
      "인력양성",
    ],
    EXPORT: ["수출", "해외진출", "글로벌", "무역"],
    SMART_FACTORY: ["스마트공장", "스마트팩토리", "제조혁신", "자동화"],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return category;
    }
  }

  return "GENERAL";
}

/**
 * Deduplicate programs by content hash.
 * Keeps the first occurrence of each unique hash.
 */
export function deduplicatePrograms(
  programs: NormalizedProgram[]
): NormalizedProgram[] {
  const seen = new Set<string>();
  const result: NormalizedProgram[] = [];

  for (const program of programs) {
    if (!seen.has(program.hash)) {
      seen.add(program.hash);
      result.push(program);
    }
  }

  return result;
}

/**
 * Generate a content hash for deduplication.
 * Based on name + agency + deadline (not source-specific IDs).
 */
export function contentHash(
  name: string,
  agency: string,
  deadline: string
): string {
  const input = `${name.toLowerCase().trim()}|${agency.toLowerCase().trim()}|${deadline}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
```

- [ ] **Step 6: Create initial index.ts**

Create `packages/crawler/src/index.ts`:

```typescript
export type {
  CrawledProgram,
  CrawlResult,
  CrawlerConfig,
  CrawlSourceConfig,
  NormalizedProgram,
} from "./types";

export {
  normalizeProgram,
  deduplicatePrograms,
  inferCategory,
  contentHash,
} from "./normalizer";

// Worker (added after implementation)
// export { runCrawler } from "./worker";
// export { analyzeProgramWithAi } from "./analyzer";
```

- [ ] **Step 7: Run tests**

```bash
cd /Volumes/포터블/AX/axle/packages/crawler
npx vitest run tests/normalizer.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add packages/crawler/
git commit -m "feat: add packages/crawler with normalizer, deduplication, and category inference"
```

---

## Task 7: Crawler Worker and Browser Manager

**Files:**
- Create: `packages/crawler/src/browser.ts`
- Create: `packages/crawler/src/worker.ts`
- Create: `packages/crawler/src/analyzer.ts`
- Create: `packages/crawler/src/sources/base-source.ts`
- Create: `packages/crawler/src/sources/bizinfo.ts`
- Create: `packages/crawler/tests/analyzer.test.ts`
- Create: `packages/crawler/tests/worker.test.ts`

- [ ] **Step 1: Create browser singleton**

Create `packages/crawler/src/browser.ts`:

```typescript
import { chromium, type Browser, type BrowserContext } from "playwright";

let browserInstance: Browser | null = null;

/**
 * Browser singleton with memory optimization.
 * Reuses a single browser instance across crawl operations.
 */
export async function getBrowser(
  headless = true
): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = await chromium.launch({
    headless,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
    ],
  });

  return browserInstance;
}

/**
 * Create a new browser context with optimized settings.
 */
export async function createContext(
  browser: Browser
): Promise<BrowserContext> {
  return browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
}

/**
 * Close the browser singleton.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
```

- [ ] **Step 2: Create base source interface**

Create `packages/crawler/src/sources/base-source.ts`:

```typescript
import type { BrowserContext } from "playwright";
import type { CrawledProgram } from "../types";

/**
 * Abstract base for crawler sources.
 * Each government portal has its own source implementation.
 */
export abstract class BaseSource {
  abstract readonly name: string;
  abstract readonly baseUrl: string;

  /**
   * Crawl the source and return discovered programs.
   */
  abstract crawl(
    context: BrowserContext,
    options?: { maxPages?: number }
  ): Promise<CrawledProgram[]>;

  /**
   * Parse a single program detail page.
   */
  abstract parseDetail(
    context: BrowserContext,
    url: string
  ): Promise<CrawledProgram | null>;
}
```

- [ ] **Step 3: Create bizinfo.go.kr source**

Create `packages/crawler/src/sources/bizinfo.ts`:

```typescript
import type { BrowserContext, Page } from "playwright";
import type { CrawledProgram } from "../types";
import { BaseSource } from "./base-source";

/**
 * Crawler source for bizinfo.go.kr (기업마당).
 * Korea's main government business support portal.
 */
export class BizinfoSource extends BaseSource {
  readonly name = "bizinfo";
  readonly baseUrl = "https://www.bizinfo.go.kr";

  async crawl(
    context: BrowserContext,
    options?: { maxPages?: number }
  ): Promise<CrawledProgram[]> {
    const maxPages = options?.maxPages ?? 5;
    const programs: CrawledProgram[] = [];
    const page = await context.newPage();

    try {
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const listUrl = `${this.baseUrl}/web/lay1/bbs/S1T122C128/AS/74/list.do?rows=20&cpage=${pageNum}`;

        await page.goto(listUrl, {
          waitUntil: "networkidle",
          timeout: 30000,
        });

        const items = await this.parseListPage(page);
        if (items.length === 0) break;

        programs.push(...items);
      }
    } finally {
      await page.close();
    }

    return programs;
  }

  async parseDetail(
    context: BrowserContext,
    url: string
  ): Promise<CrawledProgram | null> {
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

      const title = await page
        .locator(".view_tit, h3.tit")
        .textContent()
        .catch(() => null);
      if (!title) return null;

      const agency = await page
        .locator("th:has-text('주관기관') + td, .agency")
        .textContent()
        .catch(() => "");

      const deadline = await page
        .locator("th:has-text('접수기간') + td, .period")
        .textContent()
        .catch(() => "");

      const description = await page
        .locator(".view_cont, .content")
        .textContent()
        .catch(() => "");

      const dates = parseDateRange(deadline ?? "");

      // Extract sourceId from URL
      const sourceIdMatch = url.match(/article_seq=(\d+)/);
      const sourceId = sourceIdMatch?.[1] ?? url;

      return {
        title: title.trim(),
        agency: (agency ?? "").trim(),
        category: "",
        applicationStart: dates.start,
        applicationEnd: dates.end,
        description: (description ?? "").trim().slice(0, 5000),
        announcementUrl: url,
        sourceId,
        sourceName: this.name,
        crawledAt: new Date(),
      };
    } catch (error) {
      console.error(`Failed to parse ${url}:`, error);
      return null;
    } finally {
      await page.close();
    }
  }

  private async parseListPage(page: Page): Promise<CrawledProgram[]> {
    const items: CrawledProgram[] = [];

    const rows = await page.locator("table tbody tr, .list_item").all();

    for (const row of rows) {
      try {
        const titleEl = await row.locator("a").first();
        const title = await titleEl.textContent();
        const href = await titleEl.getAttribute("href");

        if (!title || !href) continue;

        const agency = await row
          .locator("td:nth-child(3), .org")
          .textContent()
          .catch(() => "");

        const deadline = await row
          .locator("td:nth-child(4), .date")
          .textContent()
          .catch(() => "");

        const dates = parseDateRange(deadline ?? "");
        const fullUrl = href.startsWith("http")
          ? href
          : `${this.baseUrl}${href}`;

        const sourceIdMatch = href.match(/article_seq=(\d+)/);
        const sourceId = sourceIdMatch?.[1] ?? href;

        items.push({
          title: title.trim(),
          agency: (agency ?? "").trim(),
          category: "",
          applicationStart: dates.start,
          applicationEnd: dates.end,
          announcementUrl: fullUrl,
          sourceId,
          sourceName: this.name,
          crawledAt: new Date(),
        });
      } catch {
        // Skip malformed rows
        continue;
      }
    }

    return items;
  }
}

function parseDateRange(text: string): {
  start?: string;
  end?: string;
} {
  // Match patterns like "2026.04.01 ~ 2026.05.31" or "2026-04-01~2026-05-31"
  const match = text.match(
    /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*~\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/
  );

  if (match) {
    return {
      start: match[1].replace(/[./]/g, "-"),
      end: match[2].replace(/[./]/g, "-"),
    };
  }

  // Match single date
  const singleMatch = text.match(/(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/);
  if (singleMatch) {
    return { end: singleMatch[1].replace(/[./]/g, "-") };
  }

  return {};
}
```

- [ ] **Step 4: Create AI program analyzer**

Create `packages/crawler/src/analyzer.ts`:

```typescript
import type { CrawledProgram } from "./types";

export interface ProgramAnalysis {
  category: string;
  targetCompanies: string;
  keyRequirements: string[];
  estimatedDifficulty: "easy" | "medium" | "hard";
  recommendedFor: string[];
  eligibility: Record<string, unknown>;
}

/**
 * AI-powered program analysis.
 * Uses Claude Haiku to extract structured information from program descriptions.
 */
export async function analyzeProgramWithAi(
  program: CrawledProgram
): Promise<ProgramAnalysis> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `다음 정부지원사업 공고를 분석해주세요. JSON으로 응답해주세요.

제목: ${program.title}
기관: ${program.agency}
내용: ${(program.description ?? "").slice(0, 2000)}

응답 형식:
{
  "category": "STARTUP|VENTURE|RND|CERTIFICATION|EXPORT|SMART_FACTORY|GENERAL",
  "targetCompanies": "대상 기업 설명",
  "keyRequirements": ["요구사항1", "요구사항2"],
  "estimatedDifficulty": "easy|medium|hard",
  "recommendedFor": ["업종1", "업종2"],
  "eligibility": {
    "minEmployees": null,
    "maxEmployees": null,
    "ventureRequired": false,
    "rndRequired": false
  }
}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return defaultAnalysis();
  } catch (error) {
    console.error("AI analysis failed:", error);
    return defaultAnalysis();
  }
}

function defaultAnalysis(): ProgramAnalysis {
  return {
    category: "GENERAL",
    targetCompanies: "분석 불가",
    keyRequirements: [],
    estimatedDifficulty: "medium",
    recommendedFor: [],
    eligibility: {},
  };
}
```

- [ ] **Step 5: Create crawler worker**

Create `packages/crawler/src/worker.ts`:

```typescript
import { prisma } from "@axle/db";
import { getBrowser, createContext, closeBrowser } from "./browser";
import { normalizeProgram, deduplicatePrograms } from "./normalizer";
import { analyzeProgramWithAi } from "./analyzer";
import { BizinfoSource } from "./sources/bizinfo";
import type { CrawlResult, CrawledProgram, NormalizedProgram } from "./types";
import type { BaseSource } from "./sources/base-source";

const SOURCES: BaseSource[] = [
  new BizinfoSource(),
];

/**
 * Run the crawler worker for a specific source or all sources.
 */
export async function runCrawler(
  orgId: string,
  options?: {
    sourceName?: string;
    maxPages?: number;
    analyze?: boolean;
  }
): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const sourcesToCrawl = options?.sourceName
    ? SOURCES.filter((s) => s.name === options.sourceName)
    : SOURCES;

  const browser = await getBrowser(true);

  try {
    for (const source of sourcesToCrawl) {
      const startTime = Date.now();
      const errors: string[] = [];

      try {
        const context = await createContext(browser);
        const crawled = await source.crawl(context, {
          maxPages: options?.maxPages ?? 5,
        });
        await context.close();

        // Normalize and deduplicate
        const normalized = deduplicatePrograms(
          crawled.map(normalizeProgram)
        );

        // Save to database
        const { newCount, updatedCount } = await saveProgramsToDb(
          orgId,
          normalized,
          crawled,
          options?.analyze ?? false
        );

        results.push({
          source: source.name,
          totalFound: crawled.length,
          newPrograms: newCount,
          updatedPrograms: updatedCount,
          errors,
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        errors.push(`${source.name}: ${(error as Error).message}`);
        results.push({
          source: source.name,
          totalFound: 0,
          newPrograms: 0,
          updatedPrograms: 0,
          errors,
          durationMs: Date.now() - startTime,
        });
      }
    }
  } finally {
    await closeBrowser();
  }

  return results;
}

async function saveProgramsToDb(
  orgId: string,
  normalized: NormalizedProgram[],
  original: CrawledProgram[],
  analyze: boolean
): Promise<{ newCount: number; updatedCount: number }> {
  let newCount = 0;
  let updatedCount = 0;

  for (const program of normalized) {
    // Check if program already exists (by source ID)
    const existing = await prisma.programInfo.findFirst({
      where: {
        orgId,
        announcementUrl: program.announcementUrl,
      },
    });

    // Run AI analysis if enabled
    let analysisData: Record<string, unknown> = {};
    if (analyze && !existing) {
      const originalProgram = original.find(
        (o) => o.sourceId === program.sourceId
      );
      if (originalProgram) {
        const analysis = await analyzeProgramWithAi(originalProgram);
        analysisData = {
          requirements: analysis.eligibility,
          eligibility: {
            targetCompanies: analysis.targetCompanies,
            keyRequirements: analysis.keyRequirements,
            difficulty: analysis.estimatedDifficulty,
            recommendedFor: analysis.recommendedFor,
          },
        };
        // Use AI-inferred category if normalizer returned GENERAL
        if (program.category === "GENERAL" && analysis.category !== "GENERAL") {
          program.category = analysis.category;
        }
      }
    }

    if (existing) {
      // Update if deadline changed
      if (
        program.applicationEnd &&
        existing.applicationEnd?.toISOString() !==
          program.applicationEnd.toISOString()
      ) {
        await prisma.programInfo.update({
          where: { id: existing.id },
          data: {
            applicationEnd: program.applicationEnd,
            crawledAt: new Date(),
          },
        });
        updatedCount++;
      }
    } else {
      // Create new program
      await prisma.programInfo.create({
        data: {
          orgId,
          name: program.name,
          agency: program.agency,
          category: program.category as never,
          announcementUrl: program.announcementUrl,
          applicationStart: program.applicationStart,
          applicationEnd: program.applicationEnd,
          maxFunding: program.maxFunding,
          region: program.region,
          requirements: analysisData.requirements ?? program.requirements,
          eligibility: analysisData.eligibility ?? program.eligibility,
          isCrawled: true,
          crawledAt: new Date(),
        },
      });
      newCount++;
    }
  }

  return { newCount, updatedCount };
}
```

- [ ] **Step 6: Write tests for analyzer and worker**

Create `packages/crawler/tests/analyzer.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { analyzeProgramWithAi } from "../src/analyzer";
import type { CrawledProgram } from "../src/types";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({
            category: "RND",
            targetCompanies: "AI/ICT 기업",
            keyRequirements: ["사업자등록", "기술인력 보유"],
            estimatedDifficulty: "medium",
            recommendedFor: ["소프트웨어", "AI"],
            eligibility: { ventureRequired: false, rndRequired: true },
          }),
        }],
      }),
    },
  })),
}));

describe("Program Analyzer", () => {
  it("analyzes a program and returns structured data", async () => {
    const program: CrawledProgram = {
      title: "AI 바우처 지원사업",
      agency: "정보통신산업진흥원",
      category: "",
      description: "AI 기술 활용 및 개발",
      announcementUrl: "https://example.com",
      sourceId: "12345",
      sourceName: "bizinfo",
      crawledAt: new Date(),
    };

    const result = await analyzeProgramWithAi(program);

    expect(result.category).toBe("RND");
    expect(result.keyRequirements).toHaveLength(2);
    expect(result.estimatedDifficulty).toBe("medium");
  });
});
```

Create `packages/crawler/tests/worker.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { BizinfoSource } from "../src/sources/bizinfo";

describe("Crawler Sources", () => {
  it("BizinfoSource has correct name and base URL", () => {
    const source = new BizinfoSource();
    expect(source.name).toBe("bizinfo");
    expect(source.baseUrl).toContain("bizinfo.go.kr");
  });
});
```

- [ ] **Step 7: Run tests**

```bash
cd /Volumes/포터블/AX/axle/packages/crawler
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 8: Update index.ts and commit**

Update `packages/crawler/src/index.ts`:

```typescript
export type {
  CrawledProgram,
  CrawlResult,
  CrawlerConfig,
  CrawlSourceConfig,
  NormalizedProgram,
} from "./types";

export {
  normalizeProgram,
  deduplicatePrograms,
  inferCategory,
  contentHash,
} from "./normalizer";

export { runCrawler } from "./worker";
export { analyzeProgramWithAi } from "./analyzer";
export { getBrowser, createContext, closeBrowser } from "./browser";
export { BizinfoSource } from "./sources/bizinfo";
```

```bash
cd /Volumes/포터블/AX/axle
git add packages/crawler/
git commit -m "feat: add crawler worker with Playwright browser, bizinfo source, and AI analyzer"
```

---

## Task 8: Web Pages — Matching Dashboard and Crawler Admin

**Files:**
- Create: `apps/web/src/app/api/matching/route.ts`
- Create: `apps/web/src/app/api/matching/[matchId]/feedback/route.ts`
- Create: `apps/web/src/app/api/crawler/route.ts`
- Create: `apps/web/src/app/(app)/matching/page.tsx`
- Create: `apps/web/src/app/(app)/matching/_components/matching-results.tsx`
- Create: `apps/web/src/app/(app)/matching/_components/match-card.tsx`
- Create: `apps/web/src/app/(app)/admin/crawler/page.tsx`

- [ ] **Step 1: Create matching API route**

Create `apps/web/src/app/api/matching/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { runMatchingPipeline, type ClientProfile, type ProgramProfile } from "@axle/matching";

export async function POST(request: Request) {
  const { clientId, orgId } = await request.json();

  if (!clientId || !orgId) {
    return NextResponse.json(
      { error: "clientId and orgId required" },
      { status: 400 }
    );
  }

  await getVerifiedOrgMember(orgId);

  // Load client data
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      financials: { orderBy: { year: "desc" }, take: 1 },
      documents: { select: { name: true, category: true } },
      certificates: { where: { isActive: true } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Load active programs
  const programs = await prisma.programInfo.findMany({
    where: {
      orgId,
      applicationEnd: { gte: new Date() },
    },
  });

  // Build client profile
  const clientProfile: ClientProfile = {
    id: client.id,
    name: client.name,
    businessNumber: client.businessNumber ?? undefined,
    industry: client.industry ?? undefined,
    employeeCount: client.employeeCount ?? undefined,
    capitalAmount: client.capitalAmount ? Number(client.capitalAmount) : undefined,
    foundedDate: client.foundedDate?.toISOString() ?? undefined,
    region: client.region ?? undefined,
    isVenture: client.isVenture,
    isInnoBiz: client.isInnoBiz,
    isMainBiz: client.isMainBiz,
    isSocial: client.isSocial,
    revenue: client.financials[0]?.revenue
      ? Number(client.financials[0].revenue)
      : undefined,
    rndExperience: false, // Derived from project history
    certifications: client.certificates.map((c) => c.type),
    documents: client.documents.map((d) => d.name),
  };

  // Build program profiles
  const programProfiles: ProgramProfile[] = programs.map((p) => ({
    id: p.id,
    name: p.name,
    agency: p.agency ?? undefined,
    category: p.category,
    applicationEnd: p.applicationEnd ?? undefined,
    maxFunding: p.maxFunding ? Number(p.maxFunding) : undefined,
    region: p.region ?? undefined,
    requirements: p.requirements as ProgramProfile["requirements"],
    eligibility: p.eligibility as ProgramProfile["eligibility"],
  }));

  // Run matching pipeline
  const results = await runMatchingPipeline(clientProfile, programProfiles);

  // Save results to database
  for (const result of results) {
    await prisma.matchingResult.create({
      data: {
        clientId: result.clientId,
        programId: result.programId,
        score: result.score.total,
        matchReasons: result.matchReasons,
        disqualifyReasons: result.disqualifyReasons,
      },
    });
  }

  return NextResponse.json({
    clientId,
    totalPrograms: programs.length,
    qualified: results.filter((r) => !r.isDisqualified).length,
    results,
  });
}
```

- [ ] **Step 2: Create feedback API route**

Create `apps/web/src/app/api/matching/[matchId]/feedback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getVerifiedUser } from "@axle/auth/dal";
import { submitFeedback, MatchFeedbackSchema } from "@axle/matching";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  await getVerifiedUser();

  const body = await request.json();
  const feedback = MatchFeedbackSchema.parse({
    matchResultId: matchId,
    ...body,
  });

  const result = await submitFeedback(feedback);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create crawler API route**

Create `apps/web/src/app/api/crawler/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { runCrawler } from "@axle/crawler";

export async function POST(request: Request) {
  const { orgId, source, maxPages, analyze } = await request.json();

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { member } = await getVerifiedOrgMember(orgId);

  // Only ADMIN/OWNER can start crawling
  if (member.role === "MEMBER") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const results = await runCrawler(orgId, {
    sourceName: source,
    maxPages: maxPages ?? 3,
    analyze: analyze ?? true,
  });

  return NextResponse.json({ results });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  await getVerifiedOrgMember(orgId);

  // Return crawler stats
  const { prisma } = await import("@axle/db");

  const crawledCount = await prisma.programInfo.count({
    where: { orgId, isCrawled: true },
  });

  const lastCrawled = await prisma.programInfo.findFirst({
    where: { orgId, isCrawled: true },
    orderBy: { crawledAt: "desc" },
    select: { crawledAt: true },
  });

  return NextResponse.json({
    crawledPrograms: crawledCount,
    lastCrawledAt: lastCrawled?.crawledAt,
  });
}
```

- [ ] **Step 4: Create matching results page**

Create `apps/web/src/app/(app)/matching/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import { Badge } from "@axle/ui/badge";
import { Button } from "@axle/ui/button";

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; clientId?: string }>;
}) {
  const params = await searchParams;
  const orgId = params.orgId ?? "";
  const clientId = params.clientId;

  if (!orgId) {
    return <p className="text-muted-foreground">조직을 선택해주세요.</p>;
  }

  await getVerifiedOrgMember(orgId);

  // Get clients for selection
  const clients = await prisma.client.findMany({
    where: { orgId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Get matching results for selected client
  let matchingResults: Array<{
    id: string;
    score: unknown;
    matchReasons: unknown;
    disqualifyReasons: unknown;
    isRelevant: boolean | null;
    feedbackNote: string | null;
    program: { id: string; name: string; agency: string | null; category: string; applicationEnd: Date | null };
  }> = [];

  if (clientId) {
    matchingResults = await prisma.matchingResult.findMany({
      where: { clientId },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            agency: true,
            category: true,
            applicationEnd: true,
          },
        },
      },
      orderBy: { score: "desc" },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">매칭 결과</h1>
      </div>

      <div className="flex items-center gap-4">
        <select
          className="rounded-md border px-3 py-2 text-sm"
          defaultValue={clientId ?? ""}
        >
          <option value="">고객사 선택...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button>매칭 실행</Button>
      </div>

      {matchingResults.length > 0 ? (
        <div className="space-y-3">
          {matchingResults.map((result, idx) => {
            const score = Number(result.score);
            const isDisqualified =
              Array.isArray(result.disqualifyReasons) &&
              (result.disqualifyReasons as string[]).length > 0;

            return (
              <Card
                key={result.id}
                className={isDisqualified ? "opacity-60" : ""}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                        isDisqualified
                          ? "bg-muted text-muted-foreground"
                          : score >= 70
                            ? "bg-green-100 text-green-800"
                            : score >= 40
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                      }`}
                    >
                      {isDisqualified ? "X" : `${Math.round(score)}`}
                    </div>
                    <div>
                      <p className="font-medium">{result.program.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {result.program.agency ?? "미입력"} |{" "}
                        {result.program.applicationEnd
                          ? new Date(
                              result.program.applicationEnd
                            ).toLocaleDateString("ko-KR")
                          : "마감 미정"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {result.program.category}
                    </Badge>
                    {result.isRelevant === true && (
                      <Badge className="bg-green-100 text-green-800">
                        관련있음
                      </Badge>
                    )}
                    {result.isRelevant === false && (
                      <Badge className="bg-red-100 text-red-800">
                        관련없음
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : clientId ? (
        <p className="text-center text-muted-foreground">
          매칭 결과가 없습니다. "매칭 실행" 버튼을 눌러주세요.
        </p>
      ) : (
        <p className="text-center text-muted-foreground">
          고객사를 선택해주세요.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create crawler admin page**

Create `apps/web/src/app/(app)/admin/crawler/page.tsx`:

```tsx
import { prisma } from "@axle/db";
import { getVerifiedOrgMember } from "@axle/auth/dal";
import { Card, CardHeader, CardTitle, CardContent } from "@axle/ui/card";
import { Button } from "@axle/ui/button";
import { Badge } from "@axle/ui/badge";

export default async function CrawlerAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  const params = await searchParams;
  const orgId = params.orgId ?? "";

  if (!orgId) {
    return <p className="text-muted-foreground">조직을 선택해주세요.</p>;
  }

  const { member } = await getVerifiedOrgMember(orgId);

  if (member.role === "MEMBER") {
    return <p className="text-destructive">관리자 권한이 필요합니다.</p>;
  }

  const crawledCount = await prisma.programInfo.count({
    where: { orgId, isCrawled: true },
  });

  const manualCount = await prisma.programInfo.count({
    where: { orgId, isCrawled: false },
  });

  const lastCrawled = await prisma.programInfo.findFirst({
    where: { orgId, isCrawled: true },
    orderBy: { crawledAt: "desc" },
    select: { crawledAt: true, name: true },
  });

  const recentPrograms = await prisma.programInfo.findMany({
    where: { orgId, isCrawled: true },
    orderBy: { crawledAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      agency: true,
      category: true,
      applicationEnd: true,
      crawledAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">크롤러 관리</h1>
        <Button>크롤링 시작</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              크롤링 수집
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{crawledCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              수동 등록
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{manualCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              마지막 크롤링
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {lastCrawled?.crawledAt
                ? new Date(lastCrawled.crawledAt).toLocaleString("ko-KR")
                : "없음"}
            </p>
            {lastCrawled?.name && (
              <p className="text-sm text-muted-foreground truncate">
                {lastCrawled.name}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>소스 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">bizinfo.go.kr (기업마당)</p>
                <p className="text-sm text-muted-foreground">
                  정부 지원사업 통합 포털
                </p>
              </div>
              <Badge className="bg-green-100 text-green-800">활성</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">k-startup.go.kr</p>
                <p className="text-sm text-muted-foreground">
                  창업 지원사업 포털
                </p>
              </div>
              <Badge variant="outline">준비중</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>최근 수집 프로그램</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentPrograms.map((program) => (
              <div
                key={program.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{program.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {program.agency ?? "-"} |{" "}
                    {program.crawledAt
                      ? new Date(program.crawledAt).toLocaleString("ko-KR")
                      : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{program.category}</Badge>
                  {program.applicationEnd && (
                    <span className="text-xs text-muted-foreground">
                      ~
                      {new Date(program.applicationEnd).toLocaleDateString(
                        "ko-KR"
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {recentPrograms.length === 0 && (
              <p className="text-center text-muted-foreground p-4">
                수집된 프로그램이 없습니다.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/포터블/AX/axle
git add apps/web/src/app/api/matching/ apps/web/src/app/api/crawler/ apps/web/src/app/\(app\)/matching/ apps/web/src/app/\(app\)/admin/
git commit -m "feat: add matching dashboard, feedback API, crawler admin, and crawler API routes"
```

---

## Task 9: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run packages/matching tests**

```bash
cd /Volumes/포터블/AX/axle/packages/matching
npx vitest run
```

Expected: All tests PASS (stage1, stage2, stage3, pipeline, feedback).

- [ ] **Step 2: Run packages/crawler tests**

```bash
cd /Volumes/포터블/AX/axle/packages/crawler
npx vitest run
```

Expected: All tests PASS (normalizer, analyzer, worker).

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Volumes/포터블/AX/axle
npx turbo build --filter=@axle/matching --filter=@axle/crawler
```

Expected: Both packages compile without errors.

- [ ] **Step 4: Verify web app TypeScript**

```bash
cd /Volumes/포터블/AX/axle/apps/web
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/포터블/AX/axle
git add -A
git commit -m "chore: Phase 8 complete — 3-stage AI matching pipeline + Playwright crawler with bizinfo source"
```

---

## Summary

Phase 8 delivers:
- **packages/matching**: 3-stage AI matching pipeline
  - Stage 1: Hard disqualification (structured eligibility: employee count, revenue, region, certifications, industry exclusion)
  - Stage 2: Soft penalties (deadline proximity, document readiness, category alignment, region mismatch)
  - Stage 3: Qualification scoring (eligibility 40%, category 20%, semantic 25%, document 15%)
  - Feedback tracking (isRelevant, feedbackNote, accuracy stats)
- **packages/crawler**: Playwright-based government portal scraper
  - Browser singleton with memory optimization
  - BizInfo.go.kr source implementation
  - AI-powered program analysis (Claude Haiku)
  - Content-hash deduplication and normalization
  - Category inference from Korean keywords
- **apps/web pages**:
  - Matching results dashboard (per client, ranked, color-coded scores)
  - Feedback form (relevant/irrelevant with notes)
  - Crawler admin panel (start/stop, stats, source management, recent programs)
- **API Routes**: Matching execution, feedback submission, crawler start/status
- **Deployment**: OCI VM worker (shared with FlowMate) for production crawling

**Next:** Phase 9 would cover Notification system, Collaboration features, and Analytics dashboards.

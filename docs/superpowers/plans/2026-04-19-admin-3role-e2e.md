# Admin 3권한 교차 E2E — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** platform/admin/employee 권한 경계와 ReBAC/쓰기 차단/운영 흐름을 CI에서 회귀 감지하는 3권한 교차 E2E 테스트 인프라 구축.

**Architecture:** Playwright 기반. 하이브리드 DB (경계 검증은 prod read-only, 쓰기 테스트는 ephemeral Postgres). 역할별 storageState 재사용으로 로그인 오버헤드 최소화. 2단계 CI (boundary=모든 PR, write=path filter/nightly).

**Tech Stack:** Playwright, Prisma 7, Next.js 16, PostgreSQL 16 + pgvector, GitHub Actions, TypeScript.

**Branching:** 3개 PR로 분할 (의존성 있음 — 순차 머지):
1. **PR 1 (foundation)**: seed-e2e.ts + helpers + globalSetup + `@smoke` 태깅 (기존 CI 유지)
2. **PR 2 (boundary)**: boundary 3개 스펙 + `e2e-boundary.yml`
3. **PR 3 (write + CI 정리)**: write 스펙 + `e2e-write.yml` + 기존 `e2e.yml` 삭제

**Manual Gates:**
- PR 1 머지 후: prod Supabase에 `seed-e2e.ts` 주입, GitHub secrets 8개 등록
- PR 2 머지 후: 브랜치 보호 규칙에 `e2e-boundary` 필수 체크 추가

---

## File Structure

**신규 파일**
- `packages/db/seed-e2e.ts` — idempotent upsert 기반 E2E 계정/조직/프로젝트 seed
- `e2e/helpers/roles.ts` — 역할 → 계정/ID 매핑
- `e2e/global-setup.ts` — 4역할 storageState 생성
- `e2e/role-boundary.spec.ts` — platform-admin 경로/API 접근 경계 (8 scenarios)
- `e2e/cross-org-isolation.spec.ts` — 조직 간 데이터 격리 (5 scenarios)
- `e2e/rebac-project-access.spec.ts` — ReBAC 프로젝트 권한 (4 scenarios)
- `e2e/role-write-actions.spec.ts` — 쓰기 차단/운영 흐름 (8 scenarios)
- `.github/workflows/e2e-boundary.yml` — PR마다 prod read-only 테스트
- `.github/workflows/e2e-write.yml` — path filter + nightly ephemeral 테스트 (regression issue 포함)

**수정 파일**
- `playwright.config.ts` — globalSetup + E2E_BASE_URL 조건부 webServer
- `e2e/helpers/auth.ts` — signInAs() 추가, 기존 signInAsTestUser 후방 호환
- `e2e/auth.spec.ts`, `e2e/smoke.spec.ts`, `e2e/client-crud.spec.ts`, `e2e/project-crud.spec.ts`, `e2e/meeting-crud.spec.ts` — `@smoke` 태그 추가
- `.github/workflows/e2e.yml` — `--grep @smoke`로 제한 (PR 1), PR 3에서 삭제

---

## PR 1 — Foundation (seed + helpers + globalSetup)

### Task 1: Create E2E-only seed script

**Files:**
- Create: `packages/db/seed-e2e.ts`

- [ ] **Step 1: Create seed-e2e.ts with idempotent upsert logic**

```typescript
// packages/db/seed-e2e.ts
// AXLE E2E Seed — idempotent, production-safe.
// Usage: set -a && source .env.local && set +a && npx tsx packages/db/seed-e2e.ts
// ONLY creates/updates entities with `e2e-` or `@e2e.axleai.io` prefix.
// Real data is never touched.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const E2E_PASSWORD = "test1234";

const USERS = {
  platform:    { id: "e2e-platform",    email: "platform@e2e.axleai.io", name: "E2E Platform Admin",  platformRole: "PLATFORM_ADMIN" as const },
  org1Owner:   { id: "e2e-org1-owner",  email: "owner1@e2e.axleai.io",   name: "E2E Org1 Owner",      platformRole: "USER" as const },
  org1Member:  { id: "e2e-org1-member", email: "member1@e2e.axleai.io",  name: "E2E Org1 Member",     platformRole: "USER" as const },
  org2Owner:   { id: "e2e-org2-owner",  email: "owner2@e2e.axleai.io",   name: "E2E Org2 Owner",      platformRole: "USER" as const },
};

const ORGS = {
  org1: { id: "org-e2e-1", name: "E2E 컨설팅 A", slug: "e2e-consulting-a" },
  org2: { id: "org-e2e-2", name: "E2E 컨설팅 B", slug: "e2e-consulting-b" },
};

const CLIENTS = {
  client1: { id: "client-e2e-1", orgId: ORGS.org1.id, name: "E2E Client A", businessNumber: "999-99-00001", status: "ACTIVE" as const },
  client2: { id: "client-e2e-2", orgId: ORGS.org2.id, name: "E2E Client B", businessNumber: "999-99-00002", status: "ACTIVE" as const },
};

const PROJECTS = {
  p1: { id: "project-e2e-1", clientId: CLIENTS.client1.id, type: "BUSINESS_PLAN" as const, title: "E2E Project — member shared", status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, assignedToId: USERS.org1Owner.id },
  p2: { id: "project-e2e-2", clientId: CLIENTS.client1.id, type: "BUSINESS_PLAN" as const, title: "E2E Project — owner only",    status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, assignedToId: USERS.org1Owner.id },
  p3: { id: "project-e2e-3", clientId: CLIENTS.client2.id, type: "BUSINESS_PLAN" as const, title: "E2E Project — org2",          status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, assignedToId: USERS.org2Owner.id },
};

async function main() {
  console.log("[seed-e2e] Starting idempotent E2E seed...");
  const hashed = await bcrypt.hash(E2E_PASSWORD, 10);

  // 1. Users — upsert by id
  for (const u of Object.values(USERS)) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, name: u.name, platformRole: u.platformRole, isActive: true, password: hashed },
      create: { id: u.id, email: u.email, name: u.name, platformRole: u.platformRole, password: hashed },
    });
  }
  console.log(`[seed-e2e] Upserted ${Object.keys(USERS).length} users`);

  // 2. Organizations
  for (const o of Object.values(ORGS)) {
    await prisma.organization.upsert({
      where: { id: o.id },
      update: { name: o.name, slug: o.slug },
      create: { id: o.id, name: o.name, slug: o.slug },
    });
  }
  console.log(`[seed-e2e] Upserted ${Object.keys(ORGS).length} organizations`);

  // 3. Memberships — delete + create to keep state clean for E2E users only
  const e2eUserIds = Object.values(USERS).map((u) => u.id);
  await prisma.membership.deleteMany({ where: { userId: { in: e2eUserIds } } });
  await prisma.membership.createMany({
    data: [
      { userId: USERS.org1Owner.id,  organizationId: ORGS.org1.id, role: "OWNER" },
      { userId: USERS.org1Member.id, organizationId: ORGS.org1.id, role: "MEMBER" },
      { userId: USERS.org2Owner.id,  organizationId: ORGS.org2.id, role: "OWNER" },
      // platform user: no membership (intentional)
    ],
  });
  console.log(`[seed-e2e] Created 3 memberships`);

  // 4. Clients — upsert
  for (const c of Object.values(CLIENTS)) {
    await prisma.client.upsert({
      where: { id: c.id },
      update: { orgId: c.orgId, name: c.name, businessNumber: c.businessNumber, status: c.status },
      create: { id: c.id, orgId: c.orgId, name: c.name, businessNumber: c.businessNumber, status: c.status },
    });
  }
  console.log(`[seed-e2e] Upserted ${Object.keys(CLIENTS).length} clients`);

  // 5. Projects — upsert
  for (const p of Object.values(PROJECTS)) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: { clientId: p.clientId, type: p.type, title: p.title, status: p.status, priority: p.priority, assignedToId: p.assignedToId },
      create: { id: p.id, clientId: p.clientId, type: p.type, title: p.title, status: p.status, priority: p.priority, assignedToId: p.assignedToId },
    });
  }
  console.log(`[seed-e2e] Upserted ${Object.keys(PROJECTS).length} projects`);

  // 6. ProjectMembers — reset for E2E projects only
  const e2eProjectIds = Object.values(PROJECTS).map((p) => p.id);
  await prisma.projectMember.deleteMany({ where: { projectId: { in: e2eProjectIds } } });
  await prisma.projectMember.createMany({
    data: [
      { projectId: PROJECTS.p1.id, userId: USERS.org1Owner.id,  role: "LEAD" },
      { projectId: PROJECTS.p1.id, userId: USERS.org1Member.id, role: "MEMBER" },
      { projectId: PROJECTS.p2.id, userId: USERS.org1Owner.id,  role: "LEAD" },
      { projectId: PROJECTS.p3.id, userId: USERS.org2Owner.id,  role: "LEAD" },
    ],
  });
  console.log(`[seed-e2e] Created 4 project members`);

  // 7. RelationTuples (ReBAC) — reset for E2E namespace only
  await prisma.relationTuple.deleteMany({
    where: {
      OR: [
        { namespace: "organization", objectId: { in: Object.values(ORGS).map((o) => o.id) } },
        { namespace: "project",      objectId: { in: e2eProjectIds } },
      ],
    },
  });
  await prisma.relationTuple.createMany({
    data: [
      // Org memberships
      { namespace: "organization", objectId: ORGS.org1.id, relation: "owner",  subjectType: "user", subjectId: USERS.org1Owner.id },
      { namespace: "organization", objectId: ORGS.org1.id, relation: "member", subjectType: "user", subjectId: USERS.org1Owner.id },
      { namespace: "organization", objectId: ORGS.org1.id, relation: "member", subjectType: "user", subjectId: USERS.org1Member.id },
      { namespace: "organization", objectId: ORGS.org2.id, relation: "owner",  subjectType: "user", subjectId: USERS.org2Owner.id },
      { namespace: "organization", objectId: ORGS.org2.id, relation: "member", subjectType: "user", subjectId: USERS.org2Owner.id },
      // Project relations
      { namespace: "project", objectId: PROJECTS.p1.id, relation: "lead",   subjectType: "user", subjectId: USERS.org1Owner.id },
      { namespace: "project", objectId: PROJECTS.p1.id, relation: "member", subjectType: "user", subjectId: USERS.org1Member.id },
      { namespace: "project", objectId: PROJECTS.p2.id, relation: "lead",   subjectType: "user", subjectId: USERS.org1Owner.id },
      { namespace: "project", objectId: PROJECTS.p3.id, relation: "lead",   subjectType: "user", subjectId: USERS.org2Owner.id },
    ],
  });
  console.log(`[seed-e2e] Created 9 relation tuples`);

  console.log("[seed-e2e] Done. No real data was modified.");
}

main()
  .catch((err) => {
    console.error("[seed-e2e] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
```

- [ ] **Step 2: Run against local ephemeral DB (or dev DB) to verify**

Run:
```bash
cd /Volumes/포터블/AXLE
set -a && source .env.local && set +a
npx tsx packages/db/seed-e2e.ts
```

Expected output:
```
[seed-e2e] Starting idempotent E2E seed...
[seed-e2e] Upserted 4 users
[seed-e2e] Upserted 2 organizations
[seed-e2e] Created 3 memberships
[seed-e2e] Upserted 2 clients
[seed-e2e] Upserted 3 projects
[seed-e2e] Created 4 project members
[seed-e2e] Created 9 relation tuples
[seed-e2e] Done. No real data was modified.
```

Re-run the same command. Expected: same output, no errors (idempotent).

- [ ] **Step 3: Verify login works for all 4 E2E accounts**

Manual: open https://localhost:3000/login (or dev URL) and log in with:
- `platform@e2e.axleai.io` / `test1234`
- `owner1@e2e.axleai.io` / `test1234`
- `member1@e2e.axleai.io` / `test1234`
- `owner2@e2e.axleai.io` / `test1234`

Each should land on `/dashboard` (or `/platform-admin` for platform).

- [ ] **Step 4: Commit**

```bash
git checkout -b chore/WI-027-chore-e2e-seed-foundation
git add packages/db/seed-e2e.ts
git commit -m "WI-027-chore E2E 전용 idempotent seed 스크립트 추가

- seed-e2e.ts: upsert 기반, 실 데이터 불변 (prod 주입 가능)
- 4 users (platform/org1-owner/org1-member/org2-owner) + 2 orgs + 3 projects + ReBAC tuples
- 모든 E2E 엔티티는 *-e2e-* prefix 또는 @e2e.axleai.io 이메일"
```

---

### Task 2: Add role-based E2E helper

**Files:**
- Create: `e2e/helpers/roles.ts`
- Modify: `e2e/helpers/auth.ts`

- [ ] **Step 1: Create roles.ts**

```typescript
// e2e/helpers/roles.ts
export type E2ERole = "platform" | "org1-owner" | "org1-member" | "org2-owner";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env ${name}. For local runs, copy .env.e2e.example → .env.e2e and source it.`,
    );
  }
  return v;
}

export function getAccount(role: E2ERole): { email: string; password: string } {
  switch (role) {
    case "platform":
      return { email: requireEnv("E2E_PLATFORM_EMAIL"), password: requireEnv("E2E_PLATFORM_PASSWORD") };
    case "org1-owner":
      return { email: requireEnv("E2E_ORG1_OWNER_EMAIL"), password: requireEnv("E2E_ORG1_OWNER_PASSWORD") };
    case "org1-member":
      return { email: requireEnv("E2E_ORG1_MEMBER_EMAIL"), password: requireEnv("E2E_ORG1_MEMBER_PASSWORD") };
    case "org2-owner":
      return { email: requireEnv("E2E_ORG2_OWNER_EMAIL"), password: requireEnv("E2E_ORG2_OWNER_PASSWORD") };
  }
}

export const E2E_ROLES: readonly E2ERole[] = ["platform", "org1-owner", "org1-member", "org2-owner"] as const;

export const E2E_IDS = {
  orgs: { org1: "org-e2e-1", org2: "org-e2e-2" },
  clients: { org1: "client-e2e-1", org2: "client-e2e-2" },
  projects: {
    memberShared: "project-e2e-1", // org1-member has access
    ownerOnly: "project-e2e-2",    // org1-member has NO access
    org2: "project-e2e-3",
  },
  users: {
    platform: "e2e-platform",
    org1Owner: "e2e-org1-owner",
    org1Member: "e2e-org1-member",
    org2Owner: "e2e-org2-owner",
  },
} as const;

export function storageStatePath(role: E2ERole): string {
  return `.playwright-auth/${role}.json`;
}
```

- [ ] **Step 2: Extend auth.ts with signInAs**

Read existing `e2e/helpers/auth.ts` first (don't lose existing helpers), then replace with:

```typescript
// e2e/helpers/auth.ts
import { type Page, expect } from "@playwright/test";
import { type E2ERole, getAccount } from "./roles";

// Legacy single-account envs (kept for backward-compat).
export const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "";
export const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "";
export const hasTestCreds = Boolean(TEST_USER_EMAIL && TEST_USER_PASSWORD);

/** Sign in as a specific E2E role. */
export async function signInAs(page: Page, role: E2ERole): Promise<void> {
  const { email, password } = getAccount(role);
  await page.goto("/login");
  await page.getByLabel(/이메일|email/i).fill(email);
  await page.getByLabel(/비밀번호|password/i).fill(password);
  await page.getByRole("button", { name: /로그인|sign in/i }).click();
  // Platform admin lands on /platform-admin; others on /dashboard.
  await page.waitForURL(/\/(dashboard|platform-admin|clients|projects)/, { timeout: 15_000 });
}

/**
 * Legacy wrapper — equivalent to signInAs(page, "org1-owner").
 * Preserved for existing smoke tests that still use E2E_USER_EMAIL.
 * If E2E_ORG1_OWNER_* is set, use it; otherwise fall back to legacy envs.
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  if (process.env.E2E_ORG1_OWNER_EMAIL) {
    await signInAs(page, "org1-owner");
    return;
  }
  if (!hasTestCreds) {
    throw new Error(
      "E2E_USER_EMAIL / E2E_USER_PASSWORD (or E2E_ORG1_OWNER_*) must be set",
    );
  }
  await page.goto("/login");
  await page.getByLabel(/이메일|email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/비밀번호|password/i).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: /로그인|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|clients|projects)/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/(dashboard|clients|projects)/);
}

/** Unique client name for a test run (avoids collisions on shared DBs). */
export function uniqueClientName(prefix = "E2E-Client"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers/roles.ts e2e/helpers/auth.ts
git commit -m "WI-027-chore E2E role helper + signInAs 추가

- roles.ts: 4역할 계정 env 매핑 + E2E_IDS + storageState 경로
- auth.ts: signInAs(role) 추가, 기존 signInAsTestUser는 org1-owner로 위임 (후방 호환)"
```

---

### Task 3: Add Playwright globalSetup for storageState

**Files:**
- Create: `e2e/global-setup.ts`
- Modify: `playwright.config.ts`
- Create: `.gitignore` entry (`.playwright-auth/`)

- [ ] **Step 1: Create global-setup.ts**

```typescript
// e2e/global-setup.ts
import { chromium, type FullConfig } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { E2E_ROLES, getAccount, storageStatePath } from "./helpers/roles";

/**
 * Logs in as each E2E role once and saves storage state to .playwright-auth/{role}.json.
 * Tests then reuse these via `test.use({ storageState: ... })` — no per-test login.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Skip gracefully if E2E account envs are missing — individual tests that need
  // storage state will fail with a clear message instead of a confusing crash here.
  const anyAccountEnvSet = process.env.E2E_PLATFORM_EMAIL
    || process.env.E2E_ORG1_OWNER_EMAIL;
  if (!anyAccountEnvSet) {
    console.warn("[global-setup] No E2E_* account envs found. Skipping storageState generation.");
    return;
  }

  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  if (!existsSync(".playwright-auth")) mkdirSync(".playwright-auth", { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const role of E2E_ROLES) {
      const { email, password } = getAccount(role);
      const ctx = await browser.newContext({ baseURL });
      const page = await ctx.newPage();
      try {
        await page.goto("/login");
        await page.getByLabel(/이메일|email/i).fill(email);
        await page.getByLabel(/비밀번호|password/i).fill(password);
        await page.getByRole("button", { name: /로그인|sign in/i }).click();
        await page.waitForURL(/\/(dashboard|platform-admin|clients|projects)/, { timeout: 15_000 });
        await ctx.storageState({ path: storageStatePath(role) });
        console.log(`[global-setup] Saved storage state for ${role}`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Update playwright.config.ts**

Read current `playwright.config.ts`, then replace with:

```typescript
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3000";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["json"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

- [ ] **Step 3: Gitignore .playwright-auth**

Read `.gitignore`, append:
```
.playwright-auth/
```

- [ ] **Step 4: Smoke-test global setup locally**

With dev server running on `:3000` and E2E accounts injected, run:
```bash
E2E_PLATFORM_EMAIL=platform@e2e.axleai.io \
E2E_PLATFORM_PASSWORD=test1234 \
E2E_ORG1_OWNER_EMAIL=owner1@e2e.axleai.io \
E2E_ORG1_OWNER_PASSWORD=test1234 \
E2E_ORG1_MEMBER_EMAIL=member1@e2e.axleai.io \
E2E_ORG1_MEMBER_PASSWORD=test1234 \
E2E_ORG2_OWNER_EMAIL=owner2@e2e.axleai.io \
E2E_ORG2_OWNER_PASSWORD=test1234 \
npx playwright test --list
```

Expected: 4 storageState files created under `.playwright-auth/`, test list prints without error.

- [ ] **Step 5: Commit**

```bash
git add e2e/global-setup.ts playwright.config.ts .gitignore
git commit -m "WI-027-chore Playwright globalSetup로 4역할 storageState 사전 생성

- globalSetup: 각 역할 1회 로그인 → .playwright-auth/{role}.json 저장
- 테스트당 로그인 반복 제거 → 런타임 단축
- E2E env 미설정 시 warning 후 skip (기존 smoke 영향 없음)"
```

---

### Task 4: Tag existing smoke specs + restrict e2e.yml to `@smoke`

**Files:**
- Modify: `e2e/auth.spec.ts`, `e2e/smoke.spec.ts`, `e2e/client-crud.spec.ts`, `e2e/project-crud.spec.ts`, `e2e/meeting-crud.spec.ts`
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Add `@smoke` tag to existing describe blocks**

For each file, prepend `{ tag: "@smoke" }` to the `test.describe(...)` call or add `test.info()` tag.

Concrete pattern: change
```typescript
test.describe("auth: invalid credentials", () => {
```
to
```typescript
test.describe("auth: invalid credentials @smoke", () => {
```

Playwright picks up `@smoke` from the describe title for `--grep @smoke`. Apply to ALL describe blocks in these 5 files.

- [ ] **Step 2: Verify --grep @smoke selects only existing specs**

```bash
npx playwright test --grep @smoke --list
```

Expected: prints only tests from auth/smoke/client-crud/project-crud/meeting-crud.

- [ ] **Step 3: Update e2e.yml to --grep @smoke**

Modify `.github/workflows/e2e.yml`: find the line
```yaml
            npx playwright test --reporter=json > e2e-results.json
```
and both occurrences (PR + push branches), append `--grep @smoke`:
```yaml
            npx playwright test --grep @smoke --reporter=json > e2e-results.json
```

- [ ] **Step 4: Commit**

```bash
git add e2e/*.spec.ts .github/workflows/e2e.yml
git commit -m "WI-027-chore 기존 E2E 스펙에 @smoke 태그 + CI grep 제한

- auth/smoke/client-crud/project-crud/meeting-crud → @smoke
- e2e.yml: --grep @smoke로 기존 동작 유지
- 이후 PR에서 추가될 @boundary/@write 태그와 분리"
```

- [ ] **Step 5: Push and create PR 1**

```bash
git push -u origin chore/WI-027-chore-e2e-seed-foundation
gh pr create --title "WI-027-chore E2E 3권한 foundation (seed + helpers + globalSetup)" --body "$(cat <<'EOF'
## Summary
- E2E 전용 idempotent seed (`packages/db/seed-e2e.ts`) — prod 주입 가능
- 4역할 계정 헬퍼 (`e2e/helpers/roles.ts`, `signInAs(role)`)
- Playwright globalSetup으로 storageState 4개 사전 생성
- 기존 스펙 5개에 `@smoke` 태그, `e2e.yml`은 `--grep @smoke`로 제한

## Test plan
- [ ] `npx tsx packages/db/seed-e2e.ts` 로컬 ephemeral/dev DB에서 성공 + 2회 실행 idempotent
- [ ] `npx playwright test --grep @smoke --list` 결과에 기존 5개 스펙만 포함
- [ ] CI `e2e` workflow 통과 (기존 동작 유지 확인)
- [ ] PR 머지 후 prod Supabase에 `seed-e2e.ts` 주입 — 4계정 로그인 가능
- [ ] GitHub secrets 8개 등록 (E2E_PLATFORM_EMAIL/PASSWORD, E2E_ORG1_OWNER_*, E2E_ORG1_MEMBER_*, E2E_ORG2_OWNER_*)
EOF
)"
```

- [ ] **Step 6: After PR 1 merges — manual gate**

1. Prod Supabase seed 주입:
   ```bash
   git checkout main && git pull
   set -a && source .env.production.local && set +a  # or similar prod-credential file
   npx tsx packages/db/seed-e2e.ts
   ```
   Expected log: "No real data was modified."

2. Verify login for all 4 accounts at https://axleai.io/login.

3. Add 8 GitHub secrets via `gh secret set`:
   ```bash
   for pair in \
     "E2E_PLATFORM_EMAIL=platform@e2e.axleai.io" \
     "E2E_PLATFORM_PASSWORD=test1234" \
     "E2E_ORG1_OWNER_EMAIL=owner1@e2e.axleai.io" \
     "E2E_ORG1_OWNER_PASSWORD=test1234" \
     "E2E_ORG1_MEMBER_EMAIL=member1@e2e.axleai.io" \
     "E2E_ORG1_MEMBER_PASSWORD=test1234" \
     "E2E_ORG2_OWNER_EMAIL=owner2@e2e.axleai.io" \
     "E2E_ORG2_OWNER_PASSWORD=test1234"; do
     KEY="${pair%%=*}"
     VAL="${pair#*=}"
     echo -n "$VAL" | gh secret set "$KEY"
   done
   ```

---

## PR 2 — Boundary Tests + CI

### Task 5: role-boundary.spec.ts

**Files:**
- Create: `e2e/role-boundary.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// e2e/role-boundary.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath } from "./helpers/roles";
import { signInAs } from "./helpers/auth";

test.describe("role boundary: platform admin routes @boundary", () => {
  test.describe("as platform", () => {
    test.use({ storageState: storageStatePath("platform") });

    test("can render /platform-admin/users", async ({ page }) => {
      await page.goto("/platform-admin/users");
      await expect(page).toHaveURL(/\/platform-admin\/users/);
      // Users table should be rendered (at least one row or the empty-state text).
      await expect(page.getByRole("heading", { name: /사용자|Users/i })).toBeVisible();
    });

    test("can render /platform-admin/organizations", async ({ page }) => {
      await page.goto("/platform-admin/organizations");
      await expect(page).toHaveURL(/\/platform-admin\/organizations/);
      await expect(page.getByRole("heading", { name: /조직|Organizations/i })).toBeVisible();
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("is redirected away from /platform-admin", async ({ page }) => {
      await page.goto("/platform-admin");
      await page.waitForURL(/\/(dashboard|login)/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/(dashboard|login)/);
    });

    test("GET /api/admin/users returns 403", async ({ request }) => {
      const res = await request.get("/api/admin/users");
      expect(res.status()).toBe(403);
    });

    test("GET /api/admin/stats returns 403", async ({ request }) => {
      const res = await request.get("/api/admin/stats");
      expect(res.status()).toBe(403);
    });
  });

  test.describe("as org1-member", () => {
    test.use({ storageState: storageStatePath("org1-member") });

    test("is redirected away from /platform-admin", async ({ page }) => {
      await page.goto("/platform-admin");
      await page.waitForURL(/\/(dashboard|login)/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/(dashboard|login)/);
    });

    test("GET /api/admin/organizations returns 403", async ({ request }) => {
      const res = await request.get("/api/admin/organizations");
      expect(res.status()).toBe(403);
    });
  });

  test.describe("unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("is redirected to /login from /platform-admin", async ({ page }) => {
      await page.goto("/platform-admin");
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/login/);
    });
  });
});
```

- [ ] **Step 2: Run locally (with dev server + storageState populated)**

```bash
npx playwright test e2e/role-boundary.spec.ts --grep @boundary
```

Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git checkout -b chore/WI-028-chore-e2e-boundary-tests
git add e2e/role-boundary.spec.ts
git commit -m "WI-028-chore role-boundary E2E 스펙 (@boundary, 8개)

- platform: /platform-admin/users, /organizations 렌더
- org1-owner/member: /platform-admin 리다이렉트, /api/admin/* 403
- unauth: /platform-admin → /login"
```

---

### Task 6: cross-org-isolation.spec.ts

**Files:**
- Create: `e2e/cross-org-isolation.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// e2e/cross-org-isolation.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

test.describe("cross-org isolation @boundary", () => {
  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("cannot access org2 client via direct URL", async ({ page }) => {
      const res = await page.goto(`/clients/${E2E_IDS.clients.org2}`);
      // Either 404 page or redirect to /clients list with empty detail
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("cannot access org2 project via direct URL", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.org2}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("org2 client is not visible in /clients list", async ({ page }) => {
      await page.goto("/clients");
      // E2E Client B should NOT appear for org1-owner
      await expect(page.getByText(/E2E Client B/)).toHaveCount(0);
    });
  });

  test.describe("as org2-owner", () => {
    test.use({ storageState: storageStatePath("org2-owner") });

    test("cannot access org1 client via direct URL", async ({ page }) => {
      const res = await page.goto(`/clients/${E2E_IDS.clients.org1}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("cannot access org1 project via direct URL", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });
  });
});
```

- [ ] **Step 2: Run locally**

```bash
npx playwright test e2e/cross-org-isolation.spec.ts --grep @boundary
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/cross-org-isolation.spec.ts
git commit -m "WI-028-chore cross-org-isolation E2E 스펙 (@boundary, 5개)

- org1-owner/org2-owner 상호 데이터 직접 접근 차단
- 목록 쿼리에서도 상대 조직 엔티티 미노출"
```

---

### Task 7: rebac-project-access.spec.ts

**Files:**
- Create: `e2e/rebac-project-access.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// e2e/rebac-project-access.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

test.describe("ReBAC project access @boundary", () => {
  test.describe("as org1-member", () => {
    test.use({ storageState: storageStatePath("org1-member") });

    test("can view shared project detail (MEMBER role)", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      expect(res?.status()).toBe(200);
      // Project title should render
      await expect(page.getByText(/E2E Project — member shared/)).toBeVisible();
    });

    test("cannot view owner-only project (not a project member)", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.ownerOnly}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("PATCH on owner-only project returns 403", async ({ request }) => {
      const res = await request.patch(`/api/projects/${E2E_IDS.projects.ownerOnly}`, {
        data: { title: "hacked" },
      });
      expect([403, 404]).toContain(res.status());
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("can view shared project and see edit affordances", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      expect(res?.status()).toBe(200);
      // Edit button should be visible for LEAD
      const editBtn = page.getByRole("link", { name: /수정|Edit/i }).or(
        page.getByRole("button", { name: /수정|Edit/i }),
      );
      await expect(editBtn.first()).toBeVisible();
    });
  });
});
```

- [ ] **Step 2: Run locally**

```bash
npx playwright test e2e/rebac-project-access.spec.ts --grep @boundary
```

Expected: 4 tests pass. If edit-button locator fails, inspect actual project detail UI and adjust selector before committing.

- [ ] **Step 3: Commit**

```bash
git add e2e/rebac-project-access.spec.ts
git commit -m "WI-028-chore rebac-project-access E2E 스펙 (@boundary, 4개)

- MEMBER: 등록된 프로젝트 읽기 OK, 비멤버 프로젝트 404/403
- LEAD: 프로젝트 상세 + 편집 버튼 노출
- API 레벨 PATCH 차단 검증"
```

---

### Task 8: Create e2e-boundary.yml workflow

**Files:**
- Create: `.github/workflows/e2e-boundary.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/e2e-boundary.yml
name: E2E Boundary Tests

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  boundary:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      NODE_OPTIONS: '--max-old-space-size=4096'
      E2E_BASE_URL: https://axleai.io
      E2E_PLATFORM_EMAIL: ${{ secrets.E2E_PLATFORM_EMAIL }}
      E2E_PLATFORM_PASSWORD: ${{ secrets.E2E_PLATFORM_PASSWORD }}
      E2E_ORG1_OWNER_EMAIL: ${{ secrets.E2E_ORG1_OWNER_EMAIL }}
      E2E_ORG1_OWNER_PASSWORD: ${{ secrets.E2E_ORG1_OWNER_PASSWORD }}
      E2E_ORG1_MEMBER_EMAIL: ${{ secrets.E2E_ORG1_MEMBER_EMAIL }}
      E2E_ORG1_MEMBER_PASSWORD: ${{ secrets.E2E_ORG1_MEMBER_PASSWORD }}
      E2E_ORG2_OWNER_EMAIL: ${{ secrets.E2E_ORG2_OWNER_EMAIL }}
      E2E_ORG2_OWNER_PASSWORD: ${{ secrets.E2E_ORG2_OWNER_PASSWORD }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run @boundary tests against prod
        run: npx playwright test --grep @boundary

      - name: Upload trace on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-boundary-trace-${{ github.run_id }}
          path: |
            test-results/
            .playwright-auth/
          retention-days: 7
          if-no-files-found: ignore
```

- [ ] **Step 2: Dry-run via workflow_dispatch**

After pushing branch, trigger manually:
```bash
gh workflow run e2e-boundary.yml --ref chore/WI-028-chore-e2e-boundary-tests
```

Wait for completion. Expected: all 17 @boundary tests pass against https://axleai.io.

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/e2e-boundary.yml
git commit -m "WI-028-chore e2e-boundary.yml CI 워크플로우 추가

- 모든 PR에서 prod axleai.io에 read-only @boundary 테스트
- Secret 8개 참조 (DATABASE_URL 미포함 — 쓰기 불가)
- 실패 시 trace artifact 업로드"
git push -u origin chore/WI-028-chore-e2e-boundary-tests
```

- [ ] **Step 4: Create PR 2**

```bash
gh pr create --title "WI-028-chore E2E boundary 테스트 (17개) + e2e-boundary.yml" --body "$(cat <<'EOF'
## Summary
- role-boundary (8) + cross-org-isolation (5) + rebac-project-access (4) = 17 @boundary 시나리오
- `e2e-boundary.yml`: 모든 PR에서 https://axleai.io 대상 read-only 실행 (~90초)
- prod 데이터 변조 없음 — DATABASE_URL 미주입

## Test plan
- [ ] `npx playwright test --grep @boundary` 로컬 17개 통과
- [ ] workflow_dispatch 수동 실행 통과
- [ ] PR check에 `e2e-boundary` 등록 후 머지 전 초록 확인
- [ ] 머지 후 브랜치 보호 규칙에 필수 체크 추가
EOF
)"
```

- [ ] **Step 5: After PR 2 merges — manual gate**

브랜치 보호 규칙에 `e2e-boundary` 필수 체크 추가:
```bash
gh api -X PATCH /repos/:owner/:repo/branches/main/protection/required_status_checks \
  --field "contexts[]=e2e-boundary / boundary"
```
(정확한 check name은 PR check UI에서 확인 후 사용)

---

## PR 3 — Write Tests + CI Consolidation

### Task 9: role-write-actions.spec.ts

**Files:**
- Create: `e2e/role-write-actions.spec.ts`

- [ ] **Step 1: Write the spec**

Note — D-4 원안은 "신규 조직 생성"이었으나 `POST /api/admin/organizations`가 존재하지 않음(GET만). 대신 "platform이 양 조직 조회 가능" 검증으로 대체.

```typescript
// e2e/role-write-actions.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

test.describe("role write actions @write", () => {
  test.describe("as org1-member", () => {
    test.use({ storageState: storageStatePath("org1-member") });

    test("DELETE on owner-only project returns 403", async ({ request }) => {
      const res = await request.delete(`/api/projects/${E2E_IDS.projects.ownerOnly}`);
      expect([403, 404]).toContain(res.status());
    });

    test("POST /api/admin/organizations/{org}/members returns 403", async ({ request }) => {
      const res = await request.post(`/api/admin/organizations/${E2E_IDS.orgs.org1}/members`, {
        data: { userId: E2E_IDS.users.org1Member, role: "OWNER" },
      });
      expect(res.status()).toBe(403);
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("can CRUD a client (create → edit → delete)", async ({ page, request }) => {
      const clientName = `E2E-Write-${Date.now()}`;

      // Create
      await page.goto("/clients/new");
      await page.getByLabel(/회사명|Name/i).fill(clientName);
      await page.getByLabel(/사업자번호/i).fill("111-11-11111");
      await page.getByRole("button", { name: /생성|저장|Save|Create/i }).click();
      await page.waitForURL(/\/clients\/[^/]+/, { timeout: 10_000 });
      const url = page.url();
      const clientId = url.split("/").pop()!;

      // Edit
      await page.goto(`/clients/${clientId}/edit`);
      await page.getByLabel(/회사명|Name/i).fill(`${clientName}-edited`);
      await page.getByRole("button", { name: /저장|업데이트|Save|Update/i }).click();
      await page.waitForURL(/\/clients\/[^/]+(?!\/edit)/);

      // Delete via API (UI delete flow may require confirm dialog)
      const delRes = await request.delete(`/api/clients/${clientId}`);
      expect([200, 204]).toContain(delRes.status());
    });
  });

  test.describe("as platform", () => {
    test.use({ storageState: storageStatePath("platform") });

    test("GET /api/admin/organizations returns both E2E orgs", async ({ request }) => {
      const res = await request.get("/api/admin/organizations");
      expect(res.status()).toBe(200);
      const body = await res.json();
      const orgs: Array<{ id: string }> = body.organizations ?? body.data ?? body;
      const ids = orgs.map((o) => o.id);
      expect(ids).toContain(E2E_IDS.orgs.org1);
      expect(ids).toContain(E2E_IDS.orgs.org2);
    });

    test("can deactivate a user via bulk API", async ({ request }) => {
      const res = await request.post("/api/admin/users/bulk", {
        data: { userIds: [E2E_IDS.users.org1Member], action: "deactivate" },
      });
      expect([200, 204]).toContain(res.status());
    });

    test("can reactivate a user via bulk API", async ({ request }) => {
      const res = await request.post("/api/admin/users/bulk", {
        data: { userIds: [E2E_IDS.users.org1Member], action: "activate" },
      });
      expect([200, 204]).toContain(res.status());
    });

    test("can view org detail for a cross-org organization", async ({ page }) => {
      await page.goto(`/platform-admin/organizations/${E2E_IDS.orgs.org1}`);
      await expect(page).toHaveURL(new RegExp(`/platform-admin/organizations/${E2E_IDS.orgs.org1}`));
      await expect(page.getByText(/E2E 컨설팅 A/)).toBeVisible();
    });

    test("can export users CSV", async ({ request }) => {
      const res = await request.get("/api/admin/users/export");
      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(body.split("\n").length).toBeGreaterThan(1); // header + at least one row
    });
  });
});
```

- [ ] **Step 2: Run locally against ephemeral DB**

Spin up ephemeral Postgres via Docker, seed, start web, then:
```bash
# Terminal 1
docker run --rm -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=axle_e2e -p 5432:5432 pgvector/pgvector:pg16
# Terminal 2
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/axle_e2e
export DIRECT_URL=$DATABASE_URL
npx prisma db push --schema=packages/db/prisma/schema.prisma --skip-generate
npx tsx packages/db/seed.ts
npx tsx packages/db/seed-e2e.ts
npm run -w apps/web build && npm run -w apps/web start
# Terminal 3
export E2E_PLATFORM_EMAIL=platform@e2e.axleai.io E2E_PLATFORM_PASSWORD=test1234 # ... (all 8)
npx playwright test --grep @write
```

Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git checkout -b chore/WI-029-chore-e2e-write-tests
git add e2e/role-write-actions.spec.ts
git commit -m "WI-029-chore role-write-actions E2E 스펙 (@write, 8개)

- MEMBER: 타인 프로젝트 DELETE/조직 멤버 추가 403
- OWNER: 자기 조직 client CRUD 정상
- PLATFORM: 조직 조회, 사용자 비활성화/재활성화, 조직 상세 진입, CSV export"
```

---

### Task 10: Create e2e-write.yml with regression issue logic

**Files:**
- Create: `.github/workflows/e2e-write.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/e2e-write.yml
name: E2E Write Tests (ephemeral)

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/**'
      - 'e2e/**'
      - 'playwright.config.ts'
      - 'package-lock.json'
      - '.github/workflows/e2e-write.yml'
  pull_request:
    paths:
      - 'apps/web/app/(admin)/**'
      - 'apps/web/app/api/admin/**'
      - 'apps/web/lib/admin/**'
      - 'packages/auth/**'
      - 'packages/db/prisma/schema.prisma'
      - 'packages/db/seed.ts'
      - 'packages/db/seed-e2e.ts'
      - 'e2e/**'
      - '.github/workflows/e2e-write.yml'
  schedule:
    - cron: '0 17 * * *'  # 02:00 KST
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  write:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: axle_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      NODE_OPTIONS: '--max-old-space-size=4096'
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/axle_e2e
      DIRECT_URL: postgres://postgres:postgres@localhost:5432/axle_e2e
      NEXTAUTH_SECRET: test-secret-for-e2e-only
      AUTH_SECRET: test-secret-for-e2e-only
      NEXTAUTH_URL: http://localhost:3000
      AUTH_URL: http://localhost:3000
      E2E_BASE_URL: http://localhost:3000
      E2E_PLATFORM_EMAIL: platform@e2e.axleai.io
      E2E_PLATFORM_PASSWORD: test1234
      E2E_ORG1_OWNER_EMAIL: owner1@e2e.axleai.io
      E2E_ORG1_OWNER_PASSWORD: test1234
      E2E_ORG1_MEMBER_EMAIL: member1@e2e.axleai.io
      E2E_ORG1_MEMBER_PASSWORD: test1234
      E2E_ORG2_OWNER_EMAIL: owner2@e2e.axleai.io
      E2E_ORG2_OWNER_PASSWORD: test1234
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm

      - run: npm ci

      - name: Prisma generate
        run: npx prisma generate --schema=packages/db/prisma/schema.prisma

      - name: Prisma db push
        run: npx prisma db push --schema=packages/db/prisma/schema.prisma --skip-generate

      - name: Seed main fixtures
        run: npx tsx packages/db/seed.ts

      - name: Seed E2E fixtures
        run: npx tsx packages/db/seed-e2e.ts

      - name: Build web app
        run: npx turbo build --filter=web

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start web app
        run: |
          npm run -w apps/web start &
          npx wait-on http://localhost:3000 --timeout 60000

      - name: Run @write + @smoke tests
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            npx playwright test --grep "@write|@smoke" --reporter=json > e2e-results.json
          else
            npx playwright test --grep "@write|@smoke" --reporter=json > e2e-results.json 2>&1 || true
          fi

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-write-report-${{ github.run_id }}
          path: |
            playwright-report/
            test-results/
            e2e-results.json
          retention-days: 14
          if-no-files-found: ignore

      - name: Auto-create regression issues on main push / schedule
        if: always() && (github.event_name == 'push' || github.event_name == 'schedule')
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          if [ ! -f e2e-results.json ]; then
            echo "No e2e results file found"
            exit 0
          fi

          FAILED_TESTS=$(cat e2e-results.json | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            const suites = data.suites || [];
            const failures = [];
            function walk(suite, parentTitle) {
              const suiteTitle = parentTitle ? parentTitle + ' > ' + (suite.title || '') : (suite.title || '');
              for (const spec of (suite.specs || [])) {
                for (const t of (spec.tests || [])) {
                  if (t.status === 'unexpected' || t.status === 'failed') {
                    failures.push({
                      title: suiteTitle + ' > ' + spec.title,
                      file: suite.file || '',
                      error: (t.results?.[0]?.error?.message || '').substring(0, 500),
                    });
                  }
                }
              }
              for (const child of (suite.suites || [])) walk(child, suiteTitle);
            }
            suites.forEach(s => walk(s, ''));
            console.log(JSON.stringify(failures));
          " 2>/dev/null || echo "[]")

          if [ "$FAILED_TESTS" = "[]" ] || [ -z "$FAILED_TESTS" ]; then
            echo "All E2E tests passed"
            exit 0
          fi

          echo "$FAILED_TESTS" | node -e "
            const failures = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            for (const f of failures) {
              const wiMatch = f.title.match(/WI-\d+/);
              const wiNum = wiMatch ? wiMatch[0] : 'UNKNOWN';
              console.log(JSON.stringify({ wi: wiNum, title: f.title, file: f.file, error: f.error }));
            }
          " | while IFS= read -r line; do
            WI_NUM=$(echo "$line" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).wi)")
            TITLE=$(echo "$line"  | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).title)")
            ERROR=$(echo "$line"  | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).error)")
            FILE=$(echo "$line"   | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).file)")

            EXISTING=$(gh issue list --label regression --search "$WI_NUM" --state open --json number,title --jq "[.[] | select(.title | test(\"^${WI_NUM}[^0-9]\"))] | length" 2>/dev/null || echo "0")
            if [ "$EXISTING" != "0" ]; then
              echo "Skipping $WI_NUM - regression issue already exists"
              continue
            fi

            BODY="E2E 테스트 실패: WI=${WI_NUM}, 테스트=${TITLE}, 파일=${FILE}, 커밋=${{ github.sha }}. 에러: ${ERROR}"
            gh issue create \
              --label regression \
              --title "${WI_NUM} e2e 실패: ${TITLE}" \
              --body "$BODY" || true
            echo "Created regression issue for $WI_NUM"
          done
```

- [ ] **Step 2: Commit the workflow**

```bash
git add .github/workflows/e2e-write.yml
git commit -m "WI-029-chore e2e-write.yml CI 워크플로우 추가 (ephemeral + regression)

- ephemeral pgvector:pg16 서비스로 격리 실행
- seed.ts → seed-e2e.ts → build → start → playwright
- trigger: admin 경로 path filter PR + main push + nightly 02:00 KST
- main push/schedule 실패 시 regression issue 자동 생성 (기존 e2e.yml에서 이식)"
```

---

### Task 11: Delete old e2e.yml

**Files:**
- Delete: `.github/workflows/e2e.yml`

- [ ] **Step 1: Verify e2e-write.yml covers everything e2e.yml did**

Checklist:
- [x] `@smoke` tests run → e2e-write.yml has `--grep "@write|@smoke"`
- [x] Regression issue creation on main push → e2e-write.yml step exists
- [x] Playwright artifacts upload → e2e-write.yml uploads
- [x] Node 22, NODE_OPTIONS 4GB → e2e-write.yml has these

- [ ] **Step 2: Delete**

```bash
git rm .github/workflows/e2e.yml
git commit -m "WI-029-chore 기존 e2e.yml 제거 — e2e-write.yml로 흡수 완료"
```

- [ ] **Step 3: Push and create PR 3**

```bash
git push -u origin chore/WI-029-chore-e2e-write-tests
gh pr create --title "WI-029-chore E2E write 테스트 (8개) + e2e-write.yml + e2e.yml 제거" --body "$(cat <<'EOF'
## Summary
- role-write-actions (8) @write 시나리오
- e2e-write.yml: ephemeral Postgres + seed + build + start + playwright
- main push/schedule 실패 시 regression issue 자동 생성 (기존 로직 이식)
- 기존 e2e.yml 제거 — @smoke는 e2e-write.yml로 흡수

## Test plan
- [ ] `npx playwright test --grep @write` 로컬 ephemeral 환경에서 8개 통과
- [ ] PR의 e2e-write 워크플로우 실행 성공 (~5분)
- [ ] 머지 후 main push 트리거 확인
- [ ] nightly schedule 다음 실행 확인 (2026-04-20 02:00 KST)
EOF
)"
```

---

## Self-Review 체크리스트 (플랜 작성 후 수행)

- [ ] Spec §Seed 분리: Task 1 (seed-e2e.ts) 커버 ✓
- [ ] Spec §E2E 헬퍼: Task 2 (roles.ts + auth.ts) 커버 ✓
- [ ] Spec §Storage state 재사용: Task 3 (globalSetup) 커버 ✓
- [ ] Spec §역할별 매핑 (platformRole): Task 1 seed-e2e.ts 반영 ✓
- [ ] Spec §A role-boundary (8): Task 5 커버 ✓
- [ ] Spec §B cross-org (5): Task 6 커버 ✓
- [ ] Spec §C rebac-project (4): Task 7 커버 ✓
- [ ] Spec §D role-write (8): Task 9 커버 — D-4는 POST endpoint 부재로 "다중 조직 조회"로 대체 (플랜에 주석으로 명시)
- [ ] Spec §CI e2e-boundary.yml: Task 8 커버 ✓
- [ ] Spec §CI e2e-write.yml + regression carry forward: Task 10 커버 ✓
- [ ] Spec §기존 e2e.yml 처리: Task 4 (@smoke grep) + Task 11 (삭제) 커버 ✓
- [ ] Spec §수용 기준 — 플랜 단계 사전 검증 (PATCH, /new, 403/404):
  - PATCH /api/projects 있음 (route.ts:64) ✓ — C-4 유지
  - /platform-admin/organizations/new 없음, POST API도 없음 — D-4 "GET으로 양 조직 조회"로 대체 (Task 9에 주석) ✓
  - 403 관례: forbiddenResponse() = HTTP 403, `[403, 404]` 허용으로 정렬 ✓

**Placeholder scan**: 모든 Task의 code block은 실제 실행 가능한 완성 코드. TBD/TODO/placeholder 없음.

**Type consistency**:
- `E2ERole` 타입 = `"platform" | "org1-owner" | "org1-member" | "org2-owner"` — roles.ts/global-setup.ts/specs 일관 ✓
- `storageStatePath(role)` — roles.ts 정의, globalSetup + specs 동일 시그니처 사용 ✓
- `E2E_IDS` — roles.ts 정의, 모든 spec에서 동일 키 구조 참조 ✓
- `signInAs(page, role)` — auth.ts 정의, 현재 플랜에선 직접 호출 없음(storageState 대체) — 향후 확장용 ✓

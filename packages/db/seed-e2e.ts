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

// Fixture for AI summary failure UI — a meeting whose transcript has a FAILED
// AiJob. Used by e2e/meeting-ai-summary-failure.spec.ts to regression-test the
// user-facing failure state introduced by PR #25.
const FAILED_SUMMARY_FIXTURE = {
  meetingId: "meeting-e2e-failed-summary",
  transcriptId: "transcript-e2e-failed-summary",
  aiJobId: "aijob-e2e-failed-summary",
  errorMessage: "E2E seeded failure — AI provider returned 500.",
} as const;

// Fixture for Phase 20 intake happy-path E2E (WI-716). A PENDING IntakeDraft
// whose parsedJson is realistic enough to drive the review form. The E2E spec
// asserts: review → 등록 → redirect to /erp/orders/{orderId} with the same
// counterparty + amounts. Auto-register is enabled by default in the form so
// the seeded item produces a new Product + InventoryMovement on confirm.
const INTAKE_PENDING_FIXTURE = {
  draftId: "intake-e2e-pending-confirm",
  vendor: "E2E 영수증 거래처",
  itemName: "E2E 시드 상품",
  itemQty: 5,
  itemUnitPrice: 1000,
  tax: 500,
  total: 5_500,
  date: "2026-05-01",
  // Public placeholder; the review page renders it via <img>. We only assert
  // the alt text exists, not that the image actually loads — keeps the test
  // resilient to network conditions and lets us skip Vercel Blob for E2E.
  blobUrl: "https://placehold.co/400x600/png?text=E2E+Receipt",
} as const;

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
      // Phase 20 ERP module scopes (WI-716). `module-scope` namespace is
      // checked by `requireErpScope` → `checkModulePermission`. `erp` is a
      // read/write-only resource (no `erp:*` in MODULE_SCOPES catalog), so
      // we grant both verbs explicitly to org1-owner.
      { namespace: "module-scope", objectId: ORGS.org1.id, relation: "erp:read",  subjectType: "user", subjectId: USERS.org1Owner.id },
      { namespace: "module-scope", objectId: ORGS.org1.id, relation: "erp:write", subjectType: "user", subjectId: USERS.org1Owner.id },
    ],
  });
  console.log(`[seed-e2e] Created 11 relation tuples`);

  // 8. AI summary failure fixture (Meeting + Transcript + FAILED AiJob).
  // Idempotent: we upsert the AiJob first (to re-use the fixed id), then
  // the Meeting, then the MeetingTranscript with aiJobId pointing at it.
  await prisma.aiJob.upsert({
    where: { id: FAILED_SUMMARY_FIXTURE.aiJobId },
    update: {
      status: "FAILED",
      errorMessage: FAILED_SUMMARY_FIXTURE.errorMessage,
    },
    create: {
      id: FAILED_SUMMARY_FIXTURE.aiJobId,
      orgId: ORGS.org1.id,
      type: "SUMMARY",
      tier: "API_HAIKU",
      status: "FAILED",
      input: { source: "e2e-seed" },
      errorMessage: FAILED_SUMMARY_FIXTURE.errorMessage,
    },
  });

  await prisma.meeting.upsert({
    where: { id: FAILED_SUMMARY_FIXTURE.meetingId },
    update: {
      clientId: CLIENTS.client1.id,
      title: "E2E — AI Summary Failure Fixture",
    },
    create: {
      id: FAILED_SUMMARY_FIXTURE.meetingId,
      clientId: CLIENTS.client1.id,
      title: "E2E — AI Summary Failure Fixture",
      date: new Date("2026-04-01T10:00:00Z"),
    },
  });

  await prisma.meetingTranscript.upsert({
    where: { id: FAILED_SUMMARY_FIXTURE.transcriptId },
    update: {
      rawTranscript: "E2E transcript body for failed-summary fixture.",
      summary: null,
      aiJobId: FAILED_SUMMARY_FIXTURE.aiJobId,
    },
    create: {
      id: FAILED_SUMMARY_FIXTURE.transcriptId,
      meetingId: FAILED_SUMMARY_FIXTURE.meetingId,
      rawTranscript: "E2E transcript body for failed-summary fixture.",
      summary: null,
      aiJobId: FAILED_SUMMARY_FIXTURE.aiJobId,
    },
  });
  console.log(`[seed-e2e] Upserted AI summary failure fixture`);

  // 9. Phase 20 intake fixture (WI-716) — a PENDING IntakeDraft that the
  // happy-path E2E confirms into an Order. We force status back to PENDING
  // on every seed so the E2E is repeatable; the confirm endpoint locks it
  // to CONFIRMED, so without this reset a second run would 409.
  //
  // Side-effect of resetting: any Order/InventoryMovement/Product rows the
  // previous E2E run created via auto-register are NOT deleted here (they
  // live under org-e2e-1 alongside real test data). The E2E asserts on the
  // freshly-created Order via its router.push redirect, so leftover rows
  // from prior runs don't interfere with the assertions.
  const intakeParsed = {
    type: "purchase",
    vendor: INTAKE_PENDING_FIXTURE.vendor,
    date: INTAKE_PENDING_FIXTURE.date,
    items: [
      {
        name: INTAKE_PENDING_FIXTURE.itemName,
        qty: INTAKE_PENDING_FIXTURE.itemQty,
        unitPrice: INTAKE_PENDING_FIXTURE.itemUnitPrice,
        unit: "개",
      },
    ],
    total: INTAKE_PENDING_FIXTURE.total,
    tax: INTAKE_PENDING_FIXTURE.tax,
    confidence: 0.95,
  };
  await prisma.intakeDraft.upsert({
    where: { id: INTAKE_PENDING_FIXTURE.draftId },
    update: {
      orgId: ORGS.org1.id,
      userId: USERS.org1Owner.id,
      blobUrl: INTAKE_PENDING_FIXTURE.blobUrl,
      ocrJson: { source: "e2e-seed", text: "E2E receipt OCR raw text" },
      parsedJson: intakeParsed,
      matchSuggestions: {},
      status: "PENDING",
      confirmedOrderId: null,
      errorMsg: null,
    },
    create: {
      id: INTAKE_PENDING_FIXTURE.draftId,
      orgId: ORGS.org1.id,
      userId: USERS.org1Owner.id,
      blobUrl: INTAKE_PENDING_FIXTURE.blobUrl,
      ocrJson: { source: "e2e-seed", text: "E2E receipt OCR raw text" },
      parsedJson: intakeParsed,
      matchSuggestions: {},
      status: "PENDING",
    },
  });
  console.log(`[seed-e2e] Upserted intake happy-path fixture (PENDING)`);

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

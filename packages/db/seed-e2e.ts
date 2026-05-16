// packages/db/seed-e2e.ts
// AXLE E2E Seed — idempotent, production-safe.
// Usage: set -a && source .env.local && set +a && npx tsx packages/db/seed-e2e.ts
// ONLY creates/updates entities with `e2e-` or `@e2e.axleai.io` prefix.
// Real data is never touched.

import { PrismaClient, MovementType, OrderType, OrderStatus, ReferenceType, DraftStatus } from "@prisma/client";
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

// Phase 20 ERP fixtures (Q2-2026 전수 E2E batch). Stable IDs across all
// resources so specs can deep-link directly without searching lists.
// Idempotency strategy:
//   - Products/Drafts/Orders → upsert (reset to baseline state on every run)
//   - OrderItems / InventoryMovements → deleteMany by fixture id prefix
//     then createMany (rebuild the collection from scratch each run).
// All fixture rows live under org-e2e-1 so they share scope grants with
// org1-owner and don't collide with org2-owner's tenant.
const ERP_PRODUCT_IDS = {
  edit: "product-e2e-edit",
  collision: "product-e2e-collision",
  archive: "product-e2e-archive",
  inventory: "product-e2e-inventory",
} as const;

const ERP_ORDER_IDS = {
  draft: "order-e2e-draft",
  confirmed: "order-e2e-confirmed",
  cancelled: "order-e2e-cancelled",
  fromIntake: "order-e2e-from-intake",
} as const;

const ERP_INVMOV_IDS = [
  "invmov-e2e-001",
  "invmov-e2e-002",
  "invmov-e2e-003",
  "invmov-e2e-004",
  "invmov-e2e-005",
] as const;

const ERP_INTAKE_IDS = {
  discard: "intake-e2e-discard",
  lowConfidence: "intake-e2e-low-confidence",
  errored: "intake-e2e-errored",
  withSuggestions: "intake-e2e-with-suggestions",
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
      // org1-member: erp:read only — used by erp-multi-org spec to verify
      // that write actions return 403 while reads succeed.
      { namespace: "module-scope", objectId: ORGS.org1.id, relation: "erp:read",  subjectType: "user", subjectId: USERS.org1Member.id },
      // org2-owner: full erp scope on their own tenant — used by erp-multi-org
      // to verify cross-tenant resource access returns 404 (not 403).
      { namespace: "module-scope", objectId: ORGS.org2.id, relation: "erp:read",  subjectType: "user", subjectId: USERS.org2Owner.id },
      { namespace: "module-scope", objectId: ORGS.org2.id, relation: "erp:write", subjectType: "user", subjectId: USERS.org2Owner.id },
    ],
  });
  console.log(`[seed-e2e] Created 14 relation tuples`);

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

  // 10. Phase 20 ERP fixtures (전수 E2E batch).
  //
  // Products — 4 stable rows for CRUD / inventory / orders specs. We delete
  // any OrderItem/InventoryMovement that references these by id-prefix below
  // (steps 11–12), so the products themselves can stay as `upsert` even
  // though they're FK targets.
  const PRODUCT_ROWS = [
    {
      id: ERP_PRODUCT_IDS.edit,
      name: "E2E 편집용 상품",
      sku: "E2E-EDIT-001",
      unit: "개",
      unitPrice: 5_000,
      category: "E2E",
    },
    {
      id: ERP_PRODUCT_IDS.collision,
      name: "E2E SKU 중복 대상",
      // Specs that create a new product with this sku must hit P2002 → 409.
      sku: "E2E-DUPE-CANARY",
      unit: "개",
      unitPrice: 1_000,
      category: "E2E",
    },
    {
      id: ERP_PRODUCT_IDS.archive,
      name: "E2E 보관 테스트 상품",
      sku: "E2E-ARCH-001",
      unit: "박스",
      unitPrice: 3_000,
      category: "E2E",
    },
    {
      id: ERP_PRODUCT_IDS.inventory,
      name: "E2E 재고 추적 상품",
      sku: "E2E-INV-001",
      unit: "개",
      unitPrice: 2_500,
      category: "E2E",
    },
  ] as const;
  for (const p of PRODUCT_ROWS) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        orgId: ORGS.org1.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        unitPrice: p.unitPrice,
        category: p.category,
        archived: false, // always reset archived flag so DELETE spec is repeatable
      },
      create: {
        id: p.id,
        orgId: ORGS.org1.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        unitPrice: p.unitPrice,
        category: p.category,
      },
    });
  }
  console.log(`[seed-e2e] Upserted ${PRODUCT_ROWS.length} ERP products`);

  // 11. Orders + OrderItems — rebuild collections from scratch so cancel
  // spec is repeatable (CONFIRMED resets to CONFIRMED, any reversal rows
  // we created on a previous run are pruned in step 12).
  //
  // Delete order items first (FK → orders), then orders themselves, then
  // recreate. We scope deletes to our 4 fixture ids so historic real-data
  // orders under org-e2e-1 (created by other E2E spec runs) are untouched.
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: Object.values(ERP_ORDER_IDS) } },
  });
  await prisma.order.deleteMany({
    where: { id: { in: Object.values(ERP_ORDER_IDS) } },
  });
  await prisma.order.createMany({
    data: [
      {
        id: ERP_ORDER_IDS.draft,
        orgId: ORGS.org1.id,
        type: OrderType.PURCHASE,
        counterpartyName: "E2E DRAFT 거래처",
        status: OrderStatus.DRAFT,
        total: 10_000,
        tax: 0,
        occurredAt: new Date("2026-05-10T00:00:00Z"),
        source: ReferenceType.MANUAL,
      },
      {
        id: ERP_ORDER_IDS.confirmed,
        orgId: ORGS.org1.id,
        type: OrderType.PURCHASE,
        counterpartyName: "E2E 취소 대상 거래처",
        status: OrderStatus.CONFIRMED,
        total: 25_000,
        tax: 2_500,
        occurredAt: new Date("2026-05-12T00:00:00Z"),
        source: ReferenceType.MANUAL,
      },
      {
        id: ERP_ORDER_IDS.cancelled,
        orgId: ORGS.org1.id,
        type: OrderType.SALE,
        counterpartyName: "E2E 이미 취소됨 거래처",
        status: OrderStatus.CANCELLED,
        total: 15_000,
        tax: 1_500,
        occurredAt: new Date("2026-05-08T00:00:00Z"),
        source: ReferenceType.MANUAL,
      },
      {
        id: ERP_ORDER_IDS.fromIntake,
        orgId: ORGS.org1.id,
        type: OrderType.PURCHASE,
        counterpartyName: "E2E Intake 출처 거래처",
        status: OrderStatus.CONFIRMED,
        total: 5_500,
        tax: 500,
        occurredAt: new Date("2026-05-01T00:00:00Z"),
        // Intake backlink test asserts this order's detail page links back
        // to /erp/intake/{sourceId}. The target draft is the happy-path
        // fixture seeded above (PENDING reset on every run).
        source: ReferenceType.RECEIPT_INTAKE,
        sourceId: INTAKE_PENDING_FIXTURE.draftId,
      },
    ],
  });
  await prisma.orderItem.createMany({
    data: [
      // DRAFT order — 1 ad-hoc line (no productId, no inventory effect).
      {
        id: "oi-e2e-draft-1",
        orderId: ERP_ORDER_IDS.draft,
        productId: null,
        productName: "DRAFT ad-hoc 품목",
        qty: 1,
        unitPrice: 10_000,
        lineTotal: 10_000,
      },
      // CONFIRMED order — 1 line on the inventory-tracked product.
      // Step 12 creates the matching IN InventoryMovement so the cancel
      // spec can assert a reversal OUT row gets written.
      {
        id: "oi-e2e-confirmed-1",
        orderId: ERP_ORDER_IDS.confirmed,
        productId: ERP_PRODUCT_IDS.inventory,
        productName: "E2E 재고 추적 상품",
        qty: 10,
        unitPrice: 2_500,
        lineTotal: 25_000,
      },
      // CANCELLED order — kept minimal (double-cancel spec only inspects status).
      {
        id: "oi-e2e-cancelled-1",
        orderId: ERP_ORDER_IDS.cancelled,
        productId: null,
        productName: "취소된 ad-hoc 품목",
        qty: 1,
        unitPrice: 15_000,
        lineTotal: 15_000,
      },
      // RECEIPT_INTAKE order — matches the intake fixture totals (5×1,000 + 500).
      {
        id: "oi-e2e-from-intake-1",
        orderId: ERP_ORDER_IDS.fromIntake,
        productId: null,
        productName: "E2E 시드 상품",
        qty: 5,
        unitPrice: 1_000,
        lineTotal: 5_000,
      },
    ],
  });
  console.log(`[seed-e2e] Rebuilt 4 ERP orders + 4 order items`);

  // 12. InventoryMovements — rebuild from scratch.
  //
  // We scope deletes by:
  //   - the 5 fixture ids (timeline filter spec)
  //   - sourceId in our fixture order ids (cancel-reversal rows)
  // so historic real-data movements under org-e2e-1 aren't disturbed.
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { id: { in: [...ERP_INVMOV_IDS] } },
        {
          orgId: ORGS.org1.id,
          source: ReferenceType.ORDER,
          sourceId: { in: Object.values(ERP_ORDER_IDS) },
        },
      ],
    },
  });
  await prisma.inventoryMovement.createMany({
    data: [
      // Mixed type + date set used by erp-inventory spec (period/type filter).
      // Sorted desc by occurredAt to match the route's default ordering.
      {
        id: ERP_INVMOV_IDS[0],
        orgId: ORGS.org1.id,
        productId: ERP_PRODUCT_IDS.inventory,
        type: MovementType.IN,
        qty: 100,
        source: ReferenceType.INITIAL,
        note: "초기 입고 (E2E)",
        occurredAt: new Date("2026-05-01T00:00:00Z"),
      },
      {
        id: ERP_INVMOV_IDS[1],
        orgId: ORGS.org1.id,
        productId: ERP_PRODUCT_IDS.inventory,
        type: MovementType.OUT,
        qty: 30,
        source: ReferenceType.MANUAL,
        note: "수기 출고 (E2E)",
        occurredAt: new Date("2026-05-05T00:00:00Z"),
      },
      {
        id: ERP_INVMOV_IDS[2],
        orgId: ORGS.org1.id,
        productId: ERP_PRODUCT_IDS.inventory,
        type: MovementType.ADJUST,
        qty: 5,
        source: ReferenceType.MANUAL,
        note: "재고 조정 (E2E)",
        occurredAt: new Date("2026-05-08T00:00:00Z"),
      },
      {
        id: ERP_INVMOV_IDS[3],
        orgId: ORGS.org1.id,
        productId: ERP_PRODUCT_IDS.inventory,
        type: MovementType.IN,
        qty: 50,
        source: ReferenceType.MANUAL,
        note: "추가 입고 (E2E)",
        occurredAt: new Date("2026-05-10T00:00:00Z"),
      },
      // Mirrors the CONFIRMED order's line item so the cancel spec can
      // assert a reversal OUT row gets created adjacent to this IN row.
      {
        id: ERP_INVMOV_IDS[4],
        orgId: ORGS.org1.id,
        productId: ERP_PRODUCT_IDS.inventory,
        type: MovementType.IN,
        qty: 10,
        source: ReferenceType.ORDER,
        sourceId: ERP_ORDER_IDS.confirmed,
        unitCost: 2_500,
        note: "주문 확정으로 입고 (E2E)",
        occurredAt: new Date("2026-05-12T00:00:00Z"),
      },
    ],
  });
  console.log(`[seed-e2e] Rebuilt ${ERP_INVMOV_IDS.length} inventory movements`);

  // 13. Additional intake drafts — discard / low-confidence / errored /
  // matchSuggestions. Each PENDING draft resets status + clears terminal
  // fields so the corresponding spec is repeatable.
  const intakeWithSuggestionsParsed = {
    type: "purchase",
    vendor: CLIENTS.client1.name, // matches a seeded client by name
    date: "2026-05-15",
    items: [
      {
        // matches product-e2e-edit by name → spec exercises autocomplete pick
        name: "E2E 편집용 상품",
        qty: 2,
        unitPrice: 5_000,
        unit: "개",
      },
    ],
    total: 10_000,
    tax: 0,
    confidence: 0.92,
  };
  const intakeFixtures = [
    {
      id: ERP_INTAKE_IDS.discard,
      parsedJson: {
        type: "purchase",
        vendor: "폐기 대상 거래처",
        date: "2026-05-14",
        items: [{ name: "폐기 상품", qty: 1, unitPrice: 1_000, unit: "개" }],
        total: 1_000,
        tax: 0,
        confidence: 0.9,
      },
      matchSuggestions: {},
      status: DraftStatus.PENDING,
      errorMsg: null,
    },
    {
      id: ERP_INTAKE_IDS.lowConfidence,
      parsedJson: {
        type: "purchase",
        vendor: "저신뢰 거래처",
        date: "2026-05-13",
        items: [{ name: "저신뢰 상품", qty: 1, unitPrice: 2_000, unit: "개" }],
        total: 2_000,
        tax: 0,
        confidence: 0.42, // < 0.6 → review form shows warning banner
      },
      matchSuggestions: {},
      status: DraftStatus.PENDING,
      errorMsg: null,
    },
    {
      id: ERP_INTAKE_IDS.errored,
      // OCR failed — UI shows the errorMsg banner and asks user for manual entry.
      parsedJson: {},
      matchSuggestions: {},
      status: DraftStatus.PENDING,
      errorMsg: "E2E seed — OCR provider returned 500.",
    },
    {
      id: ERP_INTAKE_IDS.withSuggestions,
      parsedJson: intakeWithSuggestionsParsed,
      matchSuggestions: {
        // Spec asserts the review form surfaces these and a pick wires the
        // existing Product / Client id (not creating new rows).
        items: [
          {
            index: 0,
            product: {
              id: ERP_PRODUCT_IDS.edit,
              name: "E2E 편집용 상품",
              sku: "E2E-EDIT-001",
              unitPrice: "5000",
            },
          },
        ],
        counterparty: {
          id: CLIENTS.client1.id,
          name: CLIENTS.client1.name,
        },
      },
      status: DraftStatus.PENDING,
      errorMsg: null,
    },
  ] as const;
  for (const draft of intakeFixtures) {
    await prisma.intakeDraft.upsert({
      where: { id: draft.id },
      update: {
        orgId: ORGS.org1.id,
        userId: USERS.org1Owner.id,
        blobUrl: INTAKE_PENDING_FIXTURE.blobUrl,
        ocrJson: { source: "e2e-seed" },
        parsedJson: draft.parsedJson,
        matchSuggestions: draft.matchSuggestions,
        status: draft.status,
        confirmedOrderId: null, // always clear — spec may re-confirm
        errorMsg: draft.errorMsg,
      },
      create: {
        id: draft.id,
        orgId: ORGS.org1.id,
        userId: USERS.org1Owner.id,
        blobUrl: INTAKE_PENDING_FIXTURE.blobUrl,
        ocrJson: { source: "e2e-seed" },
        parsedJson: draft.parsedJson,
        matchSuggestions: draft.matchSuggestions,
        status: draft.status,
        errorMsg: draft.errorMsg,
      },
    });
  }
  console.log(`[seed-e2e] Upserted ${intakeFixtures.length} additional intake drafts`);

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

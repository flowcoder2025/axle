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

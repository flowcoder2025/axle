import { prisma } from "./client.js";

/**
 * ReBAC (Relationship-Based Access Control) — Zanzibar-style relation tuples.
 *
 * A tuple encodes: `subjectType:subjectId` has `relation` on `namespace:objectId`
 */

/**
 * Check whether a subject holds a relation on an object.
 * Returns false (never throws) so callers can use it safely in boolean guards.
 */
export async function check(
  namespace: string,
  objectId: string,
  relation: string,
  subjectType: string,
  subjectId: string,
): Promise<boolean> {
  try {
    const tuple = await prisma.relationTuple.findFirst({
      where: { namespace, objectId, relation, subjectType, subjectId },
    });
    return tuple !== null;
  } catch {
    return false;
  }
}

/**
 * Grant a relation (idempotent — safe to call multiple times).
 */
export async function grant(
  namespace: string,
  objectId: string,
  relation: string,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  await prisma.relationTuple.upsert({
    where: {
      namespace_objectId_relation_subjectType_subjectId: {
        namespace,
        objectId,
        relation,
        subjectType,
        subjectId,
      },
    },
    create: { namespace, objectId, relation, subjectType, subjectId },
    update: {},
  });
}

/**
 * Revoke a relation. No-ops silently if the tuple does not exist.
 */
export async function revoke(
  namespace: string,
  objectId: string,
  relation: string,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  try {
    await prisma.relationTuple.delete({
      where: {
        namespace_objectId_relation_subjectType_subjectId: {
          namespace,
          objectId,
          relation,
          subjectType,
          subjectId,
        },
      },
    });
  } catch (err) {
    // Prisma P2025: record not found — silently ignore
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2025"
    ) {
      return;
    }
    throw err;
  }
}

/**
 * List all permission tuples for a given subject.
 */
export async function listPermissions(
  subjectType: string,
  subjectId: string,
): Promise<Array<{ namespace: string; objectId: string; relation: string }>> {
  return prisma.relationTuple.findMany({
    where: { subjectType, subjectId },
    select: { namespace: true, objectId: true, relation: true },
  });
}

/**
 * Convenience helper: check whether a user has any membership relation on an org.
 */
export async function hasOrgAccess(
  userId: string,
  orgId: string,
): Promise<boolean> {
  return check("org", orgId, "member", "user", userId);
}

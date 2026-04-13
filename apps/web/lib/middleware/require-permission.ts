import { check, prisma } from "@axle/db";
import { NextResponse } from "next/server";

/**
 * Verify the user has the required relation on the given object.
 * Returns null if allowed, or a 403 NextResponse if denied.
 *
 * Backward compatibility: if no ReBAC tuples exist for this object at all
 * (i.e. a project created before ReBAC was wired), the check is skipped
 * so existing projects continue to work.
 */
export async function requirePermission(
  namespace: string,
  objectId: string,
  relation: string,
  subjectId: string,
): Promise<NextResponse | null> {
  // Check if the subject holds the required relation
  const allowed = await check(namespace, objectId, relation, "user", subjectId);
  if (allowed) {
    return null;
  }

  // Backward compatibility: if no tuples exist for this object at all,
  // allow the operation (project was created before ReBAC enforcement).
  const tupleCount = await prisma.relationTuple.count({
    where: { namespace, objectId },
  });

  if (tupleCount === 0) {
    return null;
  }

  return NextResponse.json(
    { error: { code: "FORBIDDEN", message: "이 작업을 수행할 권한이 없습니다." } },
    { status: 403 },
  );
}

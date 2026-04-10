import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { notFoundResponse } from "@/lib/api-helpers";

/**
 * Resolves a project by ID, enforcing org boundary via project.client.orgId.
 * Returns the project's id and clientId on success, or a 404 NextResponse on failure.
 */
export async function resolveProject(
  projectId: string,
  orgId: string,
): Promise<
  | { ok: true; project: { id: string; clientId: string } }
  | { ok: false; response: NextResponse }
> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId } },
    select: { id: true, clientId: true },
  });

  if (!project) {
    return { ok: false, response: notFoundResponse("Project") };
  }

  return { ok: true, project };
}

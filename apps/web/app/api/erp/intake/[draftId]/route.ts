/**
 * /api/erp/intake/[draftId]
 *
 *   GET — Fetch a single IntakeDraft in the active tenant. The `orgId` scope
 *         is enforced via `findFirst` so cross-tenant draftIds return 404.
 */

import { prisma } from "@axle/db";
import { requireErpScope, toResponse } from "@/lib/erp/auth";
import { serializeIntakeDraft } from "@/lib/erp/serialize";

interface RouteContext {
  params: Promise<{ draftId: string }>;
}

export async function GET(
  _req: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const { draftId } = await context.params;
    if (!draftId) {
      return new Response("draftId is required", { status: 400 });
    }
    const draft = await prisma.intakeDraft.findFirst({
      where: { id: draftId, orgId: ctx.orgId },
    });
    if (!draft) {
      return new Response("Not found", { status: 404 });
    }
    return Response.json(serializeIntakeDraft(draft));
  } catch (err) {
    return toResponse(err);
  }
}

/**
 * /api/erp/intake/[draftId]
 *
 *   GET — Fetch a single IntakeDraft in the active tenant. The `orgId` scope
 *         is enforced via `findFirst` so cross-tenant draftIds return 404.
 */

import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  ErpNotFoundError,
} from "@/lib/erp/auth";
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
      return erpBadRequest("draftId is required");
    }
    const draft = await prisma.intakeDraft.findFirst({
      where: { id: draftId, orgId: ctx.orgId },
    });
    if (!draft) {
      throw new ErpNotFoundError("Draft not found");
    }
    return Response.json(serializeIntakeDraft(draft));
  } catch (err) {
    return toResponse(err);
  }
}

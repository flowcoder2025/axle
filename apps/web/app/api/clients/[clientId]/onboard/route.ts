import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { sendOnboardingChecklist } from "@/lib/services/client-onboarding";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * POST /api/clients/[clientId]/onboard
 *
 * Triggers the onboarding checklist dispatch for an existing client and
 * stamps `onboardedAt` so the UI can reflect that onboarding has begun.
 * Idempotent: if already onboarded, the timestamp is refreshed and the
 * checklist is re-dispatched so the contact can resend the welcome email.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true, orgId: true },
    });

    if (!client) {
      return notFoundResponse("Client");
    }

    const onboardedAt = new Date();

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { onboardedAt },
      select: { id: true, onboardedAt: true },
    });

    // Fire-and-forget — onboarding dispatch must not fail the 200 response.
    void sendOnboardingChecklist(client.id, client.orgId);

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}

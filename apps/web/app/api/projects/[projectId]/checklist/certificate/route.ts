import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { resolveProject } from "@/lib/utils/resolve-project";
import {
  requestCertificate,
  checkAndRequestRenewals,
} from "@/lib/services/certificate-checklist";
import { z } from "zod";

type RouteContext = { params: Promise<{ projectId: string }> };

const certificateRequestSchema = z.object({
  certificateType: z.string().min(1, "인증서 유형은 필수입니다"),
  name: z.string().optional(),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
});

/**
 * POST /api/projects/[projectId]/checklist/certificate
 * Request a certificate through the checklist system.
 * If the client already has a valid cert → auto-links it (APPROVED).
 * If expired or missing → creates a PENDING checklist item.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { projectId } = await params;
    const result = await resolveProject(projectId, user.orgId);
    if (!result.ok) return result.response;

    const body = await req.json();
    const parsed = certificateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const project = result.project;
    const item = await requestCertificate(
      projectId,
      project.clientId,
      parsed.data.certificateType,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        isRequired: parsed.data.isRequired,
      },
    );

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * GET /api/projects/[projectId]/checklist/certificate/renewals
 * Check for expired certificates and auto-create renewal requests.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { projectId } = await params;
    const result = await resolveProject(projectId, user.orgId);
    if (!result.ok) return result.response;

    const project = result.project;
    const renewals = await checkAndRequestRenewals(projectId, project.clientId);

    return NextResponse.json({
      data: renewals,
      message: renewals.length > 0
        ? `${renewals.length}건의 인증서 갱신이 필요합니다`
        : "갱신이 필요한 인증서가 없습니다",
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

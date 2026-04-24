/**
 * WI-303: Venture Tech Assessment endpoints.
 *
 * GET  — returns the auto-filled `VentureTechAssessmentInput` JSON so the
 *        UI can show a preview of what will be in the document.
 * POST — generates the DOCX and streams it back as a file download.
 *
 * Both endpoints require:
 *   - authenticated user with an active organization
 *   - project owned by that organization
 *   - project.type === "VENTURE_CERT"
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { generateVentureTechAssessmentDocx } from "@axle/docgen";
import { buildVentureTechAssessmentInput } from "@/lib/services/venture-tech-assessment";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

async function resolveClientId(
  projectId: string,
  orgId: string,
): Promise<{ clientId: string } | { error: NextResponse }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId } },
    select: { id: true, type: true, clientId: true },
  });
  if (!project) return { error: notFoundResponse("Project") };
  if (project.type !== "VENTURE_CERT") {
    return {
      error: forbiddenResponse("기술성평가서는 VENTURE_CERT 프로젝트에서만 생성할 수 있습니다."),
    };
  }
  return { clientId: project.clientId };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { projectId } = await params;
    const resolved = await resolveClientId(projectId, user.orgId);
    if ("error" in resolved) return resolved.error;

    const input = await buildVentureTechAssessmentInput(resolved.clientId);
    return NextResponse.json({ input });
  } catch (err) {
    return handleInternalError(err);
  }
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { projectId } = await params;
    const resolved = await resolveClientId(projectId, user.orgId);
    if ("error" in resolved) return resolved.error;

    const input = await buildVentureTechAssessmentInput(resolved.clientId);

    // Surface a clean 422 when prerequisite fields are missing so the UI can
    // tell the user *why* generation failed instead of a generic 500.
    if (!input.companyInfo.companyName?.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_COMPANY_NAME",
            message: "회사명이 설정되지 않았습니다. 고객사 정보를 먼저 입력해주세요.",
          },
        },
        { status: 422 },
      );
    }
    if (!input.companyInfo.ceoName?.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_CEO_NAME",
            message: "대표자가 설정되지 않았습니다. 고객사 정보를 먼저 입력해주세요.",
          },
        },
        { status: 422 },
      );
    }

    const { docxBuffer, fileName } = await generateVentureTechAssessmentDocx(input);

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

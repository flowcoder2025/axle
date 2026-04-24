/**
 * WI-323: BUNDLE 공통 서류 전파 엔드포인트.
 *
 * POST /api/projects/[projectId]/bundle-propagate
 *   - 인증된 사용자 + 조직 소유 프로젝트 + project.type === BUNDLE
 *   - 요청 본문 없음 (idempotent)
 *   - 200 { summary: PropagateBundleDocumentsResult }
 *   - 403 BUNDLE이 아닐 때
 *   - 404 프로젝트 없을 때
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { propagateBundleDocuments } from "@/lib/services/bundle-document-propagate";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { orgId: user.orgId } },
      select: { id: true, type: true },
    });
    if (!project) return notFoundResponse("Project");
    if (project.type !== "BUNDLE") {
      return forbiddenResponse(
        "공통 서류 전파는 BUNDLE 프로젝트에서만 실행할 수 있습니다.",
      );
    }

    const summary = await propagateBundleDocuments(projectId);
    return NextResponse.json({ summary });
  } catch (err) {
    return handleInternalError(err);
  }
}

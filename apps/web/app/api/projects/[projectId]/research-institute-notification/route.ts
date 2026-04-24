/**
 * WI-311: Research Institute Notification endpoints.
 *
 * GET  — returns the auto-filled `ResearchInstituteNotificationInput` JSON so
 *        the UI can preview the document before download.
 * POST — generates the DOCX and streams it back as a file download.
 *        Accepts an optional `{ overrides: Partial<ResearchInstituteNotificationInput> }`
 *        body so the UI can tweak fields right before generation without
 *        persisting them into `masterProfile.researchInstitute`.
 *
 * Both endpoints require:
 *   - authenticated user with an active organization
 *   - project owned by that organization
 *   - project.type === "RESEARCH_INSTITUTE"
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  generateResearchInstituteNotificationDocx,
  type ResearchInstituteNotificationInput,
} from "@axle/docgen";
import { buildResearchInstituteNotificationInput } from "@/lib/services/research-institute-notification";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * Shallow-merge a partial override on top of the auto-filled input, mirroring
 * the venture assessment route (WI-303).
 *   - companyInfo: spread-merge
 *   - overview / title: simple override
 *   - rdFields / coreTechnologies / projects / researchers: array replace when
 *     supplied; otherwise keep auto. Arrays are replaced rather than merged
 *     because each element has no stable id — merging by index would surprise
 *     the caller who shipped a trimmed list to remove rows.
 */
function mergeOverrides(
  base: ResearchInstituteNotificationInput,
  override: Partial<ResearchInstituteNotificationInput>,
): ResearchInstituteNotificationInput {
  return {
    companyInfo: { ...base.companyInfo, ...(override.companyInfo ?? {}) },
    overview: override.overview ?? base.overview,
    rdFields: override.rdFields ?? base.rdFields,
    coreTechnologies: override.coreTechnologies ?? base.coreTechnologies,
    projects: override.projects ?? base.projects,
    researchers: override.researchers ?? base.researchers,
    title: override.title ?? base.title,
  };
}

async function resolveClientId(
  projectId: string,
  orgId: string,
): Promise<{ clientId: string } | { error: NextResponse }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId } },
    select: { id: true, type: true, clientId: true },
  });
  if (!project) return { error: notFoundResponse("Project") };
  if (project.type !== "RESEARCH_INSTITUTE") {
    return {
      error: forbiddenResponse(
        "연구소 설립신고서는 RESEARCH_INSTITUTE 프로젝트에서만 생성할 수 있습니다.",
      ),
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

    const input = await buildResearchInstituteNotificationInput(resolved.clientId);
    return NextResponse.json({ input });
  } catch (err) {
    return handleInternalError(err);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { projectId } = await params;
    const resolved = await resolveClientId(projectId, user.orgId);
    if ("error" in resolved) return resolved.error;

    // Optional `{ overrides: Partial<ResearchInstituteNotificationInput> }` body.
    // Tolerate parse failures quietly — empty body is the common case.
    let overrides: Partial<ResearchInstituteNotificationInput> | undefined;
    if (req.body) {
      try {
        const body = (await req.json()) as {
          overrides?: Partial<ResearchInstituteNotificationInput>;
        };
        overrides = body?.overrides;
      } catch {
        // Empty/invalid body — ignore, treat as no overrides.
      }
    }

    let input = await buildResearchInstituteNotificationInput(resolved.clientId);
    if (overrides) input = mergeOverrides(input, overrides);

    // Surface 422 for missing prerequisites so the UI can explain why.
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

    const { docxBuffer, fileName } =
      await generateResearchInstituteNotificationDocx(input);

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

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
import {
  generateVentureTechAssessmentDocx,
  type VentureTechAssessmentInput,
} from "@axle/docgen";
import { buildVentureTechAssessmentInput } from "@/lib/services/venture-tech-assessment";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * Shallow-merge a partial override on top of the auto-filled input.
 * Per top-level field:
 *   - companyInfo / sections / checks / achievements / intellectualProperty:
 *     spread-merge (override scalar fields, keep auto values for unspecified).
 *   - finance: array replace when supplied; otherwise keep auto.
 *   - title: simple override.
 * Deep merging beyond two levels is intentionally avoided — the override
 * shape mirrors the input shape so callers can always send `{ field: value }`
 * exactly where they want to land.
 */
function mergeOverrides(
  base: VentureTechAssessmentInput,
  override: Partial<VentureTechAssessmentInput>,
): VentureTechAssessmentInput {
  return {
    companyInfo: { ...base.companyInfo, ...(override.companyInfo ?? {}) },
    sections: { ...base.sections, ...(override.sections ?? {}) },
    checks: { ...base.checks, ...(override.checks ?? {}) },
    finance: override.finance ?? base.finance,
    achievements: { ...(base.achievements ?? {}), ...(override.achievements ?? {}) },
    intellectualProperty: {
      ...(base.intellectualProperty ?? {}),
      ...(override.intellectualProperty ?? {}),
    },
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
  if (project.type !== "VENTURE_CERT") {
    return {
      error: forbiddenResponse("기술성평가서는 VENTURE_CERT 프로젝트에서만 생성할 수 있습니다."),
    };
  }
  return { clientId: project.clientId };
}

/** Recognise the explicit precision-loss error from `decimalToNumber`. */
function isPrecisionLossError(err: unknown): err is Error {
  return err instanceof Error && err.message.includes("safe integer range");
}

function precisionResponse(err: Error) {
  return NextResponse.json(
    {
      error: {
        code: "NUMERIC_OVERFLOW",
        message:
          "재무 항목 중 일부가 안전 변환 범위를 초과합니다. 자본금/매출 입력값을 확인해주세요.",
        detail: err.message,
      },
    },
    { status: 422 },
  );
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
    if (isPrecisionLossError(err)) return precisionResponse(err);
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

    // Optional `{ overrides: Partial<VentureTechAssessmentInput> }` body
    // lets the UI tweak fields right before generation without persisting
    // them into masterProfile.venture first. Empty body is the common case;
    // tolerate any parse failure quietly (no overrides applied).
    let overrides: Partial<VentureTechAssessmentInput> | undefined;
    if (req.body) {
      try {
        const body = (await req.json()) as { overrides?: Partial<VentureTechAssessmentInput> };
        overrides = body?.overrides;
      } catch {
        // Empty/invalid body — ignore, treat as no overrides.
      }
    }

    let input = await buildVentureTechAssessmentInput(resolved.clientId);
    if (overrides) input = mergeOverrides(input, overrides);

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
    if (isPrecisionLossError(err)) return precisionResponse(err);
    return handleInternalError(err);
  }
}

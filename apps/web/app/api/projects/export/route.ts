import { NextRequest } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { projectSearchSchema } from "@/lib/validations/project";
import { handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { generateCsv } from "@/lib/utils/csv-export";
import { Prisma } from "@prisma/client";

const TYPE_LABELS: Record<string, string> = {
  BUSINESS_PLAN: "사업계획서",
  VENTURE_CERT: "벤처인증",
  SOBOOJANG_CERT: "소부장인증",
  RESEARCH_INSTITUTE: "연구소설립",
  PATENT: "특허",
  FINANCIAL_ANALYSIS: "재무분석",
  RESEARCH_TASK: "연구과제",
  BUNDLE: "통합패키지",
};

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "접수",
  DOC_COLLECTING: "서류 수집 중",
  IN_PROGRESS: "진행 중",
  REVIEW: "검토 중",
  SUBMITTED: "제출 완료",
  APPROVED: "승인",
  REJECTED: "반려",
  COMPLETED: "완료",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
  URGENT: "긴급",
};

// GET /api/projects/export — download all matching projects as CSV
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return new Response("No active organization", { status: 403 });
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = projectSearchSchema.safeParse(searchParams);
    if (!parsed.success) {
      return new Response("Invalid parameters", { status: 400 });
    }

    const { clientId, type, status, assignedToId } = parsed.data;

    const where: Prisma.ProjectWhereInput = {
      client: { orgId: user.orgId },
      ...(clientId ? { clientId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(assignedToId ? { assignedToId } : {}),
    };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        type: true,
        status: true,
        priority: true,
        client: { select: { name: true } },
        assignedToUser: { select: { name: true } },
        dueDate: true,
        createdAt: true,
      },
    });

    const headers = [
      "프로젝트명",
      "유형",
      "상태",
      "우선순위",
      "고객사",
      "담당자",
      "마감일",
      "생성일",
    ];

    const formatDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

    const rows = projects.map((p) => [
      p.title,
      TYPE_LABELS[p.type] ?? p.type,
      STATUS_LABELS[p.status] ?? p.status,
      PRIORITY_LABELS[p.priority] ?? p.priority,
      p.client.name,
      p.assignedToUser?.name ?? "",
      formatDate(p.dueDate),
      formatDate(p.createdAt),
    ]);

    const csv = generateCsv(headers, rows);
    const today = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="projects-${today}.csv"`,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

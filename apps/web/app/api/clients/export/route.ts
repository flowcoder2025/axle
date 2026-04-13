import { NextRequest } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { clientSearchSchema } from "@/lib/validations/client";
import { handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { generateCsv } from "@/lib/utils/csv-export";
import { Prisma } from "@prisma/client";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
  PROSPECT: "잠재",
};

// GET /api/clients/export — download all matching clients as CSV
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
    const parsed = clientSearchSchema.safeParse(searchParams);
    if (!parsed.success) {
      return new Response("Invalid parameters", { status: 400 });
    }

    const { q, status } = parsed.data;

    const where: Prisma.ClientWhereInput = {
      orgId: user.orgId,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { businessNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const clients = await prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        name: true,
        businessNumber: true,
        ceoName: true,
        industry: true,
        region: true,
        phone: true,
        email: true,
        status: true,
        updatedAt: true,
      },
    });

    const headers = [
      "고객사명",
      "사업자번호",
      "대표자",
      "업종",
      "지역",
      "전화",
      "이메일",
      "상태",
      "최종 수정일",
    ];

    const rows = clients.map((c) => [
      c.name,
      c.businessNumber ?? "",
      c.ceoName ?? "",
      c.industry ?? "",
      c.region ?? "",
      c.phone ?? "",
      c.email ?? "",
      STATUS_LABELS[c.status] ?? c.status,
      c.updatedAt.toISOString().slice(0, 10),
    ]);

    const csv = generateCsv(headers, rows);
    const today = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clients-${today}.csv"`,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

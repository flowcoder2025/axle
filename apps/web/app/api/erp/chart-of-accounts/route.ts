/**
 * /api/erp/chart-of-accounts (Phase 21 WI-725)
 *
 *  GET  — List the active tenant's ChartOfAccounts. Lazily seeds the
 *         国세청 표준재무제표 v2024 baseline on the first call per tenant
 *         (idempotent — concurrent first calls don't double-insert; see
 *         coa-seed.ts).
 *
 *  POST — Add a user-defined account. Always `isSystem=false`. Tenant
 *         scope; `(orgId, code)` collisions surface as 409 CONFLICT.
 *
 *  System rows (isSystem=true) created by the seed are read-only — see
 *  [id]/route.ts for the PATCH/DELETE guards.
 */

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  ErpConflictError,
} from "@/lib/erp/auth";
import { seedSystemChartOfAccounts } from "@/lib/erp/coa-seed";

const CategorySchema = z.enum([
  "REVENUE",
  "COGS",
  "OPEX",
  "NON_OPERATING",
  "OTHER",
]);

const CreateBody = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "code must be alphanumeric/underscore/dash"),
  name: z.string().trim().min(1).max(100),
  category: CategorySchema,
  parentCode: z.string().trim().min(1).max(20).nullable().optional(),
});

export interface SerializedCoa {
  id: string;
  code: string;
  name: string;
  category: "REVENUE" | "COGS" | "OPEX" | "NON_OPERATING" | "OTHER";
  parentCode: string | null;
  source: string;
  isSystem: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

function serialize(c: {
  id: string;
  code: string;
  name: string;
  category: string;
  parentCode: string | null;
  source: string;
  isSystem: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}): SerializedCoa {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    category: c.category as SerializedCoa["category"],
    parentCode: c.parentCode,
    source: c.source,
    isSystem: c.isSystem,
    effectiveFrom: c.effectiveFrom.toISOString(),
    effectiveTo: c.effectiveTo ? c.effectiveTo.toISOString() : null,
  };
}

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:read");
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const parsedCategory =
      category && CategorySchema.safeParse(category).success
        ? (category as SerializedCoa["category"])
        : undefined;

    // Lazy seed: first GET per tenant populates the standard chart.
    // Idempotent — coa-seed handles concurrent first calls via P2002.
    await seedSystemChartOfAccounts(prisma, ctx.orgId);

    const rows = await prisma.chartOfAccounts.findMany({
      where: {
        orgId: ctx.orgId,
        ...(parsedCategory ? { category: parsedCategory } : {}),
      },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });

    return Response.json({ items: rows.map(serialize) });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireErpScope("erp:write");
    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = CreateBody.parse(raw);

    try {
      const created = await prisma.chartOfAccounts.create({
        data: {
          orgId: ctx.orgId,
          code: body.code,
          name: body.name,
          category: body.category,
          parentCode: body.parentCode ?? null,
          source: "user",
          isSystem: false,
        },
      });
      return Response.json(serialize(created), { status: 201 });
    } catch (err) {
      // (orgId, code) collision — message prefix only per
      // feedback_prisma7_p2002_meta (meta.target unreliable on adapter-pg).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ErpConflictError(
          `ChartOfAccounts code ${body.code} already exists in this tenant`,
          ["code"],
        );
      }
      throw err;
    }
  } catch (err) {
    return toResponse(err);
  }
}

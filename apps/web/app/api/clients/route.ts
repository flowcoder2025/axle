import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { clientCreateSchema, clientSearchSchema } from "@/lib/validations/client";
import type { ZodError } from "zod";
import { Prisma } from "@prisma/client";

function handleZodError(err: ZodError) {
  const issues = err.issues ?? [];
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      },
    },
    { status: 400 }
  );
}

// GET /api/clients — list clients with search, filter, pagination, sorting
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = clientSearchSchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { q, status, page, pageSize, sortBy, sortOrder } = parsed.data;
    const skip = (page - 1) * pageSize;

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

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          name: true,
          businessNumber: true,
          ceoName: true,
          industry: true,
          phone: true,
          email: true,
          status: true,
          assignedTo: true,
          region: true,
          isVenture: true,
          isInnoBiz: true,
          isMainBiz: true,
          isSocial: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({ data: clients, total, page, pageSize });
  } catch (err) {
    console.error("[GET /api/clients]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// POST /api/clients — create a new client
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = clientCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const {
      foundedDate,
      ventureValidUntil,
      capitalAmount,
      masterProfile,
      profileBlocks,
      ...rest
    } = parsed.data;

    const client = await prisma.client.create({
      data: {
        ...rest,
        orgId: user.orgId,
        foundedDate: foundedDate ? new Date(foundedDate) : undefined,
        ventureValidUntil: ventureValidUntil ? new Date(ventureValidUntil) : undefined,
        capitalAmount: capitalAmount !== undefined ? capitalAmount : undefined,
        masterProfile: masterProfile != null
          ? (masterProfile as Prisma.InputJsonValue)
          : undefined,
        profileBlocks: profileBlocks != null
          ? (profileBlocks as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/clients]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

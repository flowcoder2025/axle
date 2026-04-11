import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { encrypt } from "@/lib/crypto";
import { unauthorizedResponse, handleInternalError } from "@/lib/api-helpers";
import { z } from "zod";

const storeTokensSchema = z.object({
  provider: z.string().min(1, "provider is required"),
  accessToken: z.string().min(1, "accessToken is required"),
  refreshToken: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  scope: z.string().nullable().optional(),
});

// GET /api/oauth/tokens — check connection status for a provider
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "provider query param is required" } },
        { status: 400 }
      );
    }

    const record = await prisma.oAuthToken.findUnique({
      where: { userId_provider: { userId: user.id, provider } },
      select: { createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      data: {
        connected: !!record,
        provider,
        connectedAt: record?.createdAt?.toISOString() ?? null,
        lastUpdated: record?.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/oauth/tokens — store encrypted tokens
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await req.json();
    const parsed = storeTokensSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join("; "),
          },
        },
        { status: 400 }
      );
    }

    const { provider, accessToken, refreshToken, expiresAt, scope } = parsed.data;

    await prisma.oAuthToken.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: {
        userId: user.id,
        provider,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        scope: scope ?? null,
      },
      update: {
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        scope: scope ?? null,
      },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/oauth/tokens — disconnect (delete token record)
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "provider query param is required" } },
        { status: 400 }
      );
    }

    await prisma.oAuthToken.deleteMany({
      where: { userId: user.id, provider },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}

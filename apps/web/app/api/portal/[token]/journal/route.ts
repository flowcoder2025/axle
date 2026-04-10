import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { z } from "zod";

type RouteContext = { params: Promise<{ token: string }> };

const journalCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력해 주세요").max(500),
  content: z.string().min(1, "내용을 입력해 주세요").max(10000),
});

/**
 * Validates a portal token for JOURNAL scope access.
 * Returns the token record or a NextResponse error.
 */
async function validateJournalToken(token: string) {
  const portalToken = await prisma.portalToken.findUnique({
    where: { token },
    select: { id: true, projectId: true, scope: true, expiresAt: true },
  });

  if (!portalToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Invalid portal link" } },
        { status: 404 },
      ),
    };
  }

  if (portalToken.expiresAt && portalToken.expiresAt < new Date()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "EXPIRED", message: "This portal link has expired" } },
        { status: 410 },
      ),
    };
  }

  if (portalToken.scope !== "JOURNAL" && portalToken.scope !== "FULL") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "This portal link does not allow journal access" } },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, portalToken };
}

/**
 * GET /api/portal/[token]/journal
 * Lists all journal entries submitted via this portal token.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;
    const validation = await validateJournalToken(token);
    if (!validation.ok) return validation.response;

    const journals = await prisma.portalJournal.findMany({
      where: { tokenId: validation.portalToken.id },
      orderBy: { submittedAt: "desc" },
    });

    return NextResponse.json({ data: journals });
  } catch (err) {
    console.error("Portal journal GET error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/portal/[token]/journal
 * Creates a new journal entry for the given portal token.
 * Requires JOURNAL or FULL scope.
 *
 * Body: { title: string, content: string }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;
    const validation = await validateJournalToken(token);
    if (!validation.ok) return validation.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = journalCreateSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
          },
        },
        { status: 400 },
      );
    }

    const journal = await prisma.portalJournal.create({
      data: {
        tokenId: validation.portalToken.id,
        title: parsed.data.title,
        content: parsed.data.content,
      },
    });

    return NextResponse.json({ data: journal }, { status: 201 });
  } catch (err) {
    console.error("Portal journal POST error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}

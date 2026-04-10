import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { resolveProject } from "@/lib/utils/resolve-project";
import { create as createNotification } from "@axle/notification";

type RouteContext = { params: Promise<{ projectId: string }> };

const commentCreateSchema = z.object({
  body: z.string().min(1, "Comment body is required").max(5000),
});

/**
 * GET /api/projects/[projectId]/activity
 *
 * Returns a merged timeline of project events aggregated from existing tables:
 * - Documents created
 * - Status changes (via project.updatedAt when status != INTAKE)
 * - Members added
 * - Meetings scheduled
 * - Comments posted
 *
 * Sorted newest-first, limited to 50 events.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId } = await params;
    const resolved = await resolveProject(projectId, user.orgId);
    if (!resolved.ok) return resolved.response;

    const [documents, members, meetings, comments] = await Promise.all([
      prisma.document.findMany({
        where: { projectId },
        select: { id: true, name: true, category: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.projectMember.findMany({
        where: { projectId },
        select: { id: true, userId: true, role: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.meeting.findMany({
        where: { projectId },
        select: { id: true, title: true, date: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.projectComment.findMany({
        where: { projectId },
        select: { id: true, authorId: true, body: true, mentions: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    // Enrich member records with user names
    const userIds = members.map((m) => m.userId);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Enrich comment authors
    const commentAuthorIds = [...new Set(comments.map((c) => c.authorId))];
    const commentAuthors =
      commentAuthorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: commentAuthorIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const authorMap = new Map(commentAuthors.map((u) => [u.id, u]));

    type ActivityEvent = {
      id: string;
      type: "DOCUMENT_ADDED" | "MEMBER_ADDED" | "MEETING_SCHEDULED" | "COMMENT";
      timestamp: Date;
      payload: Record<string, unknown>;
    };

    const timeline: ActivityEvent[] = [
      ...documents.map((d) => ({
        id: `doc-${d.id}`,
        type: "DOCUMENT_ADDED" as const,
        timestamp: d.createdAt,
        payload: { documentId: d.id, name: d.name, category: d.category },
      })),
      ...members.map((m) => ({
        id: `member-${m.id}`,
        type: "MEMBER_ADDED" as const,
        timestamp: m.createdAt,
        payload: { memberId: m.id, userId: m.userId, role: m.role, user: userMap.get(m.userId) ?? null },
      })),
      ...meetings.map((m) => ({
        id: `meeting-${m.id}`,
        type: "MEETING_SCHEDULED" as const,
        timestamp: m.createdAt,
        payload: { meetingId: m.id, title: m.title, date: m.date },
      })),
      ...comments.map((c) => ({
        id: `comment-${c.id}`,
        type: "COMMENT" as const,
        timestamp: c.createdAt,
        payload: {
          commentId: c.id,
          body: c.body,
          mentions: c.mentions,
          author: authorMap.get(c.authorId) ?? null,
        },
      })),
    ];

    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return NextResponse.json({ data: timeline.slice(0, 50) });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/projects/[projectId]/activity
 *
 * Adds a comment to the project. Parses @userId mentions from the body
 * and creates notifications for each mentioned user.
 *
 * Body: { body: string }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { projectId } = await params;
    const resolved = await resolveProject(projectId, user.orgId);
    if (!resolved.ok) return resolved.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = commentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    // Extract @userId mentions from the body text
    const mentionPattern = /@([a-z0-9]+)/gi;
    const rawMentions = [...parsed.data.body.matchAll(mentionPattern)].map((m) => m[1]);

    // Validate mentioned users exist in the org
    const mentionedUsers =
      rawMentions.length > 0
        ? await prisma.user.findMany({
            where: {
              id: { in: rawMentions },
              memberships: { some: { organizationId: user.orgId } },
            },
            select: { id: true },
          })
        : [];
    const validMentions = mentionedUsers.map((u) => u.id);

    const comment = await prisma.projectComment.create({
      data: {
        projectId,
        authorId: user.id,
        body: parsed.data.body,
        mentions: validMentions,
      },
    });

    // Create MENTION notifications for mentioned users (excluding the author)
    const mentionsToNotify = validMentions.filter((id) => id !== user.id);
    if (mentionsToNotify.length > 0) {
      await Promise.all(
        mentionsToNotify.map((mentionedUserId) =>
          createNotification({
            userId: mentionedUserId,
            type: "MENTION",
            title: "댓글에서 언급되었습니다",
            body: parsed.data.body.slice(0, 200),
            link: `/projects/${projectId}`,
          }),
        ),
      );
    }

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * project-handoff.ts — Handoff workflow service
 *
 * Handles reassigning a project to a new user:
 * 1. Updates project.assignedTo
 * 2. Creates a HANDOFF notification for the new assignee
 * 3. Sends a handoff email to the new assignee
 *
 * AI summary generation is stubbed for Phase 14 (AiJob integration).
 */

import { prisma } from "@axle/db";
import { create as createNotification } from "@axle/notification";
import { send } from "@axle/email";

export interface HandoffInput {
  projectId: string;
  newAssigneeId: string;
  reason?: string;
  initiatorId: string;
  orgId: string;
}

export interface HandoffResult {
  projectId: string;
  newAssigneeId: string;
  newAssigneeName: string | null;
  newAssigneeEmail: string;
}

/**
 * executeHandoff — reassigns a project to a new member and notifies them.
 *
 * @throws if the project is not found within the org boundary, or
 *         if the new assignee is not a member of the org.
 */
export async function executeHandoff(input: HandoffInput): Promise<HandoffResult> {
  const { projectId, newAssigneeId, reason, initiatorId, orgId } = input;

  // 1. Verify project belongs to org
  const project = await prisma.project.findFirst({
    where: { id: projectId, client: { orgId } },
    select: { id: true, title: true, status: true, dueDate: true },
  });
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  // 2. Verify new assignee is a member of the org
  const newAssignee = await prisma.user.findFirst({
    where: { id: newAssigneeId, memberships: { some: { organizationId: orgId } } },
    select: { id: true, name: true, email: true },
  });
  if (!newAssignee) {
    throw new Error("ASSIGNEE_NOT_FOUND");
  }

  // 3. Get initiator info for email context
  const initiator = await prisma.user.findUnique({
    where: { id: initiatorId },
    select: { name: true, email: true },
  });

  // 4. Update project.assignedTo
  await prisma.project.update({
    where: { id: projectId },
    data: { assignedTo: newAssignee.name ?? newAssignee.email },
  });

  // 5. Promote new assignee to LEAD in ProjectMember (upsert)
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: newAssigneeId } },
    create: { projectId, userId: newAssigneeId, role: "LEAD" },
    update: { role: "LEAD" },
  });

  // 6. Create in-app HANDOFF notification
  await createNotification({
    userId: newAssigneeId,
    type: "HANDOFF",
    title: `프로젝트가 이관되었습니다: ${project.title}`,
    body: reason ? `이관 사유: ${reason}` : undefined,
    link: `/projects/${projectId}`,
  });

  // 7. Send handoff email (best-effort — non-blocking)
  const handoffEmailHtml = buildHandoffEmailHtml({
    projectTitle: project.title,
    projectId,
    newAssigneeName: newAssignee.name ?? newAssignee.email,
    initiatorName: initiator?.name ?? initiator?.email ?? "담당자",
    reason,
    dueDate: project.dueDate ? project.dueDate.toLocaleDateString("ko-KR") : undefined,
  });

  send({
    channel: "email",
    options: {
      to: newAssignee.email,
      subject: `[AXLE] 프로젝트 이관 알림: ${project.title}`,
      html: handoffEmailHtml,
    },
  }).catch((err: unknown) => {
    // Log but do not throw — email failure should not block the handoff
    console.error("Handoff email failed:", err);
  });

  return {
    projectId,
    newAssigneeId,
    newAssigneeName: newAssignee.name,
    newAssigneeEmail: newAssignee.email,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface HandoffEmailContext {
  projectTitle: string;
  projectId: string;
  newAssigneeName: string;
  initiatorName: string;
  reason?: string;
  dueDate?: string;
}

function buildHandoffEmailHtml(ctx: HandoffEmailContext): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /><title>프로젝트 이관</title></head>
<body style="font-family:sans-serif;color:#111;padding:32px;max-width:560px;margin:0 auto;">
  <h2 style="margin-bottom:16px;">📋 프로젝트 이관 알림</h2>
  <p>${ctx.initiatorName}님이 아래 프로젝트를 귀하에게 이관했습니다.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr>
      <td style="padding:8px;font-weight:bold;border:1px solid #ddd;width:30%;">프로젝트</td>
      <td style="padding:8px;border:1px solid #ddd;">${ctx.projectTitle}</td>
    </tr>
    ${ctx.dueDate ? `
    <tr>
      <td style="padding:8px;font-weight:bold;border:1px solid #ddd;">마감일</td>
      <td style="padding:8px;border:1px solid #ddd;">${ctx.dueDate}</td>
    </tr>` : ""}
    ${ctx.reason ? `
    <tr>
      <td style="padding:8px;font-weight:bold;border:1px solid #ddd;">이관 사유</td>
      <td style="padding:8px;border:1px solid #ddd;">${ctx.reason}</td>
    </tr>` : ""}
  </table>
  <p style="margin-top:24px;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/projects/${ctx.projectId}"
       style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
      프로젝트 바로가기
    </a>
  </p>
  <hr style="margin:32px 0;border:none;border-top:1px solid #eee;" />
  <p style="font-size:12px;color:#666;">본 메일은 AXLE 시스템에서 자동 발송되었습니다.</p>
</body>
</html>`.trim();
}

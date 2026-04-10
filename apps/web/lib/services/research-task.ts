/**
 * research-task.ts
 *
 * Service for executing RESEARCH type AiJobs.
 *
 * Phase 14 note: actual Claude CLI execution via agent-bridge is not wired yet.
 * This service creates the AiJob pipeline structure and a placeholder OUTPUT Document,
 * so the rest of the application (UI, status polling) can be built against a stable interface.
 */

import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";

interface InvestigationItem {
  topic: string;
  description?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW";
}

interface ResearchInput {
  investigationItems: InvestigationItem[];
  clientContext?: unknown;
}

/**
 * Builds a structured research prompt from investigation items.
 * Phase 14 will pass this to the Claude CLI via agent-bridge.
 */
export function buildResearchPrompt(input: ResearchInput): string {
  const { investigationItems, clientContext } = input;

  const itemLines = investigationItems
    .map((item, idx) => {
      const priorityTag = item.priority ? ` [${item.priority}]` : "";
      const desc = item.description ? `\n   ${item.description}` : "";
      return `${idx + 1}.${priorityTag} ${item.topic}${desc}`;
    })
    .join("\n");

  const contextSection =
    clientContext
      ? `\n## Client Context\n${JSON.stringify(clientContext, null, 2)}\n`
      : "";

  return `# Research Task\n${contextSection}\n## Investigation Items\n${itemLines}\n\nPlease research each item thoroughly and produce a structured report with findings, analysis, and recommendations.`;
}

/**
 * Executes a RESEARCH AiJob:
 * 1. Update AiJob status to RUNNING
 * 2. Build research prompt from investigation items
 * 3. (Phase 14) Call Claude CLI via agent-bridge — placeholder for now
 * 4. Create OUTPUT Document with placeholder report content
 * 5. Update AiJob status to COMPLETED, link reportDocumentId in output
 *
 * This function is designed to be called asynchronously (fire-and-start).
 * It must not throw — errors update the job status to FAILED.
 */
export async function executeResearchTask(aiJobId: string): Promise<void> {
  // 1. Fetch AiJob and validate
  let aiJob: {
    id: string;
    projectId: string | null;
    input: Prisma.JsonValue;
    status: string;
  } | null;

  try {
    aiJob = await prisma.aiJob.findUnique({
      where: { id: aiJobId },
      select: { id: true, projectId: true, input: true, status: true },
    });
  } catch (err) {
    console.error(`[executeResearchTask] DB fetch failed for job ${aiJobId}:`, err);
    return;
  }

  if (!aiJob) {
    console.warn(`[executeResearchTask] AiJob not found: ${aiJobId}`);
    return;
  }

  if (aiJob.status !== "QUEUED") {
    console.warn(
      `[executeResearchTask] Job ${aiJobId} is not QUEUED (status=${aiJob.status}), skipping`
    );
    return;
  }

  if (!aiJob.projectId) {
    console.error(`[executeResearchTask] AiJob ${aiJobId} has no projectId`);
    await prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: "FAILED", errorMessage: "No projectId on AiJob" },
    });
    return;
  }

  // 2. Update AiJob status to RUNNING
  try {
    await prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: "RUNNING" },
    });
  } catch (err) {
    console.error(`[executeResearchTask] Failed to set RUNNING for ${aiJobId}:`, err);
    return;
  }

  try {
    const input = aiJob.input as unknown as ResearchInput;
    const investigationItems: InvestigationItem[] = Array.isArray(input.investigationItems)
      ? input.investigationItems
      : [];

    // 3. Build research prompt (Phase 14: pass to Claude CLI via agent-bridge)
    const prompt = buildResearchPrompt({
      investigationItems,
      clientContext: input.clientContext,
    });

    console.info(
      `[executeResearchTask] Job ${aiJobId}: prompt built (${investigationItems.length} items). Phase 14 will wire agent-bridge here.`
    );

    // Placeholder report output — Phase 14 replaces with actual Claude CLI response
    const placeholderReport = {
      summary: "Research task queued. Awaiting agent-bridge integration (Phase 14).",
      prompt,
      items: investigationItems.map((item) => ({
        topic: item.topic,
        priority: item.priority ?? "MEDIUM",
        findings: null,
        recommendations: null,
      })),
      generatedAt: new Date().toISOString(),
      phase: "PLACEHOLDER",
    };

    // 4. Fetch project to get clientId for Document creation
    const project = await prisma.project.findUnique({
      where: { id: aiJob.projectId },
      select: { id: true, clientId: true },
    });

    if (!project) {
      throw new Error(`Project ${aiJob.projectId} not found`);
    }

    // Create OUTPUT Document with placeholder report content
    const reportDocument = await prisma.document.create({
      data: {
        clientId: project.clientId,
        projectId: project.id,
        name: `Research Report — ${new Date().toLocaleDateString("ko-KR")}`,
        fileUrl: "",
        fileType: "application/json",
        category: "OUTPUT",
        ocrStatus: "NONE",
        ocrResult: placeholderReport as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    // 5. Update AiJob status to COMPLETED with output
    await prisma.aiJob.update({
      where: { id: aiJobId },
      data: {
        status: "COMPLETED",
        output: {
          reportDocumentId: reportDocument.id,
          report: placeholderReport,
        } as Prisma.InputJsonValue,
      },
    });

    console.info(
      `[executeResearchTask] Job ${aiJobId} COMPLETED. Document: ${reportDocument.id}`
    );
  } catch (err) {
    console.error(`[executeResearchTask] Research task failed for ${aiJobId}:`, err);

    try {
      await prisma.aiJob.update({
        where: { id: aiJobId },
        data: {
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    } catch (updateErr) {
      console.error(
        `[executeResearchTask] Failed to set FAILED status for ${aiJobId}:`,
        updateErr
      );
    }
  }
}

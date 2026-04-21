/**
 * WI-202 — Business plan pipeline orchestrator.
 *
 * Runs: RAG draft → (optional) Precision DOCX → Verification → Storage upload →
 * Document row → AiJob completion → AI_JOB_COMPLETE event.
 *
 * All work happens fire-and-forget from the POST handler. Every terminal
 * outcome — success or failure — is persisted back to the AiJob row so the
 * GET endpoint can report status without the original request context.
 */
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import {
  generateRagDraft,
  generatePrecisionDocx,
  verify,
  REQUIRED_SECTIONS,
  type DocumentSection,
  type RagDraftOutput,
  type VerificationResult,
} from "@axle/docgen";
import { uploadFile } from "@axle/storage";
import { eventBus } from "@/lib/events/event-bus";

export interface BusinessPlanPipelineParams {
  jobId: string;
  projectId: string;
  clientId: string;
  orgId: string;
  programId: string;
  assigneeId: string;
  sections?: string[];
  engine: "rag" | "precision" | "both";
}

export interface BusinessPlanPipelineResult {
  documentId?: string;
  docxUrl?: string;
  rag: {
    sectionCount: number;
    sourceDocs: string[];
    tokensUsed?: number;
  };
  verification?: VerificationResult;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function filterSections(
  rag: RagDraftOutput,
  wanted?: string[]
): DocumentSection[] {
  if (!wanted || wanted.length === 0) return rag.sections;
  const allowed = new Set(wanted);
  const filtered = rag.sections.filter((s) => allowed.has(s.title));
  // If the caller asked for sections that didn't materialize, fall back to
  // the full draft rather than producing an empty DOCX.
  return filtered.length > 0 ? filtered : rag.sections;
}

function sectionsToMarkdown(sections: DocumentSection[]): string {
  return sections
    .map((s) => `# ${s.title}\n\n${s.content.trim()}`)
    .join("\n\n");
}

/**
 * Execute the full pipeline for a single AiJob. Never throws — all errors are
 * written back to the AiJob row as status=FAILED.
 */
export async function runBusinessPlanPipeline(
  params: BusinessPlanPipelineParams
): Promise<void> {
  const startedAt = Date.now();
  const {
    jobId,
    projectId,
    clientId,
    orgId,
    programId,
    assigneeId,
    sections,
    engine,
  } = params;

  try {
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: "RUNNING" },
    });

    // 1. RAG draft
    const rag = await generateRagDraft({ clientId, programId, projectId });

    const draftSections = filterSections(rag, sections);
    const result: BusinessPlanPipelineResult = {
      rag: {
        sectionCount: rag.sections.length,
        sourceDocs: rag.metadata.sourceDocs,
        tokensUsed: rag.metadata.tokensUsed,
      },
    };

    // 2. Precision DOCX (skipped when engine === 'rag')
    if (engine !== "rag") {
      const { docxBuffer, fileName } = await generatePrecisionDocx({
        draftSections,
      });

      // 3. Verification runs on the markdown text of the draft we just
      //    serialized. verify() inspects section headings + minimum length.
      const verification = await verify({
        documentContent: sectionsToMarkdown(draftSections),
        programId,
      });
      result.verification = verification;

      // 4. Upload DOCX to Supabase Storage (exports bucket, org-scoped path)
      const uploaded = await uploadFile("exports", fileName, docxBuffer, {
        orgId,
        contentType: DOCX_MIME,
      });
      result.docxUrl = uploaded.url;

      // 5. Document row (category = OUTPUT, linked to project + client)
      const doc = await prisma.document.create({
        data: {
          clientId,
          projectId,
          name: `[BUSINESS_PLAN] ${fileName}`,
          fileUrl: uploaded.url,
          fileType: DOCX_MIME,
          category: "OUTPUT",
        },
        select: { id: true },
      });
      result.documentId = doc.id;
    }

    // 6. Mark AiJob COMPLETED
    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        output: result as unknown as Prisma.InputJsonValue,
        durationMs: Date.now() - startedAt,
      },
    });

    // 7. Fire AI_JOB_COMPLETE so the notification pipeline can pick it up.
    //    Swallow errors — notification failure must not fail the pipeline.
    await eventBus
      .emit("AI_JOB_COMPLETE", {
        jobId,
        jobType: "BUSINESS_PLAN",
        assigneeId,
        resultUrl: result.docxUrl,
      })
      .catch((err) =>
        console.error("[business-plan-pipeline] event emit failed", err)
      );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await prisma.aiJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: message,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (updateErr) {
      // Swallow: the job row might have been deleted or the DB is down.
      console.error("[business-plan-pipeline] failed to mark job FAILED", {
        jobId,
        original: message,
        updateErr:
          updateErr instanceof Error ? updateErr.message : String(updateErr),
      });
    }

    await eventBus
      .emit("AI_JOB_FAILED", {
        jobId,
        jobType: "BUSINESS_PLAN",
        assigneeId,
        errorMessage: message,
      })
      .catch((emitErr) =>
        console.error(
          "[business-plan-pipeline] AI_JOB_FAILED emit error",
          emitErr
        )
      );
  }
}

export const BUSINESS_PLAN_REQUIRED_SECTIONS = REQUIRED_SECTIONS;

/**
 * Certificate Renewal Service (WI-326)
 *
 * Scans active certificates whose `validTo` falls within the renewal lead
 * window and — for each one that is NOT already being renewed — creates an
 * INTAKE project, attaches its default checklist, and notifies the
 * certificate owner's consultant.
 *
 * Idempotency: renewal Projects are tagged with
 *   `Project.metadata.renewalOfCertificateId = certificate.id`
 * so re-running the cron will NOT create duplicates.
 */

import { prisma } from "@axle/db";
import { Prisma, type ProjectType } from "@prisma/client";
import { create as createNotification } from "@axle/notification";
import { eventBus } from "@/lib/events/event-bus";
import { applyChecklistTemplates } from "@/lib/services/checklist-template-apply";
import {
  DEFAULT_RENEWAL_LEAD_DAYS,
  projectTypeForCertificate,
} from "./project-certificate-auto";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Shape we select from `Certificate` for renewal processing. */
type RenewalCandidate = {
  id: string;
  type: string;
  validTo: Date;
  clientId: string;
  subjectName: string;
  client: {
    id: string;
    name: string;
    orgId: string;
    assignedToId: string | null;
  };
};

export interface RenewalReport {
  /** Number of expiring certificates inspected. */
  scanned: number;
  /** New renewal projects created. */
  created: number;
  /** Certificates skipped because a renewal project already exists. */
  alreadyInProgress: number;
  /** Certificates we couldn't renew automatically (no mapping, no assignee). */
  skipped: number;
}

/**
 * Find active certificates whose `validTo` lies in the lead window.
 *
 * Window: `(now, now + leadDays]`. The lower bound excludes already-expired
 * certificates — those are handled by the existing `findExpiredCertificates`
 * flow (PR #7).
 */
export async function findCertificatesNearExpiry(
  leadDays: number = DEFAULT_RENEWAL_LEAD_DAYS,
  now: Date = new Date(),
): Promise<RenewalCandidate[]> {
  const cutoff = new Date(now.getTime() + leadDays * MS_PER_DAY);
  return prisma.certificate.findMany({
    where: {
      isActive: true,
      validTo: { gt: now, lte: cutoff },
    },
    select: {
      id: true,
      type: true,
      validTo: true,
      clientId: true,
      subjectName: true,
      client: {
        select: { id: true, name: true, orgId: true, assignedToId: true },
      },
    },
  }) as unknown as Promise<RenewalCandidate[]>;
}

/**
 * Returns true when a renewal project for this certificate already exists
 * (any status except COMPLETED/REJECTED). Uses the JSON metadata tag set at
 * creation time — no schema change needed.
 */
async function hasOpenRenewalProject(certificateId: string): Promise<boolean> {
  const existing = await prisma.project.findFirst({
    where: {
      metadata: {
        path: ["renewalOfCertificateId"],
        equals: certificateId,
      },
      status: { notIn: ["COMPLETED", "REJECTED"] },
    },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Creates the renewal project for a single certificate and its default
 * checklist. Mirrors the POST /api/projects transaction but scoped to the
 * cron use case (no Zod input, no ReBAC grant — the assignee already owns
 * the parent client).
 */
async function createRenewalProject(
  candidate: RenewalCandidate,
  projectType: ProjectType,
  now: Date,
): Promise<string> {
  const daysUntilExpiry = Math.ceil(
    (candidate.validTo.getTime() - now.getTime()) / MS_PER_DAY,
  );
  const title = `${candidate.subjectName} 갱신 (${candidate.type}, D-${daysUntilExpiry})`;

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        clientId: candidate.clientId,
        title,
        type: projectType,
        status: "INTAKE",
        dueDate: candidate.validTo,
        assignedToId: candidate.client.assignedToId ?? undefined,
        metadata: {
          renewalOfCertificateId: candidate.id,
          renewalReason: "cron/certificate-renewal",
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    // Auto-apply checklist templates (org-specific + platform-wide).
    await applyChecklistTemplates(tx, {
      projectId: project.id,
      orgId: candidate.client.orgId,
      projectType,
    });

    return project.id;
  });
}

/**
 * Main entry point — scan, create, notify. Pure of HTTP concerns so the
 * cron route and tests can drive it identically.
 */
export async function runCertificateRenewalScan(options: {
  leadDays?: number;
  now?: Date;
} = {}): Promise<RenewalReport> {
  const now = options.now ?? new Date();
  const leadDays = options.leadDays ?? DEFAULT_RENEWAL_LEAD_DAYS;

  const candidates = await findCertificatesNearExpiry(leadDays, now);
  const report: RenewalReport = {
    scanned: candidates.length,
    created: 0,
    alreadyInProgress: 0,
    skipped: 0,
  };

  for (const cert of candidates) {
    const projectType = projectTypeForCertificate(cert.type);
    if (!projectType) {
      report.skipped += 1;
      continue;
    }
    if (await hasOpenRenewalProject(cert.id)) {
      report.alreadyInProgress += 1;
      continue;
    }

    let renewalProjectId: string | null = null;
    try {
      renewalProjectId = await createRenewalProject(cert, projectType, now);
      report.created += 1;
    } catch (err) {
      console.error(
        `certificate-renewal: project create failed for cert ${cert.id}`,
        err,
      );
      report.skipped += 1;
    }

    const assigneeId = cert.client.assignedToId;
    const daysUntilExpiry = Math.ceil(
      (cert.validTo.getTime() - now.getTime()) / MS_PER_DAY,
    );

    if (assigneeId) {
      await createNotification({
        userId: assigneeId,
        type: "DEADLINE",
        title: `인증서 갱신 임박: ${cert.type} (D-${daysUntilExpiry})`,
        body: `${cert.client.name}의 ${cert.type}이(가) ${daysUntilExpiry}일 후 만료됩니다.`,
        link: renewalProjectId
          ? `/projects/${renewalProjectId}`
          : `/clients/${cert.clientId}`,
      }).catch((err) => {
        console.error(
          `certificate-renewal: notification failed for cert ${cert.id}`,
          err,
        );
      });

      void eventBus
        .emit("CERTIFICATE_RENEWING", {
          certificateId: cert.id,
          certificateType: cert.type,
          clientId: cert.clientId,
          expiresAt: cert.validTo,
          daysUntilExpiry,
          assigneeId,
          renewalProjectId,
        })
        .catch(console.error);
    }
  }

  return report;
}

/**
 * Certificate Checklist Service
 *
 * Handles certificate requests through the checklist system:
 * - First-time registration: create ChecklistItem(itemType=CERTIFICATE) → portal upload → link to Certificate
 * - Renewal on expiry: detect expired certificates → auto-create new checklist item → request via portal
 */

import { prisma } from "@axle/db";

/**
 * Check if a client already has a valid (non-expired, active) certificate of the given type.
 */
export async function findValidCertificate(
  clientId: string,
  certificateType: string,
): Promise<{ id: string; validTo: Date | null } | null> {
  const cert = await prisma.certificate.findFirst({
    where: {
      clientId,
      type: certificateType,
      isActive: true,
      OR: [
        { validTo: null },
        { validTo: { gt: new Date() } },
      ],
    },
    select: { id: true, validTo: true },
    orderBy: { validTo: "desc" },
  });
  return cert;
}

/**
 * Find expired certificates for a client that need renewal.
 */
export async function findExpiredCertificates(clientId: string) {
  return prisma.certificate.findMany({
    where: {
      clientId,
      isActive: true,
      validTo: { lt: new Date() },
    },
    select: {
      id: true,
      type: true,
      subjectName: true,
      validTo: true,
    },
  });
}

/**
 * Create a certificate request as a checklist item.
 * If the client already has a valid certificate of this type, returns null (no action needed).
 * If expired or missing, creates a CERTIFICATE checklist item.
 */
export async function requestCertificate(
  projectId: string,
  clientId: string,
  certificateType: string,
  opts?: { name?: string; description?: string; isRequired?: boolean },
) {
  // Check if there's already a pending/requested checklist item for this cert type
  const existing = await prisma.checklistItem.findFirst({
    where: {
      projectId,
      itemType: "CERTIFICATE",
      certificateType,
      status: { in: ["PENDING", "REQUESTED"] },
    },
  });

  if (existing) return existing;

  // Check if client already has a valid certificate
  const valid = await findValidCertificate(clientId, certificateType);
  if (valid) {
    // Link existing valid certificate — no upload needed
    return prisma.checklistItem.create({
      data: {
        projectId,
        name: opts?.name ?? `${certificateType} (기존 유효)`,
        description: opts?.description,
        isRequired: opts?.isRequired ?? true,
        itemType: "CERTIFICATE",
        certificateType,
        certificateId: valid.id,
        status: "VERIFIED",
        uploadedAt: new Date(),
      },
    });
  }

  // No valid certificate → request new upload
  return prisma.checklistItem.create({
    data: {
      projectId,
      name: opts?.name ?? `${certificateType} 등록 요청`,
      description:
        opts?.description ??
        `${certificateType}을(를) 업로드해 주세요. 최초 등록 또는 만료 갱신이 필요합니다.`,
      isRequired: opts?.isRequired ?? true,
      itemType: "CERTIFICATE",
      certificateType,
      status: "PENDING",
    },
  });
}

/**
 * When a certificate file is uploaded via portal, create/update the Certificate record
 * and link it to the checklist item.
 */
export async function fulfillCertificateUpload(
  checklistItemId: string,
  clientId: string,
  data: {
    subjectName: string;
    storagePath: string;
    validFrom?: Date;
    validTo?: Date;
    serialNumber?: string;
  },
) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: checklistItemId },
    select: { certificateType: true, certificateId: true },
  });

  if (!item?.certificateType) {
    throw new Error("Checklist item is not a certificate request");
  }

  // Deactivate old certificates of the same type
  await prisma.certificate.updateMany({
    where: {
      clientId,
      type: item.certificateType,
      isActive: true,
    },
    data: { isActive: false },
  });

  // Create new certificate
  const cert = await prisma.certificate.create({
    data: {
      clientId,
      type: item.certificateType,
      subjectName: data.subjectName,
      storagePath: data.storagePath,
      validFrom: data.validFrom ?? null,
      validTo: data.validTo ?? null,
      serialNumber: data.serialNumber ?? null,
      isActive: true,
    },
  });

  // Link certificate to checklist item and mark as uploaded
  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: {
      certificateId: cert.id,
      status: "UPLOADED",
      uploadedAt: new Date(),
    },
  });

  return cert;
}

/**
 * Scan a project's client for expired certificates and auto-create renewal checklist items.
 * Called by cron or when opening a project.
 */
export async function checkAndRequestRenewals(
  projectId: string,
  clientId: string,
) {
  const expired = await findExpiredCertificates(clientId);
  const created = [];

  for (const cert of expired) {
    const item = await requestCertificate(projectId, clientId, cert.type, {
      name: `${cert.subjectName} 갱신 요청`,
      description: `${cert.subjectName}이(가) ${cert.validTo?.toLocaleDateString("ko-KR")}에 만료되었습니다. 갱신된 인증서를 업로드해 주세요.`,
      isRequired: true,
    });
    created.push(item);
  }

  return created;
}

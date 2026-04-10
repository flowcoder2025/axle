import { prisma } from "@axle/db";
import { verifyBusinessNumber } from "@axle/ocr";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MasterProfile {
  businessInfo: {
    name: string;
    ceoName: string | null;
    businessNumber: string | null;
    status: string | null;
    industry: string | null;
    region: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    employeeCount: number | null;
    foundedDate: string | null;
  };
  certifications: {
    isVenture: boolean;
    isInnoBiz: boolean;
    isMainBiz: boolean;
    isSocial: boolean;
    ventureValidUntil: string | null;
  };
  summary: string;
}

export type ProfileBlockType = "info" | "cert" | "financial";

export interface ProfileBlockField {
  label: string;
  value: string | null;
}

export interface ProfileBlock {
  type: ProfileBlockType;
  title: string;
  fields: ProfileBlockField[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function buildSummary(
  name: string,
  businessInfo: MasterProfile["businessInfo"],
  certs: MasterProfile["certifications"]
): string {
  const parts: string[] = [];
  parts.push(`${name}은(는)`);

  if (businessInfo.region) parts.push(`${businessInfo.region} 소재`);
  if (businessInfo.industry) parts.push(`${businessInfo.industry} 업종`);
  parts.push("기업입니다.");

  if (businessInfo.ceoName) {
    parts.push(`대표자는 ${businessInfo.ceoName}이며,`);
  }

  const activeCerts: string[] = [];
  if (certs.isVenture) activeCerts.push("벤처기업");
  if (certs.isInnoBiz) activeCerts.push("이노비즈");
  if (certs.isMainBiz) activeCerts.push("메인비즈");
  if (certs.isSocial) activeCerts.push("사회적기업");

  if (activeCerts.length > 0) {
    parts.push(`${activeCerts.join(", ")} 인증을 보유하고 있습니다.`);
  }

  if (businessInfo.status && businessInfo.status !== "정상") {
    parts.push(`현재 사업자 상태는 "${businessInfo.status}"입니다.`);
  }

  return parts.join(" ");
}

function buildProfileBlocks(
  masterProfile: MasterProfile
): ProfileBlock[] {
  const { businessInfo, certifications } = masterProfile;

  const infoBlock: ProfileBlock = {
    type: "info",
    title: "기업 개요",
    fields: [
      { label: "대표자", value: businessInfo.ceoName },
      { label: "사업자번호", value: businessInfo.businessNumber },
      { label: "사업자 상태", value: businessInfo.status },
      { label: "업종", value: businessInfo.industry },
      { label: "지역", value: businessInfo.region },
      { label: "주소", value: businessInfo.address },
      { label: "대표 전화", value: businessInfo.phone },
      { label: "이메일", value: businessInfo.email },
      { label: "웹사이트", value: businessInfo.website },
      {
        label: "직원 수",
        value: businessInfo.employeeCount != null
          ? `${businessInfo.employeeCount}명`
          : null,
      },
      { label: "설립일", value: businessInfo.foundedDate },
    ],
  };

  const certFields: ProfileBlockField[] = [
    { label: "벤처기업", value: certifications.isVenture ? "인증" : "미인증" },
    { label: "이노비즈", value: certifications.isInnoBiz ? "인증" : "미인증" },
    { label: "메인비즈", value: certifications.isMainBiz ? "인증" : "미인증" },
    { label: "사회적기업", value: certifications.isSocial ? "인증" : "미인증" },
  ];
  if (certifications.ventureValidUntil) {
    certFields.push({
      label: "벤처 유효기간",
      value: certifications.ventureValidUntil,
    });
  }

  const certBlock: ProfileBlock = {
    type: "cert",
    title: "인증 현황",
    fields: certFields,
  };

  const financialBlock: ProfileBlock = {
    type: "financial",
    title: "재무 요약",
    fields: [
      { label: "최근 재무 정보", value: "등록된 재무 데이터를 확인하세요." },
    ],
  };

  return [infoBlock, certBlock, financialBlock];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateMasterProfile(clientId: string): Promise<void> {
  // 1. Fetch client from DB
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    console.warn(`[generateMasterProfile] Client not found: ${clientId}`);
    return;
  }

  // 2. Optionally enrich with business number verification
  let verifiedStatus: string | null = null;
  if (client.businessNumber) {
    try {
      const result = await verifyBusinessNumber(client.businessNumber);
      verifiedStatus = result.status;
    } catch (err) {
      // Non-fatal: verification failure should not block profile generation
      console.warn(
        `[generateMasterProfile] Business number verification failed for ${clientId}:`,
        err
      );
    }
  }

  // 3. Build masterProfile
  const certifications: MasterProfile["certifications"] = {
    isVenture: client.isVenture,
    isInnoBiz: client.isInnoBiz,
    isMainBiz: client.isMainBiz,
    isSocial: client.isSocial,
    ventureValidUntil: formatDate(client.ventureValidUntil),
  };

  const businessInfo: MasterProfile["businessInfo"] = {
    name: client.name,
    ceoName: client.ceoName,
    businessNumber: client.businessNumber,
    status: verifiedStatus,
    industry: client.industry,
    region: client.region,
    address: client.address,
    phone: client.phone,
    email: client.email,
    website: client.website,
    employeeCount: client.employeeCount,
    foundedDate: formatDate(client.foundedDate),
  };

  const masterProfile: MasterProfile = {
    businessInfo,
    certifications,
    summary: buildSummary(client.name, businessInfo, certifications),
  };

  // 4. Build profileBlocks
  const profileBlocks = buildProfileBlocks(masterProfile);

  // 5. Persist to DB
  await prisma.client.update({
    where: { id: clientId },
    data: {
      masterProfile: masterProfile as unknown as Prisma.InputJsonValue,
      profileBlocks: profileBlocks as unknown as Prisma.InputJsonValue,
    },
  });
}

// packages/db/seed-manual.ts
// AXLE Manual Screenshot Seed — production-safe, idempotent.
//
// Purpose: 사용자 매뉴얼(docs/manual/user/) 스크린샷을 위한 풍부한 목데이터를
// 기존 seed-e2e.ts가 만든 E2E Org1(org-e2e-1)에 추가로 주입합니다.
//
// 모든 레코드는 `manual-` prefix id를 사용하며 idempotent(upsert) 합니다.
// Real customer data is never touched.
//
// Usage:
//   set -a && source .env.local && set +a
//   npx tsx packages/db/seed-e2e.ts        # 먼저 계정·org 세팅
//   npx tsx packages/db/seed-manual.ts      # 그다음 목데이터 주입

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ORG_ID = "org-e2e-1";
const OWNER_ID = "e2e-org1-owner";
const MEMBER_ID = "e2e-org1-member";

const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000);

// ── Clients ──────────────────────────────────────────────────────────────
const CLIENTS: Prisma.ClientCreateInput[] = [
  {
    id: "manual-client-1",
    organization: { connect: { id: ORG_ID } },
    name: "(주)테크노베이션",
    businessNumber: "123-45-67890",
    ceoName: "김현우",
    industry: "소프트웨어 개발",
    address: "서울특별시 강남구 테헤란로 123",
    phone: "02-555-0101",
    email: "contact@technovation.kr",
    website: "https://technovation.kr",
    employeeCount: 24,
    foundedDate: new Date("2021-03-15"),
    region: "서울",
    isVenture: true,
    ventureValidUntil: daysFromNow(180),
    status: "ACTIVE",
  },
  {
    id: "manual-client-2",
    organization: { connect: { id: ORG_ID } },
    name: "그린에너지솔루션㈜",
    businessNumber: "234-56-78901",
    ceoName: "박서연",
    industry: "신재생에너지",
    address: "경기도 성남시 분당구 판교로 45",
    phone: "031-123-4567",
    email: "info@greenergy.co.kr",
    employeeCount: 12,
    foundedDate: new Date("2022-07-01"),
    region: "경기",
    isInnoBiz: true,
    status: "ACTIVE",
  },
  {
    id: "manual-client-3",
    organization: { connect: { id: ORG_ID } },
    name: "㈜바이오셀",
    businessNumber: "345-67-89012",
    ceoName: "이준호",
    industry: "바이오·의료",
    address: "대전광역시 유성구 과학로 77",
    phone: "042-888-1234",
    email: "ceo@biocell.kr",
    employeeCount: 38,
    foundedDate: new Date("2019-11-20"),
    region: "대전",
    isVenture: true,
    isMainBiz: true,
    status: "ACTIVE",
  },
  {
    id: "manual-client-4",
    organization: { connect: { id: ORG_ID } },
    name: "스마트팩토리코리아",
    businessNumber: "456-78-90123",
    ceoName: "최민지",
    industry: "스마트제조",
    address: "인천광역시 연수구 송도과학로 32",
    phone: "032-765-4321",
    email: "contact@smartfactory.kr",
    employeeCount: 52,
    foundedDate: new Date("2018-05-10"),
    region: "인천",
    status: "ACTIVE",
  },
  {
    id: "manual-client-5",
    organization: { connect: { id: ORG_ID } },
    name: "㈜엣지비전",
    businessNumber: "567-89-01234",
    ceoName: "정우성",
    industry: "AI·컴퓨터비전",
    address: "서울특별시 서초구 강남대로 321",
    phone: "02-333-7890",
    email: "hello@edgevision.ai",
    employeeCount: 8,
    foundedDate: new Date("2023-02-01"),
    region: "서울",
    status: "ACTIVE",
  },
  {
    id: "manual-client-6",
    organization: { connect: { id: ORG_ID } },
    name: "네오푸드㈜",
    businessNumber: "678-90-12345",
    ceoName: "한지민",
    industry: "식품·외식",
    address: "부산광역시 해운대구 센텀로 10",
    phone: "051-222-3333",
    email: "biz@neofood.kr",
    employeeCount: 18,
    foundedDate: new Date("2020-09-30"),
    region: "부산",
    status: "PROSPECT",
  },
];

// ── Contacts ─────────────────────────────────────────────────────────────
const CONTACTS: Prisma.ContactCreateInput[] = [
  { id: "manual-contact-1", client: { connect: { id: "manual-client-1" } }, name: "김현우", position: "대표이사", department: "경영", phone: "010-1111-2222", email: "kim@technovation.kr", isPrimary: true, source: "MANUAL" },
  { id: "manual-contact-2", client: { connect: { id: "manual-client-1" } }, name: "이수진", position: "CTO",      department: "기술", phone: "010-2222-3333", email: "lee@technovation.kr", source: "MANUAL" },
  { id: "manual-contact-3", client: { connect: { id: "manual-client-2" } }, name: "박서연", position: "대표",     department: "경영", phone: "010-3333-4444", email: "park@greenergy.co.kr", isPrimary: true, source: "BUSINESS_CARD" },
  { id: "manual-contact-4", client: { connect: { id: "manual-client-3" } }, name: "이준호", position: "대표이사", department: "경영", phone: "010-4444-5555", email: "lee@biocell.kr", isPrimary: true, source: "MANUAL" },
  { id: "manual-contact-5", client: { connect: { id: "manual-client-3" } }, name: "송지아", position: "책임연구원", department: "R&D", phone: "010-5555-6666", email: "song@biocell.kr", isResearcher: true, researchField: "세포 치료제", source: "MANUAL" },
  { id: "manual-contact-6", client: { connect: { id: "manual-client-4" } }, name: "최민지", position: "대표",     department: "경영", phone: "010-6666-7777", email: "choi@smartfactory.kr", isPrimary: true, source: "MANUAL" },
  { id: "manual-contact-7", client: { connect: { id: "manual-client-5" } }, name: "정우성", position: "대표",     department: "경영", phone: "010-7777-8888", email: "chung@edgevision.ai", isPrimary: true, source: "MANUAL" },
];

// ── ProgramInfo (지원사업) ───────────────────────────────────────────────
const PROGRAMS: Prisma.ProgramInfoCreateInput[] = [
  {
    id: "manual-program-1",
    organization: { connect: { id: ORG_ID } },
    name: "2026 예비창업패키지",
    agency: "중소벤처기업부",
    category: "STARTUP",
    applicationStart: daysFromNow(-10),
    applicationEnd: daysFromNow(25),
    maxFunding: "100000000",
    region: "전국",
    announcementUrl: "https://www.k-startup.go.kr/",
    isCrawled: true,
    crawledAt: daysFromNow(-3),
  },
  {
    id: "manual-program-2",
    organization: { connect: { id: ORG_ID } },
    name: "2026 창업도약패키지",
    agency: "중소벤처기업부",
    category: "STARTUP",
    applicationStart: daysFromNow(-5),
    applicationEnd: daysFromNow(14),
    maxFunding: "300000000",
    region: "전국",
    announcementUrl: "https://www.k-startup.go.kr/",
    isCrawled: true,
    crawledAt: daysFromNow(-2),
  },
  {
    id: "manual-program-3",
    organization: { connect: { id: ORG_ID } },
    name: "중소기업 R&D 혁신역량강화사업",
    agency: "산업통상자원부",
    category: "RND",
    applicationStart: daysFromNow(-2),
    applicationEnd: daysFromNow(45),
    maxFunding: "500000000",
    region: "전국",
    isCrawled: true,
    crawledAt: daysFromNow(-1),
  },
  {
    id: "manual-program-4",
    organization: { connect: { id: ORG_ID } },
    name: "수출바우처 지원사업",
    agency: "중소벤처기업부",
    category: "EXPORT",
    applicationStart: daysFromNow(-20),
    applicationEnd: daysFromNow(5),
    maxFunding: "50000000",
    region: "전국",
    isCrawled: true,
    crawledAt: daysFromNow(-5),
  },
  {
    id: "manual-program-5",
    organization: { connect: { id: ORG_ID } },
    name: "지역혁신 선도기업 육성사업",
    agency: "경기도",
    category: "GENERAL",
    applicationStart: daysFromNow(7),
    applicationEnd: daysFromNow(60),
    maxFunding: "200000000",
    region: "경기",
    isCrawled: true,
    crawledAt: daysFromNow(-1),
  },
  {
    id: "manual-program-6",
    organization: { connect: { id: ORG_ID } },
    name: "AI 바우처 지원사업 2026",
    agency: "과학기술정보통신부",
    category: "RND",
    applicationStart: daysFromNow(-15),
    applicationEnd: daysFromNow(-1),
    maxFunding: "150000000",
    region: "전국",
    isCrawled: true,
    crawledAt: daysFromNow(-10),
  },
];

// ── Projects ─────────────────────────────────────────────────────────────
const PROJECTS: Prisma.ProjectCreateInput[] = [
  { id: "manual-project-1", client: { connect: { id: "manual-client-1" } }, type: "BUSINESS_PLAN",       title: "테크노베이션 예비창업패키지 신청", status: "IN_PROGRESS",   priority: "HIGH",    assignedToUser: { connect: { id: OWNER_ID } }, dueDate: daysFromNow(25),  feeType: "FIXED",        feeAmount: "5000000" },
  { id: "manual-project-2", client: { connect: { id: "manual-client-1" } }, type: "VENTURE_CERT",        title: "테크노베이션 벤처기업 재인증",     status: "REVIEW",        priority: "MEDIUM",  assignedToUser: { connect: { id: OWNER_ID } }, dueDate: daysFromNow(60),  feeType: "SUCCESS_RATE", successRate: "10" },
  { id: "manual-project-3", client: { connect: { id: "manual-client-2" } }, type: "BUSINESS_PLAN",       title: "그린에너지 R&D 혁신사업 신청서",    status: "DOC_COLLECTING", priority: "URGENT",  assignedToUser: { connect: { id: OWNER_ID } }, dueDate: daysFromNow(45),  feeType: "FIXED",        feeAmount: "8000000" },
  { id: "manual-project-4", client: { connect: { id: "manual-client-3" } }, type: "RESEARCH_INSTITUTE",  title: "바이오셀 기업부설연구소 설립",      status: "IN_PROGRESS",   priority: "HIGH",    assignedToUser: { connect: { id: OWNER_ID } }, dueDate: daysFromNow(90),  feeType: "FIXED",        feeAmount: "12000000" },
  { id: "manual-project-5", client: { connect: { id: "manual-client-3" } }, type: "PATENT",              title: "바이오셀 세포배양 특허 출원",       status: "IN_PROGRESS",   priority: "MEDIUM",  assignedToUser: { connect: { id: MEMBER_ID } }, dueDate: daysFromNow(120), feeType: "FIXED",        feeAmount: "3000000" },
  { id: "manual-project-6", client: { connect: { id: "manual-client-4" } }, type: "BUNDLE",              title: "스마트팩토리 인증 번들(벤처+연구소+특허)", status: "IN_PROGRESS", priority: "HIGH", assignedToUser: { connect: { id: OWNER_ID } }, dueDate: daysFromNow(180), feeType: "FIXED",        feeAmount: "25000000" },
  { id: "manual-project-7", client: { connect: { id: "manual-client-5" } }, type: "RESEARCH_TASK",       title: "엣지비전 경쟁사·기술동향 조사",     status: "COMPLETED",     priority: "LOW",     assignedToUser: { connect: { id: MEMBER_ID } }, dueDate: daysFromNow(-7),  feeType: "FIXED",        feeAmount: "1500000", isPaid: true },
  { id: "manual-project-8", client: { connect: { id: "manual-client-3" } }, type: "FINANCIAL_ANALYSIS",  title: "바이오셀 재무구조 분석·리포트",     status: "COMPLETED",     priority: "MEDIUM",  assignedToUser: { connect: { id: OWNER_ID } }, dueDate: daysFromNow(-30), feeType: "FIXED",        feeAmount: "2500000", isPaid: true },
];

// ── Documents (목록용) ──────────────────────────────────────────────────
const DOCUMENTS: Prisma.DocumentCreateInput[] = [
  { id: "manual-doc-1", client: { connect: { id: "manual-client-1" } }, project: { connect: { id: "manual-project-1" } }, name: "2025 재무제표.pdf",          fileUrl: "https://placehold.co/docs/fin2025.pdf",   fileType: "application/pdf", category: "INPUT",  ocrStatus: "COMPLETED", expiresAt: daysFromNow(300) },
  { id: "manual-doc-2", client: { connect: { id: "manual-client-1" } }, project: { connect: { id: "manual-project-1" } }, name: "법인등기부등본.pdf",          fileUrl: "https://placehold.co/docs/corp.pdf",       fileType: "application/pdf", category: "INPUT",  ocrStatus: "COMPLETED", expiresAt: daysFromNow(90) },
  { id: "manual-doc-3", client: { connect: { id: "manual-client-1" } }, project: { connect: { id: "manual-project-1" } }, name: "사업계획서 v1 초안.docx",    fileUrl: "https://placehold.co/docs/plan-v1.docx", fileType: "application/docx", category: "OUTPUT", ocrStatus: "NONE", version: 1 },
  { id: "manual-doc-4", client: { connect: { id: "manual-client-1" } }, project: { connect: { id: "manual-project-1" } }, name: "사업계획서 v2 수정본.docx",  fileUrl: "https://placehold.co/docs/plan-v2.docx", fileType: "application/docx", category: "OUTPUT", ocrStatus: "NONE", version: 2, parentDocId: "manual-doc-3" },
  { id: "manual-doc-5", client: { connect: { id: "manual-client-2" } }, project: { connect: { id: "manual-project-3" } }, name: "R&D 제안서 초안.hwpx",      fileUrl: "https://placehold.co/docs/rd.hwpx",       fileType: "application/hwpx", category: "OUTPUT", ocrStatus: "NONE" },
  { id: "manual-doc-6", client: { connect: { id: "manual-client-2" } }, project: { connect: { id: "manual-project-3" } }, name: "특허증_210-1234567.pdf",   fileUrl: "https://placehold.co/docs/patent.pdf",   fileType: "application/pdf", category: "INPUT",  ocrStatus: "COMPLETED", expiresAt: daysFromNow(1800) },
  { id: "manual-doc-7", client: { connect: { id: "manual-client-3" } }, project: { connect: { id: "manual-project-4" } }, name: "연구소 설치신청서.hwpx",     fileUrl: "https://placehold.co/docs/lab.hwpx",     fileType: "application/hwpx", category: "OUTPUT", ocrStatus: "NONE" },
  { id: "manual-doc-8", client: { connect: { id: "manual-client-3" } }, project: { connect: { id: "manual-project-4" } }, name: "연구원 이력서 모음.pdf",     fileUrl: "https://placehold.co/docs/cv.pdf",       fileType: "application/pdf", category: "INPUT",  ocrStatus: "COMPLETED" },
  { id: "manual-doc-9", client: { connect: { id: "manual-client-4" } }, project: { connect: { id: "manual-project-6" } }, name: "조직도.pdf",                  fileUrl: "https://placehold.co/docs/org.pdf",       fileType: "application/pdf", category: "INPUT",  ocrStatus: "PROCESSING" },
  { id: "manual-doc-10", client: { connect: { id: "manual-client-5" } }, project: { connect: { id: "manual-project-7" } }, name: "기술동향 조사보고서.docx",   fileUrl: "https://placehold.co/docs/research.docx", fileType: "application/docx", category: "OUTPUT", ocrStatus: "NONE" },
  { id: "manual-doc-11", client: { connect: { id: "manual-client-1" } }, name: "벤처기업확인서.pdf",   fileUrl: "https://placehold.co/docs/venture.pdf",    fileType: "application/pdf", category: "INPUT",  ocrStatus: "COMPLETED", expiresAt: daysFromNow(60) },
  { id: "manual-doc-12", client: { connect: { id: "manual-client-3" } }, name: "ISO 9001 인증서.pdf", fileUrl: "https://placehold.co/docs/iso.pdf",        fileType: "application/pdf", category: "INPUT",  ocrStatus: "COMPLETED", expiresAt: daysFromNow(-30) },
];

// ── Meetings ─────────────────────────────────────────────────────────────
const MEETINGS: Prisma.MeetingCreateInput[] = [
  { id: "manual-meeting-1", client: { connect: { id: "manual-client-1" } }, project: { connect: { id: "manual-project-1" } }, title: "예비창업패키지 킥오프 미팅",      date: daysFromNow(-5), location: "테크노베이션 본사 회의실" },
  { id: "manual-meeting-2", client: { connect: { id: "manual-client-2" } }, project: { connect: { id: "manual-project-3" } }, title: "R&D 사업 요건 정리 회의",          date: daysFromNow(-3), location: "온라인(Zoom)" },
  { id: "manual-meeting-3", client: { connect: { id: "manual-client-3" } }, project: { connect: { id: "manual-project-4" } }, title: "연구소 설립 실사 사전 미팅",      date: daysFromNow(-1), location: "바이오셀 연구동" },
  { id: "manual-meeting-4", client: { connect: { id: "manual-client-5" } }, project: { connect: { id: "manual-project-7" } }, title: "엣지비전 피드백 미팅",              date: daysFromNow(-14), location: "온라인(Google Meet)" },
];

const TRANSCRIPTS: Prisma.MeetingTranscriptCreateInput[] = [
  {
    id: "manual-transcript-1",
    meeting: { connect: { id: "manual-meeting-1" } },
    rawTranscript: "[대표] 예비창업패키지 신청 일정이 너무 촉박한 것 같아요. [컨설턴트] 네, 서류는 우선순위로 나눠서 다음 주까지 1차본을 맞추겠습니다. [대표] 사업계획서 양식은 언제 공유 가능하실까요?...",
    summary: "예비창업패키지 신청 킥오프. 신청 일정이 타이트하다는 이슈로 서류 수집 우선순위를 정리했고, 1차본은 다음 주까지 완성하기로 합의. 양식은 당일 공유 예정.",
  },
  {
    id: "manual-transcript-2",
    meeting: { connect: { id: "manual-meeting-3" } },
    rawTranscript: "[대표] 연구소 면적 기준은 충족하는데 전담 연구원 2명 요건이 부담이에요. [컨설턴트] 기존 인력 중 연구 경력 있으신 분 확인하고, 부족하면 채용 플랜을 사업계획에 반영하겠습니다. [책임연구원] 논문 리스트는 제가 정리해서 보내드릴게요....",
    summary: "기업부설연구소 설립 실사 준비. 연구원 요건 충족 전략 수립(내부 경력자 확인 + 신규 채용 플랜), 논문 리스트는 책임연구원이 취합하여 공유하기로 함.",
  },
];

// ── ActionItems ──────────────────────────────────────────────────────────
const ACTION_ITEMS = [
  { id: "manual-action-1", meetingId: "manual-meeting-1", description: "사업계획서 양식 파일 공유", assigneeUserId: OWNER_ID,  dueDate: daysFromNow(-4), status: "DONE" as const        },
  { id: "manual-action-2", meetingId: "manual-meeting-1", description: "재무제표 2024 수령",            assigneeUserId: MEMBER_ID, dueDate: daysFromNow(2),  status: "IN_PROGRESS" as const },
  { id: "manual-action-3", meetingId: "manual-meeting-3", description: "기존 연구 경력자 명단 확인",   assigneeUserId: OWNER_ID,  dueDate: daysFromNow(3),  status: "OPEN" as const         },
  { id: "manual-action-4", meetingId: "manual-meeting-3", description: "신규 연구원 채용 플랜 초안",   assigneeUserId: MEMBER_ID, dueDate: daysFromNow(7),  status: "OPEN" as const         },
];

// ── Estimates & Contracts ───────────────────────────────────────────────
const ESTIMATES: Prisma.EstimateCreateInput[] = [
  { id: "manual-est-1", client: { connect: { id: "manual-client-1" } }, project: { connect: { id: "manual-project-1" } }, estimateNumber: "EST-2026-M001", items: [{ name: "사업계획서 작성 컨설팅", qty: 1, unitPrice: 5000000 }],        totalAmount: "5500000", taxAmount: "500000", status: "ACCEPTED", validUntil: daysFromNow(15), sentAt: daysFromNow(-10) },
  { id: "manual-est-2", client: { connect: { id: "manual-client-3" } }, project: { connect: { id: "manual-project-4" } }, estimateNumber: "EST-2026-M002", items: [{ name: "기업부설연구소 설립 컨설팅", qty: 1, unitPrice: 12000000 }], totalAmount: "13200000", taxAmount: "1200000", status: "SENT",     validUntil: daysFromNow(20), sentAt: daysFromNow(-2) },
  { id: "manual-est-3", client: { connect: { id: "manual-client-4" } }, project: { connect: { id: "manual-project-6" } }, estimateNumber: "EST-2026-M003", items: [{ name: "BUNDLE 인증 (벤처+연구소+특허)", qty: 1, unitPrice: 25000000 }], totalAmount: "27500000", taxAmount: "2500000", status: "DRAFT",    validUntil: daysFromNow(30) },
];

const CONTRACTS: Prisma.ContractCreateInput[] = [
  {
    id: "manual-contract-1",
    client: { connect: { id: "manual-client-1" } },
    project: { connect: { id: "manual-project-1" } },
    contractNumber: "CTR-2026-M001",
    title: "테크노베이션 예비창업패키지 컨설팅 계약",
    partyA: { name: "(주)테크노베이션", ceo: "김현우", bizNo: "123-45-67890" },
    partyB: { name: "E2E 컨설팅 A", ceo: "대표" },
    terms: { duration: "3 months", fee: 5500000, payment: "착수 50% + 완료 50%" },
    totalAmount: "5500000",
    startDate: daysFromNow(-10),
    endDate: daysFromNow(80),
    status: "SIGNED",
    signedAt: daysFromNow(-7),
  },
  {
    id: "manual-contract-2",
    client: { connect: { id: "manual-client-3" } },
    project: { connect: { id: "manual-project-4" } },
    contractNumber: "CTR-2026-M002",
    title: "바이오셀 기업부설연구소 설립 컨설팅 계약",
    partyA: { name: "㈜바이오셀", ceo: "이준호", bizNo: "345-67-89012" },
    partyB: { name: "E2E 컨설팅 A", ceo: "대표" },
    terms: { duration: "6 months", fee: 13200000, payment: "착수 30% + 중도 30% + 완료 40%" },
    totalAmount: "13200000",
    startDate: daysFromNow(5),
    endDate: daysFromNow(180),
    status: "SENT",
  },
];

// ── Financial ────────────────────────────────────────────────────────────
const FINANCIALS: Prisma.ClientFinancialCreateInput[] = [
  { id: "manual-fin-1-2023", client: { connect: { id: "manual-client-1" } }, year: 2023, revenue: "450000000", operatingProfit: "32000000",  netProfit: "25000000",   totalAssets: "820000000",  totalLiabilities: "340000000", totalEquity: "480000000",  creditRating: "BB", source: "manual" },
  { id: "manual-fin-1-2024", client: { connect: { id: "manual-client-1" } }, year: 2024, revenue: "680000000", operatingProfit: "58000000",  netProfit: "46000000",   totalAssets: "1050000000", totalLiabilities: "420000000", totalEquity: "630000000",  creditRating: "BB+", source: "manual" },
  { id: "manual-fin-1-2025", client: { connect: { id: "manual-client-1" } }, year: 2025, revenue: "920000000", operatingProfit: "96000000",  netProfit: "78000000",   totalAssets: "1380000000", totalLiabilities: "510000000", totalEquity: "870000000",  creditRating: "BBB", source: "manual" },
  { id: "manual-fin-3-2024", client: { connect: { id: "manual-client-3" } }, year: 2024, revenue: "1250000000", operatingProfit: "180000000", netProfit: "142000000",  totalAssets: "2100000000", totalLiabilities: "720000000", totalEquity: "1380000000", creditRating: "BBB+", source: "DART" },
  { id: "manual-fin-3-2025", client: { connect: { id: "manual-client-3" } }, year: 2025, revenue: "1580000000", operatingProfit: "245000000", netProfit: "198000000",  totalAssets: "2580000000", totalLiabilities: "820000000", totalEquity: "1760000000", creditRating: "A-", source: "DART" },
];

// ── Achievements ─────────────────────────────────────────────────────────
const ACHIEVEMENTS: Prisma.ClientAchievementCreateInput[] = [
  { id: "manual-ach-1", client: { connect: { id: "manual-client-1" } }, type: "PATENT",        title: "AI 기반 코드 분석 방법 (10-2024-0012345)", date: new Date("2024-09-12") },
  { id: "manual-ach-2", client: { connect: { id: "manual-client-1" } }, type: "AWARD",         title: "중소벤처기업부 장관상",                       date: new Date("2025-03-20") },
  { id: "manual-ach-3", client: { connect: { id: "manual-client-3" } }, type: "INVESTMENT",    title: "Pre-A 투자 유치",                             date: new Date("2024-11-15"), amount: "1500000000" },
  { id: "manual-ach-4", client: { connect: { id: "manual-client-3" } }, type: "CERTIFICATION", title: "ISO 9001 품질경영시스템 인증",               date: new Date("2023-08-01") },
  { id: "manual-ach-5", client: { connect: { id: "manual-client-4" } }, type: "CONTRACT",      title: "현대차 부품 공급 계약",                       date: new Date("2025-01-10"), amount: "3500000000" },
];

// ── Certificates ─────────────────────────────────────────────────────────
const CERTIFICATES = [
  { id: "manual-cert-1", clientId: "manual-client-1", type: "벤처기업확인서",          subjectName: "(주)테크노베이션", validFrom: daysFromNow(-365), validTo: daysFromNow(60) },
  { id: "manual-cert-2", clientId: "manual-client-1", type: "기업부설연구소 인정서", subjectName: "(주)테크노베이션", validFrom: daysFromNow(-600), validTo: daysFromNow(400) },
  { id: "manual-cert-3", clientId: "manual-client-3", type: "ISO 9001",                subjectName: "㈜바이오셀",       validFrom: daysFromNow(-700), validTo: daysFromNow(-30) },
  { id: "manual-cert-4", clientId: "manual-client-4", type: "메인비즈",                 subjectName: "스마트팩토리코리아", validFrom: daysFromNow(-200), validTo: daysFromNow(800) },
];

// ── Journals ─────────────────────────────────────────────────────────────
const JOURNALS: Prisma.ResearchJournalCreateInput[] = [
  { id: "manual-journal-1", client: { connect: { id: "manual-client-3" } }, researcher: { connect: { id: "manual-contact-5" } }, date: daysFromNow(-2), title: "세포주 안정화 조건 최적화", content: "세포주 A-12의 배양 조건을 pH 7.2, 37℃로 설정하여 24시간 관찰. 생존율 92% 확보.", hours: "6", status: "APPROVED", approvedBy: OWNER_ID, approvedAt: daysFromNow(-1) },
  { id: "manual-journal-2", client: { connect: { id: "manual-client-3" } }, researcher: { connect: { id: "manual-contact-5" } }, date: daysFromNow(-5), title: "항체 결합력 측정",             content: "ELISA 방식으로 항체 3종의 결합 affinity 측정. 종별 수치 첨부.", hours: "4", status: "SUBMITTED" },
  { id: "manual-journal-3", client: { connect: { id: "manual-client-3" } }, researcher: { connect: { id: "manual-contact-5" } }, date: daysFromNow(-10), title: "전임상 시험 프로토콜 검토",    content: "전임상 시험 프로토콜 v1 검토. 보완 필요 항목 3건 정리.", hours: "3", status: "APPROVED", approvedBy: OWNER_ID, approvedAt: daysFromNow(-8) },
  { id: "manual-journal-4", client: { connect: { id: "manual-client-3" } }, researcher: { connect: { id: "manual-contact-5" } }, date: daysFromNow(-1), title: "문헌 리뷰: CAR-T 최신 동향",   content: "2024-2025 Nature/Cell 논문 5편 리뷰. 주요 인사이트 정리.", hours: "5", status: "DRAFT" },
];

// ── Schedules ────────────────────────────────────────────────────────────
// Schedule 모델은 orgId를 plain field로 받음 (organization relation은 선언되어 있지 않음)
const SCHEDULES = [
  { id: "manual-sch-1", orgId: ORG_ID, programId: "manual-program-1", title: "예비창업패키지 마감", type: "PROGRAM_DUE" as const, startDate: daysFromNow(25), isAllDay: true, reminderDays: [7, 3, 1] },
  { id: "manual-sch-2", orgId: ORG_ID, programId: "manual-program-2", title: "창업도약패키지 마감", type: "PROGRAM_DUE" as const, startDate: daysFromNow(14), isAllDay: true, reminderDays: [7, 3, 1] },
  { id: "manual-sch-3", orgId: ORG_ID, clientId: "manual-client-1",  title: "테크노베이션 정기 미팅", type: "MEETING" as const, startDate: daysFromNow(3),  endDate: daysFromNow(3) },
  { id: "manual-sch-4", orgId: ORG_ID, clientId: "manual-client-3",  title: "바이오셀 연구소 실사",   type: "MEETING" as const, startDate: daysFromNow(10), endDate: daysFromNow(10) },
  { id: "manual-sch-5", orgId: ORG_ID, clientId: "manual-client-1",  title: "벤처기업확인서 만료",    type: "DEADLINE" as const, startDate: daysFromNow(60), isAllDay: true, reminderDays: [30, 7, 1] },
];

// ── MatchingResults ─────────────────────────────────────────────────────
const MATCHES: Prisma.MatchingResultCreateInput[] = [
  { id: "manual-match-1", clientId: "manual-client-1", program: { connect: { id: "manual-program-1" } }, score: "92", matchReasons: ["초기 창업기업 요건 부합", "소프트웨어 업종 적합"], isRelevant: true },
  { id: "manual-match-2", clientId: "manual-client-2", program: { connect: { id: "manual-program-3" } }, score: "85", matchReasons: ["R&D 집약 업종", "중소기업 해당"] },
  { id: "manual-match-3", clientId: "manual-client-5", program: { connect: { id: "manual-program-6" } }, score: "88", matchReasons: ["AI 분야", "스타트업 대상"] },
  { id: "manual-match-4", clientId: "manual-client-3", program: { connect: { id: "manual-program-3" } }, score: "78", matchReasons: ["바이오 R&D 업종"] },
  { id: "manual-match-5", clientId: "manual-client-4", program: { connect: { id: "manual-program-5" } }, score: "71", matchReasons: ["경기 지역 해당", "제조업"] },
  { id: "manual-match-6", clientId: "manual-client-6", program: { connect: { id: "manual-program-4" } }, score: "55", matchReasons: ["수출 준비 기업"], disqualifyReasons: ["매출 기준 미충족"], isRelevant: false, feedbackNote: "아직 해외 실적이 없어 부적합" },
];

// ── Notifications ───────────────────────────────────────────────────────
const NOTIFICATIONS: Prisma.NotificationCreateInput[] = [
  { id: "manual-notif-1", userId: OWNER_ID, type: "DEADLINE",       title: "예비창업패키지 마감 25일 전",   body: "테크노베이션 신청 준비 중", isRead: false },
  { id: "manual-notif-2", userId: OWNER_ID, type: "DOC_UPLOADED",   title: "새 서류 업로드됨",              body: "그린에너지솔루션이 특허증을 업로드했습니다", isRead: false },
  { id: "manual-notif-3", userId: OWNER_ID, type: "AI_JOB_COMPLETE", title: "AI 작업 완료",                   body: "엣지비전 기술동향 보고서가 생성되었습니다", isRead: true },
  { id: "manual-notif-4", userId: OWNER_ID, type: "MATCHING_RESULT", title: "새 매칭 결과 3건",               body: "진행중 공고 대비 매칭 점수 80점 이상 3건", isRead: false },
  { id: "manual-notif-5", userId: OWNER_ID, type: "ESTIMATE_SENT",   title: "견적서 승인됨",                   body: "테크노베이션이 EST-2026-M001를 승인했습니다", isRead: true },
];

// ── Upsert helpers ──────────────────────────────────────────────────────
async function upsertMany<T extends { id: string }>(
  label: string,
  rows: T[],
  upsert: (row: T) => Promise<unknown>,
) {
  let ok = 0;
  for (const row of rows) {
    try {
      await upsert(row);
      ok++;
    } catch (err) {
      console.error(`  ! ${label}: ${row.id} — ${(err as Error).message}`);
    }
  }
  console.log(`[seed-manual] ${label}: ${ok}/${rows.length}`);
}

async function main() {
  console.log("[seed-manual] Starting. Target org:", ORG_ID);

  await upsertMany("Clients", CLIENTS, (c) =>
    prisma.client.upsert({ where: { id: c.id! }, update: c as Prisma.ClientUpdateInput, create: c }),
  );
  await upsertMany("Contacts", CONTACTS, (c) =>
    prisma.contact.upsert({ where: { id: c.id! }, update: c as Prisma.ContactUpdateInput, create: c }),
  );
  await upsertMany("Programs", PROGRAMS, (p) =>
    prisma.programInfo.upsert({ where: { id: p.id! }, update: p as Prisma.ProgramInfoUpdateInput, create: p }),
  );
  await upsertMany("Projects", PROJECTS, (p) =>
    prisma.project.upsert({ where: { id: p.id! }, update: p as Prisma.ProjectUpdateInput, create: p }),
  );
  await upsertMany("Documents", DOCUMENTS, (d) =>
    prisma.document.upsert({ where: { id: d.id! }, update: d as Prisma.DocumentUpdateInput, create: d }),
  );
  await upsertMany("Meetings", MEETINGS, (m) =>
    prisma.meeting.upsert({ where: { id: m.id! }, update: m as Prisma.MeetingUpdateInput, create: m }),
  );
  await upsertMany("Transcripts", TRANSCRIPTS, (t) =>
    prisma.meetingTranscript.upsert({ where: { id: t.id! }, update: t as Prisma.MeetingTranscriptUpdateInput, create: t }),
  );
  await upsertMany("ActionItems", ACTION_ITEMS, (a) =>
    prisma.actionItem.upsert({
      where: { id: a.id },
      update: a as unknown as Prisma.ActionItemUncheckedUpdateInput,
      create: a as unknown as Prisma.ActionItemUncheckedCreateInput,
    }),
  );
  await upsertMany("Estimates", ESTIMATES, (e) =>
    prisma.estimate.upsert({ where: { id: e.id! }, update: e as Prisma.EstimateUpdateInput, create: e }),
  );
  await upsertMany("Contracts", CONTRACTS, (c) =>
    prisma.contract.upsert({ where: { id: c.id! }, update: c as Prisma.ContractUpdateInput, create: c }),
  );
  await upsertMany("Financials", FINANCIALS, (f) =>
    prisma.clientFinancial.upsert({ where: { id: f.id! }, update: f as Prisma.ClientFinancialUpdateInput, create: f }),
  );
  await upsertMany("Achievements", ACHIEVEMENTS, (a) =>
    prisma.clientAchievement.upsert({ where: { id: a.id! }, update: a as Prisma.ClientAchievementUpdateInput, create: a }),
  );
  await upsertMany("Certificates", CERTIFICATES, (c) =>
    prisma.certificate.upsert({
      where: { id: c.id },
      update: c as unknown as Prisma.CertificateUncheckedUpdateInput,
      create: c as unknown as Prisma.CertificateUncheckedCreateInput,
    }),
  );
  await upsertMany("Journals", JOURNALS, (j) =>
    prisma.researchJournal.upsert({ where: { id: j.id! }, update: j as Prisma.ResearchJournalUpdateInput, create: j }),
  );
  await upsertMany("Schedules", SCHEDULES, (s) =>
    prisma.schedule.upsert({
      where: { id: s.id },
      update: s as unknown as Prisma.ScheduleUncheckedUpdateInput,
      create: s as unknown as Prisma.ScheduleUncheckedCreateInput,
    }),
  );
  await upsertMany("Matches", MATCHES, (m) =>
    prisma.matchingResult.upsert({ where: { id: m.id! }, update: m as Prisma.MatchingResultUpdateInput, create: m }),
  );
  await upsertMany("Notifications", NOTIFICATIONS, (n) =>
    prisma.notification.upsert({ where: { id: n.id! }, update: n as Prisma.NotificationUpdateInput, create: n }),
  );

  console.log("[seed-manual] Done. Only manual-* records were touched.");
}

main()
  .catch((err) => {
    console.error("[seed-manual] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

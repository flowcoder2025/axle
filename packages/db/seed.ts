// AXLE Database Seed Script
// Run: cd /Volumes/포터블/AXLE && set -a && source .env.local && set +a && npx tsx packages/db/seed.ts

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Stable IDs ──────────────────────────────────────────────
const ID = {
  userOwner: "user-owner",
  userConsultant: "user-consultant",
  org: "org-1",
  client1: "client-1", // 테크노바
  client2: "client-2", // 그린에너지
  client3: "client-3", // 바이오헬스
  client4: "client-4", // 스마트팜
  client5: "client-5", // 디자인랩
  program1: "program-1",
  program2: "program-2",
  program3: "program-3",
  project1: "project-1",
  project2: "project-2",
  project3: "project-3",
  project4: "project-4",
  project5: "project-5",
  project6: "project-6",
  project7: "project-7",
  project8: "project-8",
  contact1: "contact-1",
  contact2: "contact-2",
  contact3: "contact-3",
  contact4: "contact-4",
  contact5: "contact-5",
  contact6: "contact-6",
  contact7: "contact-7",
  meeting1: "meeting-1",
  meeting2: "meeting-2",
  meeting3: "meeting-3",
  estimate1: "estimate-1",
  estimate2: "estimate-2",
} as const;

async function cleanDatabase() {
  console.log("Cleaning existing data...");
  // Delete in reverse dependency order
  await prisma.portalJournal.deleteMany();
  await prisma.portalToken.deleteMany();
  await prisma.projectComment.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.financialReport.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.automationLog.deleteMany();
  await prisma.aiJob.deleteMany();
  await prisma.skillPattern.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.meetingTranscript.deleteMany();
  await prisma.meetingAttendee.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.researchJournal.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.document.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.matchingResult.deleteMany();
  await prisma.programInfo.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.clientAchievement.deleteMany();
  await prisma.clientFinancial.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.relationTuple.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.oAuthToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  console.log("Database cleaned.");
}

async function seed() {
  await cleanDatabase();

  // ── 1. Users ───────────────────────────────────────────────
  console.log("Creating users...");
  const hashedPassword = await bcrypt.hash("test1234", 10);

  const owner = await prisma.user.create({
    data: {
      id: ID.userOwner,
      email: "hyunil8702@gmail.com",
      name: "최현일",
      image: null,
      password: hashedPassword,
    },
  });

  const consultant = await prisma.user.create({
    data: {
      id: ID.userConsultant,
      email: "consultant@flowcoder.com",
      name: "김민수",
      image: null,
      password: hashedPassword,
    },
  });

  // ── 2. Organization ────────────────────────────────────────
  console.log("Creating organization...");
  const org = await prisma.organization.create({
    data: {
      id: ID.org,
      name: "플로우코더 컨설팅",
      slug: "flowcoder-consulting",
    },
  });

  // ── 3. Memberships ─────────────────────────────────────────
  console.log("Creating memberships...");
  await prisma.membership.createMany({
    data: [
      { userId: ID.userOwner, organizationId: ID.org, role: "OWNER" },
      { userId: ID.userConsultant, organizationId: ID.org, role: "MEMBER" },
    ],
  });

  // ── 4. ProgramInfo ─────────────────────────────────────────
  console.log("Creating programs...");
  await prisma.programInfo.createMany({
    data: [
      {
        id: ID.program1,
        orgId: ID.org,
        name: "2026 예비창업패키지",
        agency: "중소벤처기업부",
        category: "STARTUP",
        maxFunding: 100000000,
        applicationStart: new Date("2026-03-01"),
        applicationEnd: new Date("2026-04-30"),
        memo: "예비 창업자 대상 최대 1억원 지원",
      },
      {
        id: ID.program2,
        orgId: ID.org,
        name: "벤처기업 확인",
        agency: "벤처기업확인기관",
        category: "VENTURE",
        memo: "벤처기업 확인 심사 및 인증 지원",
      },
      {
        id: ID.program3,
        orgId: ID.org,
        name: "기업부설연구소 설립",
        agency: "한국산업기술진흥협회",
        category: "RND",
        memo: "기업부설연구소 설립 인정 지원",
      },
    ],
  });

  // ── 5. Clients ─────────────────────────────────────────────
  console.log("Creating clients...");
  await prisma.client.createMany({
    data: [
      {
        id: ID.client1,
        orgId: ID.org,
        name: "주식회사 테크노바",
        businessNumber: "123-45-67890",
        ceoName: "박지훈",
        industry: "IT",
        phone: "02-1234-5678",
        email: "contact@technova.co.kr",
        address: "서울특별시 강남구 테헤란로 123",
        region: "서울",
        status: "ACTIVE",
        isVenture: true,
        ventureValidUntil: new Date("2027-12-31"),
        assignedToId: ID.userOwner,
        employeeCount: 45,
        capitalAmount: 500000000,
        foundedDate: new Date("2020-03-15"),
        memo: "AI 솔루션 전문 기업, 벤처인증 갱신 예정",
        masterProfile: {
          mainProduct: "AI 기반 업무 자동화 솔루션",
          targetMarket: "중소기업 B2B",
          techStack: ["Python", "TypeScript", "TensorFlow"],
        },
      },
      {
        id: ID.client2,
        orgId: ID.org,
        name: "그린에너지 주식회사",
        businessNumber: "234-56-78901",
        ceoName: "이수현",
        industry: "에너지",
        phone: "031-2345-6789",
        email: "info@greenenergy.co.kr",
        address: "경기도 성남시 분당구 판교로 456",
        region: "경기",
        status: "ACTIVE",
        assignedToId: ID.userConsultant,
        employeeCount: 28,
        capitalAmount: 300000000,
        foundedDate: new Date("2021-07-01"),
        memo: "신재생에너지 기술 보유, 벤처인증 신규 신청 예정",
      },
      {
        id: ID.client3,
        orgId: ID.org,
        name: "바이오헬스 주식회사",
        businessNumber: "345-67-89012",
        ceoName: "김영희",
        industry: "바이오",
        phone: "02-3456-7890",
        email: "biz@biohealth.co.kr",
        address: "서울특별시 서초구 반포대로 789",
        region: "서울",
        status: "PROSPECT",
        employeeCount: 12,
        capitalAmount: 200000000,
        foundedDate: new Date("2023-01-10"),
        memo: "초기 상담 단계, 재무분석 요청",
      },
      {
        id: ID.client4,
        orgId: ID.org,
        name: "스마트팜 솔루션즈",
        businessNumber: "456-78-90123",
        ceoName: "정대호",
        industry: "농업기술",
        phone: "054-4567-8901",
        email: "info@smartfarm.co.kr",
        address: "경상북도 포항시 남구 테크노로 321",
        region: "경북",
        status: "ACTIVE",
        isInnoBiz: true,
        assignedToId: ID.userOwner,
        employeeCount: 35,
        capitalAmount: 400000000,
        foundedDate: new Date("2019-05-20"),
        memo: "스마트 농업 IoT 솔루션, 이노비즈 인증 보유",
      },
      {
        id: ID.client5,
        orgId: ID.org,
        name: "디자인랩 주식회사",
        businessNumber: "567-89-01234",
        ceoName: "한소율",
        industry: "디자인",
        phone: "02-5678-9012",
        email: "hello@designlab.co.kr",
        address: "서울특별시 마포구 양화로 654",
        region: "서울",
        status: "INACTIVE",
        employeeCount: 8,
        capitalAmount: 100000000,
        foundedDate: new Date("2022-09-01"),
        memo: "계약 종료, 재계약 검토 중",
      },
    ],
  });

  // ── 6. Contacts ────────────────────────────────────────────
  console.log("Creating contacts...");
  await prisma.contact.createMany({
    data: [
      {
        id: ID.contact1,
        clientId: ID.client1,
        name: "박지훈",
        position: "대표이사",
        phone: "010-1111-2222",
        email: "jhpark@technova.co.kr",
        isPrimary: true,
      },
      {
        id: ID.contact2,
        clientId: ID.client1,
        name: "최연구",
        position: "연구소장",
        department: "R&D센터",
        phone: "010-1111-3333",
        email: "research@technova.co.kr",
        isResearcher: true,
        researchField: "인공지능/자연어처리",
      },
      {
        id: ID.contact3,
        clientId: ID.client2,
        name: "이수현",
        position: "대표이사",
        phone: "010-2222-3333",
        email: "shlee@greenenergy.co.kr",
        isPrimary: true,
      },
      {
        id: ID.contact4,
        clientId: ID.client2,
        name: "김에너지",
        position: "기술이사",
        department: "기술개발부",
        phone: "010-2222-4444",
        email: "energy@greenenergy.co.kr",
        isResearcher: true,
        researchField: "신재생에너지/태양광",
      },
      {
        id: ID.contact5,
        clientId: ID.client3,
        name: "김영희",
        position: "대표이사",
        phone: "010-3333-4444",
        email: "yhkim@biohealth.co.kr",
        isPrimary: true,
      },
      {
        id: ID.contact6,
        clientId: ID.client4,
        name: "정대호",
        position: "대표이사",
        phone: "010-4444-5555",
        email: "dhjeong@smartfarm.co.kr",
        isPrimary: true,
      },
      {
        id: ID.contact7,
        clientId: ID.client5,
        name: "한소율",
        position: "대표이사",
        phone: "010-5555-6666",
        email: "syhan@designlab.co.kr",
        isPrimary: true,
      },
    ],
  });

  // ── 7. ClientFinancial ─────────────────────────────────────
  console.log("Creating client financials...");
  const financials = await Promise.all([
    prisma.clientFinancial.create({
      data: {
        id: "fin-1",
        clientId: ID.client1,
        year: 2024,
        revenue: 3500000000,
        operatingProfit: 420000000,
        netProfit: 350000000,
        totalAssets: 5200000000,
        totalLiabilities: 1800000000,
        totalEquity: 3400000000,
        creditRating: "BBB+",
        source: "DART",
      },
    }),
    prisma.clientFinancial.create({
      data: {
        id: "fin-2",
        clientId: ID.client2,
        year: 2024,
        revenue: 1200000000,
        operatingProfit: 96000000,
        netProfit: 72000000,
        totalAssets: 2100000000,
        totalLiabilities: 900000000,
        totalEquity: 1200000000,
        creditRating: "BB+",
        source: "DART",
      },
    }),
    prisma.clientFinancial.create({
      data: {
        id: "fin-3",
        clientId: ID.client3,
        year: 2024,
        revenue: 500000000,
        operatingProfit: -50000000,
        netProfit: -80000000,
        totalAssets: 800000000,
        totalLiabilities: 350000000,
        totalEquity: 450000000,
        creditRating: "B",
        source: "manual",
      },
    }),
    prisma.clientFinancial.create({
      data: {
        id: "fin-4",
        clientId: ID.client4,
        year: 2024,
        revenue: 2800000000,
        operatingProfit: 336000000,
        netProfit: 252000000,
        totalAssets: 4100000000,
        totalLiabilities: 1500000000,
        totalEquity: 2600000000,
        creditRating: "BBB",
        source: "DART",
      },
    }),
    prisma.clientFinancial.create({
      data: {
        id: "fin-5",
        clientId: ID.client5,
        year: 2024,
        revenue: 300000000,
        operatingProfit: 15000000,
        netProfit: 10000000,
        totalAssets: 450000000,
        totalLiabilities: 180000000,
        totalEquity: 270000000,
        source: "manual",
      },
    }),
  ]);

  // ── 8. Certificates ────────────────────────────────────────
  console.log("Creating certificates...");
  await prisma.certificate.createMany({
    data: [
      {
        id: "cert-1",
        clientId: ID.client1,
        type: "ISO9001",
        subjectName: "품질경영시스템 인증서",
        serialNumber: "ISO-2024-001234",
        validFrom: new Date("2024-01-15"),
        validTo: new Date("2027-01-14"),
        isActive: true,
      },
      {
        id: "cert-2",
        clientId: ID.client1,
        type: "벤처기업확인서",
        subjectName: "벤처기업 확인서",
        serialNumber: "VEN-2024-005678",
        validFrom: new Date("2024-06-01"),
        validTo: new Date("2027-05-31"),
        isActive: true,
      },
      {
        id: "cert-3",
        clientId: ID.client4,
        type: "이노비즈인증",
        subjectName: "이노비즈(INNOBIZ) 확인서",
        serialNumber: "INNO-2023-009012",
        validFrom: new Date("2023-09-01"),
        validTo: new Date("2026-08-31"),
        isActive: true,
      },
    ],
  });

  // ── 9. Projects ────────────────────────────────────────────
  console.log("Creating projects...");
  await prisma.project.createMany({
    data: [
      {
        id: ID.project1,
        clientId: ID.client1,
        programId: ID.program1,
        type: "BUSINESS_PLAN",
        title: "2026 예비창업패키지 사업계획서",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignedToId: ID.userOwner,
        dueDate: new Date("2026-05-15"),
        memo: "사업계획서 초안 작성 중, AI 솔루션 사업모델 강조",
      },
      {
        id: ID.project2,
        clientId: ID.client2,
        programId: ID.program2,
        type: "VENTURE_CERT",
        title: "벤처기업 인증 신청",
        status: "DOC_COLLECTING",
        priority: "HIGH",
        assignedToId: ID.userConsultant,
        dueDate: new Date("2026-06-01"),
        memo: "기술평가 준비 중, 특허 2건 확보 완료",
      },
      {
        id: ID.project3,
        clientId: ID.client1,
        programId: ID.program3,
        type: "RESEARCH_INSTITUTE",
        title: "기업부설연구소 설립",
        status: "REVIEW",
        priority: "MEDIUM",
        assignedToId: ID.userOwner,
        dueDate: new Date("2026-05-30"),
        memo: "연구인력 요건 충족 확인 완료, 서류 검토 중",
      },
      {
        id: ID.project4,
        clientId: ID.client1,
        type: "PATENT",
        title: "AI 자동화 특허 출원",
        status: "SUBMITTED",
        priority: "MEDIUM",
        assignedToId: ID.userOwner,
        dueDate: new Date("2026-07-01"),
        submissionDate: new Date("2026-03-20"),
        memo: "출원 완료, 심사 대기 중",
      },
      {
        id: ID.project5,
        clientId: ID.client3,
        type: "FINANCIAL_ANALYSIS",
        title: "재무 분석 리포트",
        status: "COMPLETED",
        priority: "LOW",
        assignedToId: ID.userConsultant,
        dueDate: new Date("2026-03-31"),
        memo: "2024년 재무제표 기반 분석 완료",
      },
      {
        id: ID.project6,
        clientId: ID.client4,
        type: "RESEARCH_TASK",
        title: "시장 조사",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        assignedToId: ID.userConsultant,
        dueDate: new Date("2026-05-20"),
        memo: "스마트팜 시장 동향 및 경쟁사 분석",
      },
      {
        id: ID.project7,
        clientId: ID.client2,
        type: "SOBOOJANG_CERT",
        title: "소부장 인증",
        status: "INTAKE",
        priority: "LOW",
        assignedToId: ID.userOwner,
        dueDate: new Date("2026-08-01"),
        memo: "소재·부품·장비 인증 요건 사전 검토",
      },
      {
        id: ID.project8,
        clientId: ID.client1,
        type: "BUNDLE",
        title: "종합 컨설팅 패키지",
        status: "IN_PROGRESS",
        priority: "URGENT",
        assignedToId: ID.userOwner,
        dueDate: new Date("2026-06-30"),
        memo: "사업계획서 + 연구소 설립 + 특허 출원 통합 패키지",
        metadata: {
          childProjects: [ID.project1, ID.project3, ID.project4],
          discountRate: 0.15,
        },
      },
    ],
  });

  // ── 10. ProjectMembers ─────────────────────────────────────
  console.log("Creating project members...");
  await prisma.projectMember.createMany({
    data: [
      { projectId: ID.project1, userId: ID.userOwner, role: "LEAD" },
      { projectId: ID.project1, userId: ID.userConsultant, role: "MEMBER" },
      { projectId: ID.project2, userId: ID.userConsultant, role: "LEAD" },
      { projectId: ID.project3, userId: ID.userOwner, role: "LEAD" },
      { projectId: ID.project5, userId: ID.userConsultant, role: "LEAD" },
      { projectId: ID.project6, userId: ID.userConsultant, role: "LEAD" },
      { projectId: ID.project6, userId: ID.userOwner, role: "MEMBER" },
      { projectId: ID.project8, userId: ID.userOwner, role: "LEAD" },
    ],
  });

  // ── 11. Documents ──────────────────────────────────────────
  console.log("Creating documents...");
  await prisma.document.createMany({
    data: [
      {
        id: "doc-1",
        clientId: ID.client1,
        projectId: ID.project1,
        name: "2026 예비창업패키지 사업계획서 초안",
        fileUrl: "/uploads/placeholder-bp.pdf",
        fileType: "application/pdf",
        category: "OUTPUT",
      },
      {
        id: "doc-2",
        clientId: ID.client1,
        name: "2024년 재무제표",
        fileUrl: "/uploads/placeholder-financial.pdf",
        fileType: "application/pdf",
        category: "INPUT",
      },
      {
        id: "doc-3",
        clientId: ID.client1,
        projectId: ID.project4,
        name: "AI 자동화 특허 출원서",
        fileUrl: "/uploads/placeholder-patent.pdf",
        fileType: "application/pdf",
        category: "OUTPUT",
      },
      {
        id: "doc-4",
        clientId: ID.client2,
        projectId: ID.project2,
        name: "벤처기업 인증 신청서",
        fileUrl: "/uploads/placeholder-venture.pdf",
        fileType: "application/pdf",
        category: "OUTPUT",
      },
      {
        id: "doc-5",
        clientId: ID.client1,
        projectId: ID.project3,
        name: "연구소 설립 신청서 양식",
        fileUrl: "/uploads/placeholder-template.pdf",
        fileType: "application/pdf",
        category: "TEMPLATE",
      },
      {
        id: "doc-6",
        clientId: ID.client3,
        projectId: ID.project5,
        name: "바이오헬스 재무분석 결과서",
        fileUrl: "/uploads/placeholder-analysis.pdf",
        fileType: "application/pdf",
        category: "ISSUED",
      },
      {
        id: "doc-7",
        clientId: ID.client4,
        name: "이노비즈 인증서 사본",
        fileUrl: "/uploads/placeholder-innobiz.pdf",
        fileType: "application/pdf",
        category: "INPUT",
      },
    ],
  });

  // ── 12. Meetings ───────────────────────────────────────────
  console.log("Creating meetings...");
  await prisma.meeting.createMany({
    data: [
      {
        id: ID.meeting1,
        clientId: ID.client1,
        projectId: ID.project1,
        title: "테크노바 사업계획 검토 회의",
        date: new Date("2026-03-18T14:00:00+09:00"),
        location: "플로우코더 컨설팅 회의실 A",
      },
      {
        id: ID.meeting2,
        clientId: ID.client2,
        projectId: ID.project2,
        title: "그린에너지 벤처인증 사전 미팅",
        date: new Date("2026-04-25T10:00:00+09:00"),
        location: "그린에너지 본사",
      },
      {
        id: ID.meeting3,
        clientId: ID.client3,
        title: "바이오헬스 초기 상담",
        date: new Date("2026-03-10T11:00:00+09:00"),
        location: "온라인 (Zoom)",
      },
    ],
  });

  // Meeting transcripts for past meetings
  await prisma.meetingTranscript.createMany({
    data: [
      {
        meetingId: ID.meeting1,
        rawTranscript:
          "사업계획서 초안 검토 회의록. 참석: 최현일, 박지훈. AI 솔루션 사업모델의 차별성 강조 필요. 시장 규모 데이터 업데이트 요청.",
        summary:
          "사업계획서 초안 검토 완료. AI 솔루션 차별성 강화, 시장규모 데이터 보완 필요. 다음 주까지 수정본 제출 예정.",
        keyDecisions: [
          "AI 솔루션 USP 섹션 강화",
          "TAM/SAM/SOM 데이터 최신화",
          "재무추정 3개년 추가",
        ],
        sentiment: "positive",
      },
      {
        meetingId: ID.meeting3,
        rawTranscript:
          "바이오헬스 초기 상담. 참석: 김민수, 김영희. 초기 스타트업으로 재무분석이 필요한 상황. 투자 유치를 위한 기초 재무제표 정리 요청.",
        summary:
          "초기 상담 완료. 재무제표 정리 및 분석 진행 합의. 2주 내 재무 데이터 수신 후 분석 착수.",
        keyDecisions: [
          "재무제표 정리 우선 진행",
          "투자 유치용 재무 리포트 작성",
        ],
        sentiment: "neutral",
      },
    ],
  });

  // Meeting attendees
  await prisma.meetingAttendee.createMany({
    data: [
      {
        meetingId: ID.meeting1,
        userId: ID.userOwner,
        name: "최현일",
        role: "컨설턴트",
      },
      {
        meetingId: ID.meeting1,
        contactId: ID.contact1,
        name: "박지훈",
        role: "고객사 대표",
      },
      {
        meetingId: ID.meeting2,
        userId: ID.userConsultant,
        name: "김민수",
        role: "컨설턴트",
      },
      {
        meetingId: ID.meeting2,
        contactId: ID.contact3,
        name: "이수현",
        role: "고객사 대표",
      },
      {
        meetingId: ID.meeting3,
        userId: ID.userConsultant,
        name: "김민수",
        role: "컨설턴트",
      },
      {
        meetingId: ID.meeting3,
        contactId: ID.contact5,
        name: "김영희",
        role: "고객사 대표",
      },
    ],
  });

  // ── 13. ActionItems ────────────────────────────────────────
  console.log("Creating action items...");
  await prisma.actionItem.createMany({
    data: [
      {
        id: "action-1",
        meetingId: ID.meeting1,
        description: "사업계획서 시장규모 데이터 업데이트",
        assigneeUserId: ID.userOwner,
        dueDate: new Date("2026-03-25"),
        status: "DONE",
      },
      {
        id: "action-2",
        meetingId: ID.meeting1,
        description: "AI 솔루션 USP 섹션 재작성",
        assigneeUserId: ID.userOwner,
        dueDate: new Date("2026-03-28"),
        status: "IN_PROGRESS",
      },
      {
        id: "action-3",
        meetingId: ID.meeting3,
        description: "바이오헬스 2024년 재무 데이터 수집",
        assigneeUserId: ID.userConsultant,
        dueDate: new Date("2026-03-24"),
        status: "DONE",
      },
      {
        id: "action-4",
        meetingId: ID.meeting2,
        description: "벤처인증 기술평가 체크리스트 준비",
        assigneeUserId: ID.userConsultant,
        dueDate: new Date("2026-05-01"),
        status: "OPEN",
      },
    ],
  });

  // ── 14. ResearchJournals ───────────────────────────────────
  console.log("Creating research journals...");
  await prisma.researchJournal.createMany({
    data: [
      {
        id: "journal-1",
        clientId: ID.client1,
        researcherContactId: ID.contact2,
        date: new Date("2026-03-15"),
        title: "NLP 모델 성능 개선 연구",
        content:
          "자연어처리 모델의 한국어 성능 향상을 위한 데이터 증강 기법 적용. Fine-tuning 데이터셋 1만건 추가 구축.",
        objectives: "한국어 NLP 정확도 95% 이상 달성",
        results: "데이터 증강 후 정확도 92% → 94.5% 개선",
        nextSteps: "추가 데이터 확보 및 모델 아키텍처 개선",
        hours: 8,
        status: "SUBMITTED",
      },
      {
        id: "journal-2",
        clientId: ID.client2,
        researcherContactId: ID.contact4,
        date: new Date("2026-03-20"),
        title: "태양광 패널 효율 테스트",
        content:
          "신규 태양광 패널의 실외 환경 효율 테스트 진행. 기존 대비 12% 효율 향상 확인.",
        objectives: "패널 효율 20% 이상 달성",
        results: "효율 18.5% 달성, 목표 대비 1.5%p 부족",
        nextSteps: "셀 구조 최적화 및 코팅 재질 변경 테스트",
        hours: 6,
        status: "DRAFT",
      },
    ],
  });

  // ── 15. Schedules ──────────────────────────────────────────
  console.log("Creating schedules...");
  await prisma.schedule.createMany({
    data: [
      {
        id: "sched-1",
        orgId: ID.org,
        clientId: ID.client1,
        projectId: ID.project1,
        title: "예비창업패키지 제출 마감",
        type: "DEADLINE",
        startDate: new Date("2026-05-15"),
        isAllDay: true,
        reminderDays: [7, 3, 1],
      },
      {
        id: "sched-2",
        orgId: ID.org,
        clientId: ID.client2,
        title: "그린에너지 벤처인증 사전 미팅",
        type: "MEETING",
        startDate: new Date("2026-04-25T10:00:00+09:00"),
        endDate: new Date("2026-04-25T12:00:00+09:00"),
        description: "그린에너지 본사 방문, 기술평가 사전 준비 회의",
      },
      {
        id: "sched-3",
        orgId: ID.org,
        clientId: ID.client4,
        projectId: ID.project6,
        title: "스마트팜 시장조사 중간보고",
        type: "DEADLINE",
        startDate: new Date("2026-05-10"),
        isAllDay: true,
        description: "시장 동향 분석 중간 보고서 제출",
      },
    ],
  });

  // ── 16. Estimates ──────────────────────────────────────────
  console.log("Creating estimates...");
  await prisma.estimate.createMany({
    data: [
      {
        id: ID.estimate1,
        clientId: ID.client1,
        projectId: ID.project8,
        estimateNumber: "EST-2026-001",
        items: [
          {
            name: "사업계획서 작성",
            quantity: 1,
            unitPrice: 3000000,
            amount: 3000000,
          },
          {
            name: "기업부설연구소 설립 지원",
            quantity: 1,
            unitPrice: 2000000,
            amount: 2000000,
          },
          {
            name: "특허 출원 지원",
            quantity: 1,
            unitPrice: 1500000,
            amount: 1500000,
          },
        ],
        totalAmount: 5525000,
        taxAmount: 552500,
        validUntil: new Date("2026-05-31"),
        status: "SENT",
        sentAt: new Date("2026-03-15"),
      },
      {
        id: ID.estimate2,
        clientId: ID.client2,
        projectId: ID.project2,
        estimateNumber: "EST-2026-002",
        items: [
          {
            name: "벤처기업 인증 컨설팅",
            quantity: 1,
            unitPrice: 2500000,
            amount: 2500000,
          },
          {
            name: "기술평가 서류 준비",
            quantity: 1,
            unitPrice: 1000000,
            amount: 1000000,
          },
        ],
        totalAmount: 3500000,
        taxAmount: 350000,
        validUntil: new Date("2026-06-15"),
        status: "ACCEPTED",
        sentAt: new Date("2026-03-10"),
      },
    ],
  });

  // ── 17. Contracts ──────────────────────────────────────────
  console.log("Creating contracts...");
  await prisma.contract.create({
    data: {
      id: "contract-1",
      clientId: ID.client2,
      projectId: ID.project2,
      contractNumber: "CTR-2026-001",
      title: "벤처기업 인증 컨설팅 계약",
      partyA: {
        name: "플로우코더 컨설팅",
        representative: "최현일",
        businessNumber: "111-22-33333",
        address: "서울특별시 강남구",
      },
      partyB: {
        name: "그린에너지 주식회사",
        representative: "이수현",
        businessNumber: "234-56-78901",
        address: "경기도 성남시 분당구",
      },
      terms: {
        scope: "벤처기업 인증 신청 전 과정 컨설팅",
        deliverables: ["기술평가 서류", "인증 신청서", "발표자료"],
        paymentTerms: "계약금 50%, 인증 완료 후 잔금 50%",
        warrantyPeriod: "인증 완료 후 6개월",
      },
      totalAmount: 3500000,
      startDate: new Date("2026-03-15"),
      endDate: new Date("2026-08-31"),
      status: "SIGNED",
      signedAt: new Date("2026-03-15"),
    },
  });

  // ── 18. Notifications ──────────────────────────────────────
  console.log("Creating notifications...");
  await prisma.notification.createMany({
    data: [
      {
        id: "notif-1",
        userId: ID.userOwner,
        type: "DOC_REQUESTED",
        title: "서류 요청: 테크노바 재무제표",
        body: "테크노바의 2024년 재무제표가 요청되었습니다.",
        link: "/clients/client-1/documents",
        isRead: true,
        createdAt: new Date("2026-03-10"),
      },
      {
        id: "notif-2",
        userId: ID.userOwner,
        type: "DEADLINE",
        title: "마감 임박: 예비창업패키지 제출",
        body: "2026 예비창업패키지 사업계획서 제출 마감이 30일 남았습니다.",
        link: "/projects/project-1",
        isRead: false,
        createdAt: new Date("2026-04-10"),
      },
      {
        id: "notif-3",
        userId: ID.userOwner,
        type: "MEETING_NOTIFY",
        title: "회의 알림: 그린에너지 벤처인증 미팅",
        body: "4월 25일 그린에너지 벤처인증 사전 미팅이 예정되어 있습니다.",
        link: "/meetings/meeting-2",
        isRead: false,
        createdAt: new Date("2026-04-11"),
      },
      {
        id: "notif-4",
        userId: ID.userOwner,
        type: "PROJECT_ASSIGNED",
        title: "프로젝트 배정: 소부장 인증",
        body: "그린에너지 소부장 인증 프로젝트가 배정되었습니다.",
        link: "/projects/project-7",
        isRead: true,
        createdAt: new Date("2026-03-25"),
      },
      {
        id: "notif-5",
        userId: ID.userOwner,
        type: "AI_JOB_COMPLETE",
        title: "AI 작업 완료: 재무 분석",
        body: "바이오헬스 재무 분석 AI 작업이 완료되었습니다.",
        link: "/projects/project-5",
        isRead: false,
        createdAt: new Date("2026-04-05"),
      },
    ],
  });

  // ── 19. RelationTuples (ReBAC) ─────────────────────────────
  console.log("Creating relation tuples...");
  await prisma.relationTuple.createMany({
    data: [
      // Org memberships
      {
        namespace: "organization",
        objectId: ID.org,
        relation: "member",
        subjectType: "user",
        subjectId: ID.userOwner,
      },
      {
        namespace: "organization",
        objectId: ID.org,
        relation: "member",
        subjectType: "user",
        subjectId: ID.userConsultant,
      },
      {
        namespace: "organization",
        objectId: ID.org,
        relation: "owner",
        subjectType: "user",
        subjectId: ID.userOwner,
      },
      // Project access
      {
        namespace: "project",
        objectId: ID.project1,
        relation: "lead",
        subjectType: "user",
        subjectId: ID.userOwner,
      },
      {
        namespace: "project",
        objectId: ID.project1,
        relation: "member",
        subjectType: "user",
        subjectId: ID.userConsultant,
      },
      {
        namespace: "project",
        objectId: ID.project2,
        relation: "lead",
        subjectType: "user",
        subjectId: ID.userConsultant,
      },
      {
        namespace: "project",
        objectId: ID.project8,
        relation: "lead",
        subjectType: "user",
        subjectId: ID.userOwner,
      },
    ],
  });

  // ── 20. AiJobs ─────────────────────────────────────────────
  console.log("Creating AI jobs...");
  await prisma.aiJob.createMany({
    data: [
      {
        id: "aijob-1",
        projectId: ID.project5,
        type: "EVALUATION",
        tier: "API_OPUS",
        status: "COMPLETED",
        input: {
          clientId: ID.client3,
          year: 2024,
          analysisType: "full_financial",
        },
        output: {
          summary: "초기 스타트업 단계, 영업손실 발생 중이나 자산 대비 부채비율 양호",
          riskScore: 6.5,
          recommendations: [
            "매출 성장 전략 필요",
            "비용 구조 최적화",
            "투자 유치 적극 추진",
          ],
        },
        cost: 0.35,
        durationMs: 12500,
        createdAt: new Date("2026-03-28"),
      },
      {
        id: "aijob-2",
        projectId: ID.project2,
        type: "GAP_DIAGNOSIS",
        tier: "API_HAIKU",
        status: "COMPLETED",
        input: {
          clientId: ID.client2,
          targetCert: "VENTURE",
          currentDocs: ["사업계획서", "재무제표", "특허증"],
        },
        output: {
          gapItems: [
            "기술성 평가 보완 자료",
            "매출 실적 증빙",
            "기술 로드맵",
          ],
          completionRate: 0.72,
          estimatedDays: 14,
        },
        cost: 0.05,
        durationMs: 3200,
        createdAt: new Date("2026-04-01"),
      },
    ],
  });

  // ── 21. MatchingResults ────────────────────────────────────
  console.log("Creating matching results...");
  await prisma.matchingResult.createMany({
    data: [
      {
        id: "match-1",
        clientId: ID.client1,
        programId: ID.program1,
        score: 87.5,
        matchReasons: [
          "업력 3년 이상",
          "IT 분야 기술 보유",
          "매출 35억 (적격)",
        ],
        isRelevant: true,
        createdAt: new Date("2026-03-05"),
      },
      {
        id: "match-2",
        clientId: ID.client2,
        programId: ID.program2,
        score: 92.0,
        matchReasons: [
          "기술 혁신형 기업",
          "특허 2건 보유",
          "신재생에너지 분야 성장성",
        ],
        isRelevant: true,
        createdAt: new Date("2026-03-08"),
      },
    ],
  });

  // ── 22. FinancialReport ────────────────────────────────────
  console.log("Creating financial report...");
  await prisma.financialReport.create({
    data: {
      id: "finreport-1",
      clientId: ID.client3,
      clientFinancialId: "fin-3",
      year: 2024,
      analysis: {
        summary:
          "매출 5억, 영업손실 5천만원. 바이오 초기 기업 특성상 R&D 투자 과중.",
        ratios: {
          debtRatio: 0.4375,
          currentRatio: 1.8,
          operatingMargin: -0.1,
        },
        outlook: "투자 유치 시 성장 잠재력 높음",
      },
      reportUrl: "/uploads/placeholder-finreport.pdf",
    },
  });

  // ── 23. EmailLogs ──────────────────────────────────────────
  console.log("Creating email logs...");
  await prisma.emailLog.createMany({
    data: [
      {
        id: "email-1",
        clientId: ID.client1,
        projectId: ID.project1,
        to: "jhpark@technova.co.kr",
        subject: "사업계획서 초안 검토 요청",
        type: "DOC_REQUEST",
        sentAt: new Date("2026-03-12"),
      },
      {
        id: "email-2",
        meetingId: ID.meeting1,
        clientId: ID.client1,
        to: "jhpark@technova.co.kr",
        subject: "[회의록] 테크노바 사업계획 검토 회의",
        type: "MEETING_SUMMARY",
        sentAt: new Date("2026-03-18"),
        openedAt: new Date("2026-03-18"),
      },
    ],
  });

  // ── Verification ───────────────────────────────────────────
  console.log("\n--- Verification ---");
  const counts = {
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    memberships: await prisma.membership.count(),
    programs: await prisma.programInfo.count(),
    clients: await prisma.client.count(),
    contacts: await prisma.contact.count(),
    financials: await prisma.clientFinancial.count(),
    certificates: await prisma.certificate.count(),
    projects: await prisma.project.count(),
    projectMembers: await prisma.projectMember.count(),
    documents: await prisma.document.count(),
    meetings: await prisma.meeting.count(),
    meetingTranscripts: await prisma.meetingTranscript.count(),
    meetingAttendees: await prisma.meetingAttendee.count(),
    actionItems: await prisma.actionItem.count(),
    researchJournals: await prisma.researchJournal.count(),
    schedules: await prisma.schedule.count(),
    estimates: await prisma.estimate.count(),
    contracts: await prisma.contract.count(),
    notifications: await prisma.notification.count(),
    relationTuples: await prisma.relationTuple.count(),
    aiJobs: await prisma.aiJob.count(),
    matchingResults: await prisma.matchingResult.count(),
    financialReports: await prisma.financialReport.count(),
    emailLogs: await prisma.emailLog.count(),
  };

  console.log("Record counts:", counts);

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\nTotal records inserted: ${totalRecords}`);
  console.log("Seed completed successfully!");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

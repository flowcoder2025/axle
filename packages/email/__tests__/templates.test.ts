import { describe, it, expect } from "vitest";
import {
  docRequestEmail,
  docPushEmail,
  meetingSummaryEmail,
  estimateEmail,
  contractEmail,
  journalReminderEmail,
  deadlineAlertEmail,
  matchingDigestEmail,
  onboardingEmail,
} from "../src/templates/index.js";

/** Basic structural validity: must start with <div and contain </div> */
function isValidHtml(html: string): boolean {
  return html.startsWith("<div") && html.includes("</div>");
}

describe("docRequestEmail", () => {
  it("renders valid HTML containing clientName, projectName, items, and uploadUrl", () => {
    const html = docRequestEmail({
      clientName: "홍길동",
      projectName: "R&D 지원사업",
      items: ["사업자등록증", "재무제표", "기술확인서"],
      uploadUrl: "https://axle.app/upload/abc123",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("홍길동");
    // "&" is escaped to "&amp;" in user-provided strings (XSS prevention)
    expect(html).toContain("R&amp;D 지원사업");
    expect(html).toContain("사업자등록증");
    expect(html).toContain("재무제표");
    expect(html).toContain("기술확인서");
    expect(html).toContain("https://axle.app/upload/abc123");
  });

  it("renders all items as list elements", () => {
    const html = docRequestEmail({
      clientName: "김철수",
      projectName: "스마트공장",
      items: ["A", "B"],
      uploadUrl: "https://axle.app/upload/x",
    });

    expect(html.match(/<li/g)?.length).toBe(2);
  });
});

describe("docPushEmail", () => {
  it("renders valid HTML containing clientName, documentName, and uploaderName", () => {
    const html = docPushEmail({
      clientName: "이영희",
      documentName: "사업계획서.pdf",
      uploaderName: "박민준",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("이영희");
    expect(html).toContain("사업계획서.pdf");
    expect(html).toContain("박민준");
  });
});

describe("meetingSummaryEmail", () => {
  it("renders valid HTML with all props", () => {
    const html = meetingSummaryEmail({
      meetingTitle: "1차 킥오프 미팅",
      date: "2024-03-15",
      attendees: ["홍길동", "김철수", "이영희"],
      summary: "프로젝트 일정 및 역할 분담을 논의하였습니다.",
      actionItems: ["사업계획서 초안 작성", "담당자 연락처 공유"],
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("1차 킥오프 미팅");
    expect(html).toContain("2024-03-15");
    expect(html).toContain("홍길동");
    expect(html).toContain("김철수");
    expect(html).toContain("이영희");
    expect(html).toContain("프로젝트 일정 및 역할 분담을 논의하였습니다.");
    expect(html).toContain("사업계획서 초안 작성");
    expect(html).toContain("담당자 연락처 공유");
  });

  it("numbers action items starting from 1", () => {
    const html = meetingSummaryEmail({
      meetingTitle: "회의",
      date: "2024-01-01",
      attendees: ["A"],
      summary: "요약",
      actionItems: ["액션1", "액션2", "액션3"],
    });

    expect(html).toContain("<strong>1.</strong>");
    expect(html).toContain("<strong>2.</strong>");
    expect(html).toContain("<strong>3.</strong>");
  });
});

describe("estimateEmail", () => {
  const sampleItems = [
    { name: "기술 자문", quantity: 3, unitPrice: 500_000, amount: 1_500_000 },
    { name: "보고서 작성", quantity: 1, unitPrice: 800_000, amount: 800_000 },
  ];

  it("renders valid HTML with estimateNumber, totalAmount, downloadUrl", () => {
    const html = estimateEmail({
      clientName: "홍길동",
      estimateNumber: "EST-2024-001",
      items: sampleItems,
      totalAmount: 2_300_000,
      validUntil: "2024-04-30",
      downloadUrl: "https://axle.app/estimate/EST-2024-001.pdf",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("홍길동");
    expect(html).toContain("EST-2024-001");
    expect(html).toContain("기술 자문");
    expect(html).toContain("보고서 작성");
    expect(html).toContain("2024-04-30");
    expect(html).toContain("https://axle.app/estimate/EST-2024-001.pdf");
  });

  it("formats totalAmount as Korean currency", () => {
    const html = estimateEmail({
      clientName: "테스트",
      estimateNumber: "EST-001",
      items: sampleItems,
      totalAmount: 2_300_000,
      validUntil: "2024-12-31",
      downloadUrl: "https://axle.app/est",
    });

    expect(html).toContain("2,300,000원");
  });
});

describe("contractEmail", () => {
  it("renders valid HTML with clientName, contractTitle, signUrl", () => {
    const html = contractEmail({
      clientName: "홍길동",
      contractTitle: "R&D 컨설팅 서비스 계약서",
      signUrl: "https://axle.app/sign/contract-abc",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("홍길동");
    // "&" is escaped to "&amp;" in user-provided strings (XSS prevention)
    expect(html).toContain("R&amp;D 컨설팅 서비스 계약서");
    expect(html).toContain("https://axle.app/sign/contract-abc");
  });
});

describe("journalReminderEmail", () => {
  it("renders valid HTML with all props", () => {
    const html = journalReminderEmail({
      researcherName: "김연구",
      clientName: "(주)테크스타트",
      month: "2024년 3월",
      writeUrl: "https://axle.app/journal/write",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("김연구");
    expect(html).toContain("(주)테크스타트");
    expect(html).toContain("2024년 3월");
    expect(html).toContain("https://axle.app/journal/write");
  });
});

describe("deadlineAlertEmail", () => {
  it("renders valid HTML with programName, deadline, daysRemaining, clientName", () => {
    const html = deadlineAlertEmail({
      programName: "중소기업 기술개발사업",
      deadline: "2024-03-31",
      daysRemaining: 5,
      clientName: "홍길동",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("중소기업 기술개발사업");
    expect(html).toContain("2024-03-31");
    expect(html).toContain("D-5");
    expect(html).toContain("홍길동");
  });

  it("uses red color when 3 or fewer days remain", () => {
    const html = deadlineAlertEmail({
      programName: "긴급",
      deadline: "2024-03-28",
      daysRemaining: 2,
      clientName: "이영희",
    });

    expect(html).toContain("#dc2626");
  });

  it("uses amber color when 4-7 days remain", () => {
    const html = deadlineAlertEmail({
      programName: "주의",
      deadline: "2024-04-05",
      daysRemaining: 6,
      clientName: "김철수",
    });

    expect(html).toContain("#f59e0b");
  });

  it("uses blue color when more than 7 days remain", () => {
    const html = deadlineAlertEmail({
      programName: "여유",
      deadline: "2024-04-20",
      daysRemaining: 14,
      clientName: "박민준",
    });

    expect(html).toContain("#2563eb");
  });
});

describe("matchingDigestEmail", () => {
  const sampleMatches = [
    { programName: "스마트팩토리 보급사업", score: 92, reason: "제조업 기반 기업에 최적화된 지원사업입니다." },
    { programName: "기술혁신개발사업", score: 78, reason: "R&D 역량이 높은 기업에 적합합니다." },
  ];

  it("renders valid HTML with matches and consultantName", () => {
    const html = matchingDigestEmail({
      matches: sampleMatches,
      consultantName: "정컨설턴트",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("정컨설턴트");
    expect(html).toContain("스마트팩토리 보급사업");
    expect(html).toContain("기술혁신개발사업");
    expect(html).toContain("92점");
    expect(html).toContain("78점");
    expect(html).toContain("제조업 기반 기업에 최적화된 지원사업입니다.");
  });

  it("renders #1, #2 badges for each match", () => {
    const html = matchingDigestEmail({
      matches: sampleMatches,
      consultantName: "테스트",
    });

    expect(html).toContain("#1");
    expect(html).toContain("#2");
  });
});

describe("onboardingEmail", () => {
  it("renders valid HTML with all props", () => {
    const html = onboardingEmail({
      clientName: "홍길동",
      consultantName: "박컨설턴트",
      checklistItems: ["프로필 입력", "서류 업로드", "계약서 서명"],
      portalUrl: "https://axle.app/portal",
    });

    expect(isValidHtml(html)).toBe(true);
    expect(html).toContain("홍길동");
    expect(html).toContain("박컨설턴트");
    expect(html).toContain("프로필 입력");
    expect(html).toContain("서류 업로드");
    expect(html).toContain("계약서 서명");
    expect(html).toContain("https://axle.app/portal");
  });

  it("renders a row for each checklist item", () => {
    const html = onboardingEmail({
      clientName: "테스트",
      consultantName: "김컨설턴트",
      checklistItems: ["A", "B", "C"],
      portalUrl: "https://axle.app",
    });

    expect(html.match(/<tr>/g)?.length).toBe(3);
  });
});

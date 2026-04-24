import { describe, expect, it } from "vitest";
import {
  generateOrgChartMermaid,
  type OrgChartStructure,
} from "../../src/generators/org-chart.js";

const baseChart: OrgChartStructure = {
  companyName: "주식회사 제이이티",
  ceo: { name: "김희수", position: "대표이사" },
  departments: [
    { name: "경영지원팀", members: [{ name: "김창수", position: "팀장" }] },
    {
      name: "생산팀",
      members: [
        { name: "백성영", position: "사원" },
        { name: "안정빈", position: "사원" },
      ],
    },
    {
      name: "연구개발전담부서",
      members: [{ name: "심재경", position: "연구팀장" }],
    },
  ],
};

describe("generateOrgChartMermaid", () => {
  it("starts with flowchart TD header", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out.split("\n")[0]).toBe("flowchart TD");
  });

  it("renders CEO node with company name and title", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out).toContain("CEO[");
    expect(out).toContain("김희수");
    expect(out).toContain("대표이사");
    expect(out).toContain("주식회사 제이이티");
  });

  it("renders every department and its members", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out).toContain("경영지원팀");
    expect(out).toContain("김창수 팀장");
    expect(out).toContain("백성영 사원");
    expect(out).toContain("안정빈 사원");
    expect(out).toContain("연구개발전담부서");
    expect(out).toContain("심재경 연구팀장");
  });

  it("connects every department to CEO", () => {
    const out = generateOrgChartMermaid(baseChart);
    for (let i = 1; i <= baseChart.departments.length; i += 1) {
      expect(out).toContain(`CEO --> D${i}`);
    }
  });

  it("applies classDef styles to CEO and departments", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out).toContain("classDef ceo");
    expect(out).toContain("classDef dept");
    expect(out).toContain("class CEO ceo");
    expect(out).toContain("class D1,D2,D3 dept");
  });

  it("handles department with no members", () => {
    const out = generateOrgChartMermaid({
      ...baseChart,
      departments: [{ name: "신설팀", members: [] }],
    });
    expect(out).toContain("신설팀");
  });

  it("handles member with no position", () => {
    const out = generateOrgChartMermaid({
      companyName: "Acme",
      ceo: { name: "홍길동" },
      departments: [{ name: "개발팀", members: [{ name: "이순신" }] }],
    });
    expect(out).toContain("홍길동");
    expect(out).toContain("이순신");
    expect(out).not.toContain("이순신 undefined");
  });

  it("escapes double quotes and backticks in labels", () => {
    const out = generateOrgChartMermaid({
      companyName: 'Acme "Tech"',
      ceo: { name: "a`b", position: "CEO" },
      departments: [],
    });
    expect(out).not.toContain('"Tech"');
    expect(out).not.toContain("a`b");
    expect(out).toContain("Acme Tech");
    expect(out).toContain("ab");
  });

  it("throws when companyName is missing", () => {
    expect(() =>
      generateOrgChartMermaid({
        companyName: "",
        ceo: { name: "x" },
        departments: [],
      }),
    ).toThrow(/companyName/);
  });

  it("throws when ceo.name is missing", () => {
    expect(() =>
      generateOrgChartMermaid({
        companyName: "Acme",
        ceo: { name: "" },
        departments: [],
      }),
    ).toThrow(/ceo\.name/);
  });

  it("produces deterministic output", () => {
    const out1 = generateOrgChartMermaid(baseChart);
    const out2 = generateOrgChartMermaid(baseChart);
    expect(out1).toBe(out2);
  });
});

export enum ProgramCategory {
  RD = "R&D",
  EXPORT = "수출",
  STARTUP = "창업",
  EMPLOYMENT = "고용",
  FINANCE = "금융",
  MARKETING = "마케팅",
  CONSULTING = "컨설팅",
  OTHER = "기타",
}

export interface CrawledProgram {
  name: string;
  agency?: string;
  category?: string;
  applicationStart?: string;
  applicationEnd?: string;
  maxFunding?: number;
  requirements?: string;
  eligibility?: string;
  region?: string;
  announcementUrl?: string;
  rawText?: string;
  externalId?: string;
}

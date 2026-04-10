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
}

export interface CrawlError {
  source: string;
  message: string;
  selector?: string;
  url?: string;
  occurredAt: Date;
}

export interface CrawlResult {
  programs: CrawledProgram[];
  errors: CrawlError[];
  source: string;
  crawledAt: Date;
}

/**
 * Minimal subset of Playwright's Page interface used by the crawler.
 * Allows running without playwright installed — the real playwright Page
 * satisfies this interface at runtime on the OCI VM.
 */
export interface PageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<ElementHandleLike | null>;
  $$(selector: string): Promise<ElementHandleLike[]>;
  $(selector: string): Promise<ElementHandleLike | null>;
  screenshot(options?: { encoding?: string }): Promise<Buffer | string>;
  url(): string;
  close(): Promise<void>;
}

export interface ElementHandleLike {
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  $$(selector: string): Promise<ElementHandleLike[]>;
  $(selector: string): Promise<ElementHandleLike | null>;
}

export interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

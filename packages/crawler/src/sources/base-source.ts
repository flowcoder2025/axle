import type { CrawledProgram } from "../types.js";

export abstract class BaseSource {
  abstract readonly name: string;
  abstract crawl(): Promise<CrawledProgram[]>;
}

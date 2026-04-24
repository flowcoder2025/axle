// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  DocumentSection,
  RagDraftInput,
  RagDraftOutput,
  PrecisionInput,
  PrecisionOutput,
  VerificationInput,
  VerificationResult,
  MissingItem,
  FormatIssue,
  RequiredSection,
  SectionConfig,
} from "./types.js";
export {
  REQUIRED_SECTIONS,
  VENTURE_BUSINESS_PLAN_SECTIONS,
} from "./types.js";

// ── RAG Draft Engine (WI-063 / WI-201) ───────────────────────────────────────
export {
  generateRagDraft,
  searchClientDocuments,
  searchPastPlans,
} from "./engines/rag-draft.js";

// ── Precision Editor Engine (WI-064) ─────────────────────────────────────────
export { generatePrecisionDocx } from "./engines/precision-editor.js";

// ── Verification Engine (WI-065) ─────────────────────────────────────────────
export { verify } from "./engines/verification.js";

// ── DOCX Style Utils ──────────────────────────────────────────────────────────
export {
  buildDocxStyles,
  buildSectionProperties,
  toHeadingLevel,
  A4_PAGE_SIZE,
  STANDARD_MARGINS,
  FONT_KOREAN,
  FONT_LATIN,
  FONT_SIZE_BODY,
  FONT_SIZE_H1,
  FONT_SIZE_H2,
  FONT_SIZE_H3,
  SPACING,
} from "./utils/docx-styles.js";

// ── Estimate Generator (WI-066) ───────────────────────────────────────────────
export { generateEstimateDocx } from "./generators/estimate.js";
export type { EstimateDocInput } from "./generators/estimate.js";

// ── Contract Generator (WI-067) ───────────────────────────────────────────────
export { generateContractDocx } from "./generators/contract.js";
export type { ContractDocInput, ContractParty, ContractTerm } from "./generators/contract.js";

// ── Patent Draft Generator (WI-070) ──────────────────────────────────────────
export { generatePatentDraftDocx } from "./generators/patent-draft.js";
export type { PatentDraftInput } from "./generators/patent-draft.js";

// ── Converters (WI-071, WI-072) ───────────────────────────────────────────────
export { pdfToMarkdown } from "./converters/pdf-to-markdown.js";
export { markdownToDocx } from "./converters/markdown-to-docx.js";
export type { MarkdownToDocxOptions } from "./converters/markdown-to-docx.js";

// ── HWPX Editor (WI-068) ─────────────────────────────────────────────────────
export { editHwpx } from "./converters/hwpx-editor.js";
export type {
  HwpxEditOptions,
  HwpxFieldEdit,
  HwpxCheckboxEdit,
  HwpxTextReplace,
  HwpxEdit,
} from "./converters/hwpx-editor.js";

// ── Journal Report Generator (WI-069) ────────────────────────────────────────
export { generateJournalReportDocx } from "./generators/journal-report.js";
export type { JournalReportInput, JournalEntry } from "./generators/journal-report.js";

// ── Financial Report Generator (WI-101) ──────────────────────────────────────
export { generateFinancialReportDocx } from "./generators/financial-report.js";
export type { FinancialReportInput } from "./generators/financial-report.js";

// ── Text Parser (WI-005) ────────────────────────────────────────────────────
export { extractText } from "./converters/text-parser.js";
export type { ParseResult } from "./converters/text-parser.js";

// ── Image Generator (WI-006) ────────────────────────────────────────────────
export { generateImage } from "./generators/image-generator.js";
export type { ImageGenerateOptions } from "./generators/image-generator.js";

// ── Mermaid to PNG Converter (WI-006) ───────────────────────────────────────
export { convertMermaid } from "./converters/mermaid-to-png.js";
export type { MermaidOptions } from "./converters/mermaid-to-png.js";

// ── Org Chart Generator (WI-327, WI-329) ────────────────────────────────────
export {
  generateOrgChartMermaid,
  generateOrgChartDocx,
} from "./generators/org-chart.js";
export type {
  OrgChartStructure,
  OrgChartDepartment,
  OrgChartMember,
  OrgChartDocxOptions,
} from "./generators/org-chart.js";

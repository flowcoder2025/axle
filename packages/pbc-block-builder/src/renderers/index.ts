/**
 * Renderer adapters barrel.
 *
 * WI-503 ships the HTML renderer; WI-504..WI-506 will add React, Markdown,
 * and DOCX-element adapters and re-export them through this module.
 */

export { HTML_RENDERERS, escapeHtml, renderBlockHtml } from "./html.js";
export { REACT_RENDERERS, renderBlockReact } from "./react.js";
export {
  MARKDOWN_RENDERERS,
  escapeMarkdown,
  renderBlockMarkdown,
} from "./markdown.js";
export {
  DOCX_RENDERERS,
  renderBlockDocxElement,
} from "./docx-element.js";
export type {
  DocxElement,
  DocxListItem,
  DocxRun,
} from "./docx-element.js";

/**
 * Renderer adapters barrel.
 *
 * WI-503 ships the HTML renderer; WI-504..WI-506 will add React, Markdown,
 * and DOCX-element adapters and re-export them through this module.
 */

export { HTML_RENDERERS, escapeHtml, renderBlockHtml } from "./html.js";

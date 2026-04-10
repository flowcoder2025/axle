/**
 * HTML escaping utility for email templates.
 *
 * Apply to ALL user-provided string props before interpolating them into HTML.
 * Do NOT apply to URL props (href values) — URLs need raw formatting.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

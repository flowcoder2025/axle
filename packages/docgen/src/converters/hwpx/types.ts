// ── HWPX Editor Adapter Types ─────────────────────────────────────────────────
//
// Public shape shared by all HWPX editor adapter implementations.
// The current default implementation is `ZipXmlHwpxAdapter`, which manipulates
// the raw ZIP + XML directly. Future adapters (e.g. a native rhwp-backed one)
// MUST satisfy this contract so callers can remain unchanged.

/** Options used to load a template for editing. */
export interface HwpxEditOptions {
  /** Path to an HWPX template file on disk */
  templatePath?: string;
  /** Raw HWPX buffer (takes precedence over templatePath) */
  templateBuffer?: Buffer;
}

/** Set the value of a specific table cell by (table, row, col) index. */
export interface HwpxFieldEdit {
  type: "set_cell";
  /** Table index (0-based) within the section */
  table: number;
  row: number;
  col: number;
  value: string;
}

/** Toggle a checkbox field identified by its `name` attribute. */
export interface HwpxCheckboxEdit {
  type: "toggle_checkbox";
  /** Checkbox field name attribute */
  name: string;
  checked: boolean;
}

/** Global text find/replace applied over every string in the document. */
export interface HwpxTextReplace {
  type: "replace_text";
  search: string;
  replacement: string;
}

export type HwpxEdit = HwpxFieldEdit | HwpxCheckboxEdit | HwpxTextReplace;

/**
 * Opaque in-memory handle representing a loaded HWPX document.
 *
 * Implementations are free to choose the concrete representation (e.g. a
 * loaded JSZip instance, an AST, or a native binding handle). Callers must
 * not inspect the internals — they should pass the value back into the
 * adapter's `applyEdits` and `save` methods.
 */
export type HwpxDoc = unknown;

/**
 * HWPX editor adapter interface.
 *
 * Adapters implement the three-step pipeline that powers HWPX template
 * filling: load → apply edits → save. Different backends (ZIP+XML,
 * future rhwp native binding, etc.) can be swapped behind this interface
 * without changing callers.
 */
export interface HwpxEditorAdapter {
  /** Parse a raw HWPX buffer into an editable document handle. */
  loadTemplate(buf: Buffer): Promise<HwpxDoc>;
  /** Apply structured edits to the document and return a new handle. */
  applyEdits(doc: HwpxDoc, edits: HwpxEdit[]): Promise<HwpxDoc>;
  /** Serialize the document back into an HWPX (ZIP) buffer. */
  save(doc: HwpxDoc): Promise<Buffer>;
}

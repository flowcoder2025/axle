import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

import type {
  HwpxCheckboxEdit,
  HwpxDoc,
  HwpxEdit,
  HwpxEditorAdapter,
  HwpxFieldEdit,
  HwpxTextReplace,
} from "./types.js";

// ── XML parser/builder config ─────────────────────────────────────────────────

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: false,
  parseAttributeValue: false,
  trimValues: false,
  // Preserve CDATA
  cdataPropName: "__cdata",
} as const;

const BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  // Suppress declaration — HWPX files have their own XML header
  suppressUnpairedNode: false,
  // Emit all attribute values explicitly (e.g. checked="true" not just checked)
  suppressBooleanAttributes: false,
  format: false,
} as const;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Deeply set all text run values inside a cell node to `value`.
 * We replace the innermost text run; if none exists, we set the node itself.
 */
function setCellText(node: unknown, value: string): unknown {
  if (node === null || node === undefined) return value;
  if (typeof node === "string" || typeof node === "number") return value;
  if (Array.isArray(node)) {
    // Replace only the first element and clear the rest (merge into one)
    if (node.length === 0) return [value];
    return [setCellText(node[0], value)];
  }
  if (typeof node === "object") {
    const obj = { ...(node as Record<string, unknown>) };
    for (const key of Object.keys(obj)) {
      if (key.startsWith("@_")) continue;
      if (key === "__cdata") {
        obj[key] = value;
        return obj;
      }
      if (key === "hp:t" || key === "hsp:t" || key === "t") {
        obj[key] = value;
        return obj;
      }
    }
    // No text key found — set a generic "t" key
    obj["t"] = value;
    return obj;
  }
  return value;
}

/**
 * Recursively apply replace_text edits to every string value in the parsed XML
 * object. Returns a new (mutated-copy) object.
 */
function deepReplaceText(node: unknown, search: string, replacement: string): unknown {
  if (typeof node === "string") {
    return node.split(search).join(replacement);
  }
  if (Array.isArray(node)) {
    return node.map((item) => deepReplaceText(item, search, replacement));
  }
  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deepReplaceText(v, search, replacement);
    }
    return result;
  }
  return node;
}

/**
 * Collect all tables from a parsed section XML object.
 * HWPX tables live under hp:tbl (or hsp:tbl / tbl).
 */
function findTables(node: unknown): unknown[] {
  const tables: unknown[] = [];
  if (Array.isArray(node)) {
    for (const item of node) {
      tables.push(...findTables(item));
    }
    return tables;
  }
  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (key === "hp:tbl" || key === "hsp:tbl" || key === "tbl") {
        if (Array.isArray(val)) {
          tables.push(...val);
        } else {
          tables.push(val);
        }
      } else {
        tables.push(...findTables(val));
      }
    }
  }
  return tables;
}

/**
 * Get rows from a table node. HWPX rows: hp:tr / hsp:tr / tr
 */
function getRows(tableNode: unknown): unknown[] {
  if (tableNode === null || typeof tableNode !== "object") return [];
  const obj = tableNode as Record<string, unknown>;
  for (const key of ["hp:tr", "hsp:tr", "tr"]) {
    if (key in obj) {
      const v = obj[key];
      return Array.isArray(v) ? v : [v];
    }
  }
  return [];
}

/**
 * Get cells from a row node. HWPX cells: hp:tc / hsp:tc / tc
 */
function getCells(rowNode: unknown): unknown[] {
  if (rowNode === null || typeof rowNode !== "object") return [];
  const obj = rowNode as Record<string, unknown>;
  for (const key of ["hp:tc", "hsp:tc", "tc"]) {
    if (key in obj) {
      const v = obj[key];
      return Array.isArray(v) ? v : [v];
    }
  }
  return [];
}

/**
 * Find the first paragraph (hp:p / p) inside a cell that contains text runs,
 * then update it with the new value.
 */
function applyCellValue(cellNode: Record<string, unknown>, value: string): void {
  // Look for paragraph container: hp:p / p
  for (const pKey of ["hp:p", "hsp:p", "p"]) {
    if (pKey in cellNode) {
      cellNode[pKey] = setCellText(cellNode[pKey], value);
      return;
    }
  }
  // Fallback: just set a text key directly
  cellNode["t"] = value;
}

/**
 * Apply toggle_checkbox edit: find elements with matching name attribute and
 * set the checked attribute.
 */
function applyCheckbox(node: unknown, name: string, checked: boolean): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => applyCheckbox(item, name, checked));
  }
  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("@_")) {
        result[k] = v;
        continue;
      }
      result[k] = applyCheckbox(v, name, checked);
    }
    // Check if this node itself is a checkbox with matching name
    const nodeName = (obj["@_name"] as string | undefined) ?? "";
    const nodeType = (obj["@_type"] as string | undefined) ?? "";
    if (
      nodeName === name &&
      (nodeType === "checkbox" || nodeType === "check" || "checked" in obj || "@_checked" in obj)
    ) {
      result["@_checked"] = checked ? "true" : "false";
    }
    return result;
  }
  return node;
}

// ── Section XML processing ────────────────────────────────────────────────────

/**
 * Apply all edits to a single section XML string and return the modified XML.
 */
function applyEditsToSectionXml(xmlContent: string, edits: HwpxEdit[]): string {
  const parser = new XMLParser(PARSER_OPTIONS);
  const builder = new XMLBuilder(BUILDER_OPTIONS);

  let parsed = parser.parse(xmlContent) as unknown;

  // Separate edits by type for efficiency
  const setCellEdits = edits.filter((e): e is HwpxFieldEdit => e.type === "set_cell");
  const checkboxEdits = edits.filter((e): e is HwpxCheckboxEdit => e.type === "toggle_checkbox");
  const replaceEdits = edits.filter((e): e is HwpxTextReplace => e.type === "replace_text");

  // 1. replace_text — operate on the whole tree
  for (const edit of replaceEdits) {
    parsed = deepReplaceText(parsed, edit.search, edit.replacement);
  }

  // 2. toggle_checkbox
  for (const edit of checkboxEdits) {
    parsed = applyCheckbox(parsed, edit.name, edit.checked);
  }

  // 3. set_cell — find tables, then rows/cols
  if (setCellEdits.length > 0) {
    const tables = findTables(parsed);
    for (const edit of setCellEdits) {
      const table = tables[edit.table];
      if (!table) continue;
      const rows = getRows(table);
      const row = rows[edit.row];
      if (!row) continue;
      const cells = getCells(row);
      const cellNode = cells[edit.col];
      if (!cellNode || typeof cellNode !== "object") continue;
      applyCellValue(cellNode as Record<string, unknown>, edit.value);
    }
  }

  // Rebuild XML
  return builder.build(parsed) as string;
}

// ── Adapter implementation ────────────────────────────────────────────────────

/**
 * Internal document shape handed between the adapter's pipeline steps.
 * We keep the loaded JSZip instance around so `save()` can re-serialize
 * without re-reading the source buffer.
 */
interface ZipXmlDoc {
  zip: JSZip;
}

function isZipXmlDoc(doc: HwpxDoc): doc is ZipXmlDoc {
  return (
    doc !== null &&
    typeof doc === "object" &&
    "zip" in (doc as Record<string, unknown>) &&
    (doc as { zip: unknown }).zip instanceof JSZip
  );
}

/**
 * Default HWPX editor adapter — manipulates the ZIP archive and underlying
 * XML directly using `jszip` + `fast-xml-parser`.
 *
 * This is intentionally stateless per-call: every `loadTemplate` produces a
 * fresh JSZip instance, `applyEdits` mutates the zip in place, and `save`
 * serializes to a new buffer.
 */
export class ZipXmlHwpxAdapter implements HwpxEditorAdapter {
  async loadTemplate(buf: Buffer): Promise<HwpxDoc> {
    const zip = await JSZip.loadAsync(buf);
    return { zip };
  }

  async applyEdits(doc: HwpxDoc, edits: HwpxEdit[]): Promise<HwpxDoc> {
    if (!isZipXmlDoc(doc)) {
      throw new Error("ZipXmlHwpxAdapter.applyEdits: invalid document handle");
    }
    const { zip } = doc;

    // Find section XML files: Contents/section0.xml, Contents/section1.xml, …
    // Also handle files named word/document.xml if it's actually a DOCX-like wrapper.
    const sectionFiles = Object.keys(zip.files).filter(
      (name) =>
        (name.startsWith("Contents/section") && name.endsWith(".xml")) ||
        name === "Contents/content.hpf" ||
        (name.startsWith("word/") && name.endsWith(".xml"))
    );

    // If no section files found, try all XML files under Contents/
    const xmlFiles =
      sectionFiles.length > 0
        ? sectionFiles
        : Object.keys(zip.files).filter((n) => n.endsWith(".xml") && !zip.files[n].dir);

    for (const fileName of xmlFiles) {
      const file = zip.files[fileName];
      if (!file || file.dir) continue;

      const content = await file.async("string");
      if (!content.trim()) continue;

      try {
        const modified = applyEditsToSectionXml(content, edits);
        zip.file(fileName, modified);
      } catch {
        // If XML parsing fails for a file, leave it unchanged
      }
    }

    return doc;
  }

  async save(doc: HwpxDoc): Promise<Buffer> {
    if (!isZipXmlDoc(doc)) {
      throw new Error("ZipXmlHwpxAdapter.save: invalid document handle");
    }
    const result = await doc.zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    return result as Buffer;
  }
}

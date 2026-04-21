// ── HWPX Editor (facade) ──────────────────────────────────────────────────────
//
// Thin facade over the adapter layer in `./hwpx/`. The actual editing logic
// now lives in `ZipXmlHwpxAdapter`; this module preserves the historical
// public surface (`editHwpx`, `HwpxEdit*` types) so downstream callers
// continue to work unchanged.
//
// To swap the backend (e.g. to a future rhwp-native adapter), change
// `getDefaultHwpxAdapter()` in `./hwpx/index.ts`.

import { getDefaultHwpxAdapter } from "./hwpx/index.js";
import type { HwpxEdit, HwpxEditOptions } from "./hwpx/types.js";

export type {
  HwpxCheckboxEdit,
  HwpxDoc,
  HwpxEdit,
  HwpxEditOptions,
  HwpxEditorAdapter,
  HwpxFieldEdit,
  HwpxTextReplace,
} from "./hwpx/types.js";

export { ZipXmlHwpxAdapter, getDefaultHwpxAdapter } from "./hwpx/index.js";

/**
 * Edit an HWPX document by applying a list of structured edits.
 *
 * HWPX is a ZIP archive containing XML section files. The default adapter
 * (`ZipXmlHwpxAdapter`) implements the pipeline:
 * 1. Extracts the ZIP
 * 2. Parses each `Contents/section*.xml` file
 * 3. Applies the requested edits
 * 4. Repacks and returns the modified HWPX as a Buffer
 *
 * @param options - Source HWPX: either a file path or a Buffer
 * @param edits   - List of edits to apply
 * @returns Modified HWPX document as a Buffer
 */
export async function editHwpx(options: HwpxEditOptions, edits: HwpxEdit[]): Promise<Buffer> {
  if (!options.templatePath && !options.templateBuffer) {
    throw new Error("editHwpx: provide either templatePath or templateBuffer");
  }

  // Load source buffer
  let sourceBuffer: Buffer;
  if (options.templateBuffer) {
    sourceBuffer = options.templateBuffer;
  } else {
    // Dynamic import to avoid bundler issues in environments without fs
    const { readFile } = await import("node:fs/promises");
    sourceBuffer = await readFile(options.templatePath!);
  }

  const adapter = getDefaultHwpxAdapter();
  const doc = await adapter.loadTemplate(sourceBuffer);
  const edited = await adapter.applyEdits(doc, edits);
  return adapter.save(edited);
}

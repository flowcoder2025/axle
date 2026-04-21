// ── HWPX editor adapter module ────────────────────────────────────────────────
//
// Public entry point for the HWPX editor adapter layer.
// `getDefaultHwpxAdapter()` returns the adapter the high-level `editHwpx`
// facade uses today (ZIP + XML). Future backends (e.g. rhwp-native) will
// slot in behind the same `HwpxEditorAdapter` interface.

import type { HwpxEditorAdapter } from "./types.js";
import { ZipXmlHwpxAdapter } from "./zip-xml-adapter.js";

export type {
  HwpxCheckboxEdit,
  HwpxDoc,
  HwpxEdit,
  HwpxEditOptions,
  HwpxEditorAdapter,
  HwpxFieldEdit,
  HwpxTextReplace,
} from "./types.js";

export { ZipXmlHwpxAdapter } from "./zip-xml-adapter.js";

/**
 * Return the default HWPX editor adapter.
 *
 * Currently this is always `ZipXmlHwpxAdapter`. When a replacement backend
 * (e.g. rhwp v1.0+) lands, this factory is the single place that needs to
 * change — callers keep depending on the interface.
 */
export function getDefaultHwpxAdapter(): HwpxEditorAdapter {
  return new ZipXmlHwpxAdapter();
}

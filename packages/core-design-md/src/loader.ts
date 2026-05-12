/**
 * `loadDesignTokens` — fs-backed wrapper around `parseDesignMd`.
 *
 * Throws a clear `Error("Design file not found: <path>")` when the
 * path doesn't resolve. Using `node:fs/promises` keeps the loader
 * isomorphic enough to run from a Server Action / Next.js server
 * component at build time; the package itself stays non-React.
 */

import { readFile } from "node:fs/promises";
import { parseDesignMd } from "./parser.js";
import type { DesignTokens } from "./types.js";

export async function loadDesignTokens(
  filePath: string,
): Promise<DesignTokens> {
  let source: string;
  try {
    source = await readFile(filePath, "utf-8");
  } catch (cause) {
    const isMissing =
      typeof cause === "object" &&
      cause !== null &&
      (cause as { code?: string }).code === "ENOENT";
    if (isMissing) {
      throw new Error(`Design file not found: ${filePath}`);
    }
    throw cause;
  }
  return parseDesignMd(source);
}

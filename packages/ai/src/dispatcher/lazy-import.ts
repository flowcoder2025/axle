/**
 * Dynamic module loader used by handlers that adapt sibling workspace
 * packages (e.g. @axle/docgen, @axle/ocr, @axle/matching).
 *
 * We intentionally do NOT declare these as static dependencies of @axle/ai
 * to avoid a circular workspace graph (docgen already depends on @axle/ai).
 * At runtime, the consumer (apps/web) has all workspace packages installed,
 * so the dynamic specifier always resolves. The handler signature stays
 * strongly typed via the generic `T`.
 */
export async function loadModule<T>(specifier: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await (new Function("s", "return import(s)"))(specifier)) as unknown;
  return mod as T;
}

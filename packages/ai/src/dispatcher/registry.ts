import type { AiJobType } from "@prisma/client";
import {
  UnknownJobTypeError,
  type AiJobHandler,
} from "./types.js";

/**
 * Module-scoped handler registry.
 *
 * One handler per AiJobType. `registerHandler` is idempotent for the same
 * instance but will overwrite when a different handler registers for the
 * same type (useful for test doubles).
 */
const registry = new Map<AiJobType, AiJobHandler<unknown, unknown>>();

export function registerHandler<TInput, TOutput>(
  handler: AiJobHandler<TInput, TOutput>,
): void {
  registry.set(handler.type, handler as AiJobHandler<unknown, unknown>);
}

export function getHandler(type: AiJobType): AiJobHandler<unknown, unknown> {
  const handler = registry.get(type);
  if (!handler) throw new UnknownJobTypeError(type);
  return handler;
}

export function hasHandler(type: AiJobType): boolean {
  return registry.has(type);
}

export function listRegisteredTypes(): AiJobType[] {
  return Array.from(registry.keys());
}

/**
 * Test-only: remove all registered handlers.
 * Do not call from production code paths.
 */
export function resetRegistry(): void {
  registry.clear();
}

/**
 * Dispatch a job to its registered handler.
 * Throws UnknownJobTypeError if no handler exists for the type.
 * Propagates any error thrown by the handler unchanged.
 */
export async function dispatch(
  type: AiJobType,
  input: unknown,
): Promise<unknown> {
  const handler = getHandler(type);
  return handler.run(input);
}

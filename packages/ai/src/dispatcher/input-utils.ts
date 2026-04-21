import { InvalidJobInputError } from "./types.js";

/**
 * Narrow unknown input to a plain record. AiJob.input is stored as JSON so
 * we only know it's a non-null object at runtime.
 */
export function asRecord(input: unknown, jobType: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new InvalidJobInputError(
      `${jobType} handler expects an object input, got ${typeof input}`,
    );
  }
  return input as Record<string, unknown>;
}

export function requireString(
  record: Record<string, unknown>,
  key: string,
  jobType: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidJobInputError(
      `${jobType} handler requires non-empty string field '${key}'`,
    );
  }
  return value;
}

export function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

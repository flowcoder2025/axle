import { Prisma } from "@prisma/client";

/**
 * Safely formats a number[] as a pgvector literal string.
 * All values are validated to be finite to prevent injection.
 */
export function toVectorLiteral(embedding: number[]): string {
  if (embedding.some((v) => !Number.isFinite(v))) {
    throw new Error("Embedding contains non-finite values");
  }
  return `[${embedding.join(",")}]`;
}

/**
 * Validates an embedding array and returns a Prisma.Sql fragment
 * that can be interpolated directly into raw SQL queries as a ::vector cast.
 *
 * Usage: `${vectorParam(embedding)}` inside Prisma.sql template literals.
 */
export function vectorParam(embedding: number[]): Prisma.Sql {
  return Prisma.raw(`'${toVectorLiteral(embedding)}'::vector`);
}

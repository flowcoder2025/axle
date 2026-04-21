import type { AiJobType } from "@prisma/client";

/**
 * A handler is a thin adapter that knows how to execute a single AiJobType.
 *
 * The input is the opaque JSON payload from AiJob.input; each handler is
 * responsible for validating its own shape and for calling the underlying
 * engine (docgen / ocr / matching / AI provider).
 *
 * Handlers MUST NOT read or write AiJob rows — the orchestrator (the API
 * route) owns the DB record. Handlers are pure compute + external calls.
 */
export interface AiJobHandler<TInput = unknown, TOutput = unknown> {
  readonly type: AiJobType;
  run(input: TInput): Promise<TOutput>;
}

export class UnknownJobTypeError extends Error {
  readonly code = "UNKNOWN_JOB_TYPE" as const;
  constructor(public readonly jobType: string) {
    super(`No handler registered for AiJob type: ${jobType}`);
    this.name = "UnknownJobTypeError";
  }
}

export class InvalidJobInputError extends Error {
  readonly code = "INVALID_JOB_INPUT" as const;
  constructor(message: string) {
    super(message);
    this.name = "InvalidJobInputError";
  }
}

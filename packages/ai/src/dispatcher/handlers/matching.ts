import type { AiJobHandler } from "../types.js";
import { asRecord } from "../input-utils.js";
import { InvalidJobInputError } from "../types.js";
import { loadModule } from "../lazy-import.js";

interface MatchingInput {
  client: Record<string, unknown>;
  programs: Record<string, unknown>[];
}

interface MatchingModule {
  matchClientToPrograms: (
    client: Record<string, unknown>,
    programs: Record<string, unknown>[],
  ) => unknown;
}

export const matchingHandler: AiJobHandler<MatchingInput, unknown> = {
  type: "MATCHING",
  async run(input) {
    const rec = asRecord(input, "MATCHING");
    const client = rec.client;
    const programs = rec.programs;

    if (typeof client !== "object" || client === null || Array.isArray(client)) {
      throw new InvalidJobInputError("MATCHING handler: 'client' must be an object");
    }
    if (!Array.isArray(programs)) {
      throw new InvalidJobInputError("MATCHING handler: 'programs' must be an array");
    }

    const mod = await loadModule<MatchingModule>("@axle/matching");
    return mod.matchClientToPrograms(
      client as Record<string, unknown>,
      programs as Record<string, unknown>[],
    );
  },
};

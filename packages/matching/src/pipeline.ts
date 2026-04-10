import type { ClientProfile, ProgramProfile, MatchResult } from "./types.js";
import { stage1Disqualify } from "./stages/stage1-disqualify.js";
import { stage2Penalties } from "./stages/stage2-penalties.js";
import { stage3Scoring } from "./stages/stage3-scoring.js";

/**
 * Run the 3-stage matching pipeline for a client against a list of programs.
 * Returns results sorted by score descending (disqualified last).
 */
export function matchClientToPrograms(
  client: ClientProfile,
  programs: ProgramProfile[]
): MatchResult[] {
  const results: MatchResult[] = programs.map((program) => {
    const base = {
      programId: program.id,
      programName: program.name,
    };

    const s1 = stage1Disqualify(client, program);
    if (s1.disqualified) {
      return {
        ...base,
        score: 0,
        isDisqualified: true,
        disqualifyReasons: s1.reasons,
        penalties: [],
        matchReasons: [],
      };
    }

    const s2 = stage2Penalties(client, program);
    const s3 = stage3Scoring(client, program);
    const score = Math.max(0, Math.min(100, s3.score - s2.totalPenalty));

    return {
      ...base,
      score,
      isDisqualified: false,
      disqualifyReasons: [],
      penalties: s2.penalties,
      matchReasons: s3.reasons,
    };
  });

  // Sort: qualified first (by score desc), then disqualified
  return results.sort((a, b) => {
    if (a.isDisqualified !== b.isDisqualified) {
      return a.isDisqualified ? 1 : -1;
    }
    return b.score - a.score;
  });
}

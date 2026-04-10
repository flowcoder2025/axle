import { prisma } from "@axle/db";

export interface FeedbackInput {
  isRelevant: boolean;
  feedbackNote?: string;
}

export interface FeedbackStats {
  programId: string;
  total: number;
  relevant: number;
  notRelevant: number;
  accuracyRate: number; // 0-1
}

/**
 * Record user feedback on a MatchingResult.
 * isRelevant=true means the match was accurate; false means it was a poor match.
 */
export async function recordFeedback(
  matchId: string,
  isRelevant: boolean,
  notes?: string
): Promise<void> {
  await prisma.matchingResult.update({
    where: { id: matchId },
    data: {
      isRelevant,
      feedbackNote: notes ?? null,
    },
  });
}

/**
 * Compute feedback accuracy metrics for a given program.
 */
export async function getFeedbackStats(programId: string): Promise<FeedbackStats> {
  const results = await prisma.matchingResult.findMany({
    where: { programId, isRelevant: { not: null } },
    select: { isRelevant: true },
  });

  const total = results.length;
  const relevant = results.filter((r) => r.isRelevant === true).length;
  const notRelevant = total - relevant;
  const accuracyRate = total > 0 ? relevant / total : 0;

  return { programId, total, relevant, notRelevant, accuracyRate };
}

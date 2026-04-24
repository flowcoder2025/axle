/**
 * WI-322: BUNDLE 하위 프로젝트 진행률 롤업.
 *
 * Pure functions that compute progress metrics from Project + ChecklistItem
 * data. Kept dependency-free (no Prisma) so server pages can pass plain shapes
 * and unit tests can run fast.
 *
 * Progress model per child:
 *   1. If `status === "COMPLETED"` → 100% (explicit override).
 *   2. Else if the project has any checklist items → VERIFIED / total.
 *   3. Else → status-derived fallback (INTAKE 0% → APPROVED 90%).
 *
 * The three-tier fallback matters because many projects never populate a
 * checklist (the template may be missing, or the work is purely external).
 * Using just checklist ratio would leave those projects stuck at 0% even as
 * consultants progress through the state machine.
 */

import type { ProjectStatus, DocStatus } from "@prisma/client";

/** A checklist status we count as "done" for progress purposes. */
const DONE_CHECKLIST_STATUSES: ReadonlyArray<DocStatus> = ["VERIFIED"];

/**
 * Status-derived progress percent used when a project has no checklist items.
 * Values chosen so that COMPLETED is still the 100% anchor (handled earlier)
 * and APPROVED sits just below — consultants usually have a few housekeeping
 * tasks between APPROVED and COMPLETED, so 90% (not 100%) avoids suggesting
 * the project is fully wrapped.
 */
const STATUS_FALLBACK_PERCENT: Record<ProjectStatus, number> = {
  INTAKE: 0,
  DOC_COLLECTING: 15,
  IN_PROGRESS: 40,
  REVIEW: 60,
  SUBMITTED: 75,
  APPROVED: 90,
  REJECTED: 0,
  COMPLETED: 100,
};

export interface RollupChildInput {
  id: string;
  title: string;
  type: string; // ProjectType string
  status: ProjectStatus;
  checklistTotal: number;
  checklistDone: number; // count of items whose status is in DONE_CHECKLIST_STATUSES
  docsCount: number;
}

export interface RollupChildResult extends RollupChildInput {
  /** 0-100, integer. */
  progressPercent: number;
  /** Which rule produced `progressPercent` — useful for tests and future UI hints. */
  progressSource: "completed" | "checklist" | "status-fallback";
}

export interface RollupAggregate {
  /** Average of child `progressPercent`; 0 when no children. */
  avgProgress: number;
  /** Number of children with `status === "COMPLETED"`. */
  completedCount: number;
  /** Total child count. */
  totalCount: number;
  /** True when every child is COMPLETED (and there is at least one child). */
  allCompleted: boolean;
}

export function computeChildProgress(
  child: RollupChildInput,
): RollupChildResult {
  if (child.status === "COMPLETED") {
    return { ...child, progressPercent: 100, progressSource: "completed" };
  }
  if (child.checklistTotal > 0) {
    const pct = Math.round((child.checklistDone / child.checklistTotal) * 100);
    return {
      ...child,
      progressPercent: clamp(pct),
      progressSource: "checklist",
    };
  }
  return {
    ...child,
    progressPercent: STATUS_FALLBACK_PERCENT[child.status] ?? 0,
    progressSource: "status-fallback",
  };
}

export function computeBundleRollup(children: RollupChildInput[]): {
  children: RollupChildResult[];
  aggregate: RollupAggregate;
} {
  const results = children.map(computeChildProgress);
  if (results.length === 0) {
    return {
      children: results,
      aggregate: {
        avgProgress: 0,
        completedCount: 0,
        totalCount: 0,
        allCompleted: false,
      },
    };
  }
  const sum = results.reduce((acc, c) => acc + c.progressPercent, 0);
  const completedCount = results.filter((c) => c.status === "COMPLETED").length;
  return {
    children: results,
    aggregate: {
      avgProgress: Math.round(sum / results.length),
      completedCount,
      totalCount: results.length,
      allCompleted: completedCount === results.length,
    },
  };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

/**
 * Helper for Prisma includes: given a list of checklist items with
 * `{ status }`, returns the `checklistDone` count that matches our "done"
 * rule.
 */
export function countChecklistDone(items: Array<{ status: DocStatus }>): number {
  return items.filter((i) => DONE_CHECKLIST_STATUSES.includes(i.status)).length;
}

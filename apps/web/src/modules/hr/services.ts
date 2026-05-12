/**
 * `apps/flowteams` thin-shell wiring (WI-608).
 *
 * The app delegates every domain decision to `@axle/pbc-hr-payroll`
 * and only owns the factory that:
 *   - constructs the Korean leave allocation policy,
 *   - wires the Prisma store adapters to the shared @axle/db client,
 *   - stamps `organizationId` onto every store call,
 *   - injects a placeholder NomuAiClient until `packages/ai` ships
 *     the production-grade nomu chain (FlowTeams v1 안정화 후).
 *
 * The placeholder NomuAiClient returns a deterministic, citation-
 * bearing response so `validateNomuAnswer` passes — this is enough to
 * smoke-test the shell end-to-end without a live LLM call.
 */

import { prisma } from "@axle/db";
import {
  createAttendanceService,
  createKoreanLeavePolicy,
  createLeaveService,
  createNomuConsultationService,
  createPayrollService,
  createPrismaAttendanceStore,
  createPrismaLeaveStore,
  createPrismaNomuConsultationStore,
  createPrismaPayrollStore,
  type AttendanceServiceImpl,
  type AttendanceVerificationPolicy,
  type LeaveServiceImpl,
  type NomuAiClient,
  type NomuTopicCategory,
  type PayrollServiceImpl,
} from "@axle/pbc-hr-payroll";
import type { NomuConsultationService } from "@axle/pbc-hr-payroll";

export {
  // Pure functions — no per-org wiring needed; re-export verbatim.
  classifyNomuTopic,
  countLeaveDays,
  extractKoreanLaborLawCitations,
  redactNomuPii,
  renderStatementHtml,
  renderStatementMarkdown,
  validateNomuAnswer,
  verifyDefaultFlowTeamsAttendanceEnumMapping,
} from "@axle/pbc-hr-payroll";

const PRISMA_CLIENT = prisma as unknown as {
  attendance: Parameters<typeof createPrismaAttendanceStore>[0];
  leave: Parameters<typeof createPrismaLeaveStore>[0];
  nomuConsultation: Parameters<typeof createPrismaNomuConsultationStore>[0];
  payroll: Parameters<typeof createPrismaPayrollStore>[0];
};

const PLACEHOLDER_ANSWER_BY_TOPIC: Record<NomuTopicCategory, string> = {
  WAGE:
    "근로기준법 제56조에 따라 연장근로는 통상임금의 50%를 가산하여 지급해야 합니다. " +
    "최저임금법 제6조의 적용 여부도 함께 확인이 필요하며, 구체 사례는 노무사 자문을 권장드립니다.",
  ATTENDANCE:
    "근로기준법 제50조에 따라 1주 40시간을 기준으로 근태가 산정되며, 지각/조퇴 처리는 취업규칙에 명시된 바에 따라 적용됩니다. " +
    "징계가 동반되는 경우 근로기준법 제23조의 정당한 사유 요건을 함께 검토하시기 바랍니다.",
  LEAVE:
    "근로기준법 제60조에 따라 1년 미만 근속자는 월 1일씩 연차가 발생하며, 1년 이상은 15일이 부여됩니다. " +
    "출산휴가 90일은 남녀고용평등법 제18조에 따라 별도 보장됩니다.",
  DISMISSAL:
    "근로기준법 제23조에 따라 해고는 정당한 이유가 있어야 하며, 30일 전 예고가 원칙입니다. " +
    "부당해고 구제는 근로기준법 제28조의 노동위원회 절차를 따르시기 바랍니다.",
  DISCIPLINE:
    "근로기준법 제23조의 정당한 사유 + 취업규칙상 절차(소명 기회 부여, 양정의 비례성)를 충족해야 징계가 유효합니다. " +
    "구체 사례는 노무사 자문을 권장드립니다.",
  INSURANCE:
    "국민연금법 / 건강보험법 / 고용보험법 / 산업재해보상보험법 제5조에 따라 4대보험 가입 의무는 사업장 단위로 적용됩니다. " +
    "예외(일용·단시간) 기준은 별도 검토가 필요합니다.",
  CONTRACT:
    "근로기준법 제17조에 따라 근로계약서에는 임금·근로시간·휴일·연차 등 핵심 사항을 서면으로 명시해야 합니다. " +
    "수습기간 운영은 근로기준법 제35조의 적용 제외 요건을 함께 확인하시기 바랍니다.",
  OTHER:
    "구체적인 노무 자문은 사안별 사실관계가 중요합니다. 근로기준법 제17조의 서면 명시 의무를 우선 점검하시고, " +
    "필요 시 공인노무사 자문을 권장드립니다.",
};

/**
 * Placeholder NomuAiClient used until `packages/ai` provides the
 * production chain (FlowTeams v1 안정화 게이트). Returns a topic-
 * dependent, citation-bearing string so `validateNomuAnswer` passes.
 */
export function createPlaceholderNomuAiClient(): NomuAiClient {
  return {
    async generateAnswer({ topic }) {
      return {
        answer: PLACEHOLDER_ANSWER_BY_TOPIC[topic.category],
      };
    },
  };
}

export interface FlowTeamsServicesOptions {
  organizationId: string;
  /** Tenure resolver for the leave policy. Default returns 0. */
  tenureYearsResolver?: (userId: string) => number;
  /**
   * Verification policy for the attendance service. The placeholder
   * defaults below intentionally reject every check-in (the consumer
   * is expected to wire org-specific QR / IP / GPS / MANUAL policy).
   */
  attendanceVerificationPolicy?: AttendanceVerificationPolicy;
  /** Optional NomuAiClient override (production wires the @axle/ai impl). */
  nomuAi?: NomuAiClient;
}

export interface FlowTeamsServices {
  attendance: AttendanceServiceImpl;
  leave: LeaveServiceImpl;
  nomu: NomuConsultationService;
  payroll: PayrollServiceImpl;
}

const EMPTY_VERIFICATION_POLICY: AttendanceVerificationPolicy = {
  qr: { resolveExpectedCode: () => null },
  ip: { allowedIps: new Set() },
  gps: { geofences: [] },
  manual: { allowedApproverIds: new Set() },
};

export function createFlowTeamsServices(
  opts: FlowTeamsServicesOptions,
): FlowTeamsServices {
  const attendance = createAttendanceService({
    store: createPrismaAttendanceStore(PRISMA_CLIENT.attendance, {
      organizationId: opts.organizationId,
    }),
    policy:
      opts.attendanceVerificationPolicy ?? EMPTY_VERIFICATION_POLICY,
  });

  const leave = createLeaveService({
    store: createPrismaLeaveStore(PRISMA_CLIENT.leave, {
      organizationId: opts.organizationId,
    }),
    policy: createKoreanLeavePolicy(),
    resolveTenureYears: opts.tenureYearsResolver,
  });

  const nomu = createNomuConsultationService({
    store: createPrismaNomuConsultationStore(PRISMA_CLIENT.nomuConsultation),
    ai: opts.nomuAi ?? createPlaceholderNomuAiClient(),
  });

  const payroll = createPayrollService({
    prisma: createPrismaPayrollStore(PRISMA_CLIENT.payroll, {
      organizationId: opts.organizationId,
    }),
  });

  return { attendance, leave, nomu, payroll };
}

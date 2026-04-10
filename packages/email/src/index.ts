/**
 * @axle/email — Email/SMS sending with Resend + Solapi + unsubscribe
 *
 * Export map:
 *
 * Resend client:
 *   sendEmail, sendBatch, resetResendClient
 *
 * Solapi client:
 *   sendSms, sendAlimTalk, formatKoreanPhone
 *
 * Unified send:
 *   send
 *
 * Unsubscribe:
 *   generateUnsubscribeToken, verifyUnsubscribeToken, getUnsubscribeUrl
 *
 * Types:
 *   SendEmailOptions, SendSmsOptions, SendAlimTalkOptions,
 *   SendChannel, PrismaEmailLogDelegate, EmailLogCreateInput,
 *   SendPayload, SendEmailPayload, SendSmsPayload, SendAlimTalkPayload
 */

export const EMAIL_PACKAGE = "@axle/email" as const;

// Resend client
export { sendEmail, sendBatch, resetResendClient } from "./client.js";

// Solapi client
export { sendSms, sendAlimTalk, formatKoreanPhone } from "./solapi.js";

// Unified send
export { send } from "./send.js";
export type {
  SendEmailPayload,
  SendSmsPayload,
  SendAlimTalkPayload,
  SendPayload,
} from "./send.js";

// Unsubscribe
export {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  getUnsubscribeUrl,
} from "./unsubscribe.js";

// Types
export type {
  SendEmailOptions,
  SendSmsOptions,
  SendAlimTalkOptions,
  SendChannel,
  PrismaEmailLogDelegate,
  EmailLogCreateInput,
} from "./types.js";

// Email templates
export {
  docRequestEmail,
  docPushEmail,
  meetingSummaryEmail,
  estimateEmail,
  contractEmail,
  journalReminderEmail,
  deadlineAlertEmail,
  matchingDigestEmail,
  onboardingEmail,
} from "./templates/index.js";
export type {
  DocRequestEmailProps,
  DocPushEmailProps,
  MeetingSummaryEmailProps,
  EstimateEmailProps,
  EstimateItem,
  ContractEmailProps,
  JournalReminderEmailProps,
  DeadlineAlertEmailProps,
  MatchingDigestEmailProps,
  MatchItem,
  OnboardingEmailProps,
} from "./templates/index.js";

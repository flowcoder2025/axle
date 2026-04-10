/**
 * @axle/email — Shared types
 */

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendSmsOptions {
  to: string;
  text: string;
}

export interface SendAlimTalkOptions {
  to: string;
  templateId: string;
  variables: Record<string, string>;
}

export type SendChannel = "email" | "sms" | "kakao";

export interface SendOptions {
  channel: SendChannel;
  email?: SendEmailOptions;
  sms?: SendSmsOptions;
  alimtalk?: SendAlimTalkOptions;
}

/** Minimal Prisma-compatible EmailLog create interface */
export interface EmailLogCreateInput {
  channel: string;
  to: string;
  subject?: string | null;
  status: string;
  externalId?: string | null;
  error?: string | null;
}

export interface PrismaEmailLogDelegate {
  create(args: { data: EmailLogCreateInput }): Promise<{ id: string }>;
}

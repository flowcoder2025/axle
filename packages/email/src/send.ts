/**
 * @axle/email — Unified send function
 *
 * Routes to Resend (email) or Solapi (sms / kakao) based on channel.
 * Optionally records to an EmailLog table via a Prisma-compatible delegate.
 */

import { sendEmail } from "./client.js";
import { sendSms, sendAlimTalk } from "./solapi.js";
import type {
  SendEmailOptions,
  SendSmsOptions,
  SendAlimTalkOptions,
  PrismaEmailLogDelegate,
} from "./types.js";

export type { SendEmailOptions, SendSmsOptions, SendAlimTalkOptions };

// ── Overloaded call signatures ────────────────────────────────────────────────

export interface SendEmailPayload {
  channel: "email";
  options: SendEmailOptions;
  prisma?: PrismaEmailLogDelegate;
}

export interface SendSmsPayload {
  channel: "sms";
  options: SendSmsOptions;
  prisma?: PrismaEmailLogDelegate;
}

export interface SendAlimTalkPayload {
  channel: "kakao";
  options: SendAlimTalkOptions;
  prisma?: PrismaEmailLogDelegate;
}

export type SendPayload = SendEmailPayload | SendSmsPayload | SendAlimTalkPayload;

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Send a message on the specified channel.
 * Pass a Prisma `emailLog` delegate to persist a delivery record.
 *
 * @example
 * await send({ channel: "email", options: { to: "u@example.com", subject: "Hi", html: "<p>Hello</p>" } });
 * await send({ channel: "sms",   options: { to: "01012345678", text: "안녕하세요" } });
 */
export async function send(payload: SendPayload): Promise<void> {
  const { channel, options, prisma } = payload;

  let status = "sent";
  let externalId: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (channel === "email") {
      const emailOpts = options as SendEmailOptions;
      const result = await sendEmail(emailOpts);
      externalId = result.id;
    } else if (channel === "sms") {
      const smsOpts = options as SendSmsOptions;
      await sendSms(smsOpts.to, smsOpts.text);
    } else if (channel === "kakao") {
      const atOpts = options as SendAlimTalkOptions;
      await sendAlimTalk(atOpts.to, atOpts.templateId, atOpts.variables);
    } else {
      // Exhaustiveness guard
      throw new Error(`Unknown channel: ${String(channel)}`);
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    if (prisma) {
      const to =
        channel === "email"
          ? String(
              Array.isArray((options as SendEmailOptions).to)
                ? ((options as SendEmailOptions).to as string[]).join(",")
                : (options as SendEmailOptions).to
            )
          : (options as SendSmsOptions | SendAlimTalkOptions).to;

      const subject =
        channel === "email" ? (options as SendEmailOptions).subject : null;

      // Fire-and-forget — do not let logging failure surface to caller
      prisma
        .create({
          data: {
            channel,
            to,
            subject: subject ?? null,
            status,
            externalId: externalId ?? null,
            error: errorMessage ?? null,
          },
        })
        .catch(() => {
          // Swallow logging errors — delivery already succeeded or failed above
        });
    }
  }
}

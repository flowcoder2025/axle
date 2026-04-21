/**
 * password-reset — 비밀번호 재설정 안내 이메일 템플릿
 */

import { escapeHtml } from "./utils.js";

export interface PasswordResetEmailProps {
  resetUrl: string;
  /** Minutes until the token expires — shown in the body copy. */
  expiresInMinutes: number;
  /** Optional user-facing name; omit for generic greeting. */
  userName?: string;
}

export function passwordResetEmail(props: PasswordResetEmailProps): string {
  const greeting = props.userName
    ? `<strong>${escapeHtml(props.userName)}</strong>님,`
    : "안녕하세요,";

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a1a;">비밀번호 재설정 안내</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">AXLE 계정 보안</p>

    <p style="margin: 0 0 16px; line-height: 1.6;">
      ${greeting}<br>
      AXLE 계정의 비밀번호 재설정 요청이 접수되었습니다.<br>
      아래 버튼을 눌러 새로운 비밀번호를 설정해 주세요.
    </p>

    <a href="${props.resetUrl}"
       style="display: inline-block; padding: 14px 28px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; margin: 8px 0 16px;">
      비밀번호 재설정
    </a>

    <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
      이 링크는 발송 시점부터 <strong>${props.expiresInMinutes}분</strong> 동안 유효합니다.
    </p>
    <p style="margin: 0 0 18px; font-size: 13px; color: #6b7280;">
      버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여넣으세요.<br>
      <a href="${props.resetUrl}" style="color: #2563eb; word-break: break-all;">${props.resetUrl}</a>
    </p>

    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">

    <p style="margin: 0 0 6px; font-size: 13px; color: #9ca3af;">
      본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다. 기존 비밀번호는 변경되지 않으며, 계정은 안전하게 유지됩니다.
    </p>
    <p style="margin: 0; font-size: 13px; color: #9ca3af;">
      문제가 계속되면 support@axleai.io 로 문의해 주세요.
    </p>
  </div>
</div>`.trim();
}

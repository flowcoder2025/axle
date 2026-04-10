/**
 * contract — 계약서 발송 이메일 템플릿
 */

import { escapeHtml } from "./utils.js";

export interface ContractEmailProps {
  clientName: string;
  contractTitle: string;
  signUrl: string;
}

export function contractEmail(props: ContractEmailProps): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 24px; font-size: 22px; color: #1a1a1a;">계약서 서명 요청</h2>
    <p style="margin: 0 0 16px; line-height: 1.6;">
      안녕하세요, <strong>${escapeHtml(props.clientName)}</strong>님.<br>
      아래 계약서에 대한 전자 서명을 요청드립니다.
    </p>
    <div style="padding: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; margin: 0 0 24px;">
      <p style="margin: 0; font-weight: 600; color: #1a1a1a;">${escapeHtml(props.contractTitle)}</p>
    </div>
    <a href="${props.signUrl}"
       style="display: inline-block; padding: 12px 24px; background: #16a34a; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      계약서 검토 및 서명
    </a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">
      위 버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여넣으세요.<br>
      <a href="${props.signUrl}" style="color: #2563eb;">${props.signUrl}</a>
    </p>
    <p style="margin: 16px 0 0; font-size: 13px; color: #9ca3af;">
      본 이메일은 AXLE 플랫폼을 통해 자동 발송되었습니다.
    </p>
  </div>
</div>`.trim();
}

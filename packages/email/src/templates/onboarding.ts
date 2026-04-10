/**
 * onboarding — 온보딩 환영 이메일 템플릿
 */

import { escapeHtml } from "./utils.js";

export interface OnboardingEmailProps {
  clientName: string;
  consultantName: string;
  checklistItems: string[];
  portalUrl: string;
}

export function onboardingEmail(props: OnboardingEmailProps): string {
  const checklistRows = props.checklistItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px; vertical-align: middle; margin-right: 8px;"></span>
          ${escapeHtml(item)}
        </td>
      </tr>`
    )
    .join("");

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 8px; font-size: 24px; color: #1a1a1a;">AXLE에 오신 것을 환영합니다!</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #6b7280;">함께 성장하는 R&amp;D 파트너가 되겠습니다.</p>

    <p style="margin: 0 0 16px; line-height: 1.6;">
      안녕하세요, <strong>${escapeHtml(props.clientName)}</strong>님.<br>
      담당 컨설턴트 <strong>${escapeHtml(props.consultantName)}</strong>님이 배정되었습니다.<br>
      아래 온보딩 체크리스트를 완료하면 서비스 이용을 바로 시작할 수 있습니다.
    </p>

    <p style="margin: 0 0 10px; font-weight: 600;">시작 전 체크리스트</p>
    <table style="width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin: 0 0 24px;">
      <tbody>
        ${checklistRows}
      </tbody>
    </table>

    <a href="${props.portalUrl}"
       style="display: inline-block; padding: 14px 28px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px;">
      포털 바로가기
    </a>

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">
      위 버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여넣으세요.<br>
      <a href="${props.portalUrl}" style="color: #2563eb;">${props.portalUrl}</a>
    </p>
    <p style="margin: 20px 0 0; font-size: 13px; color: #9ca3af;">
      궁금한 사항이 있으시면 언제든지 ${escapeHtml(props.consultantName)} 컨설턴트에게 문의해주세요.
    </p>
  </div>
</div>`.trim();
}

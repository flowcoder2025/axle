/**
 * journal-reminder — 연구일지 리마인더 이메일 템플릿
 */

import { escapeHtml } from "./utils.js";

export interface JournalReminderEmailProps {
  researcherName: string;
  clientName: string;
  month: string;
  writeUrl: string;
}

export function journalReminderEmail(props: JournalReminderEmailProps): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 24px; font-size: 22px; color: #1a1a1a;">연구일지 작성 알림</h2>
    <p style="margin: 0 0 16px; line-height: 1.6;">
      안녕하세요, <strong>${escapeHtml(props.researcherName)}</strong>님.<br>
      <strong>${escapeHtml(props.clientName)}</strong>의 <strong>${escapeHtml(props.month)}</strong> 연구일지 작성 기한이 다가왔습니다.
    </p>
    <div style="padding: 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; margin: 0 0 24px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        연구일지는 정부과제 성과 평가의 핵심 자료입니다. 기한 내 작성을 완료해주세요.
      </p>
    </div>
    <a href="${props.writeUrl}"
       style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      연구일지 작성하기
    </a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">
      위 버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여넣으세요.<br>
      <a href="${props.writeUrl}" style="color: #2563eb;">${props.writeUrl}</a>
    </p>
  </div>
</div>`.trim();
}

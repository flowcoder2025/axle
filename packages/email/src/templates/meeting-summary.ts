/**
 * meeting-summary — 미팅 요약 이메일 템플릿
 */

export interface MeetingSummaryEmailProps {
  meetingTitle: string;
  date: string;
  attendees: string[];
  summary: string;
  actionItems: string[];
}

export function meetingSummaryEmail(props: MeetingSummaryEmailProps): string {
  const attendeeList = props.attendees
    .map((a) => `<li style="margin: 4px 0;">${a}</li>`)
    .join("");

  const actionList = props.actionItems
    .map((item, idx) => `<li style="margin: 8px 0;"><strong>${idx + 1}.</strong> ${item}</li>`)
    .join("");

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a1a;">미팅 요약</h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">${props.date}</p>

    <h3 style="margin: 0 0 8px; font-size: 16px;">${props.meetingTitle}</h3>

    <p style="margin: 0 0 6px; font-weight: 600;">참석자</p>
    <ul style="margin: 0 0 20px; padding-left: 20px; line-height: 1.6;">
      ${attendeeList}
    </ul>

    <p style="margin: 0 0 6px; font-weight: 600;">회의 내용 요약</p>
    <p style="margin: 0 0 20px; padding: 14px; background: #fff; border-left: 3px solid #2563eb; border-radius: 0 4px 4px 0; line-height: 1.7;">
      ${props.summary}
    </p>

    <p style="margin: 0 0 6px; font-weight: 600;">Action Items</p>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
      ${actionList}
    </ul>
  </div>
</div>`.trim();
}

/**
 * deadline-alert — 지원사업 마감 알림 이메일 템플릿
 */

export interface DeadlineAlertEmailProps {
  programName: string;
  deadline: string;
  daysRemaining: number;
  clientName: string;
}

export function deadlineAlertEmail(props: DeadlineAlertEmailProps): string {
  const urgencyColor = props.daysRemaining <= 3 ? "#dc2626" : props.daysRemaining <= 7 ? "#f59e0b" : "#2563eb";
  const urgencyBg = props.daysRemaining <= 3 ? "#fef2f2" : props.daysRemaining <= 7 ? "#fffbeb" : "#eff6ff";
  const urgencyBorder = props.daysRemaining <= 3 ? "#dc2626" : props.daysRemaining <= 7 ? "#f59e0b" : "#2563eb";

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 24px; font-size: 22px; color: #1a1a1a;">지원사업 마감 알림</h2>
    <p style="margin: 0 0 20px; line-height: 1.6;">
      안녕하세요, <strong>${props.clientName}</strong>님.<br>
      관심 지원사업의 마감이 임박했습니다.
    </p>
    <div style="padding: 20px; background: ${urgencyBg}; border-left: 4px solid ${urgencyBorder}; border-radius: 0 6px 6px 0; margin: 0 0 24px;">
      <p style="margin: 0 0 8px; font-weight: 700; font-size: 16px;">${props.programName}</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #374151;">
        마감일: <strong>${props.deadline}</strong>
      </p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${urgencyColor};">
        D-${props.daysRemaining}
      </p>
    </div>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; line-height: 1.6;">
      마감 전에 필요한 서류를 준비하고 신청을 완료해주세요.<br>
      준비 현황이 궁금하시면 담당 컨설턴트에게 문의해주세요.
    </p>
    <p style="margin: 0; font-size: 13px; color: #9ca3af;">
      본 알림은 AXLE 플랫폼의 맞춤 알림 서비스입니다.
    </p>
  </div>
</div>`.trim();
}

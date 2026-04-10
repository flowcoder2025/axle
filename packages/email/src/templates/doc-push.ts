/**
 * doc-push — 서류 제출 알림 이메일 템플릿
 */

export interface DocPushEmailProps {
  clientName: string;
  documentName: string;
  uploaderName: string;
}

export function docPushEmail(props: DocPushEmailProps): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 24px; font-size: 22px; color: #1a1a1a;">서류 제출 알림</h2>
    <p style="margin: 0 0 16px; line-height: 1.6;">
      안녕하세요, <strong>${props.clientName}</strong>님.<br>
      새 서류가 제출되었습니다.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
      <tr>
        <td style="padding: 10px 12px; background: #e5e7eb; font-weight: 600; border-radius: 4px 0 0 4px; width: 120px;">서류명</td>
        <td style="padding: 10px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 0 4px 4px 0;">${props.documentName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; background: #e5e7eb; font-weight: 600; border-radius: 4px 0 0 4px; margin-top: 4px;">제출자</td>
        <td style="padding: 10px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 0 4px 4px 0;">${props.uploaderName}</td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 13px; color: #6b7280;">
      AXLE 포털에서 제출된 서류를 확인하고 검토해주세요.
    </p>
  </div>
</div>`.trim();
}

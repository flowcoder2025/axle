/**
 * doc-request — 서류 요청 이메일 템플릿
 */

export interface DocRequestEmailProps {
  clientName: string;
  projectName: string;
  items: string[];
  uploadUrl: string;
}

export function docRequestEmail(props: DocRequestEmailProps): string {
  const itemList = props.items
    .map((item) => `<li style="margin: 6px 0;">${item}</li>`)
    .join("");

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 24px; font-size: 22px; color: #1a1a1a;">서류 요청</h2>
    <p style="margin: 0 0 16px; line-height: 1.6;">
      안녕하세요, <strong>${props.clientName}</strong>님.<br>
      <strong>${props.projectName}</strong> 프로젝트 진행을 위해 아래 서류가 필요합니다.
    </p>
    <ul style="margin: 0 0 24px; padding-left: 20px; line-height: 1.8;">
      ${itemList}
    </ul>
    <a href="${props.uploadUrl}"
       style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      서류 업로드하기
    </a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">
      위 버튼이 작동하지 않으면 아래 링크를 복사해 브라우저에 붙여넣으세요.<br>
      <a href="${props.uploadUrl}" style="color: #2563eb;">${props.uploadUrl}</a>
    </p>
  </div>
</div>`.trim();
}

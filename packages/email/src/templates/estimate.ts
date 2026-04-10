/**
 * estimate — 견적서 발송 이메일 템플릿
 */

import { escapeHtml } from "./utils.js";

export interface EstimateItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface EstimateEmailProps {
  clientName: string;
  estimateNumber: string;
  items: EstimateItem[];
  totalAmount: number;
  validUntil: string;
  downloadUrl: string;
}

function formatKRW(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

export function estimateEmail(props: EstimateEmailProps): string {
  const itemRows = props.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatKRW(item.unitPrice)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatKRW(item.amount)}</td>
      </tr>`
    )
    .join("");

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a1a;">견적서</h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">견적번호: ${escapeHtml(props.estimateNumber)}</p>

    <p style="margin: 0 0 20px; line-height: 1.6;">
      안녕하세요, <strong>${escapeHtml(props.clientName)}</strong>님.<br>
      요청하신 견적서를 보내드립니다. 유효기간은 <strong>${escapeHtml(props.validUntil)}</strong>까지입니다.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px; background: #fff; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background: #1e3a5f; color: #fff;">
          <th style="padding: 12px; text-align: left;">항목</th>
          <th style="padding: 12px; text-align: right;">수량</th>
          <th style="padding: 12px; text-align: right;">단가</th>
          <th style="padding: 12px; text-align: right;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tfoot>
        <tr style="background: #f0f4ff;">
          <td colspan="3" style="padding: 12px; font-weight: 700; text-align: right;">합계</td>
          <td style="padding: 12px; font-weight: 700; text-align: right; color: #2563eb;">${formatKRW(props.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>

    <a href="${props.downloadUrl}"
       style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      견적서 다운로드
    </a>
    <p style="margin: 20px 0 0; font-size: 13px; color: #6b7280;">
      문의사항이 있으시면 담당 컨설턴트에게 연락해주세요.
    </p>
  </div>
</div>`.trim();
}

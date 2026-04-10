/**
 * matching-digest — 매칭 다이제스트 이메일 템플릿
 */

import { escapeHtml } from "./utils.js";

export interface MatchItem {
  programName: string;
  score: number;
  reason: string;
}

export interface MatchingDigestEmailProps {
  matches: MatchItem[];
  consultantName: string;
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  const blocks = Array.from({ length: 10 }, (_, i) =>
    `<span style="display: inline-block; width: 16px; height: 8px; border-radius: 2px; margin-right: 2px; background: ${i < filled ? "#2563eb" : "#e5e7eb"};"></span>`
  ).join("");
  return `<span style="vertical-align: middle;">${blocks}</span> <span style="font-size: 13px; color: #6b7280;">${score}점</span>`;
}

export function matchingDigestEmail(props: MatchingDigestEmailProps): string {
  const matchCards = props.matches
    .map(
      (match, idx) => `
      <div style="padding: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span style="font-size: 12px; font-weight: 600; color: #2563eb; background: #eff6ff; padding: 2px 8px; border-radius: 999px;">#${idx + 1}</span>
        </div>
        <p style="margin: 8px 0 6px; font-weight: 700; font-size: 15px;">${escapeHtml(match.programName)}</p>
        <div style="margin: 0 0 8px;">${scoreBar(match.score)}</div>
        <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">${escapeHtml(match.reason)}</p>
      </div>`
    )
    .join("");

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #f8f9fa; padding: 32px; border-radius: 8px;">
    <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a1a;">맞춤 지원사업 매칭 결과</h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
      <strong>${escapeHtml(props.consultantName)}</strong> 컨설턴트가 분석한 추천 프로그램입니다.
    </p>
    ${matchCards}
    <p style="margin: 16px 0 0; font-size: 13px; color: #9ca3af;">
      더 자세한 내용은 담당 컨설턴트에게 문의해주세요.
    </p>
  </div>
</div>`.trim();
}

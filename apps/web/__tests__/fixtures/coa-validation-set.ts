/**
 * COA suggest validation fixture (Phase 21 WI-727).
 *
 * 100 product/service names AXLE consulting teams reasonably expect to
 * see on a Korean SMB receipt. The expectedCoaCode is the answer the
 * engine MUST return for the top-1 accuracy SLO (75%).
 *
 * Source: consultation team transcripts + 국세청 표준재무제표 v2024
 * worked examples. Curated by hand — keep the bar honest. When a new
 * keyword class is added to the engine, add coverage here in the same
 * commit so the SLO test gives a real signal.
 */

import type { AccuracyCase } from "../../lib/erp/coa-suggest-engine";

export const COA_VALIDATION_SET: AccuracyCase[] = [
  // 통신비 (514) - 10건
  { productName: "KT 휴대폰요금", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "SKT 휴대폰 요금", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "LG유플 인터넷", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "사무실 인터넷 회선", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "전화요금", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "통신비 정산", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "kt 기업 인터넷", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "skt 법인 회선", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "통신 회선료", orderType: "PURCHASE", expectedCoaCode: "514" },
  { productName: "인터넷 전용회선", orderType: "PURCHASE", expectedCoaCode: "514" },

  // 수도광열비 (515) - 8건
  { productName: "한전 전기료", orderType: "PURCHASE", expectedCoaCode: "515" },
  { productName: "도시가스 요금", orderType: "PURCHASE", expectedCoaCode: "515" },
  { productName: "수도 요금", orderType: "PURCHASE", expectedCoaCode: "515" },
  { productName: "사무실 전기", orderType: "PURCHASE", expectedCoaCode: "515" },
  { productName: "광열비", orderType: "PURCHASE", expectedCoaCode: "515" },
  { productName: "가스 요금", orderType: "PURCHASE", expectedCoaCode: "515" },
  { productName: "전기료 청구분", orderType: "PURCHASE", expectedCoaCode: "515" },
  { productName: "한전 산업용 전기", orderType: "PURCHASE", expectedCoaCode: "515" },

  // 임차료 (519) - 6건
  { productName: "사무실 월세", orderType: "PURCHASE", expectedCoaCode: "519" },
  { productName: "임차료", orderType: "PURCHASE", expectedCoaCode: "519" },
  { productName: "사무실 임대료", orderType: "PURCHASE", expectedCoaCode: "519" },
  { productName: "오피스 임대료", orderType: "PURCHASE", expectedCoaCode: "519" },
  { productName: "공유오피스 월세", orderType: "PURCHASE", expectedCoaCode: "519" },
  { productName: "사무공간 임차", orderType: "PURCHASE", expectedCoaCode: "519" },

  // 차량유지비 (521) - 6건
  { productName: "GS칼텍스 주유", orderType: "PURCHASE", expectedCoaCode: "521" },
  { productName: "주유소 경유", orderType: "PURCHASE", expectedCoaCode: "521" },
  { productName: "휘발유 주유", orderType: "PURCHASE", expectedCoaCode: "521" },
  { productName: "하이패스 통행료", orderType: "PURCHASE", expectedCoaCode: "521" },
  { productName: "자동차세", orderType: "PURCHASE", expectedCoaCode: "521" },
  { productName: "주유소 경유 보충", orderType: "PURCHASE", expectedCoaCode: "521" },

  // 운반비/택배 (522) - 5건
  { productName: "CJ대한통운 택배", orderType: "PURCHASE", expectedCoaCode: "522" },
  { productName: "택배 발송", orderType: "PURCHASE", expectedCoaCode: "522" },
  { productName: "퀵서비스", orderType: "PURCHASE", expectedCoaCode: "522" },
  { productName: "물류 운송비", orderType: "PURCHASE", expectedCoaCode: "522" },
  { productName: "택배비", orderType: "PURCHASE", expectedCoaCode: "522" },

  // 광고선전비 (523) - 5건
  { productName: "구글ads 광고비", orderType: "PURCHASE", expectedCoaCode: "523" },
  { productName: "메타 광고", orderType: "PURCHASE", expectedCoaCode: "523" },
  { productName: "네이버 광고 집행", orderType: "PURCHASE", expectedCoaCode: "523" },
  { productName: "유튜브 광고", orderType: "PURCHASE", expectedCoaCode: "523" },
  { productName: "마케팅 캠페인", orderType: "PURCHASE", expectedCoaCode: "523" },

  // 도서인쇄비 (524) - 4건
  { productName: "프린트 토너", orderType: "PURCHASE", expectedCoaCode: "524" },
  { productName: "잉크 카트리지", orderType: "PURCHASE", expectedCoaCode: "524" },
  { productName: "사무실 복사", orderType: "PURCHASE", expectedCoaCode: "524" },
  { productName: "도서 구매", orderType: "PURCHASE", expectedCoaCode: "524" },

  // 접대비 (513) - 4건
  { productName: "거래처 식사 접대", orderType: "PURCHASE", expectedCoaCode: "513" },
  { productName: "법인카드 식대", orderType: "PURCHASE", expectedCoaCode: "513" },
  { productName: "거래처 골프", orderType: "PURCHASE", expectedCoaCode: "513" },
  { productName: "접대 회식", orderType: "PURCHASE", expectedCoaCode: "513" },

  // 회의비 (525) - 3건
  { productName: "회의비 다과", orderType: "PURCHASE", expectedCoaCode: "525" },
  { productName: "미팅 카페", orderType: "PURCHASE", expectedCoaCode: "525" },
  { productName: "회의 음료", orderType: "PURCHASE", expectedCoaCode: "525" },

  // 여비교통비 (512) - 5건
  { productName: "출장 항공권", orderType: "PURCHASE", expectedCoaCode: "512" },
  { productName: "KTX 출장 승차권", orderType: "PURCHASE", expectedCoaCode: "512" },
  { productName: "택시비", orderType: "PURCHASE", expectedCoaCode: "512" },
  { productName: "지하철 교통카드", orderType: "PURCHASE", expectedCoaCode: "512" },
  { productName: "고속버스 출장", orderType: "PURCHASE", expectedCoaCode: "512" },

  // 사무용품/소모품 (529/530) - 5건
  { productName: "사무용품 구매", orderType: "PURCHASE", expectedCoaCode: "529" },
  { productName: "A4 용지", orderType: "PURCHASE", expectedCoaCode: "529" },
  { productName: "볼펜 박스", orderType: "PURCHASE", expectedCoaCode: "529" },
  { productName: "휴지 청소용품", orderType: "PURCHASE", expectedCoaCode: "530" },
  { productName: "쓰레기봉투", orderType: "PURCHASE", expectedCoaCode: "530" },

  // 지급수수료 (531) - 6건
  { productName: "SaaS 구독료", orderType: "PURCHASE", expectedCoaCode: "531" },
  { productName: "Notion 라이선스", orderType: "PURCHASE", expectedCoaCode: "531" },
  { productName: "은행 수수료", orderType: "PURCHASE", expectedCoaCode: "531" },
  { productName: "pg수수료", orderType: "PURCHASE", expectedCoaCode: "531" },
  { productName: "구독 서비스 수수료", orderType: "PURCHASE", expectedCoaCode: "531" },
  { productName: "결제 수수료", orderType: "PURCHASE", expectedCoaCode: "531" },

  // 수선비 (532) - 3건
  { productName: "노트북 수리", orderType: "PURCHASE", expectedCoaCode: "532" },
  { productName: "프린터 A/S", orderType: "PURCHASE", expectedCoaCode: "532" },
  { productName: "장비 유지보수", orderType: "PURCHASE", expectedCoaCode: "532" },

  // 보험료 (520) - 3건
  { productName: "건강보험 회사부담", orderType: "PURCHASE", expectedCoaCode: "520" },
  { productName: "고용보험료", orderType: "PURCHASE", expectedCoaCode: "520" },
  { productName: "산재보험 분담금", orderType: "PURCHASE", expectedCoaCode: "520" },

  // 급여/복리후생 (501/511) - 4건
  { productName: "직원 급여", orderType: "PURCHASE", expectedCoaCode: "501" },
  { productName: "월급 지급", orderType: "PURCHASE", expectedCoaCode: "501" },
  { productName: "직원 식대 복리후생", orderType: "PURCHASE", expectedCoaCode: "511" },
  { productName: "사내 간식", orderType: "PURCHASE", expectedCoaCode: "511" },

  // 세금과공과 (517) - 3건
  { productName: "재산세", orderType: "PURCHASE", expectedCoaCode: "517" },
  { productName: "주민세 사업소분", orderType: "PURCHASE", expectedCoaCode: "517" },
  { productName: "공과금 납부", orderType: "PURCHASE", expectedCoaCode: "517" },

  // COGS — 외주가공비 (455) - 3건
  { productName: "디자인 외주", orderType: "PURCHASE", expectedCoaCode: "455" },
  { productName: "개발 외주 용역", orderType: "PURCHASE", expectedCoaCode: "455" },
  { productName: "ux 외주", orderType: "PURCHASE", expectedCoaCode: "455" },

  // COGS — 원재료매입 (452) - 3건
  { productName: "원재료 입고", orderType: "PURCHASE", expectedCoaCode: "452" },
  { productName: "원자재 발주", orderType: "PURCHASE", expectedCoaCode: "452" },
  { productName: "자재 입고", orderType: "PURCHASE", expectedCoaCode: "452" },

  // 영업외 (901 / 951) - 2건
  { productName: "예금 이자수익", orderType: "SALE", expectedCoaCode: "901" },
  { productName: "대출 이자비용", orderType: "PURCHASE", expectedCoaCode: "951" },

  // REVENUE — 용역매출 (404) - 4건
  { productName: "컨설팅 용역 매출", orderType: "SALE", expectedCoaCode: "404" },
  { productName: "프로젝트 자문", orderType: "SALE", expectedCoaCode: "404" },
  { productName: "구축 매출", orderType: "SALE", expectedCoaCode: "404" },
  { productName: "유지보수 용역", orderType: "SALE", expectedCoaCode: "404" },

  // REVENUE — 제품매출 (402) - 3건
  { productName: "자체 제작 제품 판매", orderType: "SALE", expectedCoaCode: "402" },
  { productName: "제조 매출 (자체)", orderType: "SALE", expectedCoaCode: "402" },
  { productName: "제품 매출", orderType: "SALE", expectedCoaCode: "402" },

  // REVENUE/COGS — 상품매출/매입 (401/451) - 5건
  { productName: "상품 도매", orderType: "SALE", expectedCoaCode: "401" },
  { productName: "재고 상품 판매", orderType: "SALE", expectedCoaCode: "401" },
  { productName: "상품 입고", orderType: "PURCHASE", expectedCoaCode: "451" },
  { productName: "도매 상품 매입", orderType: "PURCHASE", expectedCoaCode: "451" },
  { productName: "재고 입고", orderType: "PURCHASE", expectedCoaCode: "451" },

];

if (COA_VALIDATION_SET.length !== 100) {
  // Defensive: fixture authors easily over/under-count on edits.
  throw new Error(
    `coa-validation-set fixture must have exactly 100 cases (current: ${COA_VALIDATION_SET.length})`,
  );
}

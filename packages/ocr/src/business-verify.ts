import type { BusinessVerifyResult } from "./types.js";

const NTS_API_URL =
  "https://api.odcloud.kr/api/nts-businessman/v1/status";

/** Strip dashes/spaces and validate 10-digit format */
function normalizeBusinessNumber(raw: string): string {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) {
    throw new Error(
      `Invalid business number format: "${raw}". Must be 10 digits (with or without dashes).`
    );
  }
  return digits;
}

interface NtsBusinessItem {
  b_no: string;
  b_stt: string;
  b_stt_cd: string;
  tax_type: string;
  tax_type_cd: string;
  end_dt: string;
  utcc_yn: string;
  tax_type_change_dt: string;
  invoice_apply_dt: string;
  rbf_tax_type: string;
  rbf_tax_type_cd: string;
}

interface NtsResponse {
  status_code: string;
  request_cnt: number;
  valid_cnt: number;
  data: NtsBusinessItem[];
}

function mapStatus(
  bSttCd: string
): "정상" | "휴업" | "폐업" {
  switch (bSttCd) {
    case "01":
      return "정상";
    case "02":
      return "휴업";
    case "03":
      return "폐업";
    default:
      // treat unknown codes as 폐업 (conservative)
      return "폐업";
  }
}

export async function verifyBusinessNumber(
  businessNumber: string
): Promise<BusinessVerifyResult> {
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    throw new Error("DATA_GO_KR_API_KEY environment variable is not set");
  }

  const normalized = normalizeBusinessNumber(businessNumber);

  const url = `${NTS_API_URL}?serviceKey=${encodeURIComponent(apiKey)}&returnType=JSON`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ b_no: [normalized] }),
  });

  if (!response.ok) {
    throw new Error(
      `NTS API request failed: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as NtsResponse;

  if (
    !body.data ||
    !Array.isArray(body.data) ||
    body.data.length === 0
  ) {
    // API returned no data — treat as invalid/not found
    return { valid: false, status: "폐업" };
  }

  const item = body.data[0];
  const status = mapStatus(item.b_stt_cd);
  const valid = status === "정상";

  return {
    valid,
    status,
  };
}

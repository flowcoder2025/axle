/**
 * WI-617 — Pack/module catalog source of truth for the platform UI.
 *
 * Mirrors `wireframes/module-catalog.md` (35 modules grouped into 6 packs).
 * Keeps the catalog declarative so the settings page, billing summary, and
 * sidebar (WI-618) all read from one shape.
 *
 * Note: this is the *catalog* (what's available to install). Whether an org
 * has actually installed a given pack/module lives in `OrgModuleInstall`.
 */

export interface CatalogModule {
  id: string;
  label: string;
  /** True when the module participates in Multi-org tenancy (★ in the spec). */
  multiOrg: boolean;
  /** True when the module is admin-only (e.g. HWPX templates). */
  admin?: boolean;
}

export interface CatalogPack {
  id: "A" | "B" | "D" | "E" | "F" | "G";
  /** Korean display title (e.g. "Pack A. 비즈니스 운영"). */
  title: string;
  icon: string;
  /** Two-tone gradient accent for the card header icon. */
  accentColor: string;
  /** One-line audience hint shown under the title. */
  audience: string;
  description: string;
  modules: CatalogModule[];
  pricing: {
    monthly: number;
    /** Free-form suffix (e.g. "+ 직원 수", "+ 크레딧", "Desktop 라이선스 포함"). */
    pricingNote?: string;
  };
  recommended?: boolean;
}

export const PACK_CATALOG: CatalogPack[] = [
  {
    id: "A",
    title: "Pack A. 비즈니스 운영",
    icon: "💼",
    accentColor: "#2563EB",
    audience: "default 추천 — 모든 조직",
    description:
      "사내 운영부터 외부 거래까지. clientId/projectId 모두 nullable.",
    modules: [
      { id: "customers", label: "고객/거래처", multiOrg: false },
      { id: "projects", label: "프로젝트", multiOrg: false },
      { id: "estimates", label: "견적", multiOrg: false },
      { id: "contracts", label: "계약", multiOrg: false },
      { id: "documents", label: "서류 + OCR", multiOrg: false },
      { id: "portal-admin", label: "외부 포털", multiOrg: false },
      { id: "calendar", label: "일정", multiOrg: false },
      { id: "meetings", label: "미팅", multiOrg: false },
      { id: "finance", label: "재무", multiOrg: true },
      { id: "analytics", label: "분석 리포트", multiOrg: true },
    ],
    pricing: { monthly: 59_000 },
    recommended: true,
  },
  {
    id: "B",
    title: "Pack B. 정부 지원사업",
    icon: "🏛️",
    accentColor: "#16A34A",
    audience: "정부 R&D / 창업 지원 대응",
    description:
      "기업마당+K-Startup 크롤 + AI 매칭 + R&D 일지. HWPX 양식 자동 채움.",
    modules: [
      { id: "programs", label: "지원사업", multiOrg: false },
      { id: "matching", label: "AI 매칭", multiOrg: true },
      { id: "journals", label: "연구일지", multiOrg: true },
      { id: "hwpx-admin", label: "HWPX 양식", multiOrg: false, admin: true },
      {
        id: "checklist-admin",
        label: "체크리스트",
        multiOrg: false,
        admin: true,
      },
      {
        id: "ai-patterns-admin",
        label: "AI 패턴",
        multiOrg: false,
        admin: true,
      },
    ],
    pricing: { monthly: 39_000 },
  },
  {
    id: "D",
    title: "Pack D. HR",
    icon: "👥",
    accentColor: "#A78BFA",
    audience: "직원 5명 이상 OR HR 위탁 운영",
    description: "급여·근태·연차·노무. 4대보험 자동 계산, 한국 노동법 인용.",
    modules: [
      { id: "employees", label: "직원", multiOrg: true },
      { id: "payroll", label: "급여", multiOrg: true },
      { id: "attendance", label: "근태", multiOrg: true },
      { id: "leave", label: "연차", multiOrg: true },
      { id: "nomu", label: "노무", multiOrg: true },
    ],
    pricing: { monthly: 49_000, pricingNote: "+ 직원 수" },
  },
  {
    id: "E",
    title: "Pack E. 콘텐츠",
    icon: "🎨",
    accentColor: "#EC4899",
    audience: "마케터 / 이커머스",
    description:
      "이미지 7개 모드 + 상세페이지 23블록 빌더. (Single-org 전용 — 본인 작업물)",
    modules: [
      { id: "create", label: "이미지 생성", multiOrg: false },
      { id: "builder", label: "빌더", multiOrg: false },
      { id: "presets", label: "프리셋", multiOrg: false },
      { id: "workflows", label: "ComfyUI", multiOrg: false, admin: true },
    ],
    pricing: { monthly: 59_000, pricingNote: "+ 크레딧" },
  },
  {
    id: "F",
    title: "Pack F. ERP",
    icon: "📦",
    accentColor: "#F59E0B",
    audience: "도소매 / 제조업",
    description: "재고·주문·배송·발주·거래처·리포트. 1년 후 PBC 추출 예정.",
    modules: [
      { id: "products", label: "상품", multiOrg: false },
      { id: "inventory", label: "재고", multiOrg: false },
      { id: "erp-customers", label: "거래처", multiOrg: false },
      { id: "orders", label: "주문", multiOrg: false },
      { id: "shipping", label: "배송", multiOrg: false },
      { id: "purchase", label: "발주", multiOrg: false },
      { id: "erp-reports", label: "리포트", multiOrg: false },
    ],
    pricing: { monthly: 89_000 },
  },
  {
    id: "G",
    title: "Add-on G. Desktop",
    icon: "🖥️",
    accentColor: "#64748B",
    audience: "OS 권한 필요 (Electron 앱)",
    description:
      "포털 자동화 (Hometax/Minwon24/4대보험/Venturein/Koita) + 공동인증서 + 녹취.",
    modules: [
      { id: "automation", label: "포털 자동화", multiOrg: false },
      { id: "certs", label: "공동인증서", multiOrg: false },
      { id: "recording", label: "녹취", multiOrg: false },
    ],
    pricing: { monthly: 29_000, pricingNote: "Desktop 라이선스 포함" },
  },
];

/** Set of all known pack ids — used for zod enum validation. */
export const PACK_IDS = ["A", "B", "D", "E", "F", "G"] as const;

/** Set of all known module ids across every pack. */
export const ALL_MODULE_IDS = PACK_CATALOG.flatMap((p) =>
  p.modules.map((m) => m.id),
);

export function getPack(id: string): CatalogPack | undefined {
  return PACK_CATALOG.find((p) => p.id === id);
}

export function getModule(
  id: string,
): { pack: CatalogPack; module: CatalogModule } | undefined {
  for (const pack of PACK_CATALOG) {
    const found = pack.modules.find((m) => m.id === id);
    if (found) return { pack, module: found };
  }
  return undefined;
}

export interface CatalogSummary {
  activePackCount: number;
  activeModuleCount: number;
  monthlyTotal: number;
  /** Always 0 in this WI — wired up by WI-620 (Multi-org tenancy). */
  managedOrgCount: number;
}

/**
 * Aggregate billing-style summary for the catalog header cards.
 * A Pack is "active" when ALL of its modules are installed; otherwise we
 * only count the individually-installed modules toward `activeModuleCount`.
 */
export function summarize(
  installedModules: ReadonlyArray<string>,
): CatalogSummary {
  const installed = new Set(installedModules);
  let activePackCount = 0;
  let monthlyTotal = 0;
  for (const pack of PACK_CATALOG) {
    const allInstalled = pack.modules.every((m) => installed.has(m.id));
    if (allInstalled) {
      activePackCount += 1;
      monthlyTotal += pack.pricing.monthly;
    }
  }
  const activeModuleCount = PACK_CATALOG.flatMap((p) => p.modules).filter((m) =>
    installed.has(m.id),
  ).length;
  return {
    activePackCount,
    activeModuleCount,
    monthlyTotal,
    managedOrgCount: 0,
  };
}

export function formatPrice(monthly: number, note?: string): string {
  const won = `₩${monthly.toLocaleString("ko-KR")}`;
  return note ? `${won} / 월 ${note}` : `${won} / 월`;
}

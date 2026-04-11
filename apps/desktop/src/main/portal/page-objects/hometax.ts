/**
 * HomeTax (홈택스) portal page-object stub.
 *
 * Phase 15: interface + stub implementation.
 * Real automation (Playwright) will be wired in a future phase.
 */

export interface HometaxCredentials {
  userId: string;
  password: string;
  /** Optional: resident registration number for cert login */
  rrn?: string;
}

export interface HometaxTaxInfo {
  year: number;
  corporateTax?: number;
  vatAmount?: number;
  incomeAmount?: number;
  fetchedAt: string;
}

export interface HometaxCertStatus {
  issuer: string;
  validTo: string;
  isRegistered: boolean;
}

export interface IHometaxPageObject {
  login(credentials: HometaxCredentials): Promise<{ sessionToken: string }>;
  fetchTaxInfo(year: number): Promise<HometaxTaxInfo>;
  checkCertStatus(): Promise<HometaxCertStatus>;
  logout(): Promise<void>;
}

export class HometaxPageObject implements IHometaxPageObject {
  private readonly baseUrl = "https://www.hometax.go.kr";
  private sessionToken: string | null = null;

  async login(credentials: HometaxCredentials): Promise<{ sessionToken: string }> {
    // Stub: real impl would launch Playwright browser with stealth plugin
    // and navigate to https://www.hometax.go.kr/ui/pp/index.html
    void credentials;
    this.sessionToken = `hometax-stub-${Date.now()}`;
    return { sessionToken: this.sessionToken };
  }

  async fetchTaxInfo(year: number): Promise<HometaxTaxInfo> {
    if (!this.sessionToken) throw new Error("Not logged in");
    // Stub: real impl would navigate to tax inquiry page and scrape table
    return {
      year,
      corporateTax: undefined,
      vatAmount: undefined,
      incomeAmount: undefined,
      fetchedAt: new Date().toISOString(),
    };
  }

  async checkCertStatus(): Promise<HometaxCertStatus> {
    if (!this.sessionToken) throw new Error("Not logged in");
    return {
      issuer: "Unknown",
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isRegistered: false,
    };
  }

  async logout(): Promise<void> {
    this.sessionToken = null;
  }
}

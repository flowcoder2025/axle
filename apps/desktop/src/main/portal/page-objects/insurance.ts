/**
 * 4대보험 (National Insurance) portal page-object stub.
 * Phase 15: interface + stub implementation.
 */

export interface InsuranceCredentials {
  userId: string;
  password: string;
  businessNumber: string;
}

export interface InsuranceContribution {
  year: number;
  month: number;
  nationalPension: number;
  healthInsurance: number;
  employmentInsurance: number;
  industrialAccident: number;
  total: number;
}

export interface InsuranceEmployee {
  name: string;
  rrn: string;
  enrollDate: string;
  resignDate?: string;
}

export interface IInsurancePageObject {
  login(credentials: InsuranceCredentials): Promise<{ sessionToken: string }>;
  fetchContributions(year: number, month: number): Promise<InsuranceContribution>;
  fetchEmployeeList(): Promise<InsuranceEmployee[]>;
  logout(): Promise<void>;
}

export class InsurancePageObject implements IInsurancePageObject {
  private sessionToken: string | null = null;

  async login(credentials: InsuranceCredentials): Promise<{ sessionToken: string }> {
    void credentials;
    this.sessionToken = `insurance-stub-${Date.now()}`;
    return { sessionToken: this.sessionToken };
  }

  async fetchContributions(year: number, month: number): Promise<InsuranceContribution> {
    if (!this.sessionToken) throw new Error("Not logged in");
    return {
      year,
      month,
      nationalPension: 0,
      healthInsurance: 0,
      employmentInsurance: 0,
      industrialAccident: 0,
      total: 0,
    };
  }

  async fetchEmployeeList(): Promise<InsuranceEmployee[]> {
    if (!this.sessionToken) throw new Error("Not logged in");
    return [];
  }

  async logout(): Promise<void> {
    this.sessionToken = null;
  }
}

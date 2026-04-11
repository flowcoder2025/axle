/**
 * KOITA (한국산업기술진흥협회) portal page-object stub.
 * Phase 15: interface + stub implementation.
 */

export interface KoitaCredentials {
  userId: string;
  password: string;
}

export interface KoitaCertification {
  certificationId: string;
  certType: "VENTURE" | "INNOBIZ" | "MAINBIZ" | string;
  validFrom: string;
  validTo: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

export interface IKoitaPageObject {
  login(credentials: KoitaCredentials): Promise<{ sessionToken: string }>;
  fetchCertifications(businessNumber: string): Promise<KoitaCertification[]>;
  verifyCertification(certificationId: string): Promise<boolean>;
  logout(): Promise<void>;
}

export class KoitaPageObject implements IKoitaPageObject {
  private sessionToken: string | null = null;

  async login(credentials: KoitaCredentials): Promise<{ sessionToken: string }> {
    void credentials;
    this.sessionToken = `koita-stub-${Date.now()}`;
    return { sessionToken: this.sessionToken };
  }

  async fetchCertifications(businessNumber: string): Promise<KoitaCertification[]> {
    if (!this.sessionToken) throw new Error("Not logged in");
    void businessNumber;
    return [];
  }

  async verifyCertification(certificationId: string): Promise<boolean> {
    if (!this.sessionToken) throw new Error("Not logged in");
    void certificationId;
    return false;
  }

  async logout(): Promise<void> {
    this.sessionToken = null;
  }
}

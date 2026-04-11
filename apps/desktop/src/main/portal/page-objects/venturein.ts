/**
 * VENTUREIN portal page-object stub.
 * Phase 15: interface + stub implementation.
 */

export interface VentureinCredentials {
  userId: string;
  password: string;
}

export interface VentureinApplication {
  applicationId: string;
  programName: string;
  status: "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  submittedAt: string;
  updatedAt: string;
}

export interface IVentureinPageObject {
  login(credentials: VentureinCredentials): Promise<{ sessionToken: string }>;
  fetchApplicationList(): Promise<VentureinApplication[]>;
  fetchApplicationDetail(applicationId: string): Promise<VentureinApplication & Record<string, unknown>>;
  logout(): Promise<void>;
}

export class VentureinPageObject implements IVentureinPageObject {
  private sessionToken: string | null = null;

  async login(credentials: VentureinCredentials): Promise<{ sessionToken: string }> {
    void credentials;
    this.sessionToken = `venturein-stub-${Date.now()}`;
    return { sessionToken: this.sessionToken };
  }

  async fetchApplicationList(): Promise<VentureinApplication[]> {
    if (!this.sessionToken) throw new Error("Not logged in");
    return [];
  }

  async fetchApplicationDetail(
    applicationId: string
  ): Promise<VentureinApplication & Record<string, unknown>> {
    if (!this.sessionToken) throw new Error("Not logged in");
    return {
      applicationId,
      programName: "Unknown",
      status: "SUBMITTED",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async logout(): Promise<void> {
    this.sessionToken = null;
  }
}

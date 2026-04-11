/**
 * 민원24 portal page-object stub.
 * Phase 15: interface + stub implementation.
 */

export interface Minwon24Credentials {
  userId: string;
  password: string;
}

export interface Minwon24Document {
  documentId: string;
  documentName: string;
  issuedAt: string;
  downloadUrl?: string;
}

export interface IMinwon24PageObject {
  login(credentials: Minwon24Credentials): Promise<{ sessionToken: string }>;
  fetchDocumentList(): Promise<Minwon24Document[]>;
  downloadDocument(documentId: string, destPath: string): Promise<string>;
  logout(): Promise<void>;
}

export class Minwon24PageObject implements IMinwon24PageObject {
  private sessionToken: string | null = null;

  async login(credentials: Minwon24Credentials): Promise<{ sessionToken: string }> {
    void credentials;
    this.sessionToken = `minwon24-stub-${Date.now()}`;
    return { sessionToken: this.sessionToken };
  }

  async fetchDocumentList(): Promise<Minwon24Document[]> {
    if (!this.sessionToken) throw new Error("Not logged in");
    return [];
  }

  async downloadDocument(documentId: string, destPath: string): Promise<string> {
    if (!this.sessionToken) throw new Error("Not logged in");
    void documentId;
    return destPath;
  }

  async logout(): Promise<void> {
    this.sessionToken = null;
  }
}

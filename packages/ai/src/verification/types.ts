export interface DocumentSection {
  name: string;
  content: string;
}

export interface DocumentData {
  title: string;
  sections: DocumentSection[];
  attachments: string[];
}

export interface VerificationIssue {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  location?: string;
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  issues: VerificationIssue[];
  recommendations: string[];
}

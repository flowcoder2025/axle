export interface ClientProfile {
  id: string;
  name: string;
  industry?: string;
  region?: string;
  employeeCount?: number;
  revenue?: number;
  isVenture?: boolean;
  isInnoBiz?: boolean;
  certifications?: string[];
}

export interface ProgramProfile {
  id: string;
  name: string;
  category: string;
  region?: string;
  maxFunding?: number;
  requirements?: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
}

export interface MatchResult {
  programId: string;
  programName: string;
  score: number; // 0-100
  isDisqualified: boolean;
  disqualifyReasons: string[];
  penalties: Array<{ reason: string; points: number }>;
  matchReasons: string[];
}

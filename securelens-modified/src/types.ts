// ── Shared types ───────────────────────────────────────────────────────────────

export type Severity = 'ERROR' | 'WARNING' | 'INFO' | 'UNKNOWN';

export interface FindingLocation {
  start: number;
  end: number;
}

export interface Finding {
  id: string;                  // unique per finding
  ruleId: string;
  severity: Severity;
  message: string;
  file: string;
  line: FindingLocation;
  column: FindingLocation;
  codeSnippet: string | null;
  fix: string | null;
  metadata: Record<string, unknown>;
  fingerprint: string | null;
}

export interface ScanError {
  code: number;
  level: string;
  message: string;
  path: string | null;
}

export interface ScanSummary {
  totalFindings: number;
  totalErrors: number;
  bySeverity: Record<Severity | string, number>;
  filesWithFindings: number;
}

export interface ScanMeta {
  scannedAt: string;
  target: string;
  config: string;
  semgrepVersion: string | null;
}

export interface ScanResult {
  meta: ScanMeta;
  summary: ScanSummary;
  findings: Finding[];
  findingsByFile: Record<string, Finding[]>;
  errors: ScanError[];
}

export interface AIExplanation {
  brief: string;          // 1-2 sentence hover text
  detail: string;         // full markdown explanation
  realWorldScenario: string;
  howToFix: string;
  references: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

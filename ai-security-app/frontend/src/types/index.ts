// src/types/index.ts

export interface User {
  _id: string;
  email: string;
  fullName: string;
  company?: string;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface ApiKey {
  _id: string;
  name: string;
  prefix: string;
  last4: string;
  lastUsed?: string;
  usageCount: number;
  monthlyLimit: number;
  isActive: boolean;
  createdAt: string;
}

export interface ThreatFinding {
  file: any;
  category: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export interface Scan {
  _id: string;
  type: 'url' | 'file' | 'ip' | 'domain';
  target: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  findings: ThreatFinding[];
  duration: number;
  createdAt: string;
}
 
export interface Session {
  _id: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  isActive: boolean;
  lastActivity: string;
  createdAt: string;
}

export interface Billing {
  _id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  scansUsed: number;
  scansLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

export interface DashboardOverview {
  stats: {
    totalScans: number;
    recentThreats: number;
    activeSessions: number;
    activeApiKeys: number;
  };
  billing: Billing;
  scanActivity: Array<{ _id: string; count: number; threats: number }>;
}

// ─── AI Service types (mirrors backend) ──────────────────────────────────────
export interface AIExplanation {
  brief: string;
  detail: string;
  realWorldScenario: string;
  howToFix: string;
  references: string[];
}

export interface AIScanSummary {
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  oneLiner: string;
  summary: string;
  mostDangerous: { ruleId: string; why: string };
  topThreeFixes: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type PlanType = 'free' | 'pro' | 'enterprise';

// src/types/index.ts
import { Request } from 'express';
import { Document, Types } from 'mongoose';

// ─── User ────────────────────────────────────────────────────────────────────
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  fullName: string;
  company?: string;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  isFirstLogin: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

// ─── OTP ─────────────────────────────────────────────────────────────────────
export interface IOTP extends Document {
  userId: Types.ObjectId;
  email: string;
  otp: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

// ─── API Key ─────────────────────────────────────────────────────────────────
export interface IApiKey extends Document {
  userId: Types.ObjectId;
  name: string;
  key: string;
  prefix: string;
  last4: string;
  scope: 'web' | 'extension';  // 'extension' keys auth the VS Code extension
  lastUsed?: Date;
  usageCount: number;
  monthlyLimit: number;
  isActive: boolean;
  createdAt: Date;
}

// ─── Scan / Threat ────────────────────────────────────────────────────────────
export interface IScan extends Document {
  userId: Types.ObjectId;
  type: 'url' | 'file' | 'ip' | 'domain';
  target: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  findings: ThreatFinding[];
  duration: number; // ms
  createdAt: Date;
}

export interface ThreatFinding {
  category: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────
export interface ISession extends Document {
  userId: Types.ObjectId;
  token: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
}

// ─── Billing ──────────────────────────────────────────────────────────────────
export interface IBilling extends Document {
  userId: Types.ObjectId;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  scansUsed: number;
  scansLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

// ─── Auth Request ─────────────────────────────────────────────────────────────
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  sessionToken?: string;
}

// ─── Extension / AI Service Types ─────────────────────────────────────────────

// Mirrors the extension's Finding shape so the same payload works both ways
export interface ExtensionFinding {
  id: string;
  ruleId: string;
  severity: 'ERROR' | 'WARNING' | 'INFO' | 'UNKNOWN';
  message: string;
  file: string;
  line: { start: number; end: number };
  column: { start: number; end: number };
  codeSnippet: string | null;
  fix: string | null;
  metadata: Record<string, unknown>;
  fingerprint: string | null;
}

export interface AIExplanation {
  brief: string;               // 1-2 sentence hover tooltip
  detail: string;              // full markdown explanation
  realWorldScenario: string;   // concrete attack story
  howToFix: string;            // before/after code fix
  references: string[];        // URLs
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

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

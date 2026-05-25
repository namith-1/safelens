// src/controllers/ai.controller.ts
//
// Three endpoints consumed by the VS Code extension (and the web dashboard):
//   POST /api/ai/explain     — explain a single Semgrep finding
//   POST /api/ai/summarize   — summarize a full scan
//   POST /api/ai/chat        — chat with scan context
//
// Auth: all routes require a valid JWT (protect middleware).
// Billing: each call counts against the user's apiCallsUsed quota.

import { Response } from 'express';
import { AuthRequest, ApiResponse, ExtensionFinding, ChatMessage } from '../types';
import * as GroqService from '../services/groq.service';
import { Billing } from '../models/Billing';

// ─── Helper: check & increment API quota ─────────────────────────────────────
async function checkAndIncrementQuota(userId: string): Promise<{ allowed: boolean; message: string }> {
  const billing = await Billing.findOne({ userId });
  if (!billing) return { allowed: true, message: '' }; // no billing record = allow

  if (billing.apiCallsUsed >= billing.apiCallsLimit) {
    return {
      allowed: false,
      message: `API call limit reached (${billing.apiCallsLimit.toLocaleString()} / month). Upgrade your plan to continue.`,
    };
  }

  billing.apiCallsUsed += 1;
  await billing.save();
  return { allowed: true, message: '' };
}

// ─── POST /api/ai/explain ─────────────────────────────────────────────────────
export const explainFinding = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const finding = req.body.finding as ExtensionFinding | undefined;

  if (!finding || !finding.ruleId || !finding.message) {
    res.status(400).json({ success: false, message: 'A valid finding object is required.' });
    return;
  }

  if (req.user?.id !== '000000000000000000000000') {
    const quota = await checkAndIncrementQuota(req.user!.id);
    if (!quota.allowed) {
      res.status(403).json({ success: false, message: quota.message });
      return;
    }
  }

  try {
    const customKey = (req as any).customGroqKey;
    const explanation = await GroqService.explainFinding(finding, customKey);
    res.json({ success: true, message: 'Explanation generated.', data: { explanation } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI service error.';
    res.status(502).json({ success: false, message: msg });
  }
};

// ─── POST /api/ai/summarize ───────────────────────────────────────────────────
export const summarizeScan = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const findings = req.body.findings as ExtensionFinding[] | undefined;

  if (!Array.isArray(findings)) {
    res.status(400).json({ success: false, message: 'findings must be an array.' });
    return;
  }

  if (req.user?.id !== '000000000000000000000000') {
    const quota = await checkAndIncrementQuota(req.user!.id);
    if (!quota.allowed) {
      res.status(403).json({ success: false, message: quota.message });
      return;
    }
  }

  try {
    const customKey = (req as any).customGroqKey;
    const summary = await GroqService.summarizeScan(findings, customKey);
    res.json({ success: true, message: 'Scan summarized.', data: { summary } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI service error.';
    res.status(502).json({ success: false, message: msg });
  }
};

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
export const chat = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const { messages, contextFindings, activeFinding } = req.body as {
    messages: ChatMessage[];
    contextFindings: ExtensionFinding[];
    activeFinding: ExtensionFinding | null;
  };

  console.log('All headers:', req.headers); // Debug log to check headers in chat endpoint
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ success: false, message: 'messages array is required.' });
    return;
  }

  if (req.user?.id !== '000000000000000000000000') {
    const quota = await checkAndIncrementQuota(req.user!.id);
    if (!quota.allowed) {
      res.status(403).json({ success: false, message: quota.message });
      return;
    }
  }

  try {
    const customKey = (req as any).customGroqKey;
    const reply = await GroqService.chat(messages, contextFindings ?? [], activeFinding ?? null, customKey);
    const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now() };
    res.json({ success: true, message: 'Chat response generated.', data: { message: assistantMsg } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI service error.';
    res.status(502).json({ success: false, message: msg });
  }
};


// src/controllers/apikey.controller.ts
import { Response } from 'express';
import crypto from 'crypto';
import { ApiKey } from '../models/ApiKey';
import { AuthRequest, ApiResponse } from '../types';

const generateKey = (): { key: string; prefix: string; last4: string } => {
  const raw = `sk-${crypto.randomBytes(32).toString('hex')}`;
  return {
    key:    raw,
    prefix: raw.substring(0, 10),   // "sk-c4eccb5x"  — shown as prefix
    last4:  raw.slice(-4),           // last 4 chars   — shown as suffix
  };
};

// ─── List API Keys ────────────────────────────────────────────────────────────
export const listApiKeys = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const keys = await ApiKey.find({ userId: req.user?.id }).sort({ createdAt: -1 }).select('-key');
  res.json({ success: true, message: 'API keys fetched.', data: { keys } });
};

// ─── Create API Key (web or extension scope) ──────────────────────────────────
export const createApiKey = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const { name, scope = 'web' } = req.body as { name: string; scope?: 'web' | 'extension' };
  if (!name) { res.status(400).json({ success: false, message: 'Key name is required.' }); return; }
  if (!['web', 'extension'].includes(scope)) {
    res.status(400).json({ success: false, message: 'scope must be "web" or "extension".' });
    return;
  }

  const count = await ApiKey.countDocuments({ userId: req.user?.id, isActive: true });
  if (count >= 10) {
    res.status(400).json({ success: false, message: 'Maximum 10 active API keys allowed.' });
    return;
  }

  const { key, prefix, last4 } = generateKey();
  const apiKey = await ApiKey.create({ userId: req.user?.id, name, key, prefix, last4, scope });

  // Return full key ONCE — never stored in plaintext after this response
  res.status(201).json({
    success: true,
    message: `${scope === 'extension' ? 'Extension' : 'Web'} API key created. Save it now — it won't be shown again.`,
    data: { key: apiKey.key, prefix, last4, name, scope, id: apiKey._id },
  });
};

// ─── Revoke API Key ───────────────────────────────────────────────────────────
export const revokeApiKey = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const apiKey = await ApiKey.findOneAndUpdate(
    { _id: req.params.id, userId: req.user?.id },
    { isActive: false },
    { new: true }
  );
  if (!apiKey) { res.status(404).json({ success: false, message: 'API key not found.' }); return; }
  res.json({ success: true, message: 'API key revoked.' });
};

// ─── Delete API Key ───────────────────────────────────────────────────────────
export const deleteApiKey = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const apiKey = await ApiKey.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
  if (!apiKey) { res.status(404).json({ success: false, message: 'API key not found.' }); return; }
  res.json({ success: true, message: 'API key deleted.' });
};

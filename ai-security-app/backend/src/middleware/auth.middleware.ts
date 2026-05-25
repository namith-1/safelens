// src/middleware/auth.middleware.ts
import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service';
import { Session } from '../models/Session';
import { ApiKey } from '../models/ApiKey';
import { AuthRequest, ApiResponse } from '../types';

// ─── JWT guard (web dashboard) ────────────────────────────────────────────────
export const protect = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("protect middleware called") // Debug log to confirm middleware is hit
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
      return;
    }
    const token = authHeader.split(' ')[1].trim();
    const decoded = verifyAccessToken(token);
    const session = await Session.findOne({ token, isActive: true });
    if (!session) {
      res.status(401).json({ success: false, message: 'Session expired or revoked. Please log in again.' });
      return;
    }
    session.lastActivity = new Date();
    await session.save();
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    req.sessionToken = token;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// ─── API Key guard (VS Code extension) ───────────────────────────────────────
// The extension sends the key via X-API-Key header (preferred — no prefix).
// Trims the key to handle accidental spaces from copy-paste in VS Code settings.
export const protectApiKey = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    // X-API-Key is the canonical header — trim handles spaces from paste
    // Strip any non-printable / non-ASCII chars — defensive against copy-paste artifacts
    const rawKey = (req.headers['x-api-key'] as string | undefined)
     // Debug log to confirm middleware is hit and show the raw key
      ?.replace(/[^\x21-\x7E]/g, '')
      .trim();
    console.log("protectApiKey middleware called, rawKey:", rawKey)
    if (!rawKey) {
      res.status(401).json({
        success: false,
        message:
          'Extension API key required. ' +
          'Get one from Dashboard → Extension Setup → Generate Key, ' +
          'then paste it in VS Code Settings → SafeLens → Backend Token.',
      });
      return;
    }

    // Direct Groq Cloud key bypasses local database checks
    if (rawKey.startsWith('gsk_') || rawKey.startsWith('gsk-')) {
      req.user = { id: '000000000000000000000000', email: 'groq-direct@safelens.com', role: 'user' };
      (req as any).customGroqKey = rawKey;
      next();
      return;
    }

    if (!rawKey.startsWith('sk-')) {
      res.status(401).json({
        success: false,
        message: 'Invalid key format. Extension API keys start with "sk-".',
      });
      return;
    }

    const apiKey = await ApiKey.findOne({ key: rawKey, isActive: true, scope: 'extension' });
    if (!apiKey) {
      res.status(401).json({
        success: false,
        message:
          'Extension API key not found or revoked. ' +
          'Generate a new one at Dashboard → Extension Setup.',
      });
      return;
    }

    apiKey.lastUsed    = new Date();
    apiKey.usageCount += 1;
    await apiKey.save();

    req.user = { id: String(apiKey.userId), email: '', role: 'user' };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'API key authentication failed.' });
  }
};

// ─── Dual guard: JWT (web) OR API key (extension) ────────────────────────────
// Checks for X-API-Key header first — if present, uses protectApiKey.
// Otherwise falls through to the JWT protect guard for the web dashboard.
export const protectAny = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  
console.log('All headers:', req.headers); 
  const hasApiKey = !!req.headers['x-api-key'];
  console.log("hasApiKey:", hasApiKey); // Debug log to confirm middleware is hit
  return hasApiKey ? protectApiKey(req, res, next) : protect(req, res, next);
};

// ─── Admin only guard ─────────────────────────────────────────────────────────
export const adminOnly = (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required.' });
    return;
  }
  next();
};

// src/controllers/session.controller.ts
import { Response } from 'express';
import { Session } from '../models/Session';
import { AuthRequest, ApiResponse } from '../types';

export const listSessions = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const sessions = await Session.find({ userId: req.user?.id, isActive: true }).sort({ lastActivity: -1 });
  res.json({ success: true, message: 'Sessions fetched.', data: { sessions } });
};

export const revokeSession = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const session = await Session.findOneAndUpdate(
    { _id: req.params.id, userId: req.user?.id },
    { isActive: false },
    { new: true }
  );
  if (!session) { res.status(404).json({ success: false, message: 'Session not found.' }); return; }
  res.json({ success: true, message: 'Session revoked.' });
};

export const revokeAllSessions = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  // Keep current session alive
  await Session.updateMany(
    { userId: req.user?.id, isActive: true, token: { $ne: req.sessionToken } },
    { isActive: false }
  );
  res.json({ success: true, message: 'All other sessions revoked.' });
};

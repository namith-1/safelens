// src/controllers/profile.controller.ts
// Handles profile update, password change, and account deletion
import { Response } from 'express';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { ApiKey } from '../models/ApiKey';
import { Scan } from '../models/Scan';
import { Billing } from '../models/Billing';
import { OTP } from '../models/OTP';
import { AuthRequest, ApiResponse } from '../types';

// ─── Update Profile ───────────────────────────────────────────────────────────
export const updateProfile = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const { fullName, company } = req.body;

  if (!fullName?.trim()) {
    res.status(400).json({ success: false, message: 'Full name is required.' });
    return;
  }

  const user = await User.findByIdAndUpdate(
    req.user?.id,
    { fullName: fullName.trim(), company: company?.trim() || '' },
    { new: true, runValidators: true }
  );

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  res.json({ success: true, message: 'Profile updated.', data: { user } });
};

// ─── Change Password ──────────────────────────────────────────────────────────
export const changePassword = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
    return;
  }

  const user = await User.findById(req.user?.id).select('+password');
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    return;
  }

  user.password = newPassword;
  await user.save();

  // Revoke all sessions — force re-login
  await Session.updateMany({ userId: user._id }, { isActive: false });

  res.json({ success: true, message: 'Password changed. Please log in again.' });
};

// ─── Delete Account ───────────────────────────────────────────────────────────
export const deleteAccount = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const userId = req.user?.id;

  // Delete all user data in parallel
  await Promise.all([
    User.findByIdAndDelete(userId),
    Session.deleteMany({ userId }),
    ApiKey.deleteMany({ userId }),
    Scan.deleteMany({ userId }),
    Billing.deleteOne({ userId }),
    OTP.deleteMany({ userId }),
  ]);

  res.json({ success: true, message: 'Account permanently deleted.' });
};

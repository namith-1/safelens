// src/services/otp.service.ts
import crypto from 'crypto';
import { Types } from 'mongoose';
import { OTP } from '../models/OTP';

// ─── Generate a 6-digit OTP ───────────────────────────────────────────────────
export const generateOTP = (): string => {
  return String(crypto.randomInt(100000, 999999));
};

// ─── Save OTP to DB (invalidates previous ones for that user) ─────────────────
export const createOTP = async (userId: Types.ObjectId, email: string): Promise<string> => {
  // Invalidate any existing unused OTPs for this user
  await OTP.updateMany({ userId, used: false }, { used: true });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);

  await OTP.create({ userId, email, otp, expiresAt });
  return otp;
};

// ─── Validate OTP ─────────────────────────────────────────────────────────────
export const validateOTP = async (
  userId: Types.ObjectId,
  submittedOtp: string
): Promise<{ valid: boolean; message: string }> => {
  const record = await OTP.findOne({
    userId,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) {
    return { valid: false, message: 'OTP expired or not found. Please request a new one.' };
  }

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(record.otp);
  const received = Buffer.from(submittedOtp);

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { valid: false, message: 'Invalid OTP. Please try again.' };
  }

  record.used = true;
  await record.save();

  return { valid: true, message: 'OTP verified successfully.' };
};

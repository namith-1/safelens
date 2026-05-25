// src/models/OTP.ts
import mongoose, { Schema } from 'mongoose';
import { IOTP } from '../types';

const OTPSchema = new Schema<IOTP>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email:     { type: String, required: true },
    otp:       { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-remove expired OTPs using MongoDB TTL index
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model<IOTP>('OTP', OTPSchema);

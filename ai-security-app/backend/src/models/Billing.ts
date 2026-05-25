// src/models/Billing.ts
import mongoose, { Schema } from 'mongoose';
import { IBilling } from '../types';

const BillingSchema = new Schema<IBilling>(
  {
    userId:             { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan:               { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    status:             { type: String, enum: ['active', 'cancelled', 'past_due'], default: 'active' },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd:   { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    scansUsed:          { type: Number, default: 0 },
    scansLimit:         { type: Number, default: 10 },    // free tier
    apiCallsUsed:       { type: Number, default: 0 },
    apiCallsLimit:      { type: Number, default: 1000 },  // free tier
  },
  { timestamps: true }
);

export const Billing = mongoose.model<IBilling>('Billing', BillingSchema);

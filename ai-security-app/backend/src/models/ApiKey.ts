// src/models/ApiKey.ts
import mongoose, { Schema } from 'mongoose';
import { IApiKey } from '../types';

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:         { type: String, required: true, trim: true },
    key:          { type: String, required: true, unique: true },
    prefix:       { type: String, required: true },      // first 10 chars e.g. sk-c4eccb5x
    last4:        { type: String, default: '????' },       // last 4 chars for display
    lastUsed:     { type: Date },
    usageCount:   { type: Number, default: 0 },
    monthlyLimit: { type: Number, default: 1000 },
    scope:        { type: String, enum: ['web', 'extension'], default: 'web' },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

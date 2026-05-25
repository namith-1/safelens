// src/models/Session.ts
import mongoose, { Schema } from 'mongoose';
import { ISession } from '../types';

const SessionSchema = new Schema<ISession>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token:        { type: String, required: true, unique: true },
    ipAddress:    { type: String, required: true },
    userAgent:    { type: String, required: true },
    location:     { type: String },
    isActive:     { type: Boolean, default: true },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Session = mongoose.model<ISession>('Session', SessionSchema);

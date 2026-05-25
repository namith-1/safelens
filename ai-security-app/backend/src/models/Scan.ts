import mongoose, { Schema } from 'mongoose';
import { IScan } from '../types';

const FindingSchema = new Schema(
  {
    ruleId:      { type: String },
    category:    { type: String, required: true },
    description: { type: String, required: true },
    severity:    { type: String, enum: ['info', 'low', 'medium', 'high', 'critical'], required: true },
    recommendation: { type: String, required: true },
    file:        { type: String },
    line:        { type: Schema.Types.Mixed },
    fingerprint: { type: String },
  },
  { _id: false }
);

const ScanSchema = new Schema<IScan>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:        { type: String, enum: ['url', 'file', 'ip', 'domain', 'semgrep'], required: true },
    target:      { type: String, required: true },
    status:      { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
    threatLevel: { type: String, enum: ['none', 'low', 'medium', 'high', 'critical'], default: 'none' },
    findings:    { type: [FindingSchema], default: [] },
    duration:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Scan = mongoose.model<IScan>('Scan', ScanSchema);
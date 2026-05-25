// src/models/User.ts
import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const UserSchema = new Schema<IUser>(
  {
    email:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:         { type: String, required: true, minlength: 8 },
    fullName:         { type: String, required: true, trim: true },
    company:          { type: String},
    role:             { type: String, enum: ['user', 'admin'], default: 'user' },
    isEmailVerified:  { type: Boolean, default: false },
    isFirstLogin:     { type: Boolean, default: true },
    plan:             { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  },
  { timestamps: true }
);

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Never send password in JSON
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as Partial<IUser>).password;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);

// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User';
import { Billing } from '../models/Billing';
import { Session } from '../models/Session';
import { createOTP, validateOTP } from '../services/otp.service';
import { sendOTPEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../services/token.service';
import { AuthRequest, ApiResponse } from '../types';

// ─── Register ──────────────────────────────────────────────────────────────────
export const register = async (req: Request, res: Response<ApiResponse>): Promise<void> => {
  const { email, password, fullName, company } = req.body;

  if (!email || !password || !fullName) {
    res.status(400).json({ success: false, message: 'Email, password, and full name are required.' });
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    return;
  }

  const BYPASS_OTP = true; // Set to false to enable email OTP verification again

  const user = await User.create({
    email,
    password,
    fullName,
    company,
    isEmailVerified: BYPASS_OTP ? true : false,
  });

  // Create default billing record
  await Billing.create({ userId: user._id });

  if (BYPASS_OTP) {
    const tokenPayload = { id: String(user._id), email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await Session.create({
      userId: user._id,
      token: accessToken,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully (OTP bypassed).',
      data: { accessToken, refreshToken, user },
    });
  } else {
    // Send OTP for email verification
    const otp = await createOTP(user._id, email);
    await sendOTPEmail(email, fullName, otp);

    res.status(201).json({
      success: true,
      message: 'Account created. Check your email for the verification OTP.',
      data: { userId: user._id, email: user.email },
    });
  }
};

// ─── Verify OTP (first login / email verification) ────────────────────────────
export const verifyOTP = async (req: Request, res: Response<ApiResponse>): Promise<void> => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    res.status(400).json({ success: false, message: 'User ID and OTP are required.' });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  const result = await validateOTP(user._id, otp);
  if (!result.valid) {
    res.status(400).json({ success: false, message: result.message });
    return;
  }

  // Mark email as verified
  user.isEmailVerified = true;
  user.isFirstLogin = false;
  await user.save();

  // Create session
  const tokenPayload = { id: String(user._id), email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await Session.create({
    userId: user._id,
    token: accessToken,
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  });

  await sendWelcomeEmail(user.email, user.fullName);

  res.json({
    success: true,
    message: 'Email verified. Welcome!',
    data: { accessToken, refreshToken, user },
  });
};

// ─── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response<ApiResponse>): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email and password are required.' });
    return;
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ success: false, message: 'Invalid email or password.' });
    return;
  }

  // Unverified users — resend OTP (unless bypassed for testing)
  const BYPASS_OTP = true;
  if (!user.isEmailVerified && !BYPASS_OTP) {
    const otp = await createOTP(user._id, email);
    await sendOTPEmail(email, user.fullName, otp);
    res.status(403).json({
      success: false,
      message: 'Email not verified. A new OTP has been sent.',
      data: { userId: user._id, requiresOTP: true },
    });
    return;
  }

  const tokenPayload = { id: String(user._id), email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await Session.create({
    userId: user._id,
    token: accessToken,
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  });

  res.json({
    success: true,
    message: 'Login successful.',
    data: { accessToken, refreshToken, user },
  });
};

// ─── Refresh Token ─────────────────────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response<ApiResponse>): Promise<void> => {
  const { refreshToken: token } = req.body;
  if (!token) {
    res.status(400).json({ success: false, message: 'Refresh token required.' });
    return;
  }

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found.' });
      return;
    }

    const newAccessToken = generateAccessToken({ id: String(user._id), email: user.email, role: user.role });
    await Session.create({
      userId: user._id,
      token: newAccessToken,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    res.json({ success: true, message: 'Token refreshed.', data: { accessToken: newAccessToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

// ─── Logout ────────────────────────────────────────────────────────────────────
export const logout = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const token = req.sessionToken;
  if (token) {
    await Session.findOneAndUpdate({ token }, { isActive: false });
  }
  res.json({ success: true, message: 'Logged out successfully.' });
};

// ─── Resend OTP ────────────────────────────────────────────────────────────────
export const resendOTP = async (req: Request, res: Response<ApiResponse>): Promise<void> => {
  const { userId } = req.body;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }
  const otp = await createOTP(user._id, user.email);
  await sendOTPEmail(user.email, user.fullName, otp);
  res.json({ success: true, message: 'New OTP sent to your email.' });
};

// ─── Forgot Password (request reset) ────────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response<ApiResponse>): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ success: false, message: 'Email is required.' });
    return;
  }

  const user = await User.findOne({ email });
  if (user) {
    const otp = await createOTP(user._id, user.email);
    await sendPasswordResetEmail(user.email, user.fullName, otp);
    res.json({ success: true, message: 'If an account exists, a password reset code was sent to the email.', data: { userId: user._id, email: user.email } });
    return;
  }

  // Don't reveal whether the email exists
  res.json({ success: true, message: 'If an account exists, a password reset code was sent to the email.' });
};

// ─── Reset Password (verify OTP + set new password) ─────────────────────────
export const resetPassword = async (req: Request, res: Response<ApiResponse>): Promise<void> => {
  const { userId, otp, newPassword } = req.body;
  if (!userId || !otp || !newPassword) {
    res.status(400).json({ success: false, message: 'userId, otp and newPassword are required.' });
    return;
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }

  const result = await validateOTP(user._id, otp);
  if (!result.valid) {
    res.status(400).json({ success: false, message: result.message });
    return;
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password has been reset. You can now sign in with your new password.' });
};

// ─── Get Current User ──────────────────────────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const user = await User.findById(req.user?.id);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found.' });
    return;
  }
  res.json({ success: true, message: 'User fetched.', data: { user } });
};

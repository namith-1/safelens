// src/routes/auth.routes.ts
import { Router } from 'express';
import { register, login, verifyOTP, logout, resendOTP, refreshToken, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { updateProfile, changePassword, deleteAccount } from '../controllers/profile.controller';
import { protect } from '../middleware/auth.middleware';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/register',       authLimiter, register);
router.post('/login',          authLimiter, login);
router.post('/verify-otp',     authLimiter, verifyOTP);
router.post('/resend-otp',     otpLimiter,  resendOTP);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password',  authLimiter, resetPassword);
router.post('/refresh',        refreshToken);

// ── Protected ─────────────────────────────────────────────────────────────────
router.post('/logout',         protect, logout);
router.get('/me',              protect, getMe);
router.patch('/profile',       protect, updateProfile);
router.patch('/password',      protect, changePassword);
router.delete('/account',      protect, deleteAccount);

export default router;

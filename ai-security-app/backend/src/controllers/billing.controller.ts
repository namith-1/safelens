// src/controllers/billing.controller.ts
import { Response } from 'express';
import { Billing } from '../models/Billing';
import { User } from '../models/User';
import { AuthRequest, ApiResponse } from '../types';

const PLAN_LIMITS = {
  free:       { scansLimit: 10,   apiCallsLimit: 1_000  },
  pro:        { scansLimit: 500,  apiCallsLimit: 50_000 },
  enterprise: { scansLimit: 9999, apiCallsLimit: 999_999 },
};

export const getBilling = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const billing = await Billing.findOne({ userId: req.user?.id });
  if (!billing) { res.status(404).json({ success: false, message: 'Billing record not found.' }); return; }
  res.json({ success: true, message: 'Billing info fetched.', data: { billing } });
};

// Simulate plan upgrade (wire to Stripe/Razorpay in production)
export const upgradePlan = async (req: AuthRequest, res: Response<ApiResponse>): Promise<void> => {
  const { plan } = req.body;
  if (!['free', 'pro', 'enterprise'].includes(plan)) {
    res.status(400).json({ success: false, message: 'Invalid plan.' });
    return;
  }

  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  const billing = await Billing.findOneAndUpdate(
    { userId: req.user?.id },
    {
      plan,
      ...limits,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
    },
    { new: true }
  );

  await User.findByIdAndUpdate(req.user?.id, { plan });

  res.json({ success: true, message: `Plan upgraded to ${plan}.`, data: { billing } });
};

// src/controllers/dashboard.controller.ts
import { Response } from 'express';
import { Types } from 'mongoose'; // 👈 ADD THIS IMPORT
import { Scan } from '../models/Scan';
import { Session } from '../models/Session';
import { Billing } from '../models/Billing';
import { ApiKey } from '../models/ApiKey';
import { AuthRequest } from '../types'; // Removed ApiResponse if not used elsewhere

// ─── Dashboard Overview ───────────────────────────────────────────────────────
export const getDashboardOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // 1. CRITICAL: Convert string ID to ObjectId for Aggregation
    // Cast to string first to satisfy TS, then to ObjectId for MongoDB
    const userObjId = new Types.ObjectId(userId as string);

    // here in recentThreats, it should return the last scan total threats, not the total count of scans with high/critical threats. we can calculate that in the frontend using the scanActivity data which has the daily count of high/critical threats for the last 7 days. we just need to sum up the threats from scanActivity to get the recentThreats count. 
    
    const [totalScans, recentThreats, activeSessions, billing, apiKeys] = await Promise.all([
      Scan.countDocuments({ userId }),
      Scan.countDocuments({ userId, threatLevel: { $in: ['high', 'critical'] } }),
      Session.countDocuments({ userId, isActive: true }),
      Billing.findOne({ userId }),
      ApiKey.countDocuments({ userId, isActive: true }),
    ]);

    // 3. Define the 7-day window
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0); 
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); 

    // 4. Run Aggregation
    const rawActivity = await Scan.aggregate([
      { 
        $match: { 
          userId: userObjId, 
          createdAt: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          threats: { $sum: { $cond: [{ $in: ['$threatLevel', ['high', 'critical']] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 5. GAP FILLER: Ensure exactly 7 items
    const scanActivity = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      
      const existingDay = rawActivity.find(a => a._id === dateStr);
      return existingDay || { _id: dateStr, count: 0, threats: 0 };
    });

    res.json({
      success: true,
      data: {
        stats: { totalScans, recentThreats, activeSessions, activeApiKeys: apiKeys },
        billing,
        scanActivity,
      },
    });
  } catch (error) {
    console.error("Dashboard Controller Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
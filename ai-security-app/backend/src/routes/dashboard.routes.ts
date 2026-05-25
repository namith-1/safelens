// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { getDashboardOverview } from '../controllers/dashboard.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.get('/overview', protect, getDashboardOverview);
export default router;

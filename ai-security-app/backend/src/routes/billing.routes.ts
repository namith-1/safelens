// src/routes/billing.routes.ts
import { Router } from 'express';
import { getBilling, upgradePlan } from '../controllers/billing.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);
router.get('/',          getBilling);
router.post('/upgrade',  upgradePlan);
export default router;

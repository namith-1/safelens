// src/routes/scan.routes.ts
import {test} from '../middleware/test';
import { Router } from 'express';
import { saveScanResults, getScanById, deleteScan, getUserScans } from '../controllers/scan.controller';
import { protect } from '../middleware/auth.middleware';
import { protectAny } from '../middleware/auth.middleware';
const router = Router();

router.post('/save-results', protectAny, saveScanResults);

router.use(protect);
router.get('/scan-results',getUserScans);
router.get('/:id',     getScanById);    
router.delete('/:id',  deleteScan);
export default router;
//
// src/routes/session.routes.ts
import { Router } from 'express';
import { listSessions, revokeSession, revokeAllSessions } from '../controllers/session.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);
router.get('/',                listSessions);
router.delete('/all',          revokeAllSessions);
router.delete('/:id',          revokeSession);
export default router;

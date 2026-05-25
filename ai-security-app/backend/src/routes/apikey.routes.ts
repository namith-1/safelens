// src/routes/apikey.routes.ts
import { Router } from 'express';
import { listApiKeys, createApiKey, revokeApiKey, deleteApiKey } from '../controllers/apikey.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);
router.get('/',              listApiKeys);
router.post('/',             createApiKey);
router.patch('/:id/revoke',  revokeApiKey);
router.delete('/:id',        deleteApiKey);
export default router;

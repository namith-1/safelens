// src/routes/ai.routes.ts
//
// /api/ai/* is consumed by:
//   - The web dashboard (JWT Bearer token, same origin as FRONTEND_URL)
//   - The VS Code extension (extension API key, any origin / no browser)
//
// protectAny accepts either auth method transparently.
// extensionCors allows any origin so VS Code's Node.js https.request works.

import { Router } from 'express';
import { explainFinding, summarizeScan, chat } from '../controllers/ai.controller';
import { protect, protectAny} from '../middleware/auth.middleware';
import { extensionCors } from '../middleware/cors.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import { test } from '../middleware/test';
const router = Router();

// CORS must come before auth so OPTIONS pre-flights are answered correctly


//router.use(extensionCors);
router.use(apiLimiter);

router.post('/explain',  protectAny, explainFinding);
router.post('/summarize', protectAny, summarizeScan);
router.post('/chat',  protectAny, chat);

export default router;

    
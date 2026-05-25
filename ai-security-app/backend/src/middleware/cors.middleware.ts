// src/middleware/cors.middleware.ts
//
// Two CORS policies:
//   1. webCors    — strict, only FRONTEND_URL is allowed (dashboard, auth)
//   2. extensionCors — open to any origin (the VS Code extension has no "origin")
//
// Usage in routes:
//   router.use(webCors)        ← auth, dashboard, billing, sessions
//   router.use(extensionCors)  ← /api/ai/* (used by both web + extension)

import cors, { CorsOptions } from 'cors';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const configuredOrigins = (process.env.FRONTEND_URLS || FRONTEND_URL)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...configuredOrigins, FRONTEND_URL, 'https://www.safelens.com']));

const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true;

  try {
    const { hostname } = new URL(origin);
    return allowedOrigins.includes(origin) || hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

// ─── Web dashboard CORS ───────────────────────────────────────────────────────
// Strict — only the configured frontend origin is allowed, with credentials.
export const webCors = cors({
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ─── Extension CORS ───────────────────────────────────────────────────────────
// Permissive origin — VS Code extensions send requests from 'vscode-webview://'
// or no origin at all (Node.js https.request). We still enforce auth via the
// API key middleware — CORS here only controls browser pre-flight.
export const extensionCors = cors({
  origin: (_origin, callback) => callback(null, true), // allow all origins
  credentials: false,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
});

// ─── Convenience: a single CorsOptions object for app.use(cors(...)) ─────────
// Used in index.ts as the default — applies webCors to everything,
// then individual routers override with extensionCors where needed.
export const defaultCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
};

// src/lib/config.ts
//
// All environment-dependent values live here.
// Switch from local → cloud by setting VITE_API_URL in your .env file.
//
// Local dev  (.env):              VITE_API_URL=http://localhost:5000
// Cloud prod (.env.production):   VITE_API_URL=https://safelens-backend.onrender.com
//
// The Vite proxy in vite.config.ts handles /api → localhost:5000 in dev,
// so you usually don't need VITE_API_URL set at all locally.

// Base URL of the backend API — used by the Extension Setup page
// to show the user what to paste into VS Code settings.
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000';

// Full /api prefix used when building absolute URLs for display only.
// Axios in lib/api.ts uses this value for actual browser calls.
export const API_URL = `${API_BASE_URL}/api`;

// App name — change once here, reflects everywhere
export const APP_NAME = 'AI Security';

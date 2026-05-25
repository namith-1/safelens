# SafeLens Deployment

Production URLs configured in this repo:

- Frontend: https://safelens.vercel.app
- Backend: https://safelens-backend.onrender.com
- Backend API prefix: https://safelens-backend.onrender.com/api
- VS Code Marketplace publisher: Namith011

## Backend on Render

Create a Render Blueprint from `ai-security-app/render.yaml`.

Set these secret environment variables in Render:

- `MONGO_URI`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `GROQ_API_KEY`

Render generates `JWT_SECRET` and `JWT_REFRESH_SECRET` automatically. After deploy, check `https://safelens-backend.onrender.com/health`.

## Frontend on Vercel

Import the repo into Vercel and set the project root to `ai-security-app/frontend`.

`ai-security-app/frontend/vercel.json` configures:

- build command: `npm run build`
- output directory: `dist`
- `VITE_API_URL=https://safelens-backend.onrender.com`
- SPA fallback rewrites

## VS Code Marketplace

The extension in `securelens-modified/package.json` now uses publisher `Namith011` and defaults to the hosted backend/dashboard URLs.

Package it from `securelens-modified`:

```bash
npm run compile
npx @vscode/vsce package
```

Upload the generated `.vsix` through the Marketplace Management Console with **New Extension** -> **Visual Studio Code**.

If Render or Vercel gives you a different URL, update:

- `ai-security-app/render.yaml`
- `ai-security-app/frontend/vercel.json`
- `ai-security-app/frontend/.env.example`
- `ai-security-app/backend/.env.example`
- `securelens-modified/package.json`

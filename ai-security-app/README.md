# 🛡️ AI Security Platform

Enterprise-grade AI-powered threat detection platform. Scan URLs, IPs, domains, and files in real time. Built with **React + TypeScript + Vite** (frontend) and **Node.js + Express + MongoDB** (backend).

---

## 📁 Project Structure

```
ai-security-app/
├── backend/                   # Express API
│   └── src/
│       ├── config/            # DB + Nodemailer setup
│       ├── controllers/       # Route handlers (auth, scans, apikeys, sessions, billing, profile)
│       ├── middleware/        # Auth guard, rate limiter, error handler
│       ├── models/            # Mongoose schemas (User, OTP, ApiKey, Scan, Session, Billing)
│       ├── routes/            # Express routers
│       ├── services/          # Email, OTP, JWT token logic
│       └── types/             # Shared TypeScript interfaces
│
├── frontend/                  # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── layout/        # DashboardLayout, PublicNavbar, ProtectedRoute
│       │   └── ui/            # LoadingScreen, Skeleton, Spinner
│       ├── context/           # AuthContext (global auth state)
│       ├── hooks/             # useDashboard (data fetching hook)
│       ├── lib/               # Axios instance (api.ts), utils (utils.ts)
│       ├── pages/
│       │   ├── auth/          # LoginPage, RegisterPage, OTPVerifyPage
│       │   ├── dashboard/     # Overview, Scans, ApiKeys, Sessions, Billing, Settings
│       │   ├── LandingPage    # Public homepage
│       │   ├── TutorialsPage  # Public + in-dashboard security tutorials
│       │   └── NotFoundPage   # 404
│       └── types/             # Frontend TypeScript interfaces
│
├── package.json               # Root runner (concurrently)
└── README.md
```

---

## 🚀 Getting Started

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Configure environment variables
```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Any long random string |
| `JWT_REFRESH_SECRET` | Another long random string |
| `SMTP_USER` | Gmail or SMTP email address |
| `SMTP_PASS` | Gmail App Password (not your login password) |
| `FRONTEND_URL` | `http://localhost:5173` for development |
| `GROQ_API_KEY` | Free key from https://console.groq.com/keys (no billing needed) |

### 3. Run both servers
```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## 🔑 API Reference

All protected endpoints require `Authorization: Bearer <token>` header.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login |
| POST | `/api/auth/verify-otp` | ❌ | Verify email OTP |
| POST | `/api/auth/resend-otp` | ❌ | Resend OTP |
| POST | `/api/auth/refresh` | ❌ | Refresh access token |
| POST | `/api/auth/logout` | ✅ | Logout + revoke session |
| GET  | `/api/auth/me` | ✅ | Get current user |
| PATCH| `/api/auth/profile` | ✅ | Update name/company |
| PATCH| `/api/auth/password` | ✅ | Change password |
| DELETE| `/api/auth/account` | ✅ | Delete account |


### AI Service
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/explain` | Explain a single Semgrep finding |
| POST | `/api/ai/summarize` | Summarize a full scan (array of findings) |
| POST | `/api/ai/chat` | Chat with scan context |

### Dashboard
| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/overview` | Stats + billing + scan activity |

### Scans
| Method | Path | Description |
|---|---|---|
| GET | `/api/scans` | List scans (paginated) |
| POST | `/api/scans` | Start a new scan |
| GET | `/api/scans/:id` | Get scan details |
| DELETE | `/api/scans/:id` | Delete scan |

### API Keys
| Method | Path | Description |
|---|---|---|
| GET | `/api/apikeys` | List keys (key hash hidden) |
| POST | `/api/apikeys` | Create key (full key shown once) |
| PATCH | `/api/apikeys/:id/revoke` | Revoke key |
| DELETE | `/api/apikeys/:id` | Delete key |

### Sessions
| Method | Path | Description |
|---|---|---|
| GET | `/api/sessions` | List active sessions |
| DELETE | `/api/sessions/all` | Revoke all other sessions |
| DELETE | `/api/sessions/:id` | Revoke a session |

### Billing
| Method | Path | Description |
|---|---|---|
| GET | `/api/billing` | Get plan + usage |
| POST | `/api/billing/upgrade` | Upgrade plan |

---

## 🔒 Security Features

- **OTP verification** on first login via Nodemailer
- **Timing-safe OTP comparison** (prevents timing attacks)
- **MongoDB TTL index** auto-expires OTPs after 10 minutes
- **JWT access + refresh tokens** with session tracking
- **Rate limiting** on all auth routes
- **bcrypt** password hashing (12 salt rounds)
- **Password never returned** in JSON (toJSON transform)
- **Session revocation** on logout and password change

---

## 🧩 Extending the App

### Add a real AI scan engine
In `backend/src/controllers/scan.controller.ts`, replace the `setTimeout` mock with your AI API call:
```typescript
// Replace the setTimeout block with your engine:
const result = await myAiEngine.scan({ type, target });
await Scan.findByIdAndUpdate(scan._id, {
  status: 'completed',
  threatLevel: result.level,
  findings: result.findings,
  duration: result.durationMs,
});
```

### Add Stripe billing
In `backend/src/controllers/billing.controller.ts`, replace `upgradePlan` with a Stripe Checkout session.

### Add webhooks
Create `backend/src/routes/webhook.routes.ts` and emit events when scans complete.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Routing | React Router v6 |
| HTTP client | Axios (with token refresh interceptor) |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB, Mongoose |
| Auth | JWT (access + refresh), bcryptjs |
| Email | Nodemailer |
| Fonts | IBM Plex Sans, IBM Plex Mono, Syne |

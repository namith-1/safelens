// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from '@/components/layout/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// ─── Public pages ──────────────────────────────────────────────────────────────
import { LandingPage }    from '@/pages/LandingPage';
import { TutorialsPage }  from '@/pages/TutorialsPage';

// ─── Auth pages ────────────────────────────────────────────────────────────────
import { LoginPage }      from '@/pages/auth/LoginPage';
import { RegisterPage }   from '@/pages/auth/RegisterPage';
import { OTPVerifyPage }  from '@/pages/auth/OTPVerifyPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';

// ─── Dashboard pages ───────────────────────────────────────────────────────────
import { OverviewPage }   from '@/pages/dashboard/OverviewPage';
import { ScansPage }      from '@/pages/dashboard/ScansPage';
import { ApiKeysPage }    from '@/pages/dashboard/ApiKeysPage';
import { SessionsPage }   from '@/pages/dashboard/SessionsPage';
import { BillingPage }    from '@/pages/dashboard/BillingPage';
import { AIServicePage }      from '@/pages/dashboard/AIServicePage';
import { ExtensionSetupPage }  from '@/pages/dashboard/ExtensionSetupPage';

import { SettingsPage }    from '@/pages/dashboard/SettingsPage';
import { NotFoundPage }    from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route path="/"          element={<LandingPage />} />
      <Route path="/tutorials" element={<TutorialsPage />} />
      <Route path="/docs"      element={<NotFoundPage />} />


      {/* ── Auth (redirect if logged in) ────────────────────────────────── */}
      <Route element={<PublicRoute />}>
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/register"    element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* OTP verify — accessible when logged out */}
      <Route path="/verify-otp" element={<OTPVerifyPage />} />

      {/* ── Protected Dashboard ─────────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index                   element={<OverviewPage />} />
          <Route path="scans"            element={<ScansPage />} />
          <Route path="apikeys"          element={<ApiKeysPage />} />
          <Route path="sessions"         element={<SessionsPage />} />
          <Route path="billing"          element={<BillingPage />} />
          <Route path="ai"              element={<AIServicePage />} />
          <Route path="extension"        element={<ExtensionSetupPage />} />
          <Route path="settings"         element={<SettingsPage />} />
          <Route path="*"                element={<NotFoundPage />} /> {/* Catch-all for unknown dashboard routes */}
          <Route path="tutorials"        element={<TutorialsPage />} /> {/* Add tutorials route within dashboard if needed */}
        </Route>
      </Route>

      {/* ── 404 ─────────────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

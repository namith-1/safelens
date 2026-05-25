// src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Home } from 'lucide-react';

export const NotFoundPage = () => (
  <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4 text-center">
    <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
    <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />

    <div className="relative space-y-6 animate-slide-up">
      {/* Glitchy 404 */}
      <div className="relative">
        <p className="font-display text-[120px] sm:text-[160px] font-bold leading-none text-surface-overlay select-none">
          404
        </p>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-600/30 flex items-center justify-center">
            <Shield className="w-8 h-8 text-accent-blue" />
          </div>
        </div>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">
          Threat not found — page missing
        </h1>
        <p className="text-slate-400 max-w-sm mx-auto text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          No threats detected — just a wrong turn.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link to="/" className="btn-primary">
          <Home className="w-4 h-4" /> Back to Home
        </Link>
        <button onClick={() => history.back()} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    </div>
  </div>
);

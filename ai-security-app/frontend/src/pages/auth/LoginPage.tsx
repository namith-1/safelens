// src/pages/auth/LoginPage.tsx
import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.data.accessToken, data.data.refreshToken, data.data.user);
      toast.success(`Welcome back, ${data.data.user.fullName.split(' ')[0]}!`);
      navigate(from, { replace: true });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; data?: { requiresOTP?: boolean; userId?: string } } } };
      const msg = err.response?.data?.message || 'Login failed';
      if (err.response?.data?.data?.requiresOTP) {
        toast.error('Please verify your email first');
        navigate('/verify-otp', { state: { userId: err.response.data.data.userId, email: form.email } });
        return;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-600/40 flex items-center justify-center">
            <Shield className="w-5 h-5 text-accent-blue" />
          </div>
          <span className="font-display text-xl font-bold text-white"> <span
            className="font-display tracking-tight"
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #e5e7eb, #60a5fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SΛFΞLΞNS
          </span></span>
        </div>

        <div className="card">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-slate-400 text-sm mt-1">Sign in to your security dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" placeholder="jane@acme.com"
                value={form.email} onChange={set('email')} required autoFocus />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-accent-blue hover:text-white transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <input className="input pr-10" type={showPwd ? 'text' : 'password'}
                  placeholder="Your password" value={form.password} onChange={set('password')} required />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-3 mt-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            New here?{' '}
            <Link to="/register" className="text-accent-blue hover:text-white transition-colors font-medium">Create an account</Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          <Link to="/" className="hover:text-slate-400">← Back to homepage</Link>
        </p>
      </div>
    </div>
  );
};

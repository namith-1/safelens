// src/pages/auth/RegisterPage.tsx
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', company: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        fullName: form.fullName, email: form.email, company: form.company, password: form.password,
      });
      if (data.data && data.data.accessToken) {
        login(data.data.accessToken, data.data.refreshToken, data.data.user);
        toast.success(`Welcome, ${data.data.user.fullName.split(' ')[0]}!`);
        navigate('/dashboard', { replace: true });
      } else {
        toast.success('Account created! Check your email for the OTP.');
        navigate('/verify-otp', { state: { userId: data.data.userId, email: form.email } });
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
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

        <div className="card border-surface-border">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">Create your account</h1>
            <p className="text-slate-400 text-sm mt-1">Start protecting your infrastructure today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" placeholder="Jane Smith" value={form.fullName} onChange={set('fullName')} required />
              </div>
              <div>
                <label className="label">Company <span className="text-slate-600 font-normal">(optional)</span></label>
                <input className="input" placeholder="Acme Corp" value={form.company} onChange={set('company')} />
              </div>
            </div>

            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" placeholder="jane@acme.com" value={form.email} onChange={set('email')} required />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={showPwd ? 'text' : 'password'}
                  placeholder="Min. 8 characters" value={form.password} onChange={set('password')} required />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <input className="input" type={showPwd ? 'text' : 'password'}
                placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} required />
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-3 mt-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-blue hover:text-white transition-colors font-medium">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          By creating an account, you agree to our{' '}
          <a href="#" className="hover:text-slate-400">Terms of Service</a> &amp;{' '}
          <a href="#" className="hover:text-slate-400">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
};

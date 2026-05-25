// src/pages/auth/OTPVerifyPage.tsx
import { useState, useRef, KeyboardEvent, ClipboardEvent, FormEvent, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, Loader2, RefreshCw, MailCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

const OTP_LENGTH = 6;

export const OTPVerifyPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { userId, email } = (location.state || {}) as { userId?: string; email?: string };

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Redirect if no state
  useEffect(() => {
    if (!userId) navigate('/register');
  }, [userId, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const updateDigit = (index: number, value: string) => {
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill('');
    text.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { toast.error('Please enter the complete 6-digit code'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { userId, otp });
      login(data.data.accessToken, data.data.refreshToken, data.data.user);
      toast.success('Email verified! Welcome aboard 🎉');
      navigate('/dashboard');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Invalid OTP');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !userId) return;
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { userId });
      toast.success('New OTP sent to your email');
      setCooldown(60);
    } catch {
      toast.error('Failed to resend OTP');
    } finally {
      setResending(false);
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
          <span className="font-display text-xl font-bold text-white">AI<span className="text-accent-blue">Security</span></span>
        </div>

        <div className="card text-center">
          <div className="w-14 h-14 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mx-auto mb-5">
            <MailCheck className="w-7 h-7 text-accent-blue" />
          </div>

          <h1 className="font-display text-2xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-1">
            We sent a 6-digit verification code to
          </p>
          <p className="text-accent-blue text-sm font-medium mb-8">{email}</p>

          <form onSubmit={handleSubmit}>
            {/* OTP Inputs */}
            <div className="flex gap-2.5 justify-center mb-8" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => updateDigit(i, e.target.value.replace(/\D/, ''))}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-11 h-13 text-center text-xl font-bold font-mono rounded-lg
                    bg-surface-raised border border-surface-border text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200 caret-accent-blue"
                  style={{ height: '52px' }}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Email'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="text-sm text-slate-500">Didn't receive it?</span>
            <button onClick={handleResend} disabled={cooldown > 0 || resending}
              className="text-sm text-accent-blue hover:text-white transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

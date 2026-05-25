import { useState, useRef, KeyboardEvent, ClipboardEvent, FormEvent, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const OTP_LENGTH = 6;

export const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, email } = (location.state || {}) as { userId?: string; email?: string };

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    if (!userId) {
      toast.error('Missing user information. Please request a reset code first.');
      navigate('/forgot-password');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { userId, otp, newPassword: password });
      toast.success('Password reset successful — you can sign in now');
      navigate('/login');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
      setDigits(Array(OTP_LENGTH).fill(''));
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
          <span className="font-display text-xl font-bold text-white">AI<span className="text-accent-blue">Security</span></span>
        </div>

        <div className="card text-center">
          <h1 className="font-display text-2xl font-bold text-white mb-2">Reset your password</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">We sent a 6-digit code to <span className="text-accent-blue font-medium">{email || 'your email'}</span></p>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2.5 justify-center mb-4" onPaste={handlePaste}>
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
                  className="w-11 h-13 text-center text-xl font-bold font-mono rounded-lg bg-surface-raised border border-surface-border text-white focus:outline-none"
                  style={{ height: '52px' }}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <div className="mb-3">
              <label className="label">New password</label>
              <input className="input" type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="mb-4">
              <label className="label">Confirm password</label>
              <input className="input" type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset password'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={handleResend} disabled={cooldown > 0 || resending || !userId}
              className="text-sm text-accent-blue hover:text-white transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            <Link to="/login" className="text-accent-blue hover:text-white transition-colors font-medium">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

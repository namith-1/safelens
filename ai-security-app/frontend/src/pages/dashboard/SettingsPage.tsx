// src/pages/dashboard/SettingsPage.tsx
import { useState, FormEvent } from 'react';
import { User, Lock, Trash2, Loader2, Check, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

type Tab = 'profile' | 'security' | 'danger';

export const SettingsPage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('profile');

  // Profile form
  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', company: user?.company ?? '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwds, setShowPwds] = useState(false);

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile.fullName.trim()) { toast.error('Full name is required'); return; }
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/auth/profile', profile);
      updateUser(data.data.user);
      toast.success('Profile updated');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to update profile');
    } finally { setSavingProfile(false); }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) { toast.error('New passwords do not match'); return; }
    if (passwords.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSavingPwd(true);
    try {
      await api.patch('/auth/password', { currentPassword: passwords.current, newPassword: passwords.next });
      toast.success('Password changed — please log in again');
      setPasswords({ current: '', next: '', confirm: '' });
      setTimeout(async () => { await logout(); navigate('/login'); }, 1500);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to change password');
    } finally { setSavingPwd(false); }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== user?.email) { toast.error('Email does not match'); return; }
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      toast.success('Account deleted');
      await logout();
      navigate('/');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile',  label: 'Profile',   icon: User     },
    { id: 'security', label: 'Security',  icon: Lock     },
    { id: 'danger',   label: 'Danger Zone', icon: AlertTriangle },
  ];

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-surface-border w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              tab === t.id
                ? 'bg-surface-raised text-white border border-surface-border'
                : 'text-slate-500 hover:text-slate-300'
            )}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ─────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="card space-y-5">
          <h2 className="font-semibold text-white">Profile Information</h2>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600/20 border-2 border-blue-600/40 flex items-center justify-center">
              <span className="font-display text-xl font-bold text-accent-blue">
                {profile.fullName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.email}</p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">
                {user?.plan} plan · {user?.role}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={profile.fullName}
                onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Company <span className="text-slate-600 font-normal">(optional)</span></label>
              <input className="input" placeholder="Your company" value={profile.company}
                onChange={e => setProfile(p => ({ ...p, company: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Email Address</label>
            <input className="input opacity-60 cursor-not-allowed" value={user?.email} disabled
              title="Email cannot be changed" />
            <p className="text-xs text-slate-600 mt-1">Email cannot be changed after registration</p>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              {savingProfile
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                : <><Check className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </form>
      )}

      {/* ── Security Tab ────────────────────────────────────────────── */}
      {tab === 'security' && (
        <form onSubmit={savePassword} className="card space-y-5">
          <div>
            <h2 className="font-semibold text-white">Change Password</h2>
            <p className="text-sm text-slate-500 mt-1">You'll be logged out after changing your password</p>
          </div>

          <div>
            <label className="label">Current Password</label>
            <input className="input" type={showPwds ? 'text' : 'password'}
              placeholder="Your current password" value={passwords.current}
              onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input className="input" type={showPwds ? 'text' : 'password'}
              placeholder="Min. 8 characters" value={passwords.next}
              onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input className="input" type={showPwds ? 'text' : 'password'}
              placeholder="Repeat new password" value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} required />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-surface-border"
                checked={showPwds} onChange={e => setShowPwds(e.target.checked)} />
              <span className="text-sm text-slate-400">Show passwords</span>
            </label>
            <button type="submit" className="btn-primary" disabled={savingPwd}>
              {savingPwd
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                : <><Lock className="w-4 h-4" /> Update Password</>}
            </button>
          </div>
        </form>
      )}

      {/* ── Danger Zone Tab ─────────────────────────────────────────── */}
      {tab === 'danger' && (
        <div className="card border-red-500/20 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="font-semibold text-red-400">Delete Account</h2>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Permanently delete your account, all API keys, scan history, and billing records.
                This action <strong className="text-white">cannot be undone</strong>.
              </p>
            </div>
          </div>

          <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/15 space-y-3">
            <p className="text-sm text-slate-300">
              Type your email address <strong className="text-white font-mono">{user?.email}</strong> to confirm:
            </p>
            <input className="input border-red-500/30 focus:ring-red-500"
              placeholder={user?.email}
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)} />
            <button
              onClick={deleteAccount}
              disabled={deleteConfirm !== user?.email || deleting}
              className="btn-danger w-full justify-center py-2.5">
              {deleting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                : <><Trash2 className="w-4 h-4" /> Permanently Delete My Account</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

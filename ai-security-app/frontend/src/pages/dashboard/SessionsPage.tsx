// src/pages/dashboard/SessionsPage.tsx
import { useState, useEffect } from 'react';
import { MonitorSmartphone, Trash2, ShieldOff, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Session } from '@/types';
import { formatRelative, formatDateTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/LoadingScreen';
import toast from 'react-hot-toast';

export const SessionsPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.data.sessions);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSessions(); }, []);

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.delete(`/sessions/${id}`);
      setSessions(s => s.filter(sess => sess._id !== id));
      toast.success('Session revoked');
    } catch { toast.error('Failed to revoke session'); }
    finally { setRevoking(null); }
  };

  const revokeAll = async () => {
    if (!confirm('Revoke all other active sessions?')) return;
    try {
      await api.delete('/sessions/all');
      await fetchSessions();
      toast.success('All other sessions revoked');
    } catch { toast.error('Failed to revoke sessions'); }
  };

  const parseBrowser = (ua: string): string => {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  };

  const parseOS = (ua: string): string => {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown OS';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Active Sessions</h1>
          <p className="text-slate-400 text-sm mt-1">Manage where you're currently signed in</p>
        </div>
        {sessions.length > 1 && (
          <button onClick={revokeAll} className="btn-danger">
            <ShieldOff className="w-4 h-4" /> Revoke All Others
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border">
          <span className="text-sm font-medium text-slate-300">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <MonitorSmartphone className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No active sessions found.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {sessions.map((session, idx) => (
              <div key={session._id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-raised/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-surface-overlay border border-surface-border flex items-center justify-center flex-shrink-0">
                  <MonitorSmartphone className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {parseBrowser(session.userAgent)} on {parseOS(session.userAgent)}
                    </span>
                    {idx === 0 && (
                      <span className="badge badge-green text-[10px]">Current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-500 font-mono">{session.ipAddress}</span>
                    {session.location && <>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-500">{session.location}</span>
                    </>}
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">
                      Active {formatRelative(session.lastActivity)}
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">
                      Started {formatDateTime(session.createdAt)}
                    </span>
                  </div>
                </div>

                {idx !== 0 && (
                  <button onClick={() => revoke(session._id)} disabled={revoking === session._id}
                    className="btn-ghost p-2 text-slate-500 hover:text-red-400">
                    {revoking === session._id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

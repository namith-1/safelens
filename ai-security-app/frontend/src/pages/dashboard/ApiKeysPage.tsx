// src/pages/dashboard/ApiKeysPage.tsx
import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Trash2, ShieldOff, Loader2, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { ApiKey } from '@/types';
import { formatRelative, formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/LoadingScreen';
import toast from 'react-hot-toast';

export const ApiKeysPage = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const fetchKeys = async () => {
    try {
      const { data } = await api.get('/apikeys');
      setKeys(data.data.keys);
    } catch { toast.error('Failed to load API keys'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? Any services using it will lose access.')) return;
    try {
      await api.patch(`/apikeys/${id}/revoke`);
      setKeys(k => k.map(key => key._id === id ? { ...key, isActive: false } : key));
      toast.success('API key revoked');
    } catch { toast.error('Failed to revoke key'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key permanently?')) return;
    try {
      await api.delete(`/apikeys/${id}`);
      setKeys(k => k.filter(key => key._id !== id));
      toast.success('API key deleted');
    } catch { toast.error('Failed to delete key'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">API Keys</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your API access credentials</p>
        </div>
      </div>

      {/* New key revealed banner */}
      {newKeyValue && (
        <div className="card border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-emerald-400 text-sm font-medium mb-2">
                ⚠️ Copy your API key now — it won't be shown again
              </p>
              <div className="flex items-center gap-2 bg-surface-raised rounded-lg px-4 py-2.5 font-mono text-sm text-slate-300 border border-surface-border">
                <span className="flex-1 truncate">{showKey ? newKeyValue : '•'.repeat(40)}</span>
                <button onClick={() => setShowKey(v => !v)} className="text-slate-500 hover:text-white ml-2">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => copyToClipboard(newKeyValue)} className="text-slate-500 hover:text-white">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button onClick={() => setNewKeyValue(null)} className="text-slate-600 hover:text-white text-xs mt-1">✕</button>
          </div>
        </div>
      )}

  

      {/* Keys list */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-300">{keys.length} key{keys.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <Key className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {keys.map(key => (
              <div key={key._id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-raised/50 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${key.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{key.name}</span>
                    {!key.isActive && <span className="badge badge-gray">Revoked</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-xs text-slate-500 font-mono select-none" title="Masked display only — the full key was shown once when created">{key.prefix}••••••••••••••••{key.last4}</code>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">
                      {key.lastUsed ? `Used ${formatRelative(key.lastUsed)}` : 'Never used'}
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">Created {formatDate(key.createdAt)}</span>
                  </div>
                </div>

                {/* Usage bar */}
                <div className="hidden sm:block w-28">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{key.usageCount.toLocaleString()}</span>
                    <span className="text-slate-600">{key.monthlyLimit.toLocaleString()}</span>
                  </div>
                  <div className="h-1 bg-surface-raised rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min((key.usageCount / key.monthlyLimit) * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {key.isActive && (
                    <button onClick={() => handleRevoke(key._id)} title="Revoke" className="btn-ghost p-2 text-slate-500 hover:text-amber-400">
                      <ShieldOff className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(key._id)} title="Delete" className="btn-ghost p-2 text-slate-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

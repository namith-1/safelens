// src/pages/dashboard/ExtensionSetupPage.tsx
//
// One-stop page for connecting the VS Code SafeLens extension to this backend.
// - Shows the backend URL the user must paste into VS Code settings
// - Lets them generate a scoped extension API key (never stored in plaintext)
// - Gives step-by-step copy-paste instructions
// - Works for both local dev and cloud (reads VITE_API_URL from config.ts)

import { useState, useEffect } from 'react';
import {
  Puzzle, Copy, CheckCheck, Plus, Loader2, Key, Trash2,
  ShieldCheck, AlertTriangle, ExternalLink, RefreshCw, Eye, EyeOff,
  Terminal, Settings, ChevronRight
} from 'lucide-react';
import api from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { cn, formatDate, formatRelative } from '@/lib/utils';
import { Skeleton } from '@/components/ui/LoadingScreen';
import toast from 'react-hot-toast';

interface ExtensionApiKey {
  _id: string;
  name: string;
  prefix: string;
  last4: string;
  scope: string;
  lastUsed?: string;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text, label = '' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className={cn('flex items-center gap-1.5 text-xs transition-colors',
        copied ? 'text-emerald-400' : 'text-slate-500 hover:text-white')}>
      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label || 'Copy'}
    </button>
  );
}

// ─── Code block with copy ─────────────────────────────────────────────────────
function CodeBlock({ value, label }: { value: string; label?: string }) {
  return (
    <div className="rounded-lg bg-navy-950 border border-surface-border overflow-hidden">
      {label && (
        <div className="px-3 py-1.5 bg-surface-raised border-b border-surface-border flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">{label}</span>
          <CopyButton text={value} />
        </div>
      )}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <code className="text-sm font-mono text-accent-blue break-all">{value}</code>
        {!label && <CopyButton text={value} />}
      </div>
    </div>
  );
}

// ─── Step badge ───────────────────────────────────────────────────────────────
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600/20 border border-blue-600/30
                      flex items-center justify-center text-xs font-bold text-accent-blue mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0 pb-6 border-b border-surface-border last:border-0 last:pb-0">
        <p className="text-sm font-semibold text-white mb-3">{title}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const ExtensionSetupPage = () => {
  const [keys, setKeys] = useState<ExtensionApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState('My VS Code');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(true);

  const backendUrl = API_BASE_URL;

  const fetchKeys = async () => {
    try {
      const { data } = await api.get('/apikeys');
      setKeys((data.data.keys as ExtensionApiKey[]).filter(k => k.scope === 'extension'));
    } catch { toast.error('Failed to load extension keys'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!keyName.trim()) { toast.error('Key name is required'); return; }
    setCreating(true);
    try {
      const { data } = await api.post('/apikeys', { name: keyName.trim(), scope: 'extension' });
      setNewKeyValue(data.data.key);
      setTimeout(() => {
    document.getElementById('new-key-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, 100);
      setShowNewKey(true);
      setKeyName('My VS Code');
      await fetchKeys();
      toast.success('Extension API key created');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to create key');
    } finally { setCreating(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this extension key? The extension will stop working until you update it.')) return;
    try {
      await api.patch(`/apikeys/${id}/revoke`);
      setKeys(k => k.map(key => key._id === id ? { ...key, isActive: false } : key));
      toast.success('Key revoked');
    } catch { toast.error('Failed to revoke key'); }
  };

  const handleRegenerate = async (id: string, name: string) => {
  if (!confirm(`Regenerate "${name}"? The old key will be revoked and a new one created.`)) return;
  try {
    await api.patch(`/apikeys/${id}/revoke`);
    const { data } = await api.post('/apikeys', { name, scope: 'extension' });
    setNewKeyValue(data.data.key);
    setShowNewKey(true);
    await fetchKeys();
    toast.success('New key generated — copy it from the banner above');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e: unknown) {
    toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to regenerate key');
  }
};
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this key permanently?')) return;
    try {
      await api.delete(`/apikeys/${id}`);
      setKeys(k => k.filter(key => key._id !== id));
      toast.success('Key deleted');
    } catch { toast.error('Failed to delete key'); }
  };

  // VS Code settings JSON the user can paste directly
  const vscodeSettings = newKeyValue
    ? JSON.stringify({
        'safelens.backendUrl':   backendUrl,
        'safelens.backendToken': newKeyValue,
      }, null, 2)
    : null;

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2.5">
          <Puzzle className="w-6 h-6 text-accent-blue" /> Extension Setup
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Connect your VS Code SafeLens extension to this backend
        </p>
      </div>

      {/* Backend URL card */}

      {/* New key revealed banner */}
      {newKeyValue && (
        <div  id="new-key-banner"  className="card border-emerald-500/30 bg-emerald-500/5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <p className="text-emerald-400 text-sm font-medium">Key created — copy the full key below into VS Code. Do not copy the masked preview in the list.</p>
          </div>

          <CodeBlock value={newKeyValue} label="safelens.backendToken" />

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                window.location.href = `vscode://Namith011.safelens/auth?token=${encodeURIComponent(newKeyValue)}`;
                toast.success('Syncing key to VS Code...');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-2 shadow transition-colors"
            >
              🔌 Auto-Sync to VS Code
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKeyValue);
                toast.success('Copied API Key to clipboard!');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              📋 Copy to Clipboard
            </button>
          </div>

          {vscodeSettings && (
            <div className="rounded-lg bg-navy-950 border border-surface-border overflow-hidden">
              <div className="px-3 py-1.5 bg-surface-raised border-b border-surface-border flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">settings.json — paste both at once</span>
                <CopyButton text={vscodeSettings} label="Copy both" />
              </div>
              <pre className="px-4 py-3 text-xs font-mono text-slate-300 overflow-x-auto">{vscodeSettings}</pre>
            </div>
          )}

          <button onClick={() => setNewKeyValue(null)}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors block">
            Dismiss
          </button>
        </div>
      )}

      {/* Step-by-step instructions */}
      <div className="card space-y-0">
        <h2 className="font-semibold text-white mb-6 flex items-center gap-2">
          <Settings className="w-4 h-4 text-accent-blue" />
          Setup Instructions
        </h2>

        <div className="space-y-0">
          <Step n={1} title="Generate an extension API key below">
            <p className="text-sm text-slate-400 leading-relaxed">
              Click "Generate Key" below. The full key is shown only once — copy it immediately.
              Extension keys are separate from your web API keys so you can revoke VS Code access independently.
            </p>
          </Step>

          <Step n={2} title='Open VS Code Settings (JSON)'>
            <p className="text-sm text-slate-400 mb-3 leading-relaxed">
              Press <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay border border-surface-border text-xs font-mono">Ctrl+Shift+P</kbd> →
              type <strong className="text-white">"SΛFΞLΞNS: Setup API Key"</strong> → press Enter.
            </p>
          </Step>

          <Step n={3} title="Add this settings">
            <p className="text-sm text-slate-400 mb-3">Paste inside SΛFΞLΞNS: Setup API Key:</p>
            <div className="rounded-lg bg-navy-950 border border-surface-border overflow-hidden">
              <div className="px-3 py-1.5 bg-surface-raised border-b border-surface-border flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">settings.json</span>
                <CopyButton
                  text={`"safelens.backendToken": "<paste the sk-... key here>"`}
                  label="Copy template"
                />
              </div>
              <pre className="px-4 py-3 text-xs font-mono text-slate-300 leading-relaxed">{
              `"safelens.backendToken": "<paste the sk-... key here>"`
              }</pre>
            </div>
          </Step>

          <Step n={4} title="Test the connection">
            <p className="text-sm text-slate-400 leading-relaxed">
              Open any file in VS Code → right-click → <strong className="text-white">SafeLens: Scan Current File</strong>.
              The AI explanations in the sidebar will now come from your backend.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Having issues? Check out our <a href="https://docs.safelens.com/extension-troubleshooting" target="_blank" className="underline hover:text-white">troubleshooting guide</a>.</span>
            </div>
          </Step>
        </div>
      </div>

      {/* Generate key section */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-accent-blue" />
          Extension API Keys
        </h2>

        {/* Create form */}
        <div className="flex gap-2">
          <input className="input flex-1" placeholder='Key name (e.g. "My MacBook VS Code")'
            value={keyName} onChange={e => setKeyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button onClick={handleCreate} className="btn-primary flex-shrink-0" disabled={creating}>
            {creating
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Plus className="w-4 h-4" /> Generate Key</>}
          </button>
        </div>

        {/* Key list */}
        {loading ? (
          <div className="space-y-2">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-slate-600">
            <Key className="w-7 h-7 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No extension keys yet. Generate one above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border rounded-xl border border-surface-border overflow-hidden">
            {keys.map(key => (
              <div key={key._id} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-raised/50 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${key.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{key.name}</span>
                    {!key.isActive && <span className="badge badge-gray">Revoked</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
<code className="text-xs text-slate-500 font-mono" title="Masked preview — to get a new copyable key, click the regenerate button">{key.prefix}••••••••••••••••{key.last4}</code>
                    <span className="text-xs text-slate-500">
                      {key.lastUsed ? `Used ${formatRelative(key.lastUsed)}` : 'Never used'}
                    </span>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">{key.usageCount} calls</span>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500">{formatDate(key.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {key.isActive && (
  <>
    <button onClick={() => handleRegenerate(key._id, key.name)} title="Regenerate — revokes this key and creates a new one"
      className="btn-ghost p-1.5 text-slate-500 hover:text-blue-400">
      <RefreshCw className="w-4 h-4" />
    </button>
    <button onClick={() => handleRevoke(key._id)} title="Revoke"
      className="btn-ghost p-1.5 text-slate-500 hover:text-amber-400">
      <ShieldCheck className="w-4 h-4" />
    </button>
  </>
)}
                  <button onClick={() => handleDelete(key._id)} title="Delete"
                    className="btn-ghost p-1.5 text-slate-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cloud migration note */}
      
    </div>
  );
};

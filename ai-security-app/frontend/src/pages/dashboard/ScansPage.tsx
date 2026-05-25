// src/pages/dashboard/ScansPage.tsx
import { useState, useEffect, useRef, FormEvent } from 'react';
import {
  ScanLine, Trash2, Loader2, Globe, FileText,
  Server, Link2, ChevronLeft, ChevronRight, ArrowLeft,
  Brain, Send, AlertTriangle,
  Lightbulb, CheckCheck, Copy, ChevronDown, ChevronUp,
  Shield,
} from 'lucide-react';
import api from '@/lib/api';
import { Scan } from '@/types';
import { threatColor, formatDateTime, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/LoadingScreen';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
const TYPE_ICONS: Record<string, React.ElementType> = {
  url: Link2, file: FileText, ip: Server, domain: Globe, semgrep: Shield,
};
const SEV_BAR: Record<string, string> = {
  info: 'bg-slate-500', low: 'bg-blue-400',
  medium: 'bg-amber-400', high: 'bg-red-400', critical: 'bg-red-600',
};
const RISK_STYLE: Record<string, string> = {
  critical: 'text-red-400 border-red-500/30 bg-red-500/10',
  high:     'text-orange-400 border-orange-500/30 bg-orange-500/10',
  medium:   'text-amber-400 border-amber-500/30 bg-amber-500/10',
  low:      'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  none:     'text-slate-400 border-slate-500/30 bg-slate-500/10',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string; timestamp: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-sm text-slate-300 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <p key={i} className="text-white font-semibold mt-3">{line.slice(3)}</p>;
        if (line.startsWith('# '))  return <p key={i} className="text-white font-bold text-base mt-3">{line.slice(2)}</p>;
        if (line.startsWith('- ') || line.startsWith('* ')) return (
          <p key={i} className="flex gap-2"><span className="text-accent-blue mt-0.5">•</span><span>{line.slice(2)}</span></p>
        );
        if (line.startsWith('```')) return <div key={i} className="border-t border-surface-border my-1" />;
        if (/^\d+\. /.test(line)) return (
          <p key={i} className="flex gap-2">
            <span className="text-slate-500 w-5 flex-shrink-0">{line.match(/^\d+/)?.[0]}.</span>
            <span>{line.replace(/^\d+\. /, '')}</span>
          </p>
        );
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/(`[^`]+`)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('`') && part.endsWith('`')
                ? <code key={j} className="font-mono text-xs bg-surface-overlay px-1.5 py-0.5 rounded text-accent-blue">{part.slice(1, -1)}</code>
                : <span key={j}>{part}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-raised hover:bg-surface-overlay transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Icon className="w-4 h-4 text-accent-blue" />{title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="p-4 bg-surface">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI Chat — scoped to a scan's findings
// ═══════════════════════════════════════════════════════════════════════════════
function ScanChat({ scan }: { scan: Scan }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const STARTERS = [
    'Summarize the risk level of this scan',
    'Which finding should I fix first?',
    'Explain the most critical vulnerability found',
    'Give me code fixes for the high severity issues',
  ];

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', {
        messages: nextHistory,
        contextFindings: scan.findings,
        activeFinding: null,
      });
      setMessages(m => [...m, data.data.message]);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Chat failed');
      setMessages(m => m.slice(0, -1));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col" style={{ height: '420px' }}>
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-accent-blue" />
            </div>
            <p className="text-slate-400 text-sm max-w-xs">
              Ask the AI about this scan's findings. It has full context of all {scan.findings.length} vulnerabilities found.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {STARTERS.map(s => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-left px-3 py-2.5 rounded-lg border border-surface-border bg-surface-raised hover:border-accent-blue/40 text-xs text-slate-400 hover:text-white transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-accent-blue" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-xl px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-blue-600/20 border border-blue-600/30 text-slate-200 rounded-br-sm'
                  : 'bg-surface-raised border border-surface-border text-slate-300 rounded-bl-sm'
              )}>
                {msg.role === 'assistant'
                  ? <SimpleMarkdown text={msg.content} />
                  : <p className="leading-relaxed">{msg.content}</p>}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
              <Brain className="w-3.5 h-3.5 text-accent-blue" />
            </div>
            <div className="flex gap-1 px-4 py-3 rounded-xl bg-surface-raised border border-surface-border">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-surface-border mt-3">
        <input className="input flex-1" placeholder="Ask about this scan..."
          value={input} onChange={e => setInput(e.target.value)} disabled={loading} />
        <button type="submit" className="btn-primary px-3" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
      {messages.length > 0 && (
        <button onClick={() => setMessages([])} className="text-xs text-slate-600 hover:text-slate-400 mt-2 text-center transition-colors">
          Clear conversation
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scan Detail
// ═══════════════════════════════════════════════════════════════════════════════
function ScanDetail({ scan, onBack }: { scan: Scan; onBack: () => void }) {
  const { copied, copy } = useCopy();
  const Icon = TYPE_ICONS[scan.type] ?? FileText;

  const severityCounts = scan.findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <button onClick={onBack}
          className="mt-1 p-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-600 transition-all flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-surface-overlay border border-surface-border flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xs text-slate-500 capitalize font-medium">{scan.type} scan</span>
            <span className="text-slate-700">·</span>
            <span className="text-xs text-slate-500">{formatDateTime(scan.createdAt)}</span>
          </div>
          <h1 className="font-display text-xl font-bold text-white truncate">{scan.target}</h1>
        </div>
        <div className={cn('px-3 py-1.5 rounded-lg border text-sm font-medium capitalize flex-shrink-0', RISK_STYLE[scan.threatLevel])}>
          {scan.threatLevel === 'none' ? 'Clean' : scan.threatLevel}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total findings', value: scan.findings.length },
          { label: 'Critical / High', value: (severityCounts['critical'] || 0) + (severityCounts['high'] || 0), accent: 'text-red-400' },
          { label: 'Medium', value: severityCounts['medium'] || 0, accent: 'text-amber-400' },
          { label: 'Low / Info', value: (severityCounts['low'] || 0) + (severityCounts['info'] || 0), accent: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className={cn('text-2xl font-bold font-mono', s.accent ?? 'text-white')}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {scan.findings.length > 0 && (
        <Section title={`Findings (${scan.findings.length})`} icon={AlertTriangle}>
          <div className="space-y-2">
            {scan.findings.map((f, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border">
                <div className={cn('w-1 rounded-full flex-shrink-0', SEV_BAR[f.severity] ?? 'bg-slate-500')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-white">{f.category}</span>
                    <span className={cn('badge text-[10px]', threatColor(f.severity))}>{f.severity}</span>
                    {f.file && <span className="text-[10px] text-slate-600 font-mono truncate max-w-[200px]">{f.file}</span>}
                  </div>
                  <p className="text-xs text-slate-400">{f.description}</p>
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-start gap-1">
                    <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {f.recommendation}
                  </p>
                </div>
                <button onClick={() => copy(f.description)} className="btn-ghost p-1.5 flex-shrink-0 self-start">
                  {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="AI Chat — scoped to this scan" icon={Brain}>
        <ScanChat scan={scan} />
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scans List Page
// ═══════════════════════════════════════════════════════════════════════════════
export const ScansPage = () => {
  const [allScans, setAllScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  const totalPages = Math.ceil(allScans.length / PAGE_SIZE);
  const paginated = allScans.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fetchScans = async () => {
    try {
      const { data } = await api.get('scans/scan-results');
      const scans: Scan[] = data.data?.scans ?? data.data ?? [];
      setAllScans(scans);
    } catch { toast.error('Failed to load scans'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this scan record?')) return;
    try {
      await api.delete(`scans/scan-results/${id}`);
      setAllScans(s => s.filter(scan => scan._id !== id));
      if (selectedScan?._id === id) setSelectedScan(null);
      toast.success('Scan deleted');
    } catch { toast.error('Failed to delete scan'); }
  };

  useEffect(() => { fetchScans(); }, []);

  useEffect(() => {
    const hasRunning = allScans.some(s => s.status === 'running' || s.status === 'pending');
    if (!hasRunning) return;
    const interval = setInterval(fetchScans, 3000);
    return () => clearInterval(interval);
  }, [allScans]);

  if (selectedScan) {
    return <ScanDetail scan={selectedScan} onBack={() => setSelectedScan(null)} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Threat Scans</h1>
          <p className="text-slate-400 text-sm mt-1">
            Scans are pushed here automatically from the SΛFΞLΞNS VS Code extension
          </p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-3 border-b border-surface-border flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {allScans.length === 0 ? 'No scans' : (
              <>
                <span className="text-white font-medium">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, allScans.length)}
                </span>
                {' '}of{' '}
                <span className="text-white font-medium">{allScans.length}</span>
              </>
            )}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500 px-2 tabular-nums">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : allScans.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <ScanLine className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No scans yet. Scans from the VS Code extension will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {paginated.map(scan => {
              const Icon = TYPE_ICONS[scan.type] ?? FileText;
              return (
                <div
                  key={scan._id}
                  onClick={() => setSelectedScan(scan)}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-surface-raised/60 transition-colors cursor-pointer group">

                  <div className="w-8 h-8 rounded-lg bg-surface-overlay border border-surface-border flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate font-mono group-hover:text-accent-blue transition-colors">
                      {scan.target}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500 capitalize">{scan.type}</span>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-500">{formatDateTime(scan.createdAt)}</span>
                      {scan.findings.length > 0 && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-xs text-slate-500">
                            {scan.findings.length} finding{scan.findings.length !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(scan.status === 'running' || scan.status === 'pending') ? (
                      <span className="badge badge-blue">
                        <Loader2 className="w-3 h-3 animate-spin" /> Running
                      </span>
                    ) : scan.status === 'failed' ? (
                      <span className="badge badge-red">Failed</span>
                    ) : (
                      <span className={cn('badge', threatColor(scan.threatLevel))}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {scan.threatLevel === 'none' ? 'Clean' : scan.threatLevel}
                      </span>
                    )}

                    <button
                      onClick={e => handleDelete(e, scan._id)}
                      className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && !loading && (
          <div className="px-6 py-3 border-t border-surface-border flex items-center justify-end gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 px-2 tabular-nums">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

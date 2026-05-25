// src/pages/dashboard/AIServicePage.tsx
//
// Dashboard page with AI chat endpoint:
//   - Chat — ask the AI anything about security with optional context

import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  Brain, Send, Loader2, Copy, CheckCheck,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { ChatMessage } from '@/types';

// ─── Shared "copy to clipboard" hook ─────────────────────────────────────────
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

// ─── Markdown-ish renderer (simple, no dep) ──────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const code = codeLines.join('\n');
      const { copy, copied } = useCopyToClipboard();
      elements.push(
        <div key={`code-${i}`} className="relative bg-slate-950 border border-slate-700 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto">
          {lang && <div className="text-slate-500 text-xs mb-2">{lang}</div>}
          <pre className="text-slate-300 whitespace-pre-wrap break-words">{code}</pre>
          <button onClick={() => copy(code)} className="absolute top-2 right-2 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
            {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      );
      i++;
      continue;
    }

    // Headers
    if (line.trim().startsWith('###')) {
      elements.push(<h4 key={`h4-${i}`} className="font-semibold text-slate-200 mt-3 mb-1">{line.replace(/^#+/, '').trim()}</h4>);
      i++;
      continue;
    }
    if (line.trim().startsWith('##')) {
      elements.push(<h3 key={`h3-${i}`} className="font-bold text-slate-100 text-base mt-4 mb-2">{line.replace(/^#+/, '').trim()}</h3>);
      i++;
      continue;
    }
    if (line.trim().startsWith('#')) {
      elements.push(<h2 key={`h2-${i}`} className="font-bold text-white text-lg mt-4 mb-2">{line.replace(/^#+/, '').trim()}</h2>);
      i++;
      continue;
    }

    // List items
    if (line.trim().startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-slate-300">
          {items.map((item, idx) => <li key={idx}>{item}</li>)}
        </ul>
      );
      continue;
    }

    // Paragraphs
    if (line.trim()) {
      elements.push(<p key={`p-${i}`} className="text-slate-300 leading-relaxed my-1">{line}</p>);
    }
    i++;
  }

  return <div className="space-y-2">{elements}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Chat Component
// ═══════════════════════════════════════════════════════════════════════════════
function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
        contextFindings: [],
        activeFinding: null,
      });
      setMessages(m => [...m, data.data.message]);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Chat request failed');
      setMessages(m => m.slice(0, -1)); // remove optimistic user msg
    } finally { setLoading(false); }
  };

  const STARTERS = [
    'What is SQL injection and how do I prevent it?',
    'Explain XSS and give me a safe code example.',
    'What are the OWASP Top 10 for 2024?',
    'How do I securely store passwords in Node.js?',
  ];

  return (
    <div className="flex flex-col" style={{ height: '520px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-accent-blue" />
            </div>
            <p className="text-slate-400 text-sm max-w-xs">Ask the AI anything about security vulnerabilities, code fixes, or your scan results.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
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

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-surface-border mt-3">
        <input className="input flex-1" placeholder="Ask about security vulnerabilities..."
          value={input} onChange={e => setInput(e.target.value)} disabled={loading} autoFocus />
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
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export const AIServicePage = () => {
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2.5">
          <Brain className="w-6 h-6 text-accent-blue" /> AI Security Service
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Powered by Groq · llama-3.3-70b — all AI processing happens in your backend, never client-side
        </p>
      </div>

      {/* Chat Panel */}
      <div className="card">
        <ChatTab />
      </div>

      {/* Info footer */}
      <div className="flex items-start gap-2 text-xs text-slate-600 p-3 rounded-lg border border-surface-border bg-surface-raised">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>
          All AI requests are proxied through your backend and authenticated with your JWT token.
          Each request counts toward your plan's API call quota.
          Your Groq API key is stored only in <code className="font-mono">.env</code> — never sent to the browser.
        </p>
      </div>
    </div>
  );
};

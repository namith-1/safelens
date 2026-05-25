// src/components/layout/DashboardLayout.tsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Key, ScanLine, MonitorSmartphone,
  CreditCard, BookOpen, Settings, LogOut, Menu, X, ChevronRight, Bell, Brain, Puzzle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn, planBadge } from '@/lib/utils';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard',          icon: LayoutDashboard,   label: 'Overview'      },
  { to: '/dashboard/scans',    icon: ScanLine,          label: 'Threat Scans'  },
  { to: '/dashboard/ai',         icon: Brain,             label: 'AI Service'    },
  { to: '/dashboard/extension',   icon: Puzzle,            label: 'Extension Setup' },
  { to: '/dashboard/apikeys',  icon: Key,               label: 'API Keys'      },
  { to: '/dashboard/sessions', icon: MonitorSmartphone, label: 'Sessions'      },
  { to: '/dashboard/billing',  icon: CreditCard,        label: 'Billing'       },
  { to: '/dashboard/tutorials',icon: BookOpen,          label: 'Tutorials'     },
];

const NavItem = ({ to, icon: Icon, label, collapsed, onClick }: {
  to: string; icon: React.ElementType; label: string; collapsed: boolean; onClick?: () => void;
}) => (
  <NavLink to={to} end={to === '/dashboard'} onClick={onClick}
    className={({ isActive }) => cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
      isActive
        ? 'bg-blue-600/15 text-white border border-blue-600/30'
        : 'text-slate-400 hover:text-white hover:bg-surface-raised border border-transparent'
    )}>
    <Icon className="w-4 h-4 flex-shrink-0" />
    {!collapsed && <span className="truncate">{label}</span>}
    {!collapsed && (
      <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
    )}
  </NavLink>
);

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const SidebarContent = ({ isMobile = false }) => (
  <div className="flex flex-col h-full">
    {/* 1. Logo Section */}
    <div className={cn(
      'flex items-center gap-3 px-3 py-5 border-b border-surface-border mb-2', 
      collapsed && !isMobile && 'justify-center px-2'
    )}>
      {/* Logo Image Container */}
      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 overflow-hidden rounded-md group">
         <img 
            src="/c.png" 
            alt="SΛFΞLΞNS logo"
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
          />
      </div>

      {/* Gradient Text Name */}
      {(!collapsed || isMobile) && (
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
      )}
    </div>

    {/* 2. Navigation Section */}
    <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
      {NAV_ITEMS.map(item => (
        <NavItem 
          key={item.to} 
          {...item} 
          collapsed={collapsed && !isMobile}
          onClick={() => isMobile && setMobileOpen(false)} 
        />
      ))}
    </nav>

    {/* 3. Bottom Section */}
    <div className="px-2 pb-4 border-t border-surface-border pt-3 space-y-0.5">
      <NavItem 
        to="/dashboard/settings" 
        icon={Settings} 
        label="Settings"
        collapsed={collapsed && !isMobile} 
        onClick={() => isMobile && setMobileOpen(false)} 
      />

      {/* User Info */}
      <div className={cn('flex items-center gap-3 px-3 py-2.5 mt-1', collapsed && !isMobile && 'justify-center')}>
        <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-600/40 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-accent-blue">
            {user?.fullName?.charAt(0).toUpperCase()}
          </span>
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.fullName}</p>
            <span className={cn('text-[10px]', planBadge(user?.plan || 'free'))}>
              {user?.plan?.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <button 
        onClick={handleLogout}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200', 
          collapsed && !isMobile && 'justify-center'
        )}
      >
        <LogOut className="w-4 h-4 flex-shrink-0" />
        {(!collapsed || isMobile) && <span>Sign Out</span>}
      </button>
    </div>
  </div>
);

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-surface border-r border-surface-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-surface-border">
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-surface border-b border-surface-border flex items-center gap-3 px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden btn-ghost p-2">
            <Menu className="w-5 h-5" />
          </button>
          <button onClick={() => setCollapsed(v => !v)} className="hidden lg:flex btn-ghost p-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button className="btn-ghost p-2 relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-blue rounded-full" />
          </button>
          <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-600/40 flex items-center justify-center">
            <span className="text-xs font-bold text-accent-blue">
              {user?.fullName?.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

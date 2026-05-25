// src/pages/dashboard/OverviewPage.tsx
import { useAuth } from '@/context/AuthContext';
import { useDashboard } from '@/hooks/useDashboard';
import { Skeleton } from '@/components/ui/LoadingScreen';
import { ScanLine, ShieldAlert, MonitorSmartphone, Key, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRelative, threatDot, cn } from '@/lib/utils';

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) => (
  <div className="card flex items-start gap-4">
    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  </div>
);

export const OverviewPage = () => {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();
  console.log(data,'Dashboard overview data in component');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Extension Link Banner */}
      <div className="card border-blue-500/30 bg-blue-500/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-base flex items-center gap-2">🔌 Connect to VS Code</h3>
          <p className="text-slate-400 text-sm mt-1">Automatically synchronize your API credentials to use SafeLens security audits directly in VS Code.</p>
        </div>
        <Link to="/dashboard/extension" className="btn-primary py-2 px-4 text-sm justify-center flex-shrink-0">
          Sync Extension <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          {greeting}, {user?.fullName?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">Here's what's happening with your security posture</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard icon={ScanLine}        label="Total Scans"        value={data?.stats.totalScans ?? 0}      color="bg-blue-600/10 border-blue-600/20 text-accent-blue"  />
            <StatCard icon={ShieldAlert}      label="High Threats (7d)"  value={data?.stats.recentThreats ?? 0}   color="bg-red-500/10 border-red-500/20 text-red-400"         />
            <StatCard icon={MonitorSmartphone}label="Active Sessions"    value={data?.stats.activeSessions ?? 0}  color="bg-emerald-500/10 border-emerald-500/20 text-emerald-400" />
            <StatCard icon={Key}              label="Active API Keys"    value={data?.stats.activeApiKeys ?? 0}   color="bg-amber-500/10 border-amber-500/20 text-amber-400"   />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Scan Activity Chart */}
  <div className="lg:col-span-2 card">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-blue" />
          Scan Activity (7 days)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Scans and threats detected daily</p>
      </div>
      <Link to="/dashboard/scans" className="btn-ghost text-xs">
        View All <ArrowRight className="w-3 h-3 ml-1" />
      </Link>
    </div>

    {isLoading ? (
  <Skeleton className="h-40 rounded-lg" />
) : (
  <div className="relative h-40 pt-2">
    {/* Empty State Overlay */}
    {data?.scanActivity?.length === 0 && (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/50 backdrop-blur-[1px] rounded-lg">
        <p className="text-xs text-slate-500 font-medium">No activity data for this period</p>
        <p className="text-[10px] text-slate-600">Start a scan to see history</p>
      </div>
    )}

    <div className="flex items-end gap-2 h-full px-1">
      {(() => {
        // Use the empty array from your log, or fallback to 7 empty days
        const activity = data?.scanActivity?.length ? data.scanActivity : Array(7).fill({ _id: null, count: 0, threats: 0 });
        const maxCount = Math.max(...activity.map(d => Number(d.count) || 0), 1);

        return activity.map((d, i) => {
          const count = Number(d.count) || 0;
          const pct = (count / maxCount) * 100;

          return (
            <div key={i} className="flex-1 flex flex-col items-center h-full gap-2">
              <div className="w-full flex-1 flex items-end">
                <div 
                  className="w-full bg-blue-600/10 rounded-t-sm border-b border-blue-500/20" 
                  style={{ height: count > 0 ? `${pct}%` : '2px' }} 
                />
              </div>
              <span className="text-[10px] text-slate-700 font-mono">
                {/* Fallback days since _id is null in your log */}
                {d._id ? new Date(d._id).toLocaleDateString('en', { weekday: 'short' }).charAt(0) : '-'}
              </span>
            </div>
          );
        });
      })()}
    </div>
  </div>
)}

    {/* Legend */}
    <div className="flex items-center gap-4 mt-4 pt-2 border-t border-surface-border/50">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-blue-600/30" />
        <span className="text-xs text-slate-500">Scans</span>
      </div>
    </div>
  </div>

  {/* Plan Card */}
  <div className="card flex flex-col gap-4">
    <h2 className="font-semibold text-white">Current Plan</h2>
    {isLoading ? (
      <Skeleton className="h-48 rounded-lg" />
    ) : (
      <>
        <div className="flex items-center justify-between">
          <span className="font-display text-3xl font-bold text-white capitalize">
            {data?.billing?.plan ?? 'Free'}
          </span>
          <span className={cn(
            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
            data?.billing?.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
          )}>
            {data?.billing?.status ?? 'Inactive'}
          </span>
        </div>

        {/* Scans Usage */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Scans Used</span>
            <span className="text-slate-200 font-mono">
              {data?.billing?.scansUsed?.toLocaleString() ?? 0} / {data?.billing?.scansLimit?.toLocaleString() ?? 0}
            </span>
          </div>
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(((data?.billing?.scansUsed ?? 0) / (data?.billing?.scansLimit ?? 1)) * 100, 100)}%` }} 
            />
          </div>
        </div>

        {/* API Usage */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">API Calls</span>
            <span className="text-slate-200 font-mono">
              {data?.billing?.apiCallsUsed?.toLocaleString() ?? 0} / {data?.billing?.apiCallsLimit?.toLocaleString() ?? 0}
            </span>
          </div>
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(((data?.billing?.apiCallsUsed ?? 0) / (data?.billing?.apiCallsLimit ?? 1)) * 100, 100)}%` }} 
            />
          </div>
        </div>

        <Link to="/dashboard/billing" className="btn-secondary w-full justify-center text-xs mt-auto py-2.5">
          Manage Plan <ArrowRight className="w-3 h-3 ml-2" />
        </Link>
      </>
    )}
  </div>
</div>

      {/* Quick scan activity list */}
     <div className="card border-l-4 border-red-500/50 shadow-lg shadow-red-500/5">
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2">
      <div className="relative">
        <ShieldAlert className="w-5 h-5 text-red-500" />
        {/* Pulsing red dot if threats exist */}
        {(data?.stats?.recentThreats ?? 0) > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
        )}
      </div>
      <h2 className="font-semibold text-white">Recent Security Alerts</h2>
    </div>
    <Link to="/dashboard/scans" className="btn-ghost text-xs group">
      View Report <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
    </Link>
  </div>

  {isLoading ? (
    <div className="space-y-3">
      {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  ) : (data?.stats?.recentThreats ?? 0) > 0 ? (
    <div className="space-y-3">
      {/* Note: Ideally your backend should send a 'recentThreatsList' array. 
         If it doesn't yet, this UI generates a summary alert based on your stats.
      */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 group hover:bg-red-500/15 transition-all">
        <div className="p-2 rounded-lg bg-red-500/20 text-red-500">
          <MonitorSmartphone className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-red-100">See Critical Breaches</h3>
            <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
              JUST NOW
            </span>
          </div>
          <p className="text-xs text-red-200/70 mt-1 leading-relaxed">
            Successfully intercepted **{data?.stats?.recentThreats}** high-risk threats during your latest scans. 
    
          </p>
          
        </div>
      </div>
    </div>
  ) : (
    <div className="text-center py-10 opacity-50">
      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
        <ScanLine className="w-6 h-6 text-slate-500" />
      </div>
      <p className="text-sm text-slate-400">System Secure</p>
      <p className="text-[11px] text-slate-600 mt-1">No active threats found in the last 24 hours.</p>
    </div>
  )}
</div>
    </div>
  );
};

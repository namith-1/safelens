// src/pages/dashboard/BillingPage.tsx
import { useState, useEffect } from 'react';
import { CreditCard, Check, Loader2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { Billing } from '@/types';
import { formatDate, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/LoadingScreen';
import toast from 'react-hot-toast';

const PLANS = [
  {
    id: 'free', name: 'Free', price: '$0', period: '/mo',
    features: ['10 scans / month', '1 API key', '1,000 API calls', 'Basic reports'],
    color: 'border-surface-border',
  },
  {
    id: 'pro', name: 'Pro', price: '$29', period: '/mo',
    features: ['500 scans / month', '5 API keys', '50,000 API calls', 'Full reports', 'Webhooks', 'Priority support'],
    color: 'border-blue-600/40',
    highlight: true,
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '',
    features: ['Unlimited scans', 'Unlimited API keys', 'Unlimited API calls', 'Dedicated infrastructure', 'SLA', '24/7 support'],
    color: 'border-surface-border',
  },
];

export const BillingPage = () => {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/billing');
        setBilling(data.data.billing);
      } catch { toast.error('Failed to load billing'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === billing?.plan) return;
    if (planId === 'enterprise') { toast('Contact sales@aisecurity.com for Enterprise plans.'); return; }
    setUpgrading(planId);
    try {
      const { data } = await api.post('/billing/upgrade', { plan: planId });
      setBilling(data.data.billing);
      toast.success(`Upgraded to ${planId} plan!`);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Upgrade failed');
    } finally { setUpgrading(null); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Billing & Plan</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current usage */}
      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : billing && (
        <div className="card space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-white">Current Plan</h2>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="font-display text-3xl font-bold text-white capitalize">{billing.plan}</span>
                <span className={cn('badge capitalize', billing.status === 'active' ? 'badge-green' : 'badge-red')}>
                  {billing.status}
                </span>
              </div>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>Period ends</p>
              <p className="text-white font-medium">{formatDate(billing.currentPeriodEnd)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Scans Used</span>
                <span className="text-white font-mono">{billing.scansUsed} / {billing.scansLimit}</span>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all',
                  billing.scansUsed / billing.scansLimit > 0.8 ? 'bg-red-500' : 'bg-blue-500'
                )} style={{ width: `${Math.min((billing.scansUsed / billing.scansLimit) * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">API Calls</span>
                <span className="text-white font-mono">{billing.apiCallsUsed.toLocaleString()} / {billing.apiCallsLimit.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all',
                  billing.apiCallsUsed / billing.apiCallsLimit > 0.8 ? 'bg-red-500' : 'bg-emerald-500'
                )} style={{ width: `${Math.min((billing.apiCallsUsed / billing.apiCallsLimit) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan selector */}
      <div>
        <h2 className="font-semibold text-white mb-4">Change Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isCurrent = billing?.plan === plan.id;
            return (
              <div key={plan.id} className={cn(
                'rounded-xl border p-6 flex flex-col gap-5 transition-all duration-200',
                plan.highlight ? 'bg-blue-600/5' : 'bg-surface',
                isCurrent ? 'border-emerald-500/40' : plan.color
              )}>
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-white">{plan.name}</h3>
                    {isCurrent && <span className="badge badge-green text-[10px]">Current</span>}
                  </div>
                  <div className="flex items-end gap-1 mt-2">
                    <span className="font-display text-3xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-400 mb-0.5 text-sm">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || upgrading === plan.id}
                  className={cn(
                    'w-full justify-center',
                    isCurrent ? 'btn-ghost opacity-60 cursor-default' : plan.highlight ? 'btn-primary' : 'btn-secondary'
                  )}>
                  {upgrading === plan.id
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Upgrading...</>
                    : isCurrent ? 'Current Plan'
                    : plan.id === 'enterprise' ? <>Contact Sales <ArrowRight className="w-3.5 h-3.5" /></>
                    : `Switch to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

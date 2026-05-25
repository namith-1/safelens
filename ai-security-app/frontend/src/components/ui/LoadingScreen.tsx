// src/components/ui/LoadingScreen.tsx
export const LoadingScreen = () => (
  <div className="fixed inset-0 bg-navy-950 flex flex-col items-center justify-center gap-4 z-50">
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-2 border-surface-border" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-blue animate-spin" />
    </div>
    <span className="text-slate-500 text-sm font-mono tracking-widest animate-pulse">LOADING</span>
  </div>
);

// ─── Inline spinner for buttons / cards ──────────────────────────────────────
export const Spinner = ({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return (
    <div className={`${s} rounded-full border-2 border-transparent border-t-accent-blue animate-spin`} />
  );
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`bg-surface-raised rounded animate-pulse ${className}`} />
);

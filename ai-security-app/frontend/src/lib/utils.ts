// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const formatDate = (date: string | Date): string =>
  new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export const formatDateTime = (date: string | Date): string =>
  new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatRelative = (date: string | Date): string => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const threatColor = (level: string): string => ({
  none:     'badge-gray',
  low:      'badge-blue',
  medium:   'badge-yellow',
  high:     'badge-red',
  critical: 'badge-red',
}[level] ?? 'badge-gray');

export const threatDot = (level: string): string => ({
  none:     'bg-slate-400',
  low:      'bg-blue-400',
  medium:   'bg-amber-400',
  high:     'bg-red-400',
  critical: 'bg-red-500',
}[level] ?? 'bg-slate-400');

export const planBadge = (plan: string): string => ({
  free:       'badge-gray',
  pro:        'badge-blue',
  enterprise: 'badge-green',
}[plan] ?? 'badge-gray');

export const truncate = (str: string, n: number): string =>
  str.length > n ? str.slice(0, n) + '…' : str;

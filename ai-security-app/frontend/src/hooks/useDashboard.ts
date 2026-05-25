// src/hooks/useDashboard.ts
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { DashboardOverview } from '@/types';

export const useDashboard = () => {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/dashboard/overview');
      console.log(res.data.data,'Dashboard overview data');
      setData(res.data.data);
      setError(null);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to load dashboard');
      console.error('Dashboard fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);
  return { data, isLoading, error, refetch: fetch };
};

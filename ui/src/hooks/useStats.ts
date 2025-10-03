import { useState, useEffect } from 'react';
import type { TradingStats, ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:3001';
const POLL_INTERVAL = 5000; // 5 seconds

export function useStats() {
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        const data: ApiResponse<TradingStats> = await response.json();

        if (data.success && data.data) {
          setStats(data.data);
          setError(null);
        } else {
          setError(data.error || 'Failed to fetch statistics');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStats();

    // Poll for updates
    const interval = setInterval(fetchStats, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return { stats, loading, error };
}

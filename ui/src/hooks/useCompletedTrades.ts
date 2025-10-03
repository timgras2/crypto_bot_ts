import { useState, useEffect } from 'react';
import type { CompletedTrade, ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:3001';
const POLL_INTERVAL = 5000; // 5 seconds (completed trades change less frequently)

export function useCompletedTrades() {
  const [trades, setTrades] = useState<CompletedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/trades/completed`);
        const data: ApiResponse<CompletedTrade[]> = await response.json();

        if (data.success && data.data) {
          setTrades(data.data);
          setError(null);
        } else {
          setError(data.error || 'Failed to fetch completed trades');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchTrades();

    // Poll for updates
    const interval = setInterval(fetchTrades, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return { trades, loading, error };
}

import { useState, useEffect } from 'react';
import type { SerializedTradeState, ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:3001';
const POLL_INTERVAL = 3000; // 3 seconds

export function useActiveTrades() {
  const [trades, setTrades] = useState<SerializedTradeState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/trades/active`);
        const data: ApiResponse<SerializedTradeState[]> = await response.json();

        if (data.success && data.data) {
          setTrades(data.data);
          setError(null);
          setLastUpdate(new Date());
        } else {
          setError(data.error || 'Failed to fetch active trades');
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

  return { trades, loading, error, lastUpdate };
}

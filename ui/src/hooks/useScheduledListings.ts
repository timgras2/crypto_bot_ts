import { useState, useEffect } from 'react';
import type { ScheduledListing, ApiResponse } from '../types';

export function useScheduledListings() {
  const [listings, setListings] = useState<ScheduledListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:3001/api/schedule/listings');
      const result: ApiResponse<ScheduledListing[]> = await response.json();
      
      if (result.success && result.data) {
        setListings(result.data);
      } else {
        setError('Failed to fetch scheduled listings');
      }
    } catch (err) {
      setError('Network error fetching scheduled listings');
      console.error('Error fetching scheduled listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const addListing = async (
    symbol: string,
    listingTime: string,
    quoteCurrency: string = 'USDT',
    notes?: string
  ) => {
    try {
      const response = await fetch('http://localhost:3001/api/schedule/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          listingTime,
          quoteCurrency,
          notes,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        await fetchListings(); // Refresh the list
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Error adding scheduled listing:', err);
      return { success: false, error: 'Network error' };
    }
  };

  const removeListing = async (symbol: string, listingTime: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/schedule/listings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          listingTime,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        await fetchListings(); // Refresh the list
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Error removing scheduled listing:', err);
      return { success: false, error: 'Network error' };
    }
  };

  useEffect(() => {
    fetchListings();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchListings, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    listings,
    loading,
    error,
    addListing,
    removeListing,
    refresh: fetchListings,
  };
}

export function useUpcomingListings() {
  const [upcoming, setUpcoming] = useState<ScheduledListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpcoming = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:3001/api/schedule/upcoming');
      const result: ApiResponse<ScheduledListing[]> = await response.json();
      
      if (result.success && result.data) {
        setUpcoming(result.data);
      } else {
        setError('Failed to fetch upcoming listings');
      }
    } catch (err) {
      setError('Network error fetching upcoming listings');
      console.error('Error fetching upcoming listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcoming();
    
    // Poll for updates every 3 seconds for upcoming listings
    const interval = setInterval(fetchUpcoming, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    upcoming,
    loading,
    error,
    refresh: fetchUpcoming,
  };
}
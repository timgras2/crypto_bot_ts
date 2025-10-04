import React, { useState } from 'react';
import { useScheduledListings } from '../hooks/useScheduledListings';
import type { ScheduledListing } from '../types';

const ScheduledListingsTable: React.FC = () => {
  const { listings, loading, error, removeListing } = useScheduledListings();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'active': return 'text-red-400 animate-pulse';
      case 'completed': return 'text-green-400';
      case 'missed': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'active': return '🔥';
      case 'completed': return '✅';
      case 'missed': return '❌';
      default: return '❓';
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const getTimeUntil = (listingTime: string) => {
    const now = new Date();
    const listing = new Date(listingTime);
    const diffMs = listing.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Past';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  const handleRemove = async (listing: ScheduledListing) => {
    const listingId = `${listing.symbol}-${listing.listingTime}`;
    
    if (removingIds.has(listingId)) return;
    
    const confirmed = window.confirm(
      `Remove scheduled listing for ${listing.symbol}?\n` +
      `Time: ${formatDateTime(listing.listingTime)}\n` +
      `Status: ${listing.status}`
    );
    
    if (!confirmed) return;
    
    setRemovingIds(prev => new Set(prev).add(listingId));
    
    try {
      const result = await removeListing(listing.symbol, listing.listingTime);
      if (!result.success) {
        alert(`Failed to remove listing: ${result.error}`);
      }
    } catch (err) {
      alert('Failed to remove listing');
    } finally {
      setRemovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(listingId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md'>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>📅 Scheduled Listings</h2>
        <div className='text-gray-600 dark:text-gray-400'>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md'>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>📅 Scheduled Listings</h2>
        <div className='text-red-600 dark:text-red-400'>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md'>
      <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
        📅 Scheduled Listings ({listings.length})
      </h2>

      {listings.length === 0 ? (
        <div className='text-gray-600 dark:text-gray-400 text-center py-8'>
          No scheduled listings. Add one using the form above.
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700'>
                <th className='text-left p-3'>Status</th>
                <th className='text-left p-3'>Symbol</th>
                <th className='text-left p-3'>Listing Time</th>
                <th className='text-left p-3'>Time Until</th>
                <th className='text-left p-3'>Quote</th>
                <th className='text-left p-3'>Notes</th>
                <th className='text-left p-3'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const listingId = `${listing.symbol}-${listing.listingTime}`;
                const isRemoving = removingIds.has(listingId);

                return (
                  <tr key={listingId} className='border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'>
                    <td className='p-3'>
                      <span className={`flex items-center gap-2 ${getStatusColor(listing.status)}`}>
                        <span>{getStatusIcon(listing.status)}</span>
                        <span className='capitalize'>{listing.status}</span>
                      </span>
                    </td>
                    <td className='p-3 text-gray-900 dark:text-white font-mono'>{listing.symbol}</td>
                    <td className='p-3 text-gray-700 dark:text-gray-300 font-mono text-xs'>
                      {formatDateTime(listing.listingTime)}
                    </td>
                    <td className='p-3'>
                      <span className={`font-mono text-xs ${
                        listing.status === 'active' ? 'text-red-400 font-bold' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {getTimeUntil(listing.listingTime)}
                      </span>
                    </td>
                    <td className='p-3 text-gray-600 dark:text-gray-400'>{listing.quoteCurrency}</td>
                    <td className='p-3 text-gray-600 dark:text-gray-400 max-w-xs truncate'>
                      {listing.notes || '-'}
                    </td>
                    <td className='p-3'>
                      {listing.status === 'pending' && (
                        <button
                          onClick={() => handleRemove(listing)}
                          disabled={isRemoving}
                          className='text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:text-gray-400 dark:disabled:text-gray-500 text-xs'
                        >
                          {isRemoving ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                      {listing.status === 'completed' && listing.tradedAt && (
                        <span className='text-green-600 dark:text-green-400 text-xs'>
                          Traded {formatDateTime(listing.tradedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScheduledListingsTable;
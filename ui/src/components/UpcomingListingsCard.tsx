import React from 'react';
import { useUpcomingListings } from '../hooks/useScheduledListings';

const UpcomingListingsCard: React.FC = () => {
  const { upcoming, loading, error } = useUpcomingListings();

  const formatTimeUntil = (listingTime: string) => {
    const now = new Date();
    const listing = new Date(listingTime);
    const diffMs = listing.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Now';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ${diffSeconds}s`;
    } else {
      return `${diffSeconds}s`;
    }
  };

  const getUrgencyColor = (listingTime: string) => {
    const now = new Date();
    const listing = new Date(listingTime);
    const diffMs = listing.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    if (diffMinutes <= 5) return 'text-red-400 animate-pulse';
    if (diffMinutes <= 30) return 'text-orange-400';
    if (diffMinutes <= 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  if (loading) {
    return (
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md h-full'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>⏰ Next Listings</h3>
        <div className='text-gray-600 dark:text-gray-400'>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md h-full'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>⏰ Next Listings</h3>
        <div className='text-red-600 dark:text-red-400'>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md h-full'>
      <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
        ⏰ Next Listings ({upcoming.length})
      </h3>

      {upcoming.length === 0 ? (
        <div className='text-gray-600 dark:text-gray-400 text-center py-4'>
          No upcoming listings in next 24h
        </div>
      ) : (
        <div className='space-y-3'>
          {upcoming.slice(0, 3).map((listing) => (
            <div
              key={`${listing.symbol}-${listing.listingTime}`}
              className='border border-gray-300 dark:border-gray-700 rounded-lg p-3'
            >
              <div className='flex justify-between items-start mb-2'>
                <div className='font-mono text-gray-900 dark:text-white font-semibold'>
                  {listing.symbol}
                </div>
                <div className={`text-sm font-mono font-bold ${getUrgencyColor(listing.listingTime)}`}>
                  {formatTimeUntil(listing.listingTime)}
                </div>
              </div>

              <div className='text-xs text-gray-600 dark:text-gray-400'>
                {new Date(listing.listingTime).toLocaleString()}
              </div>

              {listing.notes && (
                <div className='text-xs text-gray-500 dark:text-gray-500 mt-1 truncate'>
                  {listing.notes}
                </div>
              )}
            </div>
          ))}

          {upcoming.length > 3 && (
            <div className='text-center text-gray-600 dark:text-gray-400 text-sm pt-2'>
              +{upcoming.length - 3} more listings...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UpcomingListingsCard;
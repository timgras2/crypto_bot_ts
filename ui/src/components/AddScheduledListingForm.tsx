import React, { useState } from 'react';
import { useScheduledListings } from '../hooks/useScheduledListings';

const AddScheduledListingForm: React.FC = () => {
  const { addListing } = useScheduledListings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    listingTime: '',
    quoteCurrency: 'USDT',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.symbol || !formData.listingTime) {
      alert('Symbol and listing time are required');
      return;
    }

    // Validate the datetime
    const listingDate = new Date(formData.listingTime);
    if (isNaN(listingDate.getTime())) {
      alert('Invalid date/time format');
      return;
    }

    if (listingDate <= new Date()) {
      alert('Listing time must be in the future');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addListing(
        formData.symbol.toUpperCase().trim(),
        formData.listingTime,
        formData.quoteCurrency,
        formData.notes.trim() || undefined
      );

      if (result.success) {
        // Reset form
        setFormData({
          symbol: '',
          listingTime: '',
          quoteCurrency: 'USDT',
          notes: '',
        });
        alert(`Successfully scheduled ${formData.symbol} for ${listingDate.toLocaleString()}`);
      } else {
        alert(`Failed to add listing: ${result.error}`);
      }
    } catch (err) {
      alert('Failed to add listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Get current datetime in local timezone for datetime-local input
  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-md'>
      <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>➕ Schedule New Listing</h2>
      
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label htmlFor='symbol' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Symbol *
            </label>
            <input
              type='text'
              id='symbol'
              name='symbol'
              value={formData.symbol}
              onChange={handleInputChange}
              placeholder='e.g., NEWTOKEN'
              className='w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              required
            />
          </div>

          <div>
            <label htmlFor='quoteCurrency' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Quote Currency
            </label>
            <select
              id='quoteCurrency'
              name='quoteCurrency'
              value={formData.quoteCurrency}
              onChange={handleInputChange}
              className='w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='USDT'>USDT</option>
              <option value='USDC'>USDC</option>
              <option value='BTC'>BTC</option>
              <option value='BUSD'>BUSD</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor='listingTime' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Listing Time * <span className='text-xs text-gray-500 dark:text-gray-400'>(Local time)</span>
          </label>
          <input
            type='datetime-local'
            id='listingTime'
            name='listingTime'
            value={formData.listingTime}
            onChange={handleInputChange}
            min={getCurrentDateTime()}
            className='w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            required
          />
          <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
            Get exact listing times from <a href='https://www.mexc.com/newlisting' target='_blank' rel='noopener noreferrer' className='text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'>mexc.com/newlisting</a>
          </p>
        </div>

        <div>
          <label htmlFor='notes' className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Notes <span className='text-xs text-gray-500 dark:text-gray-400'>(Optional)</span>
          </label>
          <textarea
            id='notes'
            name='notes'
            value={formData.notes}
            onChange={handleInputChange}
            placeholder='e.g., High volume expected, check social media...'
            rows={2}
            className='w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>

        <div className='flex justify-between items-center pt-2'>
          <div className='text-xs text-gray-600 dark:text-gray-400'>
            💡 Bot will switch to ultra-fast polling 30 seconds before listing
          </div>
          <button
            type='submit'
            disabled={isSubmitting}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed'
          >
            {isSubmitting ? 'Adding...' : 'Schedule Listing'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddScheduledListingForm;
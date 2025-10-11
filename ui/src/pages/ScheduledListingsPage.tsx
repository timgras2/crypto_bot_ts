import { Link } from 'react-router-dom';
import AddScheduledListingForm from '../components/AddScheduledListingForm';
import ScheduledListingsTable from '../components/ScheduledListingsTable';

export function ScheduledListingsPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link
                to="/"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-2 inline-block"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Scheduled Listings
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Help Text */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            📋 How Scheduled Listings Work
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• Schedule upcoming token listings with exact times from <a href="https://www.mexc.com/newlisting" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 dark:hover:text-blue-300">MEXC announcements</a></li>
            <li>• Bot executes trade at the exact scheduled time (retries every 100ms for up to 60s)</li>
            <li>• Automatically places buy order as soon as the market becomes tradeable</li>
            <li>• Uses your configured trade amount and trailing stop-loss settings</li>
          </ul>
        </div>

        {/* Form and Table */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <AddScheduledListingForm />
          </div>
          <div className="xl:col-span-2">
            <ScheduledListingsTable />
          </div>
        </div>
      </main>
    </div>
  );
}

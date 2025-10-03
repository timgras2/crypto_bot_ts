import type { CompletedTrade } from '../types';

interface CompletedTradesTableProps {
  trades: CompletedTrade[];
}

export function CompletedTradesTable({ trades }: CompletedTradesTableProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">No completed trades yet</p>
      </div>
    );
  }

  // Show last 10 trades
  const recentTrades = trades.slice(0, 10);

  const getTriggerBadgeColor = (reason: string) => {
    switch (reason) {
      case 'trailing_stop':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'stop_loss':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'manual':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Recent Completed Trades
          <span className="ml-2 text-sm font-normal text-gray-500">
            (Last 10 of {trades.length})
          </span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Entry / Exit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                P&L %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                P&L USDT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Trigger
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Closed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {recentTrades.map((trade, index) => {
              const profitLoss = parseFloat(trade.profitLossPct);
              const isProfit = profitLoss > 0;

              return (
                <tr key={`${trade.market}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {trade.market}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400">Entry: {parseFloat(trade.buyPrice).toFixed(6)}</span>
                      <span className="text-xs text-gray-400">Exit: {parseFloat(trade.sellPrice).toFixed(6)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                    <span className={isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {isProfit ? '+' : ''}{profitLoss.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {isProfit ? '+' : ''}{trade.profitLossUsdt}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {trade.durationHours}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTriggerBadgeColor(trade.triggerReason)}`}>
                      {trade.triggerReason.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {new Date(trade.sellTime).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

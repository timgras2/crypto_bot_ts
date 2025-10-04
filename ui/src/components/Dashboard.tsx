import { StatsCard } from './StatsCard';
import { ActiveTradesTable } from './ActiveTradesTable';
import { CompletedTradesTable } from './CompletedTradesTable';
import { useActiveTrades } from '../hooks/useActiveTrades';
import { useCompletedTrades } from '../hooks/useCompletedTrades';
import { useStats } from '../hooks/useStats';

export function Dashboard() {
  const { trades: activeTrades, loading: activeLoading, error: activeError, lastUpdate } = useActiveTrades();
  const { trades: completedTrades, loading: completedLoading, error: completedError } = useCompletedTrades();
  const { stats, loading: statsLoading, error: statsError } = useStats();

  const formatLastUpdate = () => {
    if (!lastUpdate) return '';
    const secondsAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };

  if (activeLoading || completedLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (activeError || completedError || statsError) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 dark:text-red-200 font-bold mb-2">Error Loading Dashboard</h2>
          <p className="text-red-600 dark:text-red-300 text-sm">
            {activeError || completedError || statsError}
          </p>
          <p className="text-red-500 dark:text-red-400 text-xs mt-2">
            Make sure the API server is running on port 3001
          </p>
        </div>
      </div>
    );
  }

  const totalPnL = parseFloat(stats?.totalProfitLossPct || '0');
  const winRate = stats?.winRate || 0;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              MEXC Trading Bot Dashboard
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Live • Updated {formatLastUpdate()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total P&L"
            value={`${totalPnL > 0 ? '+' : ''}${totalPnL.toFixed(2)}%`}
            subtitle={`${stats?.totalProfitLossUsdt || '0.00'} USDT`}
            trend={totalPnL > 0 ? 'positive' : totalPnL < 0 ? 'negative' : 'neutral'}
          />
          <StatsCard
            title="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            subtitle={`${stats?.profitableTrades || 0} / ${stats?.totalTrades || 0} trades`}
            trend={winRate >= 50 ? 'positive' : 'negative'}
          />
          <StatsCard
            title="Active Trades"
            value={activeTrades.length}
            subtitle="Currently monitoring"
            trend="neutral"
          />
          <StatsCard
            title="Avg Duration"
            value={`${stats?.avgDurationHours || '0.0'}h`}
            subtitle={`Avg P&L: ${stats?.avgProfitLossPct || '0.00'}%`}
            trend="neutral"
          />
        </div>

        {/* Active Trades */}
        <div className="mb-8">
          <ActiveTradesTable trades={activeTrades} />
        </div>

        {/* Completed Trades */}
        <div>
          <CompletedTradesTable trades={completedTrades} />
        </div>

        {/* Best/Worst Trades */}
        {(stats?.bestTrade || stats?.worstTrade) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {stats.bestTrade && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">Best Trade</h3>
                <p className="text-lg font-bold text-green-900 dark:text-green-200">
                  {stats.bestTrade.symbol}: +{stats.bestTrade.profitPct}%
                </p>
              </div>
            )}
            {stats.worstTrade && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Worst Trade</h3>
                <p className="text-lg font-bold text-red-900 dark:text-red-200">
                  {stats.worstTrade.symbol}: {stats.worstTrade.lossPct}%
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

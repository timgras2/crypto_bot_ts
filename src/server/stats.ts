import Decimal from 'decimal.js';
import { CompletedTrade } from '../types.js';

export interface TradingStats {
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  winRate: number; // Percentage
  totalProfitLossUsdt: string;
  totalProfitLossPct: string;
  avgProfitLossPct: string;
  avgDurationHours: string;
  bestTrade: {
    symbol: string;
    profitPct: string;
  } | null;
  worstTrade: {
    symbol: string;
    lossPct: string;
  } | null;
}

/**
 * Calculate statistics from completed trades
 */
export function calculateStats(completedTrades: CompletedTrade[]): TradingStats {
  if (completedTrades.length === 0) {
    return {
      totalTrades: 0,
      profitableTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfitLossUsdt: '0.00',
      totalProfitLossPct: '0.00',
      avgProfitLossPct: '0.00',
      avgDurationHours: '0.0',
      bestTrade: null,
      worstTrade: null,
    };
  }

  let totalProfitLossUsdt = new Decimal(0);
  let totalProfitLossPct = new Decimal(0);
  let totalDurationHours = new Decimal(0);
  let profitableCount = 0;
  let losingCount = 0;

  let bestTrade: { symbol: string; profitPct: Decimal } | null = null;
  let worstTrade: { symbol: string; lossPct: Decimal } | null = null;

  for (const trade of completedTrades) {
    const profitLossUsdt = new Decimal(trade.profitLossUsdt);
    const profitLossPct = new Decimal(trade.profitLossPct);
    const duration = new Decimal(trade.durationHours);

    totalProfitLossUsdt = totalProfitLossUsdt.plus(profitLossUsdt);
    totalProfitLossPct = totalProfitLossPct.plus(profitLossPct);
    totalDurationHours = totalDurationHours.plus(duration);

    if (profitLossPct.gt(0)) {
      profitableCount++;
    } else {
      losingCount++;
    }

    // Track best trade
    if (!bestTrade || profitLossPct.gt(bestTrade.profitPct)) {
      bestTrade = { symbol: trade.market, profitPct: profitLossPct };
    }

    // Track worst trade
    if (!worstTrade || profitLossPct.lt(worstTrade.lossPct)) {
      worstTrade = { symbol: trade.market, lossPct: profitLossPct };
    }
  }

  const totalTrades = completedTrades.length;
  const winRate = totalTrades > 0 ? (profitableCount / totalTrades) * 100 : 0;
  const avgProfitLossPct = totalProfitLossPct.div(totalTrades);
  const avgDurationHours = totalDurationHours.div(totalTrades);

  return {
    totalTrades,
    profitableTrades: profitableCount,
    losingTrades: losingCount,
    winRate: parseFloat(winRate.toFixed(2)),
    totalProfitLossUsdt: totalProfitLossUsdt.toFixed(4),
    totalProfitLossPct: totalProfitLossPct.toFixed(2),
    avgProfitLossPct: avgProfitLossPct.toFixed(2),
    avgDurationHours: avgDurationHours.toFixed(1),
    bestTrade: bestTrade
      ? {
          symbol: bestTrade.symbol,
          profitPct: bestTrade.profitPct.toFixed(2),
        }
      : null,
    worstTrade: worstTrade
      ? {
          symbol: worstTrade.symbol,
          lossPct: worstTrade.lossPct.toFixed(2),
        }
      : null,
  };
}

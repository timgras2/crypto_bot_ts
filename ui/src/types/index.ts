// Types for the trading dashboard
export type SerializedTradeState = {
  market: string;
  buyPrice: string;
  quantity: string;
  investedQuote: string;
  currentPrice: string;
  highestPrice: string;
  trailingStopPrice: string;
  stopLossPrice: string;
  startTime: string;
  lastUpdate: string;
}

export type CompletedTrade = SerializedTradeState & {
  sellPrice: string;
  sellTime: string;
  profitLossPct: string;
  profitLossQuote: string;
  triggerReason: 'stop_loss' | 'trailing_stop' | 'manual';
  durationHours: string;
}

export type TradingStats = {
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  winRate: number;
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
  activeTrades: number;
}

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface ScheduledListing {
  symbol: string;
  listingTime: string;
  quoteCurrency: string;
  notes?: string;
  status: 'pending' | 'active' | 'completed' | 'missed';
  createdAt: string;
  tradedAt?: string;
}

import Decimal from 'decimal.js';

/**
 * Branded type for market symbols (e.g., "BTCUSDT")
 */
export type MarketSymbol = string & { readonly __brand: 'MarketSymbol' };

/**
 * Trading configuration parameters
 */
export interface TradingConfig {
  stopLossPct: Decimal; // Stop loss percentage (max loss before exit)
  trailingPct: Decimal; // Trailing stop percentage (profit protection)
  maxTradeAmount: Decimal; // Max USDT per trade
  checkInterval: number; // Price check interval (seconds)
  maxRetries: number; // API retry attempts
  retryDelay: number; // Delay between retries (seconds)
  quoteCurrency: string; // Quote currency filter (USDT, USDC, BTC)
}

/**
 * MEXC API configuration
 */
export interface MexcConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  rateLimit: number; // Requests per minute
  timeout: number; // Milliseconds
  receiveWindow: number; // Milliseconds
}

/**
 * Current state of a trade
 */
export interface TradeState {
  market: MarketSymbol;
  buyPrice: Decimal;
  quantity: Decimal; // Actual quantity bought (base asset)
  investedQuote: Decimal; // Actual quote currency spent on buy order (USDT/USDC/BTC/etc)
  currentPrice: Decimal;
  highestPrice: Decimal;
  trailingStopPrice: Decimal;
  stopLossPrice: Decimal;
  startTime: Date;
  lastUpdate: Date;
}

/**
 * Serializable version of TradeState for JSON persistence
 */
export interface SerializedTradeState {
  market: string;
  buyPrice: string;
  quantity: string; // Actual quantity bought (base asset)
  investedQuote: string; // Actual quote currency spent on buy order (USDT/USDC/BTC/etc)
  currentPrice: string;
  highestPrice: string;
  trailingStopPrice: string;
  stopLossPrice: string;
  startTime: string; // ISO string
  lastUpdate: string; // ISO string
}

/**
 * Completed trade record
 */
export interface CompletedTrade extends SerializedTradeState {
  sellPrice: string;
  sellTime: string; // ISO string
  profitLossPct: string;
  profitLossQuote: string; // Profit/loss in quote currency (USDT/USDC/BTC/etc)
  triggerReason: 'stop_loss' | 'trailing_stop' | 'manual';
  durationHours: string;
}

/**
 * MEXC API order side
 */
export type OrderSide = 'BUY' | 'SELL';

/**
 * MEXC API order type
 */
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'LIMIT_MAKER';

/**
 * MEXC API order request
 */
export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity?: string;
  quoteOrderQty?: string; // For market buys with USDT amount
  price?: string;
  recvWindow?: number;
  timestamp: number;
}

/**
 * MEXC API order response
 */
export interface OrderResponse {
  symbol: string;
  orderId: string;
  orderListId: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  type: string;
  side: string;
  transactTime: number;
}

/**
 * MEXC API ticker response (24hr)
 */
export interface TickerResponse {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
}

/**
 * MEXC API exchange info response
 */
export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: SymbolInfo[];
}

/**
 * MEXC symbol information
 */
export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quotePrecision: number;
  quoteAssetPrecision: number;
  isSpotTradingAllowed: boolean;
}

/**
 * MEXC API kline (candlestick) response
 * Array format: [openTime, open, high, low, close, volume, closeTime, quoteVolume]
 */
export type KlineData = [
  number, // Open time
  string, // Open price
  string, // High price
  string, // Low price
  string, // Close price
  string, // Volume
  number, // Close time
  string  // Quote asset volume
];

/**
 * Parsed kline data for easier access
 */
export interface Kline {
  openTime: number;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  volume: Decimal;
  closeTime: number;
  quoteVolume: Decimal;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

import Decimal from 'decimal.js';
import { MexcAPI } from '../api/mexc.js';
import {
  TradingConfig,
  TradeState,
  SerializedTradeState,
  CompletedTrade,
  MarketSymbol,
} from '../types.js';
import { logger } from '../utils/logger.js';
import { loadJson, saveJson } from '../utils/persistence.js';

const ACTIVE_TRADES_FILE = 'active_trades.json';
const COMPLETED_TRADES_FILE = 'completed_trades.json';

/**
 * Manages trade execution and monitoring with trailing stop-loss
 */
export class TradeManager {
  private activeTrades = new Map<string, TradeState>();
  private monitoringTasks = new Map<string, AbortController>();
  private shuttingDown = false;

  constructor(
    private readonly api: MexcAPI,
    private readonly config: TradingConfig
  ) {}

  /**
   * Serialize TradeState for JSON storage
   */
  private serializeTrade(trade: TradeState): SerializedTradeState {
    return {
      market: trade.market,
      buyPrice: trade.buyPrice.toString(),
      currentPrice: trade.currentPrice.toString(),
      highestPrice: trade.highestPrice.toString(),
      trailingStopPrice: trade.trailingStopPrice.toString(),
      stopLossPrice: trade.stopLossPrice.toString(),
      startTime: trade.startTime.toISOString(),
      lastUpdate: trade.lastUpdate.toISOString(),
    };
  }

  /**
   * Deserialize TradeState from JSON
   */
  private deserializeTrade(data: SerializedTradeState): TradeState {
    return {
      market: data.market as MarketSymbol,
      buyPrice: new Decimal(data.buyPrice),
      currentPrice: new Decimal(data.currentPrice),
      highestPrice: new Decimal(data.highestPrice),
      trailingStopPrice: new Decimal(data.trailingStopPrice),
      stopLossPrice: new Decimal(data.stopLossPrice),
      startTime: new Date(data.startTime),
      lastUpdate: new Date(data.lastUpdate),
    };
  }

  /**
   * Save active trades to disk
   */
  async saveActiveTrades(): Promise<void> {
    const serialized = Array.from(this.activeTrades.values()).map((trade) =>
      this.serializeTrade(trade)
    );
    await saveJson(ACTIVE_TRADES_FILE, serialized);
    logger.info(`Saved ${serialized.length} active trades`);
  }

  /**
   * Restore monitoring for previously active trades
   */
  async restoreMonitoring(): Promise<void> {
    const trades = await loadJson<SerializedTradeState[]>(ACTIVE_TRADES_FILE, []);

    if (trades.length === 0) {
      logger.info('No active trades to restore');
      return;
    }

    logger.info(`Restoring ${trades.length} active trades`);

    for (const serialized of trades) {
      try {
        const trade = this.deserializeTrade(serialized);
        this.activeTrades.set(trade.market, trade);
        await this.startMonitoring(trade.market, trade.buyPrice);
        logger.info(`Restored monitoring for ${trade.market}`);
      } catch (error) {
        logger.error(`Failed to restore trade for ${serialized.market}: ${String(error)}`);
      }
    }
  }

  /**
   * Place a market buy order
   */
  async placeMarketBuy(symbol: MarketSymbol, amountUsdt: Decimal): Promise<Decimal | null> {
    try {
      logger.info(`Placing market buy order: ${symbol} for ${amountUsdt.toString()} USDT`);

      const orderResponse = await this.api.placeOrder({
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quoteOrderQty: amountUsdt.toString(), // Buy with USDT amount
        timestamp: Date.now(),
      });

      if (!orderResponse) {
        logger.error(`Failed to place buy order for ${symbol}`);
        return null;
      }

      // Calculate average buy price
      const executedQty = new Decimal(orderResponse.executedQty);
      const cumulativeQuoteQty = new Decimal(orderResponse.cummulativeQuoteQty);
      const avgPrice = cumulativeQuoteQty.div(executedQty);

      logger.info(
        `Buy order executed: ${symbol} at avg price ${avgPrice.toString()} (qty: ${executedQty.toString()})`
      );

      return avgPrice;
    } catch (error) {
      logger.error(`Error placing market buy for ${symbol}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Place a market sell order
   */
  private async placeMarketSell(symbol: MarketSymbol, quantity: Decimal): Promise<Decimal | null> {
    try {
      logger.info(`Placing market sell order: ${symbol} for ${quantity.toString()} units`);

      const orderResponse = await this.api.placeOrder({
        symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: quantity.toString(),
        timestamp: Date.now(),
      });

      if (!orderResponse) {
        logger.error(`Failed to place sell order for ${symbol}`);
        return null;
      }

      const executedQty = new Decimal(orderResponse.executedQty);
      const cumulativeQuoteQty = new Decimal(orderResponse.cummulativeQuoteQty);
      const avgPrice = cumulativeQuoteQty.div(executedQty);

      logger.info(`Sell order executed: ${symbol} at avg price ${avgPrice.toString()}`);

      return avgPrice;
    } catch (error) {
      logger.error(`Error placing market sell for ${symbol}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Start monitoring a trade with trailing stop-loss
   */
  async startMonitoring(symbol: MarketSymbol, buyPrice: Decimal): Promise<void> {
    // Initialize trade state
    const stopLossPrice = buyPrice.mul(new Decimal(1).minus(this.config.minProfitPct.div(100)));
    const trailingStopPrice = buyPrice.mul(new Decimal(1).minus(this.config.trailingPct.div(100)));

    const trade: TradeState = {
      market: symbol,
      buyPrice,
      currentPrice: buyPrice,
      highestPrice: buyPrice,
      trailingStopPrice,
      stopLossPrice,
      startTime: new Date(),
      lastUpdate: new Date(),
    };

    this.activeTrades.set(symbol, trade);
    await this.saveActiveTrades();

    // Create abort controller for this monitoring task
    const abortController = new AbortController();
    this.monitoringTasks.set(symbol, abortController);

    // Start monitoring loop
    void this.monitorTrade(symbol, abortController.signal);
  }

  /**
   * Monitor trade with trailing stop-loss logic
   */
  private async monitorTrade(symbol: MarketSymbol, signal: AbortSignal): Promise<void> {
    logger.info(`Started monitoring ${symbol}`);

    while (!signal.aborted && !this.shuttingDown) {
      try {
        const trade = this.activeTrades.get(symbol);
        if (!trade) {
          logger.warn(`Trade ${symbol} not found in active trades`);
          break;
        }

        // Get current price
        const priceStr = await this.api.getPrice(symbol);
        if (!priceStr) {
          logger.warn(`Failed to get price for ${symbol}, retrying...`);
          await this.sleep(this.config.checkInterval * 1000, signal);
          continue;
        }

        const currentPrice = new Decimal(priceStr);
        trade.currentPrice = currentPrice;
        trade.lastUpdate = new Date();

        // Update highest price and trailing stop
        if (currentPrice.gt(trade.highestPrice)) {
          trade.highestPrice = currentPrice;
          trade.trailingStopPrice = currentPrice.mul(
            new Decimal(1).minus(this.config.trailingPct.div(100))
          );
          logger.info(
            `${symbol} new high: ${currentPrice.toString()}, trailing stop: ${trade.trailingStopPrice.toString()}`
          );
        }

        // Check stop conditions
        const profitPct = trade.currentPrice.minus(trade.buyPrice).div(trade.buyPrice).mul(100);

        // Triggered trailing stop (profit protection)
        if (currentPrice.lt(trade.trailingStopPrice) && currentPrice.gt(trade.buyPrice)) {
          logger.info(
            `${symbol} triggered trailing stop at ${currentPrice.toString()} (profit: ${profitPct.toFixed(2)}%)`
          );
          await this.executeSell(symbol, 'trailing_stop');
          break;
        }

        // Triggered stop loss (loss protection)
        if (currentPrice.lt(trade.stopLossPrice)) {
          logger.warn(
            `${symbol} triggered stop loss at ${currentPrice.toString()} (loss: ${profitPct.toFixed(2)}%)`
          );
          await this.executeSell(symbol, 'stop_loss');
          break;
        }

        // Save state periodically
        await this.saveActiveTrades();

        // Wait before next check
        await this.sleep(this.config.checkInterval * 1000, signal);
      } catch (error) {
        logger.error(`Error monitoring ${symbol}: ${String(error)}`);
        await this.sleep(this.config.retryDelay * 1000, signal);
      }
    }

    logger.info(`Stopped monitoring ${symbol}`);
  }

  /**
   * Execute sell order and record completed trade
   */
  private async executeSell(
    symbol: MarketSymbol,
    reason: 'stop_loss' | 'trailing_stop' | 'manual'
  ): Promise<void> {
    const trade = this.activeTrades.get(symbol);
    if (!trade) {
      logger.error(`Cannot sell ${symbol}: trade not found`);
      return;
    }

    // Calculate quantity to sell (use typical trade amount / buy price for estimation)
    const quantity = this.config.maxTradeAmount.div(trade.buyPrice);

    const sellPrice = await this.placeMarketSell(symbol, quantity);
    if (!sellPrice) {
      logger.error(`Failed to execute sell for ${symbol}`);
      return;
    }

    // Record completed trade
    await this.recordCompletedTrade(symbol, sellPrice, reason);

    // Remove from active trades
    this.activeTrades.delete(symbol);
    this.monitoringTasks.get(symbol)?.abort();
    this.monitoringTasks.delete(symbol);

    await this.saveActiveTrades();
  }

  /**
   * Record a completed trade
   */
  private async recordCompletedTrade(
    symbol: MarketSymbol,
    sellPrice: Decimal,
    reason: 'stop_loss' | 'trailing_stop' | 'manual'
  ): Promise<void> {
    const trade = this.activeTrades.get(symbol);
    if (!trade) return;

    const profitPct = sellPrice.minus(trade.buyPrice).div(trade.buyPrice).mul(100);
    const profitUsdt = profitPct.div(100).mul(this.config.maxTradeAmount);
    const duration = (Date.now() - trade.startTime.getTime()) / 3600000; // hours

    const completedTrade: CompletedTrade = {
      ...this.serializeTrade(trade),
      sellPrice: sellPrice.toString(),
      sellTime: new Date().toISOString(),
      profitLossPct: profitPct.toFixed(2),
      profitLossUsdt: profitUsdt.toFixed(4),
      triggerReason: reason,
      durationHours: duration.toFixed(1),
    };

    const completedTrades = await loadJson<CompletedTrade[]>(COMPLETED_TRADES_FILE, []);
    completedTrades.push(completedTrade);
    await saveJson(COMPLETED_TRADES_FILE, completedTrades);

    logger.info(
      `Recorded completed trade: ${symbol} ${profitPct.toFixed(2)}% (${reason})`
    );
  }

  /**
   * Stop monitoring a specific trade
   */
  stopMonitoring(symbol: string): void {
    this.monitoringTasks.get(symbol)?.abort();
    this.monitoringTasks.delete(symbol);
    logger.info(`Stopped monitoring ${symbol}`);
  }

  /**
   * Prepare for shutdown (preserve active trades)
   */
  prepareForShutdown(): void {
    this.shuttingDown = true;
    logger.info('TradeManager preparing for shutdown');
  }

  /**
   * Shutdown all monitoring tasks
   */
  async shutdown(): Promise<void> {
    this.prepareForShutdown();

    // Stop all monitoring tasks
    for (const [symbol, controller] of this.monitoringTasks.entries()) {
      controller.abort();
      logger.info(`Stopped monitoring ${symbol}`);
    }

    // Save active trades
    if (this.activeTrades.size > 0) {
      await this.saveActiveTrades();
      logger.info(`Saved ${this.activeTrades.size} active trades for recovery`);
    }
  }

  /**
   * Get active trades count
   */
  getActiveTradesCount(): number {
    return this.activeTrades.size;
  }

  /**
   * Interruptible sleep
   */
  private async sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      });
    });
  }
}

import { loadConfig } from './config.js';
import { MexcAPI } from './api/mexc.js';
import { MarketTracker } from './market/tracker.js';
import { TradeManager } from './trade/manager.js';
import { ListingScheduler } from './scheduler/listing-scheduler.js';
import { logger } from './utils/logger.js';
import { MarketSymbol } from './types.js';
import Decimal from 'decimal.js';

/**
 * Main trading bot orchestrator
 */
class TradingBot {
  private running = true;
  private previousMarkets: string[] = [];
  private scheduler: ListingScheduler;

  constructor(
    private readonly api: MexcAPI,
    private readonly marketTracker: MarketTracker,
    private readonly tradeManager: TradeManager,
    private readonly config: ReturnType<typeof loadConfig>
  ) {
    this.scheduler = new ListingScheduler();
    this.setupSignalHandlers();
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
  }

  /**
   * Handle shutdown signals
   */
  private handleShutdown(signal: string): void {
    console.log(`\n🛑 ${signal} received - shutting down gracefully...`);
    logger.info(`Received ${signal}, initiating shutdown`);
    this.running = false;
  }

  /**
   * Perform graceful shutdown
   */
  private async shutdown(): Promise<void> {
    console.log('🔄 Preparing for graceful shutdown...');
    logger.info('Shutting down bot');

    await this.tradeManager.shutdown();
    this.scheduler.cleanup();

    if (this.previousMarkets.length > 0) {
      await this.marketTracker.savePreviousMarkets(this.previousMarkets);
      console.log('💾 Market data saved');
    }

    console.log('✅ Bot shutdown complete');
    logger.info('Bot shutdown complete');
  }

  /**
   * Main bot loop
   */
  async run(): Promise<void> {
    logger.info('Starting trading bot');
    console.log('🤖 Bot is now active and scanning for new listings...');
    console.log(`💰 Max trade amount: ${this.config.trading.maxTradeAmount.toString()} USDT`);
    console.log(`🔄 Checking every ${this.config.trading.checkInterval} seconds`);
    console.log(
      `📈 Stop loss: ${this.config.trading.stopLossPct.toString()}% | Trailing stop: ${this.config.trading.trailingPct.toString()}%`
    );
    console.log(`💱 Quote currency: ${this.config.trading.quoteCurrency}`);
    console.log('-'.repeat(60));

    // Initialize scheduler and restore any previously active trades
    await this.scheduler.initialize();
    await this.tradeManager.restoreMonitoring();

    // Show next scheduled listing if any
    const nextListing = this.scheduler.getNextListing();
    if (nextListing) {
      const timeStr = new Date(nextListing.listingTime).toLocaleString();
      console.log(`⏰ Next scheduled listing: ${nextListing.symbol} at ${timeStr}`);
    }

    // Load previous markets
    this.previousMarkets = await this.marketTracker.loadPreviousMarkets();

    const isFirstRun = this.previousMarkets.length === 0;
    if (isFirstRun) {
      console.log('🔄 First run detected - establishing market baseline...');
    }

    let scanCount = 0;

    while (this.running) {
      try {
        scanCount++;
        const currentTime = new Date().toLocaleTimeString();

        // Show periodic status
        if (scanCount % 6 === 1) {
          const activeTrades = this.tradeManager.getActiveTradesCount();
          if (activeTrades > 0) {
            console.log(
              `🕐 ${currentTime} | ✅ Bot running | 📊 ${activeTrades} active trades | Scan #${scanCount}`
            );
          } else {
            console.log(
              `🕐 ${currentTime} | ✅ Bot running | 👀 Scanning for new listings... | Scan #${scanCount}`
            );
          }
        }

        // Reload previous markets from disk (detect manual changes)
        const oldPreviousMarkets = this.previousMarkets;
        this.previousMarkets = await this.marketTracker.loadPreviousMarkets();

        // Reload scheduled listings from disk (detect new listings added via API)
        await this.scheduler.initialize();

        if (
          new Set(oldPreviousMarkets).size !== new Set(this.previousMarkets).size ||
          !oldPreviousMarkets.every((m) => this.previousMarkets.includes(m))
        ) {
          const removed = oldPreviousMarkets.filter((m) => !this.previousMarkets.includes(m));
          const added = this.previousMarkets.filter((m) => !oldPreviousMarkets.includes(m));

          if (removed.length > 0) {
            console.log(`📝 Manual file change detected - Removed pairs: ${removed.join(', ')}`);
            logger.info(`Manual removal detected: ${removed.join(', ')}`);
          }
          if (added.length > 0) {
            console.log(`📝 Manual file change detected - Added pairs: ${added.join(', ')}`);
            logger.info(`Manual additions detected: ${added.join(', ')}`);
          }
        }

        // Detect new listings
        const { newListings, currentMarkets } =
          await this.marketTracker.detectNewListings(this.previousMarkets);

        // Update stored markets
        if (currentMarkets.length > 0) {
          await this.marketTracker.savePreviousMarkets(currentMarkets);
          this.previousMarkets = currentMarkets;

          // Handle first run baseline
          if (isFirstRun && scanCount === 1) {
            console.log(`✅ Baseline established: ${currentMarkets.length} existing markets saved`);
            console.log(
              `📊 Now monitoring for NEW ${this.config.trading.quoteCurrency} listings...`
            );
          } else if (scanCount === 1) {
            console.log(
              `📊 Monitoring ${currentMarkets.length} ${this.config.trading.quoteCurrency} markets for new listings`
            );
          }
        }

        // Process new listings
        for (const market of newListings) {
          // Check if this was a scheduled listing before processing
          const scheduledListings = this.scheduler.getScheduledListings();
          const matchedListing = scheduledListings.find(
            l => l.symbol === market && (l.status === 'active' || l.status === 'pending')
          );
          
          if (matchedListing) {
            console.log(`🎯 SCHEDULED LISTING DETECTED: ${market} - executing precision trade!`);
            await this.scheduler.markListingTraded(market, matchedListing.listingTime);
          }
          
          await this.handleNewListing(market);
        }

        // Use ultra-fast polling if near a scheduled listing, otherwise normal polling
        const isUltraFastMode = this.scheduler.shouldUseUltraFastPolling();
        const sleepInterval = isUltraFastMode 
          ? this.scheduler.getUltraFastInterval()
          : this.config.trading.checkInterval * 1000;
        
        // Log when entering/exiting ultra-fast mode
        if (isUltraFastMode && scanCount % 50 === 1) {
          const nextListing = this.scheduler.getNextListing();
          if (nextListing) {
            const timeUntil = new Date(nextListing.listingTime).getTime() - Date.now();
            const secondsUntil = Math.round(timeUntil / 1000);
            console.log(`🔥 ULTRA-FAST MODE: ${nextListing.symbol} listing in ~${secondsUntil}s (polling every ${sleepInterval}ms)`);
          }
        }
        
        await this.sleep(sleepInterval);
      } catch (error) {
        console.log(`🚨 ERROR in main loop: ${String(error)}`);
        logger.error(`Error in main loop: ${String(error)}`);
        await this.sleep(this.config.trading.retryDelay * 1000);
      }
    }

    // Perform shutdown
    await this.shutdown();
  }

  /**
   * Handle a new listing detection
   */
  private async handleNewListing(market: MarketSymbol): Promise<void> {
    console.log(`\n🚨 NEW LISTING DETECTED: ${market}`);
    logger.info(`Attempting to trade new listing: ${market}`);

    console.log(`🔍 Analyzing ${market}...`);

    // Try to get ticker data with retries
    let ticker = await this.api.getTicker24h(market);
    let retries = 0;
    const maxTickerRetries = 3;

    while (!ticker && retries < maxTickerRetries) {
      retries++;
      console.log(
        `⏳ Ticker data not available, retrying in 2 seconds... (attempt ${retries}/${maxTickerRetries})`
      );
      await this.sleep(2000);
      ticker = await this.api.getTicker24h(market);
    }

    // Determine trade amount
    let tradeAmount = this.config.trading.maxTradeAmount;

    if (!ticker) {
      console.log(`⚠️  No ticker data available for ${market} after ${maxTickerRetries} attempts`);
      console.log(`🎲 New listing might be too fresh - attempting trade without volume validation`);
      logger.warn(`Proceeding with ${market} trade without ticker validation`);

      // Use 50% of max for safety, capped at 5 USDT
      tradeAmount = Decimal.min(this.config.trading.maxTradeAmount.mul(0.5), new Decimal(5));
      console.log(`🛡️  Using reduced amount ${tradeAmount.toString()} USDT for safety`);
    } else {
      // Validate volume
      const volume = new Decimal(ticker.quoteVolume);
      const minVolumeThreshold = this.config.trading.maxTradeAmount.mul(10);

      console.log(
        `📊 ${market} | Price: ${ticker.lastPrice} | Volume: ${volume.toString()} USDT`
      );

      if (volume.lt(minVolumeThreshold)) {
        console.log(
          `⚠️  Volume too low (${volume.toString()} < ${minVolumeThreshold.toString()} USDT), skipping...`
        );
        logger.warn(`Skipping ${market} due to insufficient volume: ${volume.toString()}`);
        return;
      }
    }

    // Execute buy order
    console.log(`💸 EXECUTING BUY ORDER: ${tradeAmount.toString()} USDT of ${market}`);
    const buyResult = await this.tradeManager.placeMarketBuy(market, tradeAmount);

    if (buyResult) {
      console.log(`✅ BUY SUCCESS: ${market} at ${buyResult.avgPrice.toString()} USDT (qty: ${buyResult.quantity.toString()})`);

      // Check for slippage if ticker data is available
      if (ticker) {
        const tickerPrice = new Decimal(ticker.lastPrice);
        const executionPrice = buyResult.avgPrice;
        const slippage = executionPrice.minus(tickerPrice).div(tickerPrice).mul(100);

        if (slippage.abs().gt(5)) {
          const slippageStr = slippage.toFixed(2);
          logger.warn(`High slippage detected on ${market}: ${slippageStr}%`);
          console.log(
            `⚠️  Slippage: ${slippageStr}% (ticker: ${tickerPrice.toString()}, executed: ${executionPrice.toString()})`
          );
        } else {
          logger.info(`Slippage on ${market}: ${slippage.toFixed(2)}%`);
        }
      }

      console.log(`🎯 Starting monitoring with trailing stop-loss...`);
      await this.tradeManager.startMonitoring(market, buyResult.avgPrice, buyResult.quantity);
    } else {
      console.log(`❌ BUY FAILED: Could not execute order for ${market}`);
    }
  }

  /**
   * Interruptible sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.running) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, ms);
    });
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    console.log('🚀 Initializing MEXC Crypto Trading Bot...');

    // Load configuration
    const config = loadConfig();

    // Initialize API client
    const api = new MexcAPI(config.mexc);

    // Test connectivity
    const pingSuccess = await api.ping();
    if (!pingSuccess) {
      throw new Error('Failed to connect to MEXC API');
    }

    console.log('✅ Connected to MEXC API');

    // Sync time with MEXC server to prevent timestamp errors
    await api.syncTime();

    // Validate API credentials by attempting an authenticated request
    console.log('🔐 Validating API credentials...');
    const accountInfo = await api.getAccount();
    if (!accountInfo) {
      throw new Error(
        'Failed to authenticate with MEXC API.\n' +
        'Please check your MEXC_API_KEY and MEXC_API_SECRET in .env file.\n' +
        'Make sure the API key has spot trading permissions enabled.'
      );
    }
    console.log('✅ API credentials validated successfully');

    // Initialize components
    const marketTracker = new MarketTracker(api, config.trading.quoteCurrency);
    const tradeManager = new TradeManager(api, config.trading);

    // Create and run bot
    const bot = new TradingBot(api, marketTracker, tradeManager, config);
    console.log('✅ Bot initialized successfully\n');

    await bot.run();
  } catch (error) {
    console.error(`\n🚨 Fatal error: ${String(error)}`);
    logger.error(`Fatal error: ${String(error)}`);
    process.exit(1);
  }
}

// Run the bot
void main();

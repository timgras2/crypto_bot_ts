import { MexcAPI } from '../api/mexc.js';
import { MarketSymbol } from '../types.js';
import { logger } from '../utils/logger.js';
import { loadJson, saveJson } from '../utils/persistence.js';

const PREVIOUS_MARKETS_FILE = 'previous_markets.json';

/**
 * Tracks market listings and detects new listings
 */
export class MarketTracker {
  constructor(
    private readonly api: MexcAPI,
    private readonly quoteCurrency: string
  ) {}

  /**
   * Load previously seen markets from disk
   */
  async loadPreviousMarkets(): Promise<string[]> {
    return loadJson<string[]>(PREVIOUS_MARKETS_FILE, []);
  }

  /**
   * Save current markets to disk
   */
  async savePreviousMarkets(markets: string[]): Promise<void> {
    await saveJson(PREVIOUS_MARKETS_FILE, markets);
  }

  /**
   * Detect new listings by comparing current markets with previous markets
   */
  async detectNewListings(
    previousMarkets: string[]
  ): Promise<{ newListings: MarketSymbol[]; currentMarkets: string[] }> {
    try {
      const exchangeInfo = await this.api.getExchangeInfo();

      if (!exchangeInfo) {
        logger.warn('Failed to fetch exchange info');
        return { newListings: [], currentMarkets: previousMarkets };
      }

      // Filter for active trading pairs with the specified quote currency
      // MEXC uses status "1" for enabled (not "ENABLED")
      const currentMarkets = exchangeInfo.symbols
        .filter(
          (symbol) =>
            (symbol.status === '1' || symbol.status === 'ENABLED') &&
            symbol.isSpotTradingAllowed &&
            symbol.quoteAsset === this.quoteCurrency
        )
        .map((symbol) => symbol.symbol);

      // First run: establish baseline
      if (previousMarkets.length === 0) {
        logger.info(
          `First run: Establishing baseline with ${currentMarkets.length} existing ${this.quoteCurrency} markets`
        );
        return { newListings: [], currentMarkets };
      }

      // Detect new listings using set difference
      const previousSet = new Set(previousMarkets);
      const currentSet = new Set(currentMarkets);

      const newListings = Array.from(currentSet).filter(
        (market) => !previousSet.has(market)
      ) as MarketSymbol[];

      if (newListings.length > 0) {
        logger.info(`Detected ${newListings.length} new listings: ${newListings.join(', ')}`);
      }

      return { newListings, currentMarkets };
    } catch (error) {
      logger.error(`Error detecting new listings: ${String(error)}`);
      return { newListings: [], currentMarkets: previousMarkets };
    }
  }
}

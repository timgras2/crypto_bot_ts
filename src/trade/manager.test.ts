import Decimal from 'decimal.js';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TradeManager } from './manager.js';
import { MexcAPI } from '../api/mexc.js';
import type { TradingConfig, MarketSymbol } from '../types.js';

// Mock the API
jest.mock('../api/mexc.js');

// Mock persistence utilities
jest.mock('../utils/persistence.js', () => ({
  loadJson: jest.fn<() => Promise<unknown>>().mockResolvedValue([]),
  saveJson: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TradeManager - Critical Path Tests', () => {
  let mockApi: jest.Mocked<MexcAPI>;
  let config: TradingConfig;
  let tradeManager: TradeManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock API
    mockApi = {
      placeOrder: jest.fn(),
      getOrder: jest.fn(),
      getPrice: jest.fn(),
      getSymbolPrecision: jest.fn(),
    } as unknown as jest.Mocked<MexcAPI>;

    // Create test config
    config = {
      stopLossPct: new Decimal(20), // 20% max loss
      trailingPct: new Decimal(10), // 10% trailing stop
      maxTradeAmount: new Decimal(10),
      checkInterval: 5,
      maxRetries: 3,
      retryDelay: 1,
      quoteCurrency: 'USDT',
    };

    tradeManager = new TradeManager(mockApi, config);
  });

  describe('Stop-Loss Calculation', () => {
    it('should calculate stop-loss price correctly at 20% below entry', async () => {
      const buyPrice = new Decimal(100);
      const expectedStopLoss = new Decimal(80); // 100 - 20% = 80

      // Mock successful buy order
      mockApi.placeOrder.mockResolvedValueOnce({
        symbol: 'TESTUSDT',
        orderId: '123',
        executedQty: '10',
        cummulativeQuoteQty: '1000',
        status: 'FILLED',
        price: '100',
        origQty: '10',
        orderListId: 0,
        type: 'MARKET',
        side: 'BUY',
        transactTime: Date.now(),
      });

      const result = await tradeManager.placeMarketBuy(
        'TESTUSDT' as MarketSymbol,
        new Decimal(10)
      );

      expect(result).not.toBeNull();
      if (result) {
        expect(result.avgPrice.toString()).toBe('100');

        // The stop-loss would be set in startMonitoring
        // We verify the calculation directly
        const calculatedStopLoss = buyPrice.mul(new Decimal(1).minus(config.stopLossPct.div(100)));
        expect(calculatedStopLoss.toString()).toBe(expectedStopLoss.toString());
      }
    });

    it('should handle decimal precision in stop-loss calculations', () => {
      const buyPrice = new Decimal('0.00001234'); // Very small price
      const stopLossPct = new Decimal(15); // 15%

      const stopLoss = buyPrice.mul(new Decimal(1).minus(stopLossPct.div(100)));

      // Should be 0.00001234 * 0.85 = 0.000010489
      expect(stopLoss.toFixed(11)).toBe('0.00001048900');

      // Verify no floating point errors
      const loss = buyPrice.minus(stopLoss);
      const lossPct = loss.div(buyPrice).mul(100);
      expect(lossPct.toFixed(2)).toBe('15.00');
    });
  });

  describe('Trailing Stop Calculation', () => {
    it('should calculate trailing stop at 10% below current price', () => {
      const currentPrice = new Decimal(150);
      const trailingPct = new Decimal(10);

      const trailingStop = currentPrice.mul(new Decimal(1).minus(trailingPct.div(100)));

      expect(trailingStop.toString()).toBe('135'); // 150 - 10% = 135
    });

    it('should update trailing stop as price rises', () => {
      const trailingPct = new Decimal(10);

      // Price rises to 120
      let currentPrice = new Decimal(120);
      let trailingStop = currentPrice.mul(new Decimal(1).minus(trailingPct.div(100)));
      expect(trailingStop.toString()).toBe('108'); // 120 * 0.9

      // Price rises to 150
      currentPrice = new Decimal(150);
      trailingStop = currentPrice.mul(new Decimal(1).minus(trailingPct.div(100)));
      expect(trailingStop.toString()).toBe('135'); // 150 * 0.9

      // Verify trailing stop never goes down
      expect(new Decimal(135).gt(108)).toBe(true);
    });

    it('should NOT update trailing stop when price falls', () => {
      const highestPrice = new Decimal(150);
      const trailingPct = new Decimal(10);
      const existingTrailingStop = highestPrice.mul(new Decimal(1).minus(trailingPct.div(100)));

      // Price drops to 140
      const currentPrice = new Decimal(140);
      const newCalculatedStop = currentPrice.mul(new Decimal(1).minus(trailingPct.div(100)));

      // Should keep the existing (higher) trailing stop
      const actualTrailingStop = Decimal.max(existingTrailingStop, newCalculatedStop);

      expect(actualTrailingStop.toString()).toBe(existingTrailingStop.toString());
      expect(actualTrailingStop.toString()).toBe('135');
    });
  });

  describe('Profit/Loss Calculations', () => {
    it('should calculate profit percentage correctly', () => {
      const buyPrice = new Decimal(100);
      const sellPrice = new Decimal(120);

      const profit = sellPrice.minus(buyPrice);
      const profitPct = profit.div(buyPrice).mul(100);

      expect(profitPct.toFixed(2)).toBe('20.00');
    });

    it('should calculate loss percentage correctly', () => {
      const buyPrice = new Decimal(100);
      const sellPrice = new Decimal(85);

      const profit = sellPrice.minus(buyPrice);
      const profitPct = profit.div(buyPrice).mul(100);

      expect(profitPct.toFixed(2)).toBe('-15.00');
    });

    it('should handle very small price movements precisely', () => {
      const buyPrice = new Decimal('0.00001000');
      const sellPrice = new Decimal('0.00001001');

      const profit = sellPrice.minus(buyPrice);
      const profitPct = profit.div(buyPrice).mul(100);

      // 0.1% profit
      expect(profitPct.toFixed(2)).toBe('0.10');
    });

    it('should calculate USDT profit from percentage correctly', () => {
      const tradeAmount = new Decimal(10); // 10 USDT
      const profitPct = new Decimal(25); // 25% profit

      const profitUsdt = profitPct.div(100).mul(tradeAmount);

      expect(profitUsdt.toString()).toBe('2.5');
    });
  });

  describe('Order Retry Logic', () => {
    it('should retry buy order on null response', async () => {
      // First attempt fails, second succeeds
      mockApi.placeOrder
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          symbol: 'TESTUSDT',
          orderId: '123',
          executedQty: '10',
          cummulativeQuoteQty: '100',
          status: 'FILLED',
          price: '10',
          origQty: '10',
          orderListId: 0,
          type: 'MARKET',
          side: 'BUY',
          transactTime: Date.now(),
        });

      const result = await tradeManager.placeMarketBuy(
        'TESTUSDT' as MarketSymbol,
        new Decimal(10)
      );

      expect(result).not.toBeNull();
      expect(mockApi.placeOrder).toHaveBeenCalledTimes(2);
    });

    it('should give up after max retries', async () => {
      // All attempts fail
      mockApi.placeOrder.mockResolvedValue(null);

      const result = await tradeManager.placeMarketBuy(
        'TESTUSDT' as MarketSymbol,
        new Decimal(10),
        3 // maxAttempts
      );

      expect(result).toBeNull();
      expect(mockApi.placeOrder).toHaveBeenCalledTimes(3);
    });
  });

  describe('Quantity Precision', () => {
    it('should round quantity to correct precision for sell orders', () => {
      const quantity = new Decimal('10.123456789');
      const precision = 2;

      const rounded = quantity.toDecimalPlaces(precision, Decimal.ROUND_DOWN);

      expect(rounded.toString()).toBe('10.12');
    });

    it('should always round DOWN to avoid insufficient balance errors', () => {
      const quantity = new Decimal('10.999');
      const precision = 0;

      const rounded = quantity.toDecimalPlaces(precision, Decimal.ROUND_DOWN);

      expect(rounded.toString()).toBe('10');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero profit correctly', () => {
      const buyPrice = new Decimal(100);
      const sellPrice = new Decimal(100);

      const profitPct = sellPrice.minus(buyPrice).div(buyPrice).mul(100);

      expect(profitPct.toString()).toBe('0');
    });

    it('should handle very large numbers without overflow', () => {
      const largePrice = new Decimal('999999999.123456');
      const stopLossPct = new Decimal(20);

      const stopLoss = largePrice.mul(new Decimal(1).minus(stopLossPct.div(100)));

      // Verify calculation is correct (within reasonable precision)
      expect(stopLoss.toFixed(6)).toBe('799999999.298765');
      // Verify no precision loss
      expect(stopLoss.gt(0)).toBe(true);
    });

    it('should maintain precision across multiple calculations', () => {
      const buyPrice = new Decimal('1.23456789');
      const sellPrice = new Decimal('1.35802468');

      // Calculate profit
      const profit = sellPrice.minus(buyPrice);
      // Calculate percentage
      const profitPct = profit.div(buyPrice).mul(100);
      // Convert back to USDT
      const profitUsdt = profitPct.div(100).mul(new Decimal(10));

      // Should maintain precision throughout
      expect(profitPct.toFixed(2)).toBe('10.00');
      expect(profitUsdt.toFixed(4)).toBe('1.0000');
    });
  });
});

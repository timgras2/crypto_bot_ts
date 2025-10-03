import { config } from 'dotenv';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { TradingConfig, MexcConfig } from './types.js';
import { logger } from './utils/logger.js';

// Load environment variables
config();

/**
 * Zod schema for trading configuration with validation ranges
 */
const tradingConfigSchema = z.object({
  stopLossPct: z
    .string()
    .transform((val) => new Decimal(val))
    .refine((val) => val.gte(0.1) && val.lte(50), {
      message: 'STOP_LOSS_PCT must be between 0.1 and 50',
    }),
  trailingPct: z
    .string()
    .transform((val) => new Decimal(val))
    .refine((val) => val.gte(0.1) && val.lte(20), {
      message: 'TRAILING_PCT must be between 0.1 and 20',
    }),
  maxTradeAmount: z
    .string()
    .transform((val) => new Decimal(val))
    .refine((val) => val.gte(1) && val.lte(10000), {
      message: 'MAX_TRADE_AMOUNT must be between 1 and 10000',
    }),
  checkInterval: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 1 && val <= 300, {
      message: 'CHECK_INTERVAL must be between 1 and 300 seconds',
    }),
  maxRetries: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 1 && val <= 10, {
      message: 'MAX_RETRIES must be between 1 and 10',
    }),
  retryDelay: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 1 && val <= 60, {
      message: 'RETRY_DELAY must be between 1 and 60 seconds',
    }),
  quoteCurrency: z
    .string()
    .refine((val) => ['USDT', 'USDC', 'BTC', 'BUSD'].includes(val), {
      message: 'QUOTE_CURRENCY must be one of: USDT, USDC, BTC, BUSD',
    }),
});

/**
 * Zod schema for MEXC API configuration
 */
const mexcConfigSchema = z.object({
  apiKey: z
    .string()
    .min(16, 'MEXC_API_KEY appears to be invalid (too short)')
    .refine((val) => /^[a-zA-Z0-9_-]+$/.test(val), {
      message: 'MEXC_API_KEY contains invalid characters',
    }),
  apiSecret: z
    .string()
    .min(16, 'MEXC_API_SECRET appears to be invalid (too short)')
    .refine((val) => /^[a-zA-Z0-9_-]+$/.test(val), {
      message: 'MEXC_API_SECRET contains invalid characters',
    }),
  baseUrl: z
    .string()
    .url()
    .refine((val) => val.startsWith('https://'), {
      message: 'MEXC_BASE_URL must use HTTPS',
    }),
  rateLimit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 10 && val <= 5000, {
      message: 'MEXC_RATE_LIMIT must be between 10 and 5000',
    }),
  timeout: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 5000 && val <= 120000, {
      message: 'API_TIMEOUT must be between 5000 and 120000 milliseconds',
    }),
  receiveWindow: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 1000 && val <= 60000, {
      message: 'RECEIVE_WINDOW must be between 1000 and 60000 milliseconds',
    }),
});

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): { trading: TradingConfig; mexc: MexcConfig } {
  try {
    // Support backward compatibility with deprecated MIN_PROFIT_PCT
    const stopLossPct = process.env.STOP_LOSS_PCT || process.env.MIN_PROFIT_PCT || '5.0';

    if (process.env.MIN_PROFIT_PCT && !process.env.STOP_LOSS_PCT) {
      logger.warn('MIN_PROFIT_PCT is deprecated. Please use STOP_LOSS_PCT instead.');
    }

    // Validate trading configuration
    const tradingConfig = tradingConfigSchema.parse({
      stopLossPct,
      trailingPct: process.env.TRAILING_PCT || '3.0',
      maxTradeAmount: process.env.MAX_TRADE_AMOUNT || '10.0',
      checkInterval: process.env.CHECK_INTERVAL || '10',
      maxRetries: process.env.MAX_RETRIES || '3',
      retryDelay: process.env.RETRY_DELAY || '5',
      quoteCurrency: process.env.QUOTE_CURRENCY || 'USDT',
    });

    // Validate MEXC API configuration
    if (!process.env.MEXC_API_KEY || !process.env.MEXC_API_SECRET) {
      throw new Error(
        'MEXC_API_KEY and MEXC_API_SECRET are required. Please set them in your .env file.'
      );
    }

    const mexcConfig = mexcConfigSchema.parse({
      apiKey: process.env.MEXC_API_KEY,
      apiSecret: process.env.MEXC_API_SECRET,
      baseUrl: process.env.MEXC_BASE_URL || 'https://api.mexc.com',
      rateLimit: process.env.MEXC_RATE_LIMIT || '1200',
      timeout: process.env.API_TIMEOUT || '30000',
      receiveWindow: process.env.RECEIVE_WINDOW || '5000',
    });

    logger.info('Configuration loaded and validated successfully');

    return {
      trading: tradingConfig,
      mexc: mexcConfig,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        logger.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration. Please check your .env file.');
    }
    throw error;
  }
}

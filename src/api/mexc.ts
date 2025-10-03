import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { MexcConfig, ExchangeInfo, TickerResponse, OrderRequest, OrderResponse } from '../types.js';
import { logger } from '../utils/logger.js';

/**
 * Rate limiter using sliding window algorithm
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly limit: number;
  private readonly window: number; // milliseconds

  constructor(requestsPerMinute: number) {
    this.limit = requestsPerMinute;
    this.window = 60000; // 1 minute
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove requests outside the window
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.window);

    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      if (oldestRequest === undefined) {
        throw new Error('Rate limiter error: oldest request is undefined');
      }
      const waitTime = this.window - (now - oldestRequest);
      logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire(); // Retry after waiting
    }

    this.requests.push(now);
  }
}

/**
 * MEXC API client with authentication, rate limiting, and error handling
 */
export class MexcAPI {
  private readonly config: MexcConfig;
  private readonly client: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private symbolPrecisionCache = new Map<string, number>();

  constructor(config: MexcConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit);

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate HMAC SHA256 signature for authenticated requests
   */
  private sign(queryString: string): string {
    return crypto.createHmac('sha256', this.config.apiSecret).update(queryString).digest('hex');
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    authenticated = false
  ): Promise<T | null> {
    await this.rateLimiter.acquire();

    try {
      // Build headers - only add API key for authenticated requests
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authenticated) {
        headers['X-MEXC-APIKEY'] = this.config.apiKey;
      }

      // Add timestamp and recvWindow for authenticated requests
      if (authenticated) {
        params.timestamp = Date.now();
        params.recvWindow = this.config.receiveWindow;

        // Create query string and sign it (params must be in insertion order, NOT sorted)
        const queryString = Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${String(value)}`)
          .join('&');

        params.signature = this.sign(queryString);
      }

      const response = await this.client.request<T>({
        method,
        url: endpoint,
        params: params, // MEXC requires all params in query string, even for POST
        headers,
      });

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error(`MEXC API error: ${error.message}`, {
          endpoint,
          status: error.response?.status,
          data: error.response?.data,
        });
      } else {
        logger.error(`Unexpected error: ${String(error)}`);
      }
      return null;
    }
  }

  /**
   * Test connectivity to MEXC API
   */
  async ping(): Promise<boolean> {
    const response = await this.request<Record<string, never>>('GET', '/api/v3/ping');
    return response !== null;
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<number | null> {
    const response = await this.request<{ serverTime: number }>('GET', '/api/v3/time');
    return response?.serverTime ?? null;
  }

  /**
   * Get exchange information (all trading pairs)
   */
  async getExchangeInfo(): Promise<ExchangeInfo | null> {
    return this.request<ExchangeInfo>('GET', '/api/v3/exchangeInfo');
  }

  /**
   * Get base asset precision for a symbol (cached)
   */
  async getSymbolPrecision(symbol: string): Promise<number | null> {
    // Check cache first
    const cached = this.symbolPrecisionCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }

    // Fetch exchange info
    const exchangeInfo = await this.getExchangeInfo();
    if (!exchangeInfo) {
      logger.error(`Failed to fetch exchange info for precision lookup`);
      return null;
    }

    // Find symbol and cache precision
    const symbolInfo = exchangeInfo.symbols.find((s) => s.symbol === symbol);
    if (!symbolInfo) {
      logger.error(`Symbol ${symbol} not found in exchange info`);
      return null;
    }

    this.symbolPrecisionCache.set(symbol, symbolInfo.baseAssetPrecision);
    return symbolInfo.baseAssetPrecision;
  }

  /**
   * Get 24-hour ticker for a symbol
   */
  async getTicker24h(symbol: string): Promise<TickerResponse | null> {
    return this.request<TickerResponse>('GET', '/api/v3/ticker/24hr', { symbol });
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<string | null> {
    const response = await this.request<{ symbol: string; price: string }>(
      'GET',
      '/api/v3/ticker/price',
      { symbol }
    );
    return response?.price ?? null;
  }

  /**
   * Place a new order
   */
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse | null> {
    const params: Record<string, string | number | undefined> = {
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      quantity: orderRequest.quantity,
      quoteOrderQty: orderRequest.quoteOrderQty,
      price: orderRequest.price,
    };

    return this.request<OrderResponse>('POST', '/api/v3/order', params, true);
  }

  /**
   * Get order details
   */
  async getOrder(symbol: string, orderId: string): Promise<OrderResponse | null> {
    return this.request<OrderResponse>('GET', '/api/v3/order', { symbol, orderId }, true);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
    const response = await this.request<{ symbol: string; orderId: string }>(
      'DELETE',
      '/api/v3/order',
      { symbol, orderId },
      true
    );
    return response !== null;
  }

  /**
   * Get account information
   */
  async getAccount(): Promise<unknown> {
    return this.request('GET', '/api/v3/account', {}, true);
  }

  /**
   * Retry wrapper for critical operations
   */
  async withRetry<T>(
    operation: () => Promise<T | null>,
    maxRetries: number,
    retryDelay: number
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await operation();
      if (result !== null) {
        return result;
      }

      if (attempt < maxRetries) {
        logger.warn(`Retry attempt ${attempt}/${maxRetries} after ${retryDelay}s`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay * 1000));
      }
    }

    logger.error(`Operation failed after ${maxRetries} attempts`);
    return null;
  }
}

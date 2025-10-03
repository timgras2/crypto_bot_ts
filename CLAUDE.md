# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an automated cryptocurrency trading bot for the **MEXC exchange**, built with TypeScript and Node.js. The bot monitors MEXC for new token listings and automatically executes trades with intelligent trailing stop-loss protection.

**⚠️ CRITICAL: This bot trades with REAL MONEY.** The bot automatically trades on ALL new USDT listings on MEXC. This is high-risk automated trading - always start with minimal amounts (1-5 USDT per trade) for testing.

## Architecture Overview

The bot follows a modular architecture with clear separation of concerns:

### Core Components

1. **TradingBot** (`src/main.ts`) - Main orchestrator
   - Initializes all components
   - Runs the main detection loop
   - Handles graceful shutdown with SIGINT/SIGTERM
   - Coordinates between MarketTracker and TradeManager

2. **MexcAPI** (`src/api/mexc.ts`) - Exchange API client
   - HMAC-SHA256 authentication for signed requests
   - Sliding window rate limiter (1200 req/min default)
   - Retry logic with exponential backoff
   - Handles `/api/v3/*` endpoints (exchange info, tickers, orders)

3. **MarketTracker** (`src/market/tracker.ts`) - New listing detector
   - Fetches all active trading pairs from MEXC
   - Compares current markets vs. baseline (from `data/previous_markets.json`)
   - Uses set-based diffing for O(n) performance
   - First run establishes baseline without trading

4. **TradeManager** (`src/trade/manager.ts`) - Trade executor and monitor
   - Places market buy orders using `quoteOrderQty` (USDT amount)
   - Spawns async monitoring tasks for each active trade
   - Implements trailing stop-loss logic with dual thresholds:
     - **Stop Loss**: Absolute loss protection (e.g., -5%)
     - **Trailing Stop**: Profit protection that moves with price (e.g., -3% from peak)
   - Persists trade state to `data/active_trades.json` for crash recovery
   - Records completed trades to `data/completed_trades.json`

### Key Design Patterns

**Decimal Precision**: All price/amount calculations use `decimal.js` to avoid floating-point errors. Never use JavaScript's native `Number` for financial calculations.

**State Persistence**: The bot maintains state in JSON files:
- `data/previous_markets.json` - Baseline of existing markets
- `data/active_trades.json` - Currently active trades (restored on restart)
- `data/completed_trades.json` - Trade history with P&L

**Serialization**: `TradeState` uses `Decimal` objects internally, but serializes to `SerializedTradeState` (string values) for JSON storage. Always convert between these when persisting/loading.

**Async Monitoring**: Each trade gets its own async task with an `AbortController` for clean cancellation. The bot uses Node.js async/await patterns instead of threads.

**Graceful Shutdown**: When SIGINT/SIGTERM is received:
1. Sets `running = false` to exit main loop
2. Calls `TradeManager.shutdown()` to abort all monitoring tasks
3. Saves active trades and market state to disk
4. Active trades are restored on next startup via `restoreMonitoring()`

## Development Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production build
npm start

# Testing
npm test                  # Run all tests
npm run test:watch        # Watch mode

# Code quality
npm run lint             # Check for linting issues
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format with Prettier
```

## Configuration System

Configuration uses **Zod** schemas (`src/config.ts`) for runtime validation with detailed error messages. All settings come from `.env` file with safe defaults:

**Required**: `MEXC_API_KEY`, `MEXC_API_SECRET`

**Critical Trading Params**:
- `MAX_TRADE_AMOUNT` (1.0-10000.0 USDT) - Amount per trade
- `MIN_PROFIT_PCT` (0.1-50.0) - Stop loss threshold
- `TRAILING_PCT` (0.1-20.0) - Trailing stop threshold
- `QUOTE_CURRENCY` (USDT/USDC/BTC/BUSD) - Quote currency filter

Configuration loading will throw clear errors if values are out of range or API keys are malformed.

## MEXC-Specific Considerations

**Symbol Format**: MEXC uses concatenated symbols (e.g., `BTCUSDT`) without separators, unlike Bitvavo which uses `BTC-EUR`.

**Quote Order Qty**: For market buys, use `quoteOrderQty` parameter to specify USDT amount instead of calculating quantity manually.

**Receive Window**: MEXC requires `recvWindow` parameter (default 5000ms, max 60000ms) on authenticated requests to prevent replay attacks.

**Rate Limiting**: MEXC uses weight-based rate limits. This implementation uses a conservative sliding window at 1200 req/min.

## TypeScript Strictness

This project uses **maximum TypeScript strictness**:
- `strict: true`
- `noUncheckedIndexedAccess: true` - Array/object access returns `T | undefined`
- `exactOptionalPropertyTypes: true`
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`

When accessing arrays or objects, always handle the `undefined` case. ESLint will enforce these rules.

## Module System

Uses **ES Modules** (`"type": "module"` in package.json):
- All imports must include `.js` extension (even for `.ts` files)
- Use `import` syntax, not `require()`
- Top-level await is supported

## Data Files Safety

**NEVER delete data files while the bot has active trades!** The bot relies on:
- `data/active_trades.json` for state recovery after crashes/restarts
- `data/previous_markets.json` for detecting new listings

If you need to reset: stop the bot, manually sell any positions on MEXC, then delete data files.

## Logging

Uses **Winston** logger (`src/utils/logger.ts`):
- Logs to `logs/combined.log` (all levels) and `logs/error.log` (errors only)
- Console output in development (colorized)
- Set `LOG_LEVEL` env var to `debug` for verbose output

## First Run Behavior

On the first run (when `data/previous_markets.json` doesn't exist):
1. Bot fetches all current USDT pairs from MEXC
2. Saves them as the baseline
3. Does **NOT** trade on any existing pairs
4. Only trades on pairs added **after** baseline is established

This prevents the bot from immediately buying hundreds of existing pairs.

## Testing New Listings

To manually test new listing detection without waiting:
1. Start bot to establish baseline
2. Stop bot
3. Edit `data/previous_markets.json` and remove a known pair (e.g., remove `BTCUSDT`)
4. Restart bot - it will detect the removed pair as "new" and attempt to trade

## Common Pitfalls

1. **Never use `Number()` for prices/amounts** - Use `new Decimal()` instead
2. **Market symbols are branded types** - Cast strings as `MarketSymbol` when needed
3. **Check for `null` returns from API calls** - MEXC API wrapper returns `null` on errors
4. **Handle AbortController signals** - Monitoring tasks must respect abort signals for clean shutdown
5. **Wait for `saveActiveTrades()` to complete** - Don't exit process before persistence completes

## Node.js Version

Requires **Node.js >= 18.0.0** for:
- Native fetch API support
- Top-level await
- AbortController/AbortSignal

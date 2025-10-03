# MEXC Crypto Trading Bot (TypeScript)

A fully automated cryptocurrency trading bot for the MEXC exchange, built with TypeScript. Detects new token listings and executes trades with intelligent trailing stop-loss protection.

## ⚠️ Critical Safety Warning

**This bot trades with REAL MONEY on cryptocurrency exchanges.**

- **Always start with very small amounts** ($1-5 USDT per trade) for testing
- Never invest more than you can afford to lose completely
- The bot will automatically trade on **ALL new listings** - this is high risk
- Monitor the bot closely during initial runs
- Cryptocurrency trading carries significant financial risk

## Features

- 🔍 **New Listing Detection** - Monitors MEXC for newly added trading pairs
- 💰 **Automated Trading** - Places market buy orders for new listings with volume validation
- 📈 **Trailing Stop-Loss** - Dynamic profit protection that adjusts with price increases
- 💾 **State Recovery** - Resumes monitoring after bot restarts without losing positions
- 🛡️ **Risk Management** - Configurable trade amounts, stop-loss, and trailing percentages
- ⚡ **Rate Limiting** - Respects exchange API limits with sliding window implementation
- 📊 **Comprehensive Logging** - Detailed activity logs using Winston
- ✅ **Input Validation** - Extensive validation with Zod schemas and clear error messages
- 🔒 **Type Safety** - Full TypeScript type safety throughout

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MEXC account with API credentials
- Small amount of USDT for testing

### Installation

1. **Clone or navigate to this repository:**
   ```bash
   cd crypto-bot-ts
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` with your MEXC API credentials:**
   ```bash
   MEXC_API_KEY=your_api_key_here
   MEXC_API_SECRET=your_api_secret_here
   MAX_TRADE_AMOUNT=5.0  # Start VERY small!
   ```

5. **Build the project:**
   ```bash
   npm run build
   ```

6. **Run the bot:**
   ```bash
   # Development mode (with hot reload)
   npm run dev

   # Production mode
   npm start
   ```

## Configuration

All configuration is done via environment variables in the `.env` file:

### Required Settings

```bash
MEXC_API_KEY=your_api_key          # Your MEXC API key
MEXC_API_SECRET=your_api_secret    # Your MEXC API secret
```

### Trading Parameters

```bash
MAX_TRADE_AMOUNT=10.0     # USDT per trade (START SMALL: 1-5 USDT!)
MIN_PROFIT_PCT=5.0        # Stop loss percentage (5% loss = sell)
TRAILING_PCT=3.0          # Trailing stop percentage (locks in profits)
QUOTE_CURRENCY=USDT       # Quote currency for trading pairs
```

### Bot Behavior

```bash
CHECK_INTERVAL=10         # Price check interval (seconds)
MAX_RETRIES=3             # API request retry attempts
RETRY_DELAY=5             # Delay between retries (seconds)
```

### Advanced API Settings

```bash
MEXC_BASE_URL=https://api.mexc.com    # MEXC API base URL
MEXC_RATE_LIMIT=1200                   # Requests per minute
API_TIMEOUT=30000                      # Request timeout (milliseconds)
RECEIVE_WINDOW=5000                    # Request receive window (max 60000ms)
LOG_LEVEL=info                         # Logging level (error, warn, info, debug)
```

## Project Structure

```
crypto-bot-ts/
├── src/
│   ├── main.ts              # Main bot orchestrator
│   ├── config.ts            # Configuration with Zod validation
│   ├── types.ts             # TypeScript type definitions
│   ├── api/
│   │   └── mexc.ts          # MEXC API client
│   ├── market/
│   │   └── tracker.ts       # Market listing tracker
│   ├── trade/
│   │   └── manager.ts       # Trade execution and monitoring
│   └── utils/
│       ├── logger.ts        # Winston logger setup
│       └── persistence.ts   # JSON file persistence
├── tests/                   # Test files
├── data/                    # Runtime data (gitignored)
│   ├── previous_markets.json
│   ├── active_trades.json
│   └── completed_trades.json
├── logs/                    # Log files (gitignored)
└── dist/                    # Compiled JavaScript (gitignored)
```

## How It Works

1. **Baseline Establishment** - On first run, the bot establishes a baseline of existing markets
2. **Continuous Monitoring** - Every `CHECK_INTERVAL` seconds, checks for new listings
3. **Volume Validation** - Validates that new listings have sufficient trading volume
4. **Automated Trading** - Places market buy orders for validated new listings
5. **Trailing Stop-Loss** - Monitors each trade and adjusts stop-loss as price increases
6. **Profit Protection** - Sells when price drops below trailing stop or stop-loss threshold

### Trailing Stop-Loss Example

```
Buy Price:    $1.00
Stop Loss:    $0.95 (5% loss protection)
Trailing:     $0.97 (3% trailing)

Price → $1.20: New trailing stop at $1.16 (locks in 16% profit)
Price → $1.50: New trailing stop at $1.45 (locks in 45% profit)
Price drops to $1.44: SELL triggered (45% profit protected)
```

## Development

### Available Scripts

```bash
npm run dev          # Development mode with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Run production build
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint code
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format code with Prettier
```

### Running Tests

```bash
npm test
```

## Data Persistence

The bot automatically creates and manages these data files:

- `data/previous_markets.json` - Baseline of existing markets
- `data/active_trades.json` - Currently active trades (for recovery)
- `data/completed_trades.json` - History of completed trades

**Never delete these files while the bot is running with active trades!**

## Graceful Shutdown

Press `Ctrl+C` to trigger graceful shutdown:
- Saves all active trades to disk
- Preserves market data
- Stops all monitoring tasks
- Active trades will be restored on next startup

## Migrating from Python/Bitvavo Bot

Key differences from the Python version:

1. **Exchange**: MEXC instead of Bitvavo
2. **Currency**: USDT pairs instead of EUR pairs
3. **Symbol Format**: `BTCUSDT` instead of `BTC-EUR`
4. **Language**: TypeScript with full type safety
5. **Runtime**: Node.js instead of Python

Your existing trade data is **not compatible** - this is a fresh start!

## Troubleshooting

### Bot won't start
- Check that Node.js >= 18 is installed: `node --version`
- Verify `.env` file exists and contains valid API credentials
- Run `npm install` to ensure dependencies are installed

### API connection errors
- Verify API credentials are correct
- Check that your IP is whitelisted on MEXC (if required)
- Ensure your API key has trading permissions enabled

### No trades executing
- Check `data/previous_markets.json` exists (baseline established)
- Verify quote currency matches available pairs: `QUOTE_CURRENCY=USDT`
- New listings are rare - be patient!

## Security Best Practices

1. **Never commit your `.env` file** - It's gitignored by default
2. **Use API keys with limited permissions** - Only enable spot trading
3. **Enable IP whitelist on MEXC** - Restrict API access to your IP
4. **Start with minimal amounts** - Test with $1-5 USDT per trade
5. **Monitor regularly** - Check logs and active trades frequently

## Logging

Logs are written to:
- `logs/error.log` - Error-level logs only
- `logs/combined.log` - All log levels
- Console output - Colorized logs in development

Adjust log level in `.env`:
```bash
LOG_LEVEL=debug  # error, warn, info, debug
```

## License

MIT

## Disclaimer

This software is provided "as is" without warranty of any kind. Cryptocurrency trading carries significant financial risk. The authors and contributors are not responsible for any financial losses incurred through use of this software. Use at your own risk.

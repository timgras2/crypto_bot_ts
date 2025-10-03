# Getting Started with MEXC Trading Bot

## 🎯 What You Have

A complete TypeScript rewrite of your crypto trading bot, now configured for **MEXC exchange** instead of Bitvavo.

### Location
```
C:\Users\tgra\OneDrive - Superp Technology Consultants B.V\Prive\AI\Claude Code\
├── crypto_bot_main/      # Original Python/Bitvavo bot (still there)
└── crypto-bot-ts/        # New TypeScript/MEXC bot (freshly created)
```

## 📋 Next Steps

### 1. Get MEXC API Credentials

1. Go to [MEXC](https://www.mexc.com/)
2. Log in to your account
3. Navigate to **Account** → **API Management**
4. Create a new API key with **Spot Trading** permissions
5. Save your API Key and Secret (you won't see the secret again!)

### 2. Configure the Bot

```bash
cd "C:\Users\tgra\OneDrive - Superp Technology Consultants B.V\Prive\AI\Claude Code\crypto-bot-ts"
```

Edit the `.env` file and add your credentials:

```bash
# Required
MEXC_API_KEY=your_actual_api_key_here
MEXC_API_SECRET=your_actual_api_secret_here

# CRITICAL: Start with a VERY small amount!
MAX_TRADE_AMOUNT=1.0  # Start with just $1 USDT per trade!
```

### 3. Test Run

```bash
# Make sure you're in the crypto-bot-ts directory
npm run dev
```

You should see:
```
🚀 Initializing MEXC Crypto Trading Bot...
✅ Connected to MEXC API
✅ Bot initialized successfully

🤖 Bot is now active and scanning for new listings...
💰 Max trade amount: 1 USDT
🔄 Checking every 10 seconds
📈 Stop loss: 5% | Trailing stop: 3%
💱 Quote currency: USDT
------------------------------------------------------------
🔄 First run detected - establishing market baseline...
✅ Baseline established: XXX existing markets saved
📊 Now monitoring for NEW USDT listings...
```

### 4. First Run Behavior

**On the first run**, the bot will:
1. ✅ Connect to MEXC API
2. ✅ Fetch all existing USDT trading pairs
3. ✅ Save them to `data/previous_markets.json`
4. ✅ **NOT trade** on any existing pairs
5. ✅ Start monitoring for **NEW** listings only

**On subsequent runs**, the bot will:
1. ✅ Load the baseline from `data/previous_markets.json`
2. ✅ Detect any NEW pairs added since baseline
3. ✅ Automatically trade on new listings (if volume is sufficient)

## 🛡️ Safety Checklist

Before running with real money:

- [ ] I have tested with `MAX_TRADE_AMOUNT=1.0` (or less)
- [ ] I understand this bot trades on **ALL new USDT pairs** automatically
- [ ] I have enabled IP whitelist on MEXC (optional but recommended)
- [ ] I have limited my API key to **Spot Trading only** (no futures/margin)
- [ ] I understand I could lose all funds allocated to trading
- [ ] I have read and understand the trailing stop-loss mechanism
- [ ] I will monitor the bot during the first few trades

## 📊 Monitoring Your Bot

### View Active Trades
The bot automatically saves active trades to:
```
data/active_trades.json
```

### View Completed Trades
Historical trades are saved to:
```
data/completed_trades.json
```

### View Logs
Check logs in real-time:
```
tail -f logs/combined.log  # All logs
tail -f logs/error.log     # Errors only
```

Or just watch the console output where the bot is running!

## 🔄 Graceful Shutdown

To stop the bot safely:
1. Press `Ctrl+C` in the terminal
2. Wait for the shutdown message:
   ```
   🛑 SIGINT received - shutting down gracefully...
   🔄 Preparing for graceful shutdown...
   💾 Saved X active trades for recovery
   💾 Market data saved
   ✅ Bot shutdown complete
   ```

**Active trades are preserved and will be restored on next startup!**

## 🚀 Production Deployment

When ready to run continuously:

```bash
# Build production version
npm run build

# Run in production mode
npm start
```

For background execution (Linux/Mac):
```bash
nohup npm start > bot.log 2>&1 &
```

For Windows service deployment, consider using:
- [PM2](https://pm2.keymetrics.io/) (works on Windows)
- [NSSM](https://nssm.cc/) (Windows service wrapper)

## ⚙️ Configuration Options

### Trading Parameters

| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `MAX_TRADE_AMOUNT` | 10.0 | 1.0-10000.0 | USDT per trade |
| `MIN_PROFIT_PCT` | 5.0 | 0.1-50.0 | Stop loss % |
| `TRAILING_PCT` | 3.0 | 0.1-20.0 | Trailing stop % |
| `CHECK_INTERVAL` | 10 | 1-300 | Seconds between checks |
| `QUOTE_CURRENCY` | USDT | USDT, USDC, BTC | Quote currency filter |

### Example Configurations

**Conservative (Recommended for Testing):**
```bash
MAX_TRADE_AMOUNT=1.0
MIN_PROFIT_PCT=10.0
TRAILING_PCT=5.0
CHECK_INTERVAL=30
```

**Moderate:**
```bash
MAX_TRADE_AMOUNT=10.0
MIN_PROFIT_PCT=5.0
TRAILING_PCT=3.0
CHECK_INTERVAL=10
```

**Aggressive (High Risk!):**
```bash
MAX_TRADE_AMOUNT=50.0
MIN_PROFIT_PCT=3.0
TRAILING_PCT=2.0
CHECK_INTERVAL=5
```

## 🆘 Troubleshooting

### "Failed to connect to MEXC API"
- Check your API credentials in `.env`
- Verify your API key has trading permissions
- Check if MEXC is accessible from your network

### "Configuration validation failed"
- Make sure all required variables are in `.env`
- Check that numeric values are within valid ranges
- Ensure `MEXC_API_KEY` and `MEXC_API_SECRET` are at least 32 characters

### Bot compiles but crashes immediately
- Run with debug logging: `LOG_LEVEL=debug npm run dev`
- Check `logs/error.log` for detailed error messages

### No new listings detected for a long time
- New listings are rare! Be patient
- Check `data/previous_markets.json` to verify baseline was established
- You can manually test by removing a pair from the file (bot will detect it as "new")

## 📈 Understanding Results

### Profitable Trade Example
```json
{
  "market": "NEWBTC",
  "buyPrice": "0.00001000",
  "sellPrice": "0.00001500",
  "profitLossPct": "50.00",
  "profitLossUsdt": "5.0000",
  "triggerReason": "trailing_stop",
  "durationHours": "2.3"
}
```

### Loss Trade Example
```json
{
  "market": "SCAMTOKEN",
  "buyPrice": "1.00000000",
  "sellPrice": "0.95000000",
  "profitLossPct": "-5.00",
  "profitLossUsdt": "-0.5000",
  "triggerReason": "stop_loss",
  "durationHours": "0.5"
}
```

## 🔐 Security Tips

1. **Never share your `.env` file**
2. **Use API keys with IP whitelist** (if static IP)
3. **Start with minimal amounts** until you trust the bot
4. **Regularly check your MEXC account** for unexpected activity
5. **Keep your API secret secure** - regenerate if compromised

## 📚 Additional Resources

- [MEXC API Documentation](https://www.mexc.com/api-docs/spot-v3/introduction)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Winston Logger](https://github.com/winstonjs/winston)
- [Zod Validation](https://zod.dev/)

## ✨ What's Different from the Python Bot?

| Feature | Python (Bitvavo) | TypeScript (MEXC) |
|---------|------------------|-------------------|
| Exchange | Bitvavo | MEXC |
| Currency | EUR | USDT |
| Symbol Format | `BTC-EUR` | `BTCUSDT` |
| Language | Python 3.11+ | TypeScript/Node 18+ |
| Validation | Dataclasses | Zod schemas |
| Decimals | `Decimal` | `decimal.js` |
| Logging | Python logging | Winston |
| Threading | `threading` | async/await |
| Type Safety | Type hints | Full TypeScript |

## 🎉 You're Ready!

Your bot is fully configured and ready to trade. Remember:
- **Start small** (1-5 USDT per trade)
- **Monitor closely** during the first few trades
- **Understand the risks** of automated trading
- **Have fun** (but stay safe!)

Good luck! 🚀

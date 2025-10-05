# Scheduled Listings Guide

The scheduled listings feature allows you to pre-configure the bot to automatically trade newly listed tokens at their exact listing time on MEXC. This is ideal for catching new listings with precision timing.

## How It Works

Instead of relying on the bot's regular polling to detect new listings (which scans every 10 seconds), scheduled listings use **precise timer-based execution**:

1. **Schedule the listing**: Add the token symbol and exact listing time
2. **Timer activation**: Bot sets a timer to execute at the exact scheduled time
3. **Automatic execution**: At listing time, bot attempts to place a market buy order
4. **Retry logic**: If the order fails (e.g., market not yet tradeable), bot retries every 100ms for up to 60 seconds
5. **Monitoring**: Once purchased, normal trailing stop-loss monitoring begins

## Why Use Scheduled Listings?

**Speed**: Execute within milliseconds of listing time vs. up to 10 seconds delay with regular detection

**Precision**: No guessing when the listing will go live - you set the exact time

**Reliability**: Handles pre-announced symbols that appear in exchange info before trading starts

**No API waste**: Uses direct timers instead of constant polling

## Getting Listing Information

MEXC announces new listings on their official page:

**https://www.mexc.com/newlisting**

Look for:
- Token symbol (e.g., `CYPR`, `LYN`, `SP`)
- Exact listing time in UTC
- Quote currency (usually `USDT`)

**Important**: MEXC times are in UTC. Make sure to convert to your local timezone when scheduling.

## Using the Scheduler

### Option 1: Web Dashboard (Recommended)

1. **Start the bot and dashboard**:
   ```bash
   npm run dev:all
   ```

2. **Open the dashboard** at http://localhost:5173

3. **Navigate to "Scheduled Listings"** in the top menu

4. **Fill in the form**:
   - **Symbol**: Token symbol without quote currency (e.g., `CYPR` not `CYPRUSDT`)
   - **Listing Time**: Select date and time in **your local timezone**
   - **Quote Currency**: Select `USDT` (or other if applicable)
   - **Notes** (optional): Add any reminders or context

5. **Click "Schedule Listing"**

6. **Verify**: The listing appears in the table with status `pending`

### Option 2: CLI Tool

```bash
# Add a scheduled listing
npm run schedule-listing -- --symbol CYPR --time "2025-10-06 12:00" --quote USDT

# With notes
npm run schedule-listing -- --symbol LYN --time "2025-10-06 09:00" --quote USDT --notes "High volume expected"

# List all scheduled listings
npm run schedule-listing -- --list

# Remove a scheduled listing
npm run schedule-listing -- --remove CYPR --time "2025-10-06 12:00"
```

### Option 3: Direct File Edit (Not Recommended)

Edit `data/scheduled_listings.json` manually:

```json
[
  {
    "symbol": "CYPR",
    "listingTime": "2025-10-06T12:00:00.000Z",
    "quoteCurrency": "USDT",
    "status": "pending",
    "createdAt": "2025-10-05T13:00:00.000Z",
    "notes": "Official MEXC listing"
  }
]
```

**Note**: Use ISO 8601 format in UTC timezone.

## Listing Status Lifecycle

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for listing time to arrive |
| `active` | Listing time reached, attempting to execute trade |
| `completed` | Successfully traded and monitoring started |
| `missed` | Failed to execute within 60 seconds after listing time |

## Timing Considerations

### MEXC Behavior

MEXC often adds new token symbols to their API **hours before** the actual listing time when trading becomes enabled. This is why the scheduler is crucial - regular detection would miss the "new listing" event.

### Timer Precision

- Bot executes at **exactly** the scheduled time (down to the millisecond)
- If first attempt fails, retries every **100ms**
- Continues retrying for up to **60 seconds**
- Stops after successful trade or 60s timeout

### Example Timeline

```
11:59:30 - Symbol CYPRUSDT appears in MEXC exchange info (trading disabled)
11:59:45 - Bot's regular scan adds CYPRUSDT to baseline (no trade)
12:00:00.000 - SCHEDULED TIME: Bot attempts market buy order
12:00:00.000 - Order rejected: "Trading not enabled"
12:00:00.100 - Retry attempt #1
12:00:00.200 - Retry attempt #2
12:00:00.500 - Trading enabled! Order executed successfully ✓
12:00:00.500 - Trailing stop-loss monitoring begins
```

## Trade Configuration

Scheduled listings use your configured settings from `.env`:

- `MAX_TRADE_AMOUNT`: Amount per trade (USDT)
- `STOP_LOSS_PCT`: Maximum loss threshold
- `TRAILING_PCT`: Trailing stop distance from peak
- `QUOTE_CURRENCY`: Must match the scheduled listing's quote currency

**Safety tip**: Start with minimal trade amounts (1-5 USDT) for testing scheduled listings.

## Monitoring Scheduled Listings

### Via Dashboard

The Scheduled Listings page shows:
- All pending listings with countdown timers
- Active listings being executed
- Recently completed/missed listings
- Status badges and time remaining

### Via Logs

Watch the bot console output:

```
📅 Loaded 2 scheduled listings:
   • SP at 10/6/2025, 8:00:00 AM
   • LYN at 10/6/2025, 9:00:00 AM
⏰ Timer set for SP at 10/6/2025, 8:00:00 AM
⏰ Timer set for LYN at 10/6/2025, 9:00:00 AM
...
⏰ SP listing time reached - executing trade!
🎯 Executing scheduled trade: SPUSDT
```

### Via API

```bash
# Get all scheduled listings
curl http://localhost:3001/api/scheduled-listings

# Example response
{
  "listings": [
    {
      "symbol": "SP",
      "listingTime": "2025-10-06T08:00:00.000Z",
      "quoteCurrency": "USDT",
      "status": "pending",
      "notes": "Morning listing"
    }
  ]
}
```

## Best Practices

### 1. Verify Listing Times
- Always double-check MEXC's official announcement
- Account for timezone differences (MEXC uses UTC)
- Set timers 1-2 minutes before if unsure

### 2. Monitor Your Schedule
- Check the dashboard before each listing
- Ensure bot is running and connected
- Verify sufficient USDT balance

### 3. Test First
- Try scheduling a test listing in the past (will mark as missed)
- Observe the retry behavior in logs
- Start with small trade amounts

### 4. Handle Multiple Listings
- You can schedule multiple listings simultaneously
- Each gets its own independent timer
- Bot processes them in parallel

### 5. Clean Up Old Listings
- Completed/missed listings older than 24h are auto-deleted
- Manually remove listings if plans change

## Troubleshooting

### Listing Marked as "Missed"

**Possible causes**:
- Symbol doesn't exist in MEXC exchange info yet
- Trading is disabled for the symbol
- Insufficient balance or API issues
- Incorrect symbol/quote currency combination

**Solution**:
- Check MEXC listing status manually
- Review bot logs for specific error messages
- Verify API credentials have trading permissions

### Timer Not Triggering

**Possible causes**:
- Bot was restarted after listing time
- Listing time is in the past

**Solution**:
- Bot restores timers on startup if within 60s window
- For older listings, status will be `missed`

### Duplicate Listings

If you schedule the same symbol/time twice:
- Second attempt will be rejected
- Check scheduled listings table before adding

### Wrong Timezone

If the trade executes at the wrong time:
- The dashboard uses your local timezone automatically
- CLI requires manual timezone conversion to UTC
- Verify system clock is correct

## API Endpoints

The scheduler exposes these API endpoints (available when `npm run server` is running):

```bash
# Get all scheduled listings
GET /api/scheduled-listings

# Add a new scheduled listing
POST /api/scheduled-listings
{
  "symbol": "CYPR",
  "listingTime": "2025-10-06T12:00:00.000Z",
  "quoteCurrency": "USDT",
  "notes": "Optional notes"
}

# Remove a scheduled listing
DELETE /api/scheduled-listings/:symbol/:listingTime
```

## File Storage

Scheduled listings are persisted in:

```
data/scheduled_listings.json
```

**Important**:
- This file is auto-created on first use
- Bot reads this file on startup to restore timers
- Don't delete while bot has pending listings
- Format must be valid JSON

## Advanced: Programmatic Usage

You can integrate the scheduler into custom scripts:

```typescript
import { ListingScheduler } from './src/scheduler/listing-scheduler.js';

const scheduler = new ListingScheduler({
  maxWaitAfterListing: 60,  // Wait 60s after listing time
  retryInterval: 100,       // Retry every 100ms
});

// Register trade executor
scheduler.setTradeExecutor(async (symbol, quoteCurrency) => {
  // Your trade logic here
  const success = await executeTrade(symbol, quoteCurrency);
  return success; // true = completed, false = retry
});

// Add listing
await scheduler.addScheduledListing(
  'CYPR',
  '2025-10-06T12:00:00.000Z',
  'USDT',
  'Test listing'
);

// Initialize (sets up timers)
await scheduler.initialize();
```

## FAQ

**Q: Can I schedule listings for coins already trading?**
A: Yes, but it's redundant - the regular detection will catch them. Scheduler is for pre-announced new listings.

**Q: What happens if I restart the bot?**
A: Timers are restored on startup if within the 60s retry window. Older listings are marked as missed.

**Q: Can I change a scheduled listing?**
A: Remove the old one and add a new one. There's no edit functionality.

**Q: Does this work for non-USDT pairs?**
A: Yes, any quote currency supported by your config (USDT, USDC, BTC, BUSD).

**Q: How many listings can I schedule?**
A: No hard limit, but keep it reasonable (dozens, not hundreds).

**Q: Will this affect regular listing detection?**
A: No, both systems run independently. Regular detection continues every 10s.

## Support

For issues or questions:
- Check logs in `logs/combined.log`
- Review the troubleshooting section above
- Report issues at https://github.com/anthropics/claude-code/issues

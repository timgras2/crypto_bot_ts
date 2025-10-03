# Trading Bot Dashboard UI

React + Vite + Tailwind CSS dashboard for monitoring the MEXC trading bot.

## Features

- **Real-time Updates**: Auto-refreshes every 3 seconds
- **Active Trades**: Monitor current positions with P&L, trailing stops, and duration
- **Completed Trades**: View trade history with profit/loss and trigger reasons
- **Statistics**: Total P&L, win rate, average duration, best/worst trades
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Mode Support**: Automatic dark mode based on system preferences

## Development

```bash
# Install dependencies (from project root)
cd ui && npm install

# Start dev server (requires API server running on port 3001)
npm run dev
```

The UI will be available at `http://localhost:3000`

## Building for Production

```bash
# Build static files
npm run build

# Output will be in ui/dist/
```

## API Requirements

The UI expects the API server to be running on `http://localhost:3001` with the following endpoints:

- `GET /api/trades/active` - Active trades
- `GET /api/trades/completed` - Completed trades
- `GET /api/stats` - Trading statistics

Start the API server from the project root:

```bash
npm run server
```

## Running Everything Together

From the project root:

```bash
# Run bot + API + UI simultaneously
npm run dev:all
```

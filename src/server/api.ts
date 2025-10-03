import express from 'express';
import cors from 'cors';
import { loadJson } from '../utils/persistence.js';
import { SerializedTradeState, CompletedTrade } from '../types.js';
import { calculateStats } from './stats.js';
import { logger } from '../utils/logger.js';

const ACTIVE_TRADES_FILE = 'active_trades.json';
const COMPLETED_TRADES_FILE = 'completed_trades.json';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3001', 10);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true
})); // Allow Vite dev server on various ports
app.use(express.json());

/**
 * GET /api/trades/active
 * Returns all active trades
 */
app.get('/api/trades/active', async (req, res) => {
  try {
    const activeTrades = await loadJson<SerializedTradeState[]>(ACTIVE_TRADES_FILE, []);
    res.json({
      success: true,
      data: activeTrades,
      count: activeTrades.length,
    });
  } catch (error) {
    logger.error(`Error fetching active trades: ${String(error)}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active trades',
    });
  }
});

/**
 * GET /api/trades/completed
 * Returns all completed trades
 */
app.get('/api/trades/completed', async (req, res) => {
  try {
    const completedTrades = await loadJson<CompletedTrade[]>(COMPLETED_TRADES_FILE, []);

    // Sort by sellTime descending (most recent first)
    completedTrades.sort((a, b) => {
      return new Date(b.sellTime).getTime() - new Date(a.sellTime).getTime();
    });

    res.json({
      success: true,
      data: completedTrades,
      count: completedTrades.length,
    });
  } catch (error) {
    logger.error(`Error fetching completed trades: ${String(error)}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch completed trades',
    });
  }
});

/**
 * GET /api/stats
 * Returns trading statistics
 */
app.get('/api/stats', async (req, res) => {
  try {
    const completedTrades = await loadJson<CompletedTrade[]>(COMPLETED_TRADES_FILE, []);
    const activeTrades = await loadJson<SerializedTradeState[]>(ACTIVE_TRADES_FILE, []);

    const stats = calculateStats(completedTrades);

    res.json({
      success: true,
      data: {
        ...stats,
        activeTrades: activeTrades.length,
      },
    });
  } catch (error) {
    logger.error(`Error calculating stats: ${String(error)}`);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate statistics',
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API server is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start the server
 */
export function startApiServer(): void {
  app.listen(PORT, () => {
    logger.info(`API server running on http://localhost:${PORT}`);
  });
}

// If running directly (not imported)
// Note: This check works for both ES modules and direct execution
const isMainModule = import.meta.url.endsWith('api.ts') || import.meta.url.endsWith('api.js');
if (isMainModule) {
  startApiServer();
}

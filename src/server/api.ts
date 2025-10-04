import express from 'express';
import cors from 'cors';
import { loadJson } from '../utils/persistence.js';
import { SerializedTradeState, CompletedTrade } from '../types.js';
import { calculateStats } from './stats.js';
import { ListingScheduler } from '../scheduler/listing-scheduler.js';
import { logger } from '../utils/logger.js';

const ACTIVE_TRADES_FILE = 'active_trades.json';
const COMPLETED_TRADES_FILE = 'completed_trades.json';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3001', 10);

// Initialize scheduler for API endpoints
const scheduler = new ListingScheduler();
scheduler.initialize().catch(error => {
  logger.error(`Failed to initialize scheduler: ${String(error)}`);
});

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
app.get('/api/trades/active', async (_req, res) => {
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
app.get('/api/trades/completed', async (_req, res) => {
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
app.get('/api/stats', async (_req, res) => {
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
 * GET /api/schedule/listings
 * Returns all scheduled listings
 */
app.get('/api/schedule/listings', async (_req, res) => {
  try {
    const listings = scheduler.getScheduledListings();
    return res.json({
      success: true,
      data: listings,
      count: listings.length,
    });
  } catch (error) {
    logger.error(`Error fetching scheduled listings: ${String(error)}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled listings',
    });
  }
});

/**
 * GET /api/schedule/upcoming
 * Returns upcoming listings (next 24 hours)
 */
app.get('/api/schedule/upcoming', async (_req, res) => {
  try {
    const upcoming = scheduler.getUpcomingListings();
    return res.json({
      success: true,
      data: upcoming,
      count: upcoming.length,
    });
  } catch (error) {
    logger.error(`Error fetching upcoming listings: ${String(error)}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming listings',
    });
  }
});

/**
 * POST /api/schedule/listings
 * Add a new scheduled listing
 */
app.post('/api/schedule/listings', async (req, res) => {
  try {
    const { symbol, listingTime, quoteCurrency = 'USDT', notes } = req.body;

    // Validation
    if (!symbol || !listingTime) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and listingTime are required',
      });
    }

    // Validate datetime format
    const listingDate = new Date(listingTime);
    if (isNaN(listingDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid listingTime format. Use ISO datetime string.',
      });
    }

    // Check if time is in the future
    if (listingDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Listing time must be in the future',
      });
    }

    await scheduler.addScheduledListing(symbol, listingTime, quoteCurrency, notes);
    
    return res.json({
      success: true,
      message: `Scheduled listing added: ${symbol}`,
      data: {
        symbol,
        listingTime,
        quoteCurrency,
        notes,
      },
    });
  } catch (error) {
    logger.error(`Error adding scheduled listing: ${String(error)}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to add scheduled listing',
    });
  }
});

/**
 * DELETE /api/schedule/listings
 * Remove a scheduled listing
 */
app.delete('/api/schedule/listings', async (req, res) => {
  try {
    const { symbol, listingTime } = req.body;

    if (!symbol || !listingTime) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and listingTime are required',
      });
    }

    const removed = await scheduler.removeScheduledListing(symbol, listingTime);
    
    if (removed) {
      return res.json({
        success: true,
        message: `Scheduled listing removed: ${symbol}`,
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Scheduled listing not found',
      });
    }
  } catch (error) {
    logger.error(`Error removing scheduled listing: ${String(error)}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove scheduled listing',
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (_req, res) => {
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

import { logger } from '../utils/logger.js';
import { loadJson, saveJson } from '../utils/persistence.js';
import fs from 'fs/promises';
import path from 'path';

const SCHEDULED_LISTINGS_FILE = 'scheduled_listings.json';
const DATA_DIR = 'data';

/**
 * Represents a scheduled listing with precise timing
 */
export interface ScheduledListing {
  symbol: string;
  listingTime: string; // ISO timestamp
  quoteCurrency: string;
  notes?: string;
  status: 'pending' | 'active' | 'completed' | 'missed';
  createdAt: string;
  tradedAt?: string;
}

/**
 * Configuration for the listing scheduler
 */
export interface SchedulerConfig {
  maxWaitAfterListing: number; // Stop trying after X seconds past listing time
  retryInterval: number; // Retry interval in milliseconds if trade fails
}

/**
 * Callback function type for executing trades
 * Returns true if trade was successful, false if should retry
 */
export type TradeExecutor = (symbol: string, quoteCurrency: string) => Promise<boolean>;

/**
 * Manages scheduled listings and precise timing for trading at listing moments
 */
export class ListingScheduler {
  private scheduledListings: ScheduledListing[] = [];
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private lastLoggedCount = -1; // Track last logged count to prevent spam
  private tradeExecutor?: TradeExecutor; // Callback for executing trades
  private lastFileModTime: number = 0; // Track file modification time

  constructor(
    private readonly config: SchedulerConfig = {
      maxWaitAfterListing: 180, // Stop trying after 3 minutes (extended from 60s)
      retryInterval: 100, // Retry every 100ms
    }
  ) {}

  /**
   * Register a callback function to execute trades when listing time arrives
   */
  setTradeExecutor(executor: TradeExecutor): void {
    this.tradeExecutor = executor;
  }

  /**
   * Load scheduled listings from disk
   */
  async loadScheduledListings(): Promise<void> {
    this.scheduledListings = await loadJson<ScheduledListing[]>(SCHEDULED_LISTINGS_FILE, []);
    
    // Clean up old completed/missed listings (older than 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const originalCount = this.scheduledListings.length;
    
    this.scheduledListings = this.scheduledListings.filter(
      listing => listing.status === 'pending' || 
                listing.status === 'active' || 
                listing.createdAt > cutoff
    );
    
    if (this.scheduledListings.length < originalCount) {
      await this.saveScheduledListings();
      logger.info(`Cleaned up ${originalCount - this.scheduledListings.length} old listing entries`);
    }
  }

  /**
   * Save scheduled listings to disk
   */
  async saveScheduledListings(): Promise<void> {
    await saveJson(SCHEDULED_LISTINGS_FILE, this.scheduledListings);
  }

  /**
   * Add a new scheduled listing
   */
  async addScheduledListing(
    symbol: string,
    listingTimeISO: string,
    quoteCurrency: string,
    notes?: string
  ): Promise<void> {
    const listing: ScheduledListing = {
      symbol,
      listingTime: listingTimeISO,
      quoteCurrency,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...(notes && { notes }),
    };

    // Check if listing already exists
    const exists = this.scheduledListings.some(
      l => l.symbol === symbol && l.listingTime === listingTimeISO
    );

    if (exists) {
      logger.warn(`Listing for ${symbol} at ${listingTimeISO} already exists`);
      return;
    }

    this.scheduledListings.push(listing);
    await this.saveScheduledListings();
    
    logger.info(`Scheduled listing: ${symbol} at ${listingTimeISO}`);
    console.log(`📅 Scheduled: ${symbol} listing at ${new Date(listingTimeISO).toLocaleString()}`);
    
    // Set up timer for this listing
    this.setupListingTimer(listing);
  }

  /**
   * Remove a scheduled listing
   */
  async removeScheduledListing(symbol: string, listingTime: string): Promise<boolean> {
    const index = this.scheduledListings.findIndex(
      l => l.symbol === symbol && l.listingTime === listingTime
    );

    if (index === -1) {
      return false;
    }

    this.scheduledListings.splice(index, 1);
    
    // Clear any active timer
    const timerId = `${symbol}-${listingTime}`;
    const timer = this.activeTimers.get(timerId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(timerId);
    }

    await this.saveScheduledListings();
    logger.info(`Removed scheduled listing: ${symbol}`);
    return true;
  }

  /**
   * Get all scheduled listings
   */
  getScheduledListings(): ScheduledListing[] {
    return [...this.scheduledListings];
  }

  /**
   * Get upcoming listings (next 24 hours)
   */
  getUpcomingListings(): ScheduledListing[] {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return this.scheduledListings.filter(
      listing => listing.status === 'pending' && 
                new Date(listing.listingTime) > now &&
                new Date(listing.listingTime) <= tomorrow
    );
  }


  /**
   * Mark a listing as traded
   */
  async markListingTraded(symbol: string, listingTime: string): Promise<void> {
    const listing = this.scheduledListings.find(
      l => l.symbol === symbol && l.listingTime === listingTime
    );

    if (listing) {
      listing.status = 'completed';
      listing.tradedAt = new Date().toISOString();
      await this.saveScheduledListings();
      
      logger.info(`Marked ${symbol} as successfully traded`);
      console.log(`✅ Completed scheduled trade: ${symbol}`);
    }
  }

  /**
   * Mark a listing as missed (couldn't trade after listing time)
   */
  async markListingMissed(symbol: string, listingTime: string): Promise<void> {
    const listing = this.scheduledListings.find(
      l => l.symbol === symbol && l.listingTime === listingTime
    );

    if (listing) {
      listing.status = 'missed';
      await this.saveScheduledListings();
      
      logger.warn(`Marked ${symbol} as missed - could not complete trade`);
      console.log(`⚠️ Missed scheduled trade: ${symbol}`);
    }
  }

  /**
   * Setup timer for a specific listing
   */
  private setupListingTimer(listing: ScheduledListing): void {
    const now = new Date();
    const listingTime = new Date(listing.listingTime);
    const timerId = `${listing.symbol}-${listing.listingTime}`;

    // Check if timer already exists (don't recreate/relog)
    const existingTimer = this.activeTimers.get(timerId);
    if (existingTimer) {
      return; // Timer already set, skip
    }

    // If listing time has passed, check if we're still in the wait window
    if (listingTime <= now) {
      const maxWaitTime = new Date(listingTime.getTime() + this.config.maxWaitAfterListing * 1000);
      if (now <= maxWaitTime) {
        // Still within wait window - execute immediately
        logger.info(`${listing.symbol} listing time passed but within wait window (${Math.floor((now.getTime() - listingTime.getTime()) / 1000)}s late) - executing now`);
        void this.executeScheduledTrade(listing);
      } else {
        // Outside grace period - mark as missed immediately to prevent spam
        const secondsLate = Math.floor((now.getTime() - listingTime.getTime()) / 1000);
        logger.warn(`Listing time for ${listing.symbol} has passed outside grace period (${secondsLate}s late, max ${this.config.maxWaitAfterListing}s) - marking as missed`);
        void this.markListingMissed(listing.symbol, listing.listingTime);
      }
      return;
    }

    // Calculate time until listing
    const timeUntilListing = listingTime.getTime() - now.getTime();
    const hoursUntil = Math.floor(timeUntilListing / 3600000);
    const minutesUntil = Math.floor((timeUntilListing % 3600000) / 60000);

    // Set timer to execute trade at exact listing time
    const timer = setTimeout(() => {
      logger.info(`⏰ Timer FIRED for ${listing.symbol} - executing scheduled trade now`);
      console.log(`⏰ ${listing.symbol} listing time reached - executing trade!`);
      this.activeTimers.delete(timerId);
      void this.executeScheduledTrade(listing);
    }, timeUntilListing);

    this.activeTimers.set(timerId, timer);

    const listingTimeStr = listingTime.toLocaleString();
    const timeUntilStr = hoursUntil > 0
      ? `${hoursUntil}h ${minutesUntil}m`
      : `${minutesUntil}m`;

    logger.info(`✅ Timer SET for ${listing.symbol} - will execute at ${listingTimeStr} (in ${timeUntilStr})`);
    console.log(`⏰ Timer set for ${listing.symbol} at ${listingTimeStr} (in ${timeUntilStr})`);
  }

  /**
   * Execute a scheduled trade with retry logic
   */
  private async executeScheduledTrade(listing: ScheduledListing): Promise<void> {
    if (!this.tradeExecutor) {
      logger.error(`Cannot execute trade for ${listing.symbol} - no trade executor registered`);
      await this.markListingMissed(listing.symbol, listing.listingTime);
      return;
    }

    listing.status = 'active';
    const startTime = Date.now();
    const maxDuration = this.config.maxWaitAfterListing * 1000;
    let attempts = 0;

    logger.info(`🎯 Starting scheduled trade execution for ${listing.symbol}${listing.quoteCurrency} (max wait: ${this.config.maxWaitAfterListing}s)`);
    console.log(`🎯 Executing scheduled trade: ${listing.symbol}${listing.quoteCurrency}`);

    while (Date.now() - startTime < maxDuration) {
      attempts++;

      try {
        const success = await this.tradeExecutor(listing.symbol, listing.quoteCurrency);

        if (success) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          await this.markListingTraded(listing.symbol, listing.listingTime);
          logger.info(`✅ Successfully executed scheduled trade for ${listing.symbol} after ${attempts} attempts in ${duration}s`);
          return;
        }

        // Trade failed, retry after interval
        if (attempts === 1) {
          logger.info(`Market not yet available, retrying every ${this.config.retryInterval}ms...`);
          console.log(`⏳ Trade attempt failed, retrying every ${this.config.retryInterval}ms...`);
        }

        await this.sleep(this.config.retryInterval);
      } catch (error) {
        logger.error(`Error executing trade for ${listing.symbol} (attempt ${attempts}): ${String(error)}`);
        await this.sleep(this.config.retryInterval);
      }
    }

    // Exceeded max wait time
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    await this.markListingMissed(listing.symbol, listing.listingTime);
    logger.warn(`❌ Failed to execute ${listing.symbol} after ${attempts} attempts over ${duration}s (max: ${this.config.maxWaitAfterListing}s)`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize scheduler and set up all pending timers
   */
  async initialize(): Promise<void> {
    await this.loadScheduledListings();

    // Set up timers ONLY for pending listings (skip completed/missed/active)
    const pendingListings = this.scheduledListings.filter(l => l.status === 'pending');
    for (const listing of pendingListings) {
      this.setupListingTimer(listing);
    }

    // Only log if count changed (prevents spam during reload cycles)
    if (this.lastLoggedCount !== pendingListings.length) {
      logger.info(`Initialized scheduler with ${pendingListings.length} pending listings`);

      if (pendingListings.length > 0) {
        console.log(`📅 Loaded ${pendingListings.length} scheduled listings:`);
        for (const listing of pendingListings) {
          const timeStr = new Date(listing.listingTime).toLocaleString();
          console.log(`   • ${listing.symbol} at ${timeStr}`);
        }
      }

      this.lastLoggedCount = pendingListings.length;
    }
  }

  /**
   * Cleanup all active timers
   */
  cleanup(): void {
    const timerCount = this.activeTimers.size;
    if (timerCount > 0) {
      logger.info(`Cleaning up ${timerCount} active timers`);
    }

    for (const [timerId, timer] of this.activeTimers) {
      clearTimeout(timer);
      logger.debug(`Cleared timer: ${timerId}`);
    }
    this.activeTimers.clear();
  }

  /**
   * Get next scheduled listing
   */
  getNextListing(): ScheduledListing | null {
    const pendingListings = this.scheduledListings
      .filter(l => l.status === 'pending')
      .sort((a, b) => new Date(a.listingTime).getTime() - new Date(b.listingTime).getTime());

    return pendingListings[0] || null;
  }

  /**
   * Check if scheduled listings file has changed since last check
   * Returns true if file was modified, false otherwise
   */
  async checkForChanges(): Promise<boolean> {
    try {
      const filePath = path.join(DATA_DIR, SCHEDULED_LISTINGS_FILE);
      const stats = await fs.stat(filePath);
      const currentModTime = stats.mtimeMs;

      if (this.lastFileModTime === 0) {
        // First check, just store the time
        this.lastFileModTime = currentModTime;
        return false;
      }

      if (currentModTime > this.lastFileModTime) {
        this.lastFileModTime = currentModTime;
        return true;
      }

      return false;
    } catch (error) {
      // File doesn't exist or error reading it, treat as no change
      logger.debug(`Error checking scheduled listings file: ${String(error)}`);
      return false;
    }
  }
}
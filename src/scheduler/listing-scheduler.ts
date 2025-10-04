import { logger } from '../utils/logger.js';
import { loadJson, saveJson } from '../utils/persistence.js';

const SCHEDULED_LISTINGS_FILE = 'scheduled_listings.json';

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
  preActivationBuffer: number; // Start ultra-fast polling X seconds before listing
  ultraFastInterval: number; // Polling interval in milliseconds during active window
  maxWaitAfterListing: number; // Stop trying after X seconds past listing time
}

/**
 * Manages scheduled listings and precise timing for trading at listing moments
 */
export class ListingScheduler {
  private scheduledListings: ScheduledListing[] = [];
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private lastLoggedCount = -1; // Track last logged count to prevent spam

  constructor(
    private readonly config: SchedulerConfig = {
      preActivationBuffer: 30, // Start fast polling 30s before
      ultraFastInterval: 100, // Poll every 100ms when active
      maxWaitAfterListing: 60, // Stop trying after 60s
    }
  ) {}

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
   * Check if we should enter ultra-fast polling mode
   */
  shouldUseUltraFastPolling(): boolean {
    const now = new Date();
    const buffer = this.config.preActivationBuffer * 1000;
    
    return this.scheduledListings.some(listing => {
      if (listing.status !== 'pending') return false;
      
      const listingTime = new Date(listing.listingTime);
      const activationTime = new Date(listingTime.getTime() - buffer);
      const endTime = new Date(listingTime.getTime() + this.config.maxWaitAfterListing * 1000);
      
      return now >= activationTime && now <= endTime;
    });
  }

  /**
   * Get the ultra-fast polling interval (in ms)
   */
  getUltraFastInterval(): number {
    return this.config.ultraFastInterval;
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

    // Skip if listing time has passed
    if (listingTime <= now) {
      logger.warn(`Listing time for ${listing.symbol} has already passed`);
      return;
    }

    // Calculate time until activation (start ultra-fast polling)
    const activationTime = new Date(listingTime.getTime() - this.config.preActivationBuffer * 1000);
    const timeUntilActivation = activationTime.getTime() - now.getTime();

    if (timeUntilActivation <= 0) {
      // Already in activation window
      listing.status = 'active';
      console.log(`🔥 ${listing.symbol} is now in ultra-fast polling window!`);
    } else {
      // Set timer for activation
      const timer = setTimeout(() => {
        listing.status = 'active';
        console.log(`🔥 ${listing.symbol} entering ultra-fast polling mode! Listing in ${this.config.preActivationBuffer}s`);
        this.activeTimers.delete(timerId);

        // Set timeout to mark as missed if not completed
        const missedTimer = setTimeout(async () => {
          if (listing.status === 'active') {
            await this.markListingMissed(listing.symbol, listing.listingTime);
          }
        }, (this.config.preActivationBuffer + this.config.maxWaitAfterListing) * 1000);

        this.activeTimers.set(timerId + '-missed', missedTimer);
      }, timeUntilActivation);

      this.activeTimers.set(timerId, timer);

      const activationTimeStr = activationTime.toLocaleString();
      logger.info(`Set timer for ${listing.symbol} - ultra-fast polling starts at ${activationTimeStr}`);
    }
  }

  /**
   * Initialize scheduler and set up all pending timers
   */
  async initialize(): Promise<void> {
    await this.loadScheduledListings();

    // Set up timers for all pending listings
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
}
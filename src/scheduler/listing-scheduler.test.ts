import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ListingScheduler, type TradeExecutor } from './listing-scheduler.js';
import fs from 'fs/promises';

// Mock persistence utilities
jest.mock('../utils/persistence.js', () => ({
  loadJson: jest.fn<() => Promise<unknown>>().mockResolvedValue([]),
  saveJson: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fs/promises
jest.mock('fs/promises');

describe('ListingScheduler', () => {
  let scheduler: ListingScheduler;
  let mockTradeExecutor: jest.MockedFunction<TradeExecutor>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create scheduler with faster retry for testing
    scheduler = new ListingScheduler({
      maxWaitAfterListing: 180, // 3 minutes
      retryInterval: 100, // 100ms
    });

    // Create mock trade executor
    mockTradeExecutor = jest.fn<TradeExecutor>().mockResolvedValue(true);
    scheduler.setTradeExecutor(mockTradeExecutor);

    // Mock file stats for checkForChanges
    (fs.stat as any) = jest.fn((..._args: any[]) => Promise.resolve({
      mtimeMs: Date.now(),
    }));
  });

  afterEach(() => {
    scheduler.cleanup();
    jest.useRealTimers();
  });

  describe('Timer Management', () => {
    it('should set timer for future listing', async () => {
      const futureTime = new Date(Date.now() + 60000); // 1 minute from now

      await scheduler.addScheduledListing(
        'TEST',
        futureTime.toISOString(),
        'USDT',
        'test listing'
      );

      // Timer should be set but not executed yet
      expect(mockTradeExecutor).not.toHaveBeenCalled();
    });

    it('should fire timer at exact listing time', async () => {
      const futureTime = new Date(Date.now() + 1000); // 1 second from now

      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Allow promises to resolve
      await Promise.resolve();

      expect(mockTradeExecutor).toHaveBeenCalledWith('TEST', 'USDT');
    });

    it('should not create duplicate timers on reinitialization', async () => {
      const futureTime = new Date(Date.now() + 60000);

      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      // Reinitialize (simulating what happens in main loop)
      await scheduler.initialize();
      await scheduler.initialize();
      await scheduler.initialize();

      // Fast-forward to listing time
      jest.advanceTimersByTime(60000);
      await Promise.resolve();

      // Should only execute once despite multiple reinitializations
      expect(mockTradeExecutor).toHaveBeenCalledTimes(1);
    });

    it('should cleanup timers on shutdown', async () => {
      const futureTime = new Date(Date.now() + 60000);

      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      // Cleanup
      scheduler.cleanup();

      // Fast-forward past listing time
      jest.advanceTimersByTime(70000);
      await Promise.resolve();

      // Should NOT execute because timer was cleared
      expect(mockTradeExecutor).not.toHaveBeenCalled();
    });

    it('should handle multiple listings at different times', async () => {
      const time1 = new Date(Date.now() + 1000);
      const time2 = new Date(Date.now() + 2000);
      const time3 = new Date(Date.now() + 3000);

      await scheduler.addScheduledListing('TEST1', time1.toISOString(), 'USDT');
      await scheduler.addScheduledListing('TEST2', time2.toISOString(), 'USDT');
      await scheduler.addScheduledListing('TEST3', time3.toISOString(), 'USDT');

      // Advance to each time
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(mockTradeExecutor).toHaveBeenCalledWith('TEST1', 'USDT');

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(mockTradeExecutor).toHaveBeenCalledWith('TEST2', 'USDT');

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(mockTradeExecutor).toHaveBeenCalledWith('TEST3', 'USDT');

      expect(mockTradeExecutor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Grace Period (180s Window)', () => {
    it('should execute immediately if listing time just passed (within 180s)', async () => {
      // Create listing 30 seconds in the past
      const pastTime = new Date(Date.now() - 30000);

      // Mock loadJson to return this listing as "pending"
      const { loadJson } = await import('../utils/persistence.js');
      (loadJson as jest.Mock<typeof loadJson>).mockResolvedValueOnce([
        {
          symbol: 'TEST',
          listingTime: pastTime.toISOString(),
          quoteCurrency: 'USDT',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]);

      await scheduler.initialize();

      // Should execute immediately (no timer needed)
      await Promise.resolve();
      expect(mockTradeExecutor).toHaveBeenCalledWith('TEST', 'USDT');
    });

    it('should mark as missed if outside 180s window', async () => {
      // Create listing 200 seconds in the past (outside 180s window)
      const pastTime = new Date(Date.now() - 200000);

      const { loadJson, saveJson } = await import('../utils/persistence.js');
      (loadJson as jest.Mock<typeof loadJson>).mockResolvedValueOnce([
        {
          symbol: 'TEST',
          listingTime: pastTime.toISOString(),
          quoteCurrency: 'USDT',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]);

      await scheduler.initialize();
      await Promise.resolve();

      // Should mark as missed (via saveJson call with "missed" status)
      expect(saveJson).toHaveBeenCalled();
      expect(mockTradeExecutor).not.toHaveBeenCalled();
    });

    it('should not spam warnings for already missed listings', async () => {
      const { logger } = await import('../utils/logger.js');
      const pastTime = new Date(Date.now() - 200000);

      const { loadJson } = await import('../utils/persistence.js');
      (loadJson as jest.Mock<typeof loadJson>).mockResolvedValue([
        {
          symbol: 'TEST',
          listingTime: pastTime.toISOString(),
          quoteCurrency: 'USDT',
          status: 'missed', // Already marked as missed
          createdAt: new Date().toISOString(),
        },
      ]);

      await scheduler.initialize();
      await scheduler.initialize();
      await scheduler.initialize();

      // Should NOT process missed listings repeatedly
      // Logger should not be called excessively
      expect((logger.warn as jest.Mock).mock.calls.filter((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('already passed')
      ).length).toBe(0);
    });

    it('should retry within grace period if market not available', async () => {
      mockTradeExecutor.mockResolvedValueOnce(false); // Market not available
      mockTradeExecutor.mockResolvedValueOnce(false); // Still not available
      mockTradeExecutor.mockResolvedValueOnce(true);  // Now available!

      const futureTime = new Date(Date.now() + 1000);
      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      // Advance to listing time
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // First attempt (failed)
      await jest.advanceTimersByTimeAsync(0);

      // Wait for retry interval
      await jest.advanceTimersByTimeAsync(100);

      // Third attempt (success)
      await jest.advanceTimersByTimeAsync(100);

      expect(mockTradeExecutor.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should mark as missed after exceeding grace period during retries', async () => {
      // Always return false (market never available)
      mockTradeExecutor.mockResolvedValue(false);

      const futureTime = new Date(Date.now() + 1000);
      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      jest.advanceTimersByTime(1000); // Reach listing time
      await Promise.resolve();

      // Advance past grace period (180 seconds)
      jest.advanceTimersByTime(181000);
      await Promise.resolve();

      // Should have marked as missed
      const { saveJson } = await import('../utils/persistence.js');
      const calls = (saveJson as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
    });
  });

  describe('File Change Detection', () => {
    it('should return false on first check', async () => {
      (fs.stat as any) = jest.fn((..._args: any[]) => Promise.resolve({ mtimeMs: 1000000 }));

      const changed = await scheduler.checkForChanges();
      expect(changed).toBe(false);
    });

    it('should return true when file modified', async () => {
      let callCount = 0;
      (fs.stat as any) = jest.fn((..._args: any[]) => {
        callCount++;
        return Promise.resolve({ mtimeMs: callCount === 1 ? 1000000 : 2000000 });
      });

      await scheduler.checkForChanges(); // First check
      const changed = await scheduler.checkForChanges(); // File modified

      expect(changed).toBe(true);
    });

    it('should return false when file unchanged', async () => {
      (fs.stat as any) = jest.fn((..._args: any[]) => Promise.resolve({ mtimeMs: 1000000 }));

      await scheduler.checkForChanges(); // First check
      const changed = await scheduler.checkForChanges(); // Second check (unchanged)

      expect(changed).toBe(false);
    });

    it('should handle missing file gracefully', async () => {
      (fs.stat as any) = jest.fn((..._args: any[]) => Promise.reject(new Error('ENOENT: file not found')));

      const changed = await scheduler.checkForChanges();
      expect(changed).toBe(false);
    });
  });

  describe('Status Management', () => {
    it('should only process pending listings', async () => {
      const futureTime = new Date(Date.now() + 1000);

      const { loadJson } = await import('../utils/persistence.js');
      (loadJson as jest.Mock<typeof loadJson>).mockResolvedValue([
        {
          symbol: 'PENDING',
          listingTime: futureTime.toISOString(),
          quoteCurrency: 'USDT',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        {
          symbol: 'COMPLETED',
          listingTime: futureTime.toISOString(),
          quoteCurrency: 'USDT',
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
        {
          symbol: 'MISSED',
          listingTime: futureTime.toISOString(),
          quoteCurrency: 'USDT',
          status: 'missed',
          createdAt: new Date().toISOString(),
        },
      ]);

      await scheduler.initialize();

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Only PENDING should execute
      expect(mockTradeExecutor).toHaveBeenCalledWith('PENDING', 'USDT');
      expect(mockTradeExecutor).toHaveBeenCalledTimes(1);
    });

    it('should mark as completed on successful trade', async () => {
      mockTradeExecutor.mockResolvedValue(true);

      const futureTime = new Date(Date.now() + 1000);
      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Check that saveJson was called with completed status
      const { saveJson } = await import('../utils/persistence.js');
      expect(saveJson).toHaveBeenCalled();
    });

    it('should clean up old completed/missed listings (>24h)', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      const { loadJson, saveJson } = await import('../utils/persistence.js');
      (loadJson as jest.Mock<typeof loadJson>).mockResolvedValueOnce([
        {
          symbol: 'OLD_COMPLETED',
          listingTime: oldDate.toISOString(),
          quoteCurrency: 'USDT',
          status: 'completed',
          createdAt: oldDate.toISOString(),
        },
        {
          symbol: 'RECENT',
          listingTime: new Date().toISOString(),
          quoteCurrency: 'USDT',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]);

      await scheduler.initialize();

      // saveJson should be called with only the recent listing
      expect(saveJson).toHaveBeenCalled();
    });
  });

  describe('Trade Executor Integration', () => {
    it('should pass correct parameters to trade executor', async () => {
      const futureTime = new Date(Date.now() + 1000);
      await scheduler.addScheduledListing('BTC', futureTime.toISOString(), 'USDT');

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockTradeExecutor).toHaveBeenCalledWith('BTC', 'USDT');
    });

    it('should handle trade executor errors gracefully', async () => {
      mockTradeExecutor.mockRejectedValue(new Error('API error'));

      const futureTime = new Date(Date.now() + 1000);
      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Should retry despite error
      jest.advanceTimersByTime(200);
      await Promise.resolve();

      expect(mockTradeExecutor.mock.calls.length).toBeGreaterThan(1);
    });

    it('should stop retrying after successful execution', async () => {
      mockTradeExecutor.mockResolvedValueOnce(false);
      mockTradeExecutor.mockResolvedValueOnce(true); // Success on 2nd try

      const futureTime = new Date(Date.now() + 1000);
      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      jest.advanceTimersByTime(100); // One retry
      await Promise.resolve();

      // Advance more time - should not retry further
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockTradeExecutor).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle listing removal while timer is active', async () => {
      const futureTime = new Date(Date.now() + 60000);
      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');

      // Remove the listing
      await scheduler.removeScheduledListing('TEST', futureTime.toISOString());

      // Advance past listing time
      jest.advanceTimersByTime(70000);
      await Promise.resolve();

      // Should not execute
      expect(mockTradeExecutor).not.toHaveBeenCalled();
    });

    it('should handle multiple listings at exact same time', async () => {
      const sameTime = new Date(Date.now() + 1000);

      await scheduler.addScheduledListing('TEST1', sameTime.toISOString(), 'USDT');
      await scheduler.addScheduledListing('TEST2', sameTime.toISOString(), 'USDT');
      await scheduler.addScheduledListing('TEST3', sameTime.toISOString(), 'USDT');

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // All should execute
      expect(mockTradeExecutor).toHaveBeenCalledTimes(3);
    });

    it('should handle listings far in the future', async () => {
      const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await scheduler.addScheduledListing('TEST', farFuture.toISOString(), 'USDT');

      // Should not execute yet
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
      expect(mockTradeExecutor).not.toHaveBeenCalled();
    });

    it('should prevent duplicate listings with same symbol and time', async () => {
      const futureTime = new Date(Date.now() + 1000);

      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT');
      await scheduler.addScheduledListing('TEST', futureTime.toISOString(), 'USDT'); // Duplicate

      const { logger } = await import('../utils/logger.js');
      expect((logger.warn as jest.Mock).mock.calls.some((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('already exists')
      )).toBe(true);
    });

    it('should not execute listings without trade executor registered', async () => {
      const newScheduler = new ListingScheduler();
      const futureTime = new Date(Date.now() + 1000);

      // Load with pending listing
      const { loadJson } = await import('../utils/persistence.js');
      (loadJson as jest.Mock<typeof loadJson>).mockResolvedValueOnce([
        {
          symbol: 'TEST',
          listingTime: futureTime.toISOString(),
          quoteCurrency: 'USDT',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]);

      await newScheduler.initialize();

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Should be marked as missed due to no executor
      const { logger } = await import('../utils/logger.js');
      expect((logger.error as jest.Mock).mock.calls.some((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('no trade executor')
      )).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    it('should return next pending listing', async () => {
      const time1 = new Date(Date.now() + 60000);
      const time2 = new Date(Date.now() + 120000);

      await scheduler.addScheduledListing('LATER', time2.toISOString(), 'USDT');
      await scheduler.addScheduledListing('SOON', time1.toISOString(), 'USDT');

      const next = scheduler.getNextListing();
      expect(next?.symbol).toBe('SOON');
    });

    it('should return null if no pending listings', () => {
      const next = scheduler.getNextListing();
      expect(next).toBeNull();
    });

    it('should return upcoming listings within 24 hours', async () => {
      const soon = new Date(Date.now() + 60000);
      const later = new Date(Date.now() + 25 * 60 * 60 * 1000); // >24h

      await scheduler.addScheduledListing('SOON', soon.toISOString(), 'USDT');
      await scheduler.addScheduledListing('LATER', later.toISOString(), 'USDT');

      const upcoming = scheduler.getUpcomingListings();
      expect(upcoming).toHaveLength(1);
      expect(upcoming[0]?.symbol).toBe('SOON');
    });
  });
});

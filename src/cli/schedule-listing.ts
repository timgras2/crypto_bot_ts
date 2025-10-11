#!/usr/bin/env node

import { ListingScheduler } from '../scheduler/listing-scheduler.js';

/**
 * CLI tool for managing scheduled listings
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  const scheduler = new ListingScheduler();
  await scheduler.initialize();

  try {
    switch (command) {
      case 'add':
        await handleAdd(scheduler, args.slice(1));
        break;
      case 'list':
        await handleList(scheduler);
        break;
      case 'remove':
        await handleRemove(scheduler, args.slice(1));
        break;
      case 'upcoming':
        await handleUpcoming(scheduler);
        break;
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${String(error)}`);
    process.exit(1);
  }
}

async function handleAdd(scheduler: ListingScheduler, args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error('❌ Usage: npm run schedule add <SYMBOL> <ISO_DATETIME> [QUOTE_CURRENCY] [NOTES]');
    console.error('Example: npm run schedule add NEWTOKEN "2024-01-15T14:00:00.000Z" USDT "High volume expected"');
    process.exit(1);
  }

  const [symbol, datetime, quoteCurrencyArg, ...notesParts] = args;
  const quoteCurrency = quoteCurrencyArg ?? 'USDT';
  const notes = notesParts.join(' ');

  if (!datetime) {
    console.error('❌ Datetime is required');
    process.exit(1);
  }

  // Validate datetime format
  const listingTime = new Date(datetime);
  if (isNaN(listingTime.getTime())) {
    console.error('❌ Invalid datetime format. Use ISO format: YYYY-MM-DDTHH:mm:ss.sssZ');
    console.error('Example: "2024-01-15T14:00:00.000Z"');
    process.exit(1);
  }

  // Check if time is in the future
  if (listingTime <= new Date()) {
    console.error('❌ Listing time must be in the future');
    process.exit(1);
  }

  const trimmedNotes = notes.trim();
  await scheduler.addScheduledListing(symbol as string, datetime as string, quoteCurrency as string, trimmedNotes.length > 0 ? trimmedNotes : undefined);
  console.log(`✅ Added scheduled listing: ${symbol} at ${listingTime.toLocaleString()}`);
}

async function handleList(scheduler: ListingScheduler): Promise<void> {
  const listings = scheduler.getScheduledListings();
  
  if (listings.length === 0) {
    console.log('📭 No scheduled listings found');
    return;
  }

  console.log(`📅 All Scheduled Listings (${listings.length}):`);
  console.log('');
  
  for (const listing of listings) {
    const time = new Date(listing.listingTime).toLocaleString();
    const status = getStatusEmoji(listing.status);
    
    console.log(`${status} ${listing.symbol} (${listing.quoteCurrency})`);
    console.log(`   📅 Time: ${time}`);
    console.log(`   📊 Status: ${listing.status}`);
    if (listing.notes) {
      console.log(`   📝 Notes: ${listing.notes}`);
    }
    if (listing.tradedAt) {
      console.log(`   ✅ Traded: ${new Date(listing.tradedAt).toLocaleString()}`);
    }
    console.log('');
  }
}

async function handleRemove(scheduler: ListingScheduler, args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error('❌ Usage: npm run schedule remove <SYMBOL> <ISO_DATETIME>');
    process.exit(1);
  }

  const [symbol, datetime] = args;
  
  if (!symbol || !datetime) {
    console.error('❌ Both symbol and datetime are required');
    process.exit(1);
  }
  
  const success = await scheduler.removeScheduledListing(symbol, datetime);
  if (success) {
    console.log(`✅ Removed scheduled listing: ${symbol}`);
  } else {
    console.log(`❌ Listing not found: ${symbol} at ${datetime}`);
  }
}

async function handleUpcoming(scheduler: ListingScheduler): Promise<void> {
  const upcoming = scheduler.getUpcomingListings();
  
  if (upcoming.length === 0) {
    console.log('📭 No upcoming listings in the next 24 hours');
    return;
  }

  console.log(`⏰ Upcoming Listings (${upcoming.length}):`);
  console.log('');
  
  for (const listing of upcoming) {
    const time = new Date(listing.listingTime);
    const now = new Date();
    const hoursUntil = Math.round((time.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    console.log(`🎯 ${listing.symbol} (${listing.quoteCurrency})`);
    console.log(`   📅 Time: ${time.toLocaleString()}`);
    console.log(`   ⏳ In: ${hoursUntil} hours`);
    if (listing.notes) {
      console.log(`   📝 Notes: ${listing.notes}`);
    }
    console.log('');
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'active': return '🔥';
    case 'completed': return '✅';
    case 'missed': return '❌';
    default: return '❓';
  }
}

function showHelp(): void {
  console.log('🤖 MEXC Bot Listing Scheduler');
  console.log('');
  console.log('Usage: npm run schedule <command> [args...]');
  console.log('');
  console.log('Commands:');
  console.log('  add <SYMBOL> <ISO_DATETIME> [QUOTE] [NOTES]  Add scheduled listing');
  console.log('  list                                          Show all scheduled listings');
  console.log('  remove <SYMBOL> <ISO_DATETIME>               Remove scheduled listing');
  console.log('  upcoming                                      Show upcoming listings (24h)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run schedule add NEWTOKEN "2024-01-15T14:00:00.000Z" USDT "High volume"');
  console.log('  npm run schedule list');
  console.log('  npm run schedule upcoming');
  console.log('  npm run schedule remove NEWTOKEN "2024-01-15T14:00:00.000Z"');
  console.log('');
  console.log('💡 Tips:');
  console.log('  • Use ISO datetime format: YYYY-MM-DDTHH:mm:ss.sssZ');
  console.log('  • Get listing times from mexc.com/newlisting');
  console.log('  • Bot switches to ultra-fast polling 30s before listing');
  console.log('  • Ultra-fast mode polls every 100ms for precision timing');
}

// Run the CLI
void main();
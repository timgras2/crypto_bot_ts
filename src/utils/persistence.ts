import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');

/**
 * Write queue to prevent concurrent writes to the same file
 */
const writeQueues = new Map<string, Promise<void>>();

/**
 * Ensure data directory exists
 */
export async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Load JSON data from file
 */
export async function loadJson<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info(`File ${filename} not found, creating with default value`);
      await saveJson(filename, defaultValue);
      return defaultValue;
    }
    logger.error(`Error loading ${filename}: ${String(error)}`);
    return defaultValue;
  }
}

/**
 * Save JSON data to file atomically
 * Writes to a temporary file first, then renames to prevent corruption
 * Uses a write queue to prevent concurrent writes to the same file
 */
export async function saveJson<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();

  // Queue this write operation to prevent concurrent access
  const previousWrite = writeQueues.get(filename) || Promise.resolve();

  const writeOperation = previousWrite
    .catch(() => {
      // Ignore errors from previous writes
    })
    .then(async () => {
      const filePath = path.join(DATA_DIR, filename);
      const tempPath = `${filePath}.tmp`;

      try {
        // Write to temporary file first
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');

        // On Windows, fs.rename() doesn't overwrite existing files
        // So we delete the destination first if it exists
        try {
          await fs.unlink(filePath);
        } catch (unlinkError) {
          // Ignore ENOENT - file doesn't exist yet
          if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw unlinkError;
          }
        }

        // Atomic rename
        await fs.rename(tempPath, filePath);
        logger.debug(`Saved data to ${filename}`);
      } catch (error) {
        logger.error(`Error saving ${filename}: ${String(error)}`);
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    });

  writeQueues.set(filename, writeOperation);

  // Clean up the queue entry after write completes
  await writeOperation.finally(() => {
    if (writeQueues.get(filename) === writeOperation) {
      writeQueues.delete(filename);
    }
  });
}

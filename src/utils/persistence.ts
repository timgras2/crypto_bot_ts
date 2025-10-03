import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');

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
      logger.info(`File ${filename} not found, using default value`);
      return defaultValue;
    }
    logger.error(`Error loading ${filename}: ${String(error)}`);
    return defaultValue;
  }
}

/**
 * Save JSON data to file
 */
export async function saveJson<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);

  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug(`Saved data to ${filename}`);
  } catch (error) {
    logger.error(`Error saving ${filename}: ${String(error)}`);
    throw error;
  }
}

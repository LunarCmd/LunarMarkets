/**
 * Entry Price Cache
 *
 * Stores entry prices locally to accurately calculate PnL.
 * The on-chain entryPrice can change when positions are modified,
 * so we cache the original entry price when positions are opened.
 */

interface CachedEntryPrice {
  entryPriceE6: number;
  positionSize: string;
  timestamp: number;
  side: 'long' | 'short';
}

const CACHE_KEY_PREFIX = 'entry-price-';

/**
 * Generate cache key for a position
 */
function getCacheKey(marketId: string, accountId: string): string {
  return `${CACHE_KEY_PREFIX}${marketId}-${accountId}`;
}

/**
 * Save entry price to localStorage
 */
export function saveEntryPrice(
  marketId: string,
  accountId: string,
  entryPriceE6: number,
  positionSize: string,
  side: 'long' | 'short'
): void {
  try {
    const data: CachedEntryPrice = {
      entryPriceE6,
      positionSize,
      timestamp: Date.now(),
      side,
    };

    const key = getCacheKey(marketId, accountId);
    localStorage.setItem(key, JSON.stringify(data));

    console.log(`💾 Cached entry price for account ${accountId}:`, data);
  } catch (error) {
    console.error('Failed to save entry price:', error);
  }
}

/**
 * Get cached entry price from localStorage
 */
export function getCachedEntryPrice(
  marketId: string,
  accountId: string
): number | null {
  try {
    const key = getCacheKey(marketId, accountId);
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const data: CachedEntryPrice = JSON.parse(cached);

    // Return cached entry price
    return data.entryPriceE6;
  } catch (error) {
    console.error('Failed to read cached entry price:', error);
    return null;
  }
}

/**
 * Clear entry price when position is closed
 */
export function clearEntryPrice(marketId: string, accountId: string): void {
  try {
    const key = getCacheKey(marketId, accountId);
    localStorage.removeItem(key);
    console.log(`🗑️ Cleared cached entry price for account ${accountId}`);
  } catch (error) {
    console.error('Failed to clear entry price:', error);
  }
}

/**
 * Get all cached entry prices for a market
 */
export function getAllCachedEntryPrices(marketId: string): Record<string, CachedEntryPrice> {
  const result: Record<string, CachedEntryPrice> = {};

  try {
    const prefix = `${CACHE_KEY_PREFIX}${marketId}-`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const accountId = key.replace(prefix, '');
          result[accountId] = JSON.parse(cached);
        }
      }
    }
  } catch (error) {
    console.error('Failed to get cached entry prices:', error);
  }

  return result;
}

/**
 * Clear old cached prices (older than 30 days)
 */
export function cleanupOldCache(): void {
  try {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const data: CachedEntryPrice = JSON.parse(cached);
          if (data.timestamp < thirtyDaysAgo) {
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old cache:', error);
  }
}

/**
 * Position Markers Storage
 *
 * Stores position markers for display on TradingView charts.
 * Data is keyed by wallet address and market ID to show only user's own positions.
 */

export interface PositionMarker {
  marketId: string;
  accountId: string;
  walletAddress: string;
  entryPrice: number;
  entryTime: number; // Unix timestamp in seconds
  side: 'long' | 'short';
  positionSize: string;
  collateralAmount: string;
}

const MARKER_KEY_PREFIX = 'position-marker-';

/**
 * Generate storage key for a position marker
 */
function getMarkerKey(marketId: string, accountId: string, walletAddress: string): string {
  return `${MARKER_KEY_PREFIX}${marketId}-${accountId}-${walletAddress}`;
}

/**
 * Save position marker when a position is opened
 */
export function savePositionMarker(marker: PositionMarker): void {
  try {
    const key = getMarkerKey(marker.marketId, marker.accountId, marker.walletAddress);
    localStorage.setItem(key, JSON.stringify(marker));
    console.log(`📍 Saved position marker for account ${marker.accountId}:`, marker);
  } catch (error) {
    console.error('Failed to save position marker:', error);
  }
}

/**
 * Get all position markers for a specific market and wallet
 */
export function getPositionMarkers(marketId: string, walletAddress: string): PositionMarker[] {
  const markers: PositionMarker[] = [];

  try {
    const prefix = `${MARKER_KEY_PREFIX}${marketId}-`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && key.endsWith(`-${walletAddress}`)) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const marker: PositionMarker = JSON.parse(cached);
          markers.push(marker);
        }
      }
    }
  } catch (error) {
    console.error('Failed to get position markers:', error);
  }

  return markers;
}

/**
 * Get all position markers for a wallet across all markets
 */
export function getAllPositionMarkers(walletAddress: string): PositionMarker[] {
  const markers: PositionMarker[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MARKER_KEY_PREFIX) && key.endsWith(`-${walletAddress}`)) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const marker: PositionMarker = JSON.parse(cached);
          markers.push(marker);
        }
      }
    }
  } catch (error) {
    console.error('Failed to get all position markers:', error);
  }

  return markers;
}

/**
 * Clear position marker when position is closed
 */
export function clearPositionMarker(marketId: string, accountId: string, walletAddress: string): void {
  try {
    const key = getMarkerKey(marketId, accountId, walletAddress);
    localStorage.removeItem(key);
    console.log(`🗑️ Cleared position marker for account ${accountId}`);
  } catch (error) {
    console.error('Failed to clear position marker:', error);
  }
}

/**
 * Cleanup old markers (older than 30 days or if position no longer exists)
 */
export function cleanupOldMarkers(): void {
  try {
    const thirtyDaysAgo = Date.now() / 1000 - (30 * 24 * 60 * 60);

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MARKER_KEY_PREFIX)) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const marker: PositionMarker = JSON.parse(cached);
          if (marker.entryTime < thirtyDaysAgo) {
            localStorage.removeItem(key);
            console.log(`🗑️ Cleaned up old marker for account ${marker.accountId}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old markers:', error);
  }
}

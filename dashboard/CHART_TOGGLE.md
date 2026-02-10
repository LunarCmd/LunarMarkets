# Chart Toggle Feature

## Overview
The dashboard now supports two chart types:
1. **TradingView Chart** (NEW) - Custom chart with position markers
2. **DexScreener Chart** (Original) - Embedded iframe from DexScreener

## Switching Between Charts
Click the toggle button in the controls section (top of the page) to switch between chart types:
- **"TradingView (with markers)"** - Shows custom TradingView chart with your position markers
- **"DexScreener (embedded)"** - Shows the original DexScreener iframe

Your preference is saved in localStorage and persists across sessions.

## TradingView Chart Features

### ✅ Position Markers
When you open a position, a marker is automatically added to the chart showing:
- Entry price (horizontal dashed line)
- Position side (green for long, red for short)
- Entry details in the axis label

### 📍 How It Works
1. **Opening a Position**: When you execute a trade, the system saves:
   - Entry price
   - Entry time (timestamp)
   - Position side (long/short)
   - Position size
   - Your wallet address

2. **Viewing Markers**: Position markers only appear when:
   - You're connected with the same wallet that opened the position
   - The position is still open (not closed)
   - You're viewing the TradingView chart

3. **Closing Positions**: When you close a position, the marker is automatically removed

### 🗄️ Data Storage
- Position markers are stored in localStorage
- Data is keyed by: `market ID + account ID + wallet address`
- Only visible to the wallet that opened the position
- Old markers (30+ days) are automatically cleaned up

## Current Limitations

### ⚠️ Sample Price Data
The TradingView chart currently uses **sample/placeholder price data** because:
- DexScreener's public API doesn't provide historical OHLCV data
- Real-time data integration requires a paid service (Birdeye, Jupiter, etc.)

### 🔧 For Production
To use real price data, integrate one of these APIs:
- **Birdeye API**: Historical OHLCV data for Solana tokens
- **Jupiter API**: Price history endpoint
- **Custom DEX aggregator**: Fetch directly from DEX programs

Update the `fetchChartData` function in `src/components/TradingViewChart.tsx` to use real data.

## Fallback Instructions

If the TradingView chart has issues:
1. Click the toggle button to switch back to DexScreener
2. Or set `use-tradingview-chart` to `false` in localStorage
3. Or modify line 30 in `src/app/page.tsx`:
   ```typescript
   const [useTradingViewChart, setUseTradingViewChart] = useLocalStorage<boolean>('use-tradingview-chart', false);
   ```

## Files Changed

### New Files
- `src/components/TradingViewChart.tsx` - TradingView chart component with position markers
- `src/lib/positionMarkers.ts` - Position marker storage and management

### Modified Files
- `src/app/page.tsx` - Added chart toggle button and conditional rendering
- `src/components/TradingPanel.tsx` - Save position markers when opening positions
- `src/components/PersonalPositions.tsx` - Clear markers when closing positions

### Preserved Files
- `src/components/DexScreenerChart.tsx` - Original DexScreener chart (unchanged)
- `src/lib/entryPriceCache.ts` - Entry price cache (unchanged)

## Technical Details

### Libraries Used
- `lightweight-charts` - TradingView's official charting library (free, open source)

### Position Marker Format
```typescript
interface PositionMarker {
  marketId: string;           // Market identifier
  accountId: string;          // Account ID on-chain
  walletAddress: string;      // User's wallet address
  entryPrice: number;         // Entry price (decimal, not E6)
  entryTime: number;          // Unix timestamp in seconds
  side: 'long' | 'short';     // Position direction
  positionSize: string;       // Position size in base token
  collateralAmount: string;   // Collateral amount
}
```

### Storage Keys
- Position markers: `position-marker-{marketId}-{accountId}-{walletAddress}`
- Chart preference: `use-tradingview-chart` (boolean)

## Future Enhancements
- [ ] Integrate real-time price data from Birdeye/Jupiter
- [ ] Add take-profit/stop-loss markers
- [ ] Show PnL annotations on chart
- [ ] Add trade history timeline
- [ ] Multi-timeframe analysis (1m, 5m, 1h, 1d)
- [ ] Drawing tools (trend lines, support/resistance)

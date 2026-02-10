import { DashboardConfig, MarketConfig } from '@/types';

export interface ExtendedDashboardConfig extends DashboardConfig {
  marketName: string;
  marketDescription: string;
  collateralSymbol: string;
  underlyingSymbol: string;
  invertPrice: boolean;
}

function parseMarkets(): MarketConfig[] {
  const markets: MarketConfig[] = [];

  // Primary market from env vars
  const slabAddress = process.env.NEXT_PUBLIC_SLAB_ADDRESS;
  const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
  const underlyingAssetAddress = process.env.NEXT_PUBLIC_UNDERLYING_ASSET_ADDRESS;
  const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
  const matcherProgramId = process.env.NEXT_PUBLIC_MATCHER_PROGRAM_ID;

  if (slabAddress && tokenAddress && programId && matcherProgramId) {
    const collateralSymbol = process.env.NEXT_PUBLIC_COLLATERAL_SYMBOL || 'SOL';
    const underlyingSymbol = process.env.NEXT_PUBLIC_UNDERLYING_SYMBOL || 'LIQUID';
    // Default: LIQUID=6 decimals, SOL=9 decimals
    const underlyingDecimals = parseInt(process.env.NEXT_PUBLIC_UNDERLYING_DECIMALS || '6', 10);
    const collateralDecimals = parseInt(process.env.NEXT_PUBLIC_COLLATERAL_DECIMALS || '9', 10);
    
    markets.push({
      id: 'primary',
      name: process.env.NEXT_PUBLIC_MARKET_NAME || `${underlyingSymbol}/${collateralSymbol} PERP`,
      description: process.env.NEXT_PUBLIC_MARKET_DESCRIPTION || `Trade ${underlyingSymbol} with ${collateralSymbol} collateral`,
      slabAddress,
      tokenAddress,
      underlyingAssetAddress: underlyingAssetAddress || undefined,
      programId,
      matcherProgramId,
      oracleAddress: process.env.NEXT_PUBLIC_ORACLE_ADDRESS || undefined,
      underlyingSymbol,
      underlyingDecimals,
      collateralSymbol,
      collateralDecimals,
      invertPrice: process.env.NEXT_PUBLIC_INVERT_PRICE === '1',
    });
  }

  // Additional markets from JSON
  const marketsJson = process.env.NEXT_PUBLIC_MARKETS;
  if (marketsJson) {
    try {
      const parsed = JSON.parse(marketsJson);
      const additionalMarkets = Array.isArray(parsed) ? parsed : [parsed];
      markets.push(...additionalMarkets.map((m: any) => ({
        ...m,
        underlyingSymbol: m.underlyingSymbol || 'LIQUID',
        underlyingDecimals: m.underlyingDecimals ?? 6,
        collateralSymbol: m.collateralSymbol || 'SOL',
        collateralDecimals: m.collateralDecimals ?? 9,
        invertPrice: m.invertPrice || false,
      })));
    } catch (e) {
      console.error('Failed to parse NEXT_PUBLIC_MARKETS:', e);
    }
  }

  return markets;
}

export function getConfig(): ExtendedDashboardConfig {
  const markets = parseMarkets();

  return {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
    markets,
    defaultMarketId: markets[0]?.id || '',
    refreshInterval: parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || '5000', 10),
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'Percolator Dashboard',
    appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Risk Engine Explorer',
    marketName: process.env.NEXT_PUBLIC_MARKET_NAME || 'LIQUID/SOL PERP',
    marketDescription: process.env.NEXT_PUBLIC_MARKET_DESCRIPTION || 'Trade LIQUID with SOL collateral',
    collateralSymbol: process.env.NEXT_PUBLIC_COLLATERAL_SYMBOL || 'SOL',
    underlyingSymbol: process.env.NEXT_PUBLIC_UNDERLYING_SYMBOL || 'LIQUID',
    invertPrice: process.env.NEXT_PUBLIC_INVERT_PRICE === '1',
  };
}

export function getMarketById(id: string): MarketConfig | undefined {
  const { markets } = getConfig();
  return markets.find(m => m.id === id);
}

export function getAllMarkets(): MarketConfig[] {
  return getConfig().markets;
}

export function getRpcUrl(): string {
  // Check for custom RPC in localStorage (client-side only)
  if (typeof window !== 'undefined') {
    try {
      const customRpc = localStorage.getItem('custom-rpc-url');
      if (customRpc) {
        const parsed = JSON.parse(customRpc);
        if (parsed && parsed.trim()) {
          return parsed;
        }
      }
    } catch {
      // Fall through to default
    }
  }

  // Fall back to env var
  return process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

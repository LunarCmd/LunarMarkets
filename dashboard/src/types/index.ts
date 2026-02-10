import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export interface MarketConfig {
  id: string;
  name: string;
  description: string;
  slabAddress: string;
  tokenAddress: string;           // Collateral token (e.g., WSOL)
  programId: string;
  matcherProgramId: string;
  oracleAddress?: string;
  underlyingAssetAddress?: string; // Base token mint (e.g., LIQUID)
  underlyingSymbol?: string;       // Base token symbol (e.g., LIQUID)
  underlyingDecimals?: number;     // Base token decimals (e.g., 6 for LIQUID)
  collateralSymbol?: string;       // Collateral token symbol (e.g., SOL)
  collateralDecimals?: number;     // Collateral token decimals (e.g., 9 for SOL)
  invertPrice?: boolean;
}

export interface DashboardConfig {
  rpcUrl: string;
  markets: MarketConfig[];
  defaultMarketId: string;
  refreshInterval: number;
  appName: string;
  appDescription: string;
}

export interface AccountData {
  accountId: BN;
  capital: BN;
  kind: AccountKind;
  pnl: BN;
  reservedPnl: BN;
  warmupStartedAtSlot: BN;
  warmupSlopePerStep: BN;
  positionSize: BN;
  entryPrice: BN;
  fundingIndex: BN;
  matcherProgram: PublicKey;
  matcherContext: PublicKey;
  owner: PublicKey;
  feeCredits: BN;
  lastFeeSlot: BN;
}

export enum AccountKind {
  User = 0,
  LP = 1,
}

export interface SlabData {
  address: PublicKey;
  accounts: AccountData[];
  totalAccounts: number;
  vaultBalance: BN;
  vaultAddress: string;
  vaultAuthorityBump: number;
  unitScale: number;
  insuranceFund: BN;
  globalFundingIndex: BN;
  lastFundingSlot: BN;
  oraclePriceE6: BN;
  totalOpenInterest: BN;
  cTot: BN;
  initialMarginBps: BN;
  maintenanceMarginBps: BN;
  tradingFeeBps: BN;
}

export interface TokenInfo {
  address: PublicKey;
  decimals: number;
  symbol: string;
  name: string;
  supply?: BN;
}

export interface ProgramInfo {
  programId: PublicKey;
  matcherProgramId: PublicKey;
  accountCount: number;
  isActive: boolean;
}

export interface MarketStats {
  totalValueLocked: BN;      // Vault balance in collateral token (SOL)
  totalAccounts: number;      // Total number of accounts
  totalUsers: number;         // Number of User accounts
  totalLPs: number;           // Number of LP accounts
  insuranceFundBalance: BN;   // Insurance fund in collateral token (SOL)
  totalLPCapital: BN;         // Total capital across all LPs
  largestLPCapital: BN;       // Largest single LP capital
  totalLongs: number;         // Number of long positions
  totalShorts: number;        // Number of short positions
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface UseMarketDataReturn {
  data: SlabData | null;
  stats: MarketStats | null;
  loadingState: LoadingState;
  error: Error | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

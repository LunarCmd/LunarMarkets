import { 
  Connection, 
  PublicKey, 
  Commitment,
  AccountInfo,
} from '@solana/web3.js';
import BN from 'bn.js';
import { AccountData, AccountKind, MarketConfig, SlabData, TokenInfo } from '@/types';
import { formatAmount } from '@/lib/utils';

// =============================================================================
// Percolator-SOV Layout Constants (from packages/core/src/solana/slab.ts)
// Verified against mainnet LIQUID/SOL market
// =============================================================================

// Header: 72 bytes
const HEADER_LEN = 72;
const MAGIC_OFFSET = 0;           // u64: "PERCOLAT"
const VERSION_OFFSET = 8;         // u32
const BUMP_OFFSET = 12;           // u8
const FLAGS_OFFSET = 13;          // u8 (flags in _padding[0])
const ADMIN_OFFSET = 16;          // Pubkey (32 bytes)
const RESERVED_OFFSET = 48;       // [u8; 24] - nonce at [0..8], lastThrUpdateSlot at [8..16]

// Config: 320 bytes, starts at offset 72
const CONFIG_OFFSET = 72;
const CONFIG_LEN = 320;
const CONFIG_LAST_EFFECTIVE_PRICE_OFF = 312; // u64 at offset 312 within config

// Engine: starts at offset 392 (72 + 320)
const ENGINE_OFF = 392;

// Engine field offsets (relative to engine start)
const ENGINE_VAULT_OFF = 0;              // u128 (16 bytes)
const ENGINE_INSURANCE_OFF = 16;         // InsuranceFund { balance: u128, fee_revenue: u128 } (32 bytes)
const ENGINE_PARAMS_OFF = 48;            // RiskParams (144 bytes)
const ENGINE_CURRENT_SLOT_OFF = 192;     // u64
const ENGINE_FUNDING_INDEX_OFF = 200;    // I128 (16 bytes)
const ENGINE_LAST_FUNDING_SLOT_OFF = 216;// u64
const ENGINE_FUNDING_RATE_BPS_OFF = 224; // i64
const ENGINE_LAST_CRANK_SLOT_OFF = 232;  // u64
const ENGINE_MAX_CRANK_STALENESS_OFF = 240; // u64
const ENGINE_TOTAL_OI_OFF = 248;         // U128 (16 bytes)
const ENGINE_C_TOT_OFF = 264;            // U128
const ENGINE_PNL_POS_TOT_OFF = 280;      // U128
const ENGINE_LIQ_CURSOR_OFF = 296;       // u16
const ENGINE_GC_CURSOR_OFF = 298;        // u16
const ENGINE_LAST_SWEEP_START_OFF = 304; // u64
const ENGINE_LAST_SWEEP_COMPLETE_OFF = 312; // u64
const ENGINE_CRANK_CURSOR_OFF = 320;     // u16
const ENGINE_SWEEP_START_IDX_OFF = 322;  // u16
const ENGINE_LIFETIME_LIQUIDATIONS_OFF = 328; // u64
const ENGINE_LIFETIME_FORCE_CLOSES_OFF = 336; // u64
const ENGINE_NET_LP_POS_OFF = 344;       // I128
const ENGINE_LP_SUM_ABS_OFF = 360;       // U128
const ENGINE_LP_MAX_ABS_OFF = 376;       // U128
const ENGINE_LP_MAX_ABS_SWEEP_OFF = 392; // U128

// Bitmap: 64 u64 words = 512 bytes (for MAX_ACCOUNTS=4096)
const ENGINE_BITMAP_OFF = 408;           // After LP_MAX_ABS_SWEEP (392 + 16 = 408)

// After bitmap (408 + 512 = 920):
const ENGINE_NUM_USED_OFF = 920;         // u16
// 6 bytes padding for u64 alignment
const ENGINE_NEXT_ACCOUNT_ID_OFF = 928;  // u64
const ENGINE_FREE_HEAD_OFF = 936;        // u16
// _padding_accounts: [u8; 6] at 938-943 for next_free alignment
// next_free: [u16; 4096] at 944-9135 (8192 bytes)
// 8 bytes padding for Account alignment (u128)
const ENGINE_ACCOUNTS_OFF = 9136;        // accounts: [Account; 4096]

// Account constants
const BITMAP_WORDS = 64;                 // 4096 bits = 64 u64 words
const MAX_ACCOUNTS = 4096;               // Production mainnet uses 4096
const ACCOUNT_SIZE = 240;                // Account size in bytes

// Account field offsets (within each 240-byte account)
const ACCT_ACCOUNT_ID_OFF = 0;           // u64 (8 bytes)
const ACCT_CAPITAL_OFF = 8;              // u128 (16 bytes)
const ACCT_KIND_OFF = 24;                // u8 (1 byte + 7 padding = 8 bytes total)
const ACCT_PNL_OFF = 32;                 // i128 (16 bytes)
const ACCT_RESERVED_PNL_OFF = 48;        // u64 (8 bytes)
const ACCT_WARMUP_STARTED_OFF = 56;      // u64 (8 bytes)
const ACCT_WARMUP_SLOPE_OFF = 64;        // u128 (16 bytes)
const ACCT_POSITION_SIZE_OFF = 80;       // i128 (16 bytes)
const ACCT_ENTRY_PRICE_OFF = 96;         // u64 (8 bytes)
const ACCT_FUNDING_INDEX_OFF = 104;      // i128 (16 bytes)
const ACCT_MATCHER_PROGRAM_OFF = 120;    // Pubkey (32 bytes)
const ACCT_MATCHER_CONTEXT_OFF = 152;    // Pubkey (32 bytes)
const ACCT_OWNER_OFF = 184;              // Pubkey (32 bytes)
const ACCT_FEE_CREDITS_OFF = 216;        // i128 (16 bytes)
const ACCT_LAST_FEE_SLOT_OFF = 232;      // u64 (8 bytes)

// =============================================================================
// Connection wrapper
// =============================================================================

export class SolanaConnection {
  private connection: Connection;

  constructor(endpoint: string) {
    this.connection = new Connection(endpoint, {
      commitment: 'confirmed' as Commitment,
      confirmTransactionInitialTimeout: 60000,
    });
  }

  async getAccountInfo(publicKey: PublicKey): Promise<AccountInfo<Buffer> | null> {
    return this.connection.getAccountInfo(publicKey, 'confirmed');
  }

  async getSlot(): Promise<number> {
    return this.connection.getSlot('confirmed');
  }
}

// =============================================================================
// Buffer Reading Helpers
// =============================================================================

function readU8(data: Buffer, offset: number): number {
  if (offset < 0 || offset >= data.length) return 0;
  return data.readUInt8(offset);
}

function readU16(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > data.length) return 0;
  return data.readUInt16LE(offset);
}

function readU32(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > data.length) return 0;
  return data.readUInt32LE(offset);
}

function readU64(data: Buffer, offset: number): BN {
  if (offset < 0 || offset + 8 > data.length) return new BN(0);
  const low = data.readUInt32LE(offset);
  const high = data.readUInt32LE(offset + 4);
  return new BN(high).shln(32).add(new BN(low));
}

function readI64(data: Buffer, offset: number): BN {
  if (offset < 0 || offset + 8 > data.length) return new BN(0);
  // Read as signed 64-bit
  const buf = data.slice(offset, offset + 8);
  let value = new BN(buf, 'le');
  // Check if negative (MSB set)
  if (buf[7] & 0x80) {
    value = value.sub(new BN(2).pow(new BN(64)));
  }
  return value;
}

function readU128(data: Buffer, offset: number): BN {
  if (offset < 0 || offset + 16 > data.length) return new BN(0);
  const low = readU64(data, offset);
  const high = readU64(data, offset + 8);
  return high.shln(64).add(low);
}

function readI128(data: Buffer, offset: number): BN {
  if (offset < 0 || offset + 16 > data.length) return new BN(0);
  const buf = data.slice(offset, offset + 16);
  let value = new BN(buf, 'le');
  // Check if negative (MSB set)
  if (buf[15] & 0x80) {
    value = value.sub(new BN(2).pow(new BN(128)));
  }
  return value;
}

function readPubkey(data: Buffer, offset: number): PublicKey {
  if (offset < 0 || offset + 32 > data.length) {
    return new PublicKey(new Uint8Array(32));
  }
  return new PublicKey(data.slice(offset, offset + 32));
}

// =============================================================================
// Slab Data Parsing
// =============================================================================

export async function fetchSlabData(
  connection: SolanaConnection,
  market: MarketConfig
): Promise<SlabData> {
  const slabPubkey = new PublicKey(market.slabAddress);
  const accountInfo = await connection.getAccountInfo(slabPubkey);

  if (!accountInfo) {
    throw new Error(`Slab account not found: ${market.slabAddress}`);
  }

  const data = accountInfo.data;

  // Parse header
  // Magic is stored as little-endian u64: "PERCOLAT" = 0x504552434f4c4154
  // When read as bytes: 0x54, 0x41, 0x4c, 0x4f, 0x43, 0x52, 0x45, 0x50 = "TALOCREP"
  // When read as LE u64: 0x504552434f4c4154 = "PERCOLAT"
  const magic = data.readBigUInt64LE(MAGIC_OFFSET);
  const expectedMagic = BigInt('0x504552434f4c4154'); // "PERCOLAT"
  
  if (magic !== expectedMagic) {
    throw new Error(`Invalid magic: expected 0x${expectedMagic.toString(16)}, got 0x${magic.toString(16)}`);
  }

  // Parse config (at offset 72)
  const configData = data.slice(CONFIG_OFFSET, CONFIG_OFFSET + CONFIG_LEN);

  // Vault pubkey at offset 32 within config (after collateral_mint)
  const vaultPubkeyBytes = configData.slice(32, 64);
  const vaultAddress = new PublicKey(vaultPubkeyBytes);

  // Vault authority bump at offset 106 within config (after mint[32] + vault[32] + feed_id[32] + max_staleness[8] + conf_filter[2])
  const vaultAuthorityBump = configData[106];

  // Unit scale at offset 108 within config (after invert at 107)
  // Lamports per Unit for conversion (e.g., 1000 means 1 SOL = 1,000,000 Units)
  // Note: For this market unitScale = 0, meaning no scaling (1:1 lamports to units)
  const unitScale = readU32(configData, 108);

  // Oracle price is at offset 312 within config (last 8 bytes as u64)
  const oraclePriceLow = configData.readUInt32LE(CONFIG_LAST_EFFECTIVE_PRICE_OFF);
  const oraclePriceHigh = configData.readUInt32LE(CONFIG_LAST_EFFECTIVE_PRICE_OFF + 4);
  const oraclePriceE6 = new BN(oraclePriceHigh).shln(32).add(new BN(oraclePriceLow));

  // Parse engine state
  const engineData = data.slice(ENGINE_OFF);
  
  const vault = readU128(engineData, ENGINE_VAULT_OFF);
  const insuranceBalance = readU128(engineData, ENGINE_INSURANCE_OFF);
  const totalOpenInterest = readU128(engineData, ENGINE_TOTAL_OI_OFF);
  const cTot = readU128(engineData, ENGINE_C_TOT_OFF);
  const pnlPosTot = readU128(engineData, ENGINE_PNL_POS_TOT_OFF);
  const fundingIndex = readU128(engineData, ENGINE_FUNDING_INDEX_OFF);
  const lastFundingSlot = readU64(engineData, ENGINE_LAST_FUNDING_SLOT_OFF);
  const numUsedAccounts = readU16(engineData, ENGINE_NUM_USED_OFF);
  const nextAccountId = readU64(engineData, ENGINE_NEXT_ACCOUNT_ID_OFF);
  const freeHead = readU16(engineData, ENGINE_FREE_HEAD_OFF);

  // Calculate accounts offset from start of data
  const accountsOffset = ENGINE_OFF + ENGINE_ACCOUNTS_OFF;

  // Parse accounts from bitmap
  const accounts: AccountData[] = [];
  const bitmapOffset = ENGINE_OFF + ENGINE_BITMAP_OFF;
  
  // Read bitmap and parse accounts
  let parsedCount = 0;
  for (let wordIdx = 0; wordIdx < BITMAP_WORDS && parsedCount < numUsedAccounts; wordIdx++) {
    const wordOffset = bitmapOffset + wordIdx * 8;
    if (wordOffset + 8 > data.length) break;
    
    const word = data.readBigUInt64LE(wordOffset);
    if (word === BigInt(0)) continue;
    
    for (let bitIdx = 0; bitIdx < 64 && parsedCount < numUsedAccounts; bitIdx++) {
      if ((word & (BigInt(1) << BigInt(bitIdx))) !== BigInt(0)) {
        const idx = wordIdx * 64 + bitIdx;
        if (idx >= MAX_ACCOUNTS) break;
        
        const accountOffset = accountsOffset + idx * ACCOUNT_SIZE;
        if (accountOffset + ACCOUNT_SIZE > data.length) {
          console.warn(`Account ${idx} offset ${accountOffset} exceeds data length ${data.length}`);
          break;
        }

        const accountData = data.slice(accountOffset, accountOffset + ACCOUNT_SIZE);
        const account = parseAccount(accountData, idx);
        
        if (account) {
          accounts.push(account);
          parsedCount++;
        }
      }
    }
  }

  return {
    address: slabPubkey,
    accounts,
    totalAccounts: accounts.length,
    vaultBalance: vault,
    vaultAddress: vaultAddress.toBase58(),
    vaultAuthorityBump,
    unitScale,
    insuranceFund: insuranceBalance,
    globalFundingIndex: fundingIndex,
    lastFundingSlot,
    oraclePriceE6,
    totalOpenInterest,
    cTot,
  };
}

function parseAccount(data: Buffer, idx: number): AccountData | null {
  try {
    // Read account_id at offset 0 (but we'll use bitmap idx as the authoritative account index)
    const storedAccountId = readU64(data, ACCT_ACCOUNT_ID_OFF);

    // Validate stored account_id
    if (storedAccountId.gt(new BN(1000000))) {
      console.warn(`Skipping account ${idx} - invalid accountId: ${storedAccountId.toString()}`);
      return null;
    }

    // IMPORTANT: Use bitmap idx as the accountId, not the stored value
    // The engine expects the array index (bitmap slot), not the account_id field
    const accountId = new BN(idx);

    const capital = readU128(data, ACCT_CAPITAL_OFF);
    const kind = readU8(data, ACCT_KIND_OFF) as AccountKind;
    const pnl = readI128(data, ACCT_PNL_OFF);
    const reservedPnl = readU64(data, ACCT_RESERVED_PNL_OFF);
    const warmupStartedAtSlot = readU64(data, ACCT_WARMUP_STARTED_OFF);
    const warmupSlopePerStep = readU128(data, ACCT_WARMUP_SLOPE_OFF);
    const positionSize = readI128(data, ACCT_POSITION_SIZE_OFF);
    const entryPrice = readU64(data, ACCT_ENTRY_PRICE_OFF);
    const fundingIndex = readI128(data, ACCT_FUNDING_INDEX_OFF);
    const matcherProgram = readPubkey(data, ACCT_MATCHER_PROGRAM_OFF);
    const matcherContext = readPubkey(data, ACCT_MATCHER_CONTEXT_OFF);
    const owner = readPubkey(data, ACCT_OWNER_OFF);
    const feeCredits = readI128(data, ACCT_FEE_CREDITS_OFF);
    const lastFeeSlot = readU64(data, ACCT_LAST_FEE_SLOT_OFF);

    return {
      accountId,
      capital,
      kind,
      pnl,
      reservedPnl,
      warmupStartedAtSlot,
      warmupSlopePerStep,
      positionSize,
      entryPrice,
      fundingIndex,
      matcherProgram,
      matcherContext,
      owner,
      feeCredits,
      lastFeeSlot,
    };
  } catch (err) {
    console.error(`Error parsing account ${idx}:`, err);
    return null;
  }
}

// =============================================================================
// Token Info Fetching
// =============================================================================

export async function fetchTokenInfo(
  connection: SolanaConnection,
  tokenAddress: string
): Promise<TokenInfo | null> {
  try {
    const pubkey = new PublicKey(tokenAddress);
    const accountInfo = await connection.getAccountInfo(pubkey);

    if (!accountInfo) {
      return null;
    }

    // For SPL tokens, parse mint info
    // This is a simplified version - in production you'd use @solana/spl-token
    return {
      address: pubkey,
      decimals: 9, // Default for SOL
      symbol: 'SOL',
      name: 'Solana',
    };
  } catch (err) {
    console.error('Error fetching token info:', err);
    return null;
  }
}

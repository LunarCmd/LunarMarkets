'use client';

import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getRpcUrl } from '@/lib/config';
import { TokenInfo } from '@/types';
import BN from 'bn.js';

// Token mint layout:
// - 36 bytes: Mint authority option
// - 8 bytes: Supply (u64)
// - 1 byte: Decimals (u8)
// - etc.

// Known token configurations
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  'A16Gd8AfaPnG6rohE6iPFDf6mr9gk519d6aMUJAperc': {
    symbol: 'PERC',
    name: 'Percolator Token',
    decimals: 6
  },
  '71mfKdePwyWXtiF1mqu2aaCdMKnKuN664z2vEM2Xpump': {
    symbol: 'LIQUID',
    name: 'LIQUID Token',
    decimals: 6
  },
  'So11111111111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6
  },
};

export function useTokenInfo(tokenAddress: string | undefined) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tokenAddress) {
      setTokenInfo(null);
      return;
    }

    const fetchTokenInfo = async () => {
      setLoading(true);
      setError(null);

      // Check if it's a known token first
      const known = KNOWN_TOKENS[tokenAddress];

      try {
        const connection = new Connection(getRpcUrl());
        const address = new PublicKey(tokenAddress);
        
        // Get the token mint account info directly
        const accountInfo = await connection.getAccountInfo(address);
        
        if (!accountInfo) {
          throw new Error(`Token account not found: ${tokenAddress}`);
        }

        // Parse mint data manually
        const data = accountInfo.data;
        const decimals = data[44]; // Decimals at offset 44
        const supply = new BN(data.slice(36, 44), 'le'); // Supply at offset 36
        
        console.log('Token mint data:', {
          address: tokenAddress,
          decimals,
          supply: supply.toString(),
          dataLength: data.length,
          known: known?.symbol || 'unknown',
        });
        
        // Use known decimals if available (override on-chain for reliability)
        const finalDecimals = known?.decimals ?? decimals;
        
        setTokenInfo({
          address,
          decimals: finalDecimals,
          symbol: known?.symbol || 'UNKNOWN',
          name: known?.name || 'Unknown Token',
          supply,
        });
      } catch (err) {
        console.error('Error fetching token info:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch token info'));
        
        // Fallback to known token config if available
        if (known) {
          setTokenInfo({
            address: new PublicKey(tokenAddress),
            decimals: known.decimals,
            symbol: known.symbol,
            name: known.name,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTokenInfo();
  }, [tokenAddress]);

  return { tokenInfo, loading, error };
}

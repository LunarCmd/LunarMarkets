'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketConfig, SlabData, MarketStats, UseMarketDataReturn, LoadingState } from '@/types';
import { SolanaConnection, fetchSlabData } from '@/lib/solana';
import { getConfig, getRpcUrl } from '@/lib/config';
import BN from 'bn.js';

export function useMarketData(market: MarketConfig | null): UseMarketDataReturn {
  const [data, setData] = useState<SlabData | null>(null);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const connectionRef = useRef<SolanaConnection | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { refreshInterval } = getConfig();

  // Initialize connection
  useEffect(() => {
    if (!connectionRef.current) {
      connectionRef.current = new SolanaConnection(getRpcUrl());
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!market || !connectionRef.current) return;

    setLoadingState('loading');
    setError(null);

    try {
      const slabData = await fetchSlabData(connectionRef.current, market);
      
      setData(slabData);
      
      // Calculate stats - matching official app approach
      // Only count LPs with capital > 0
      const lpAccounts = slabData.accounts.filter(a => a.kind === 1 && !a.capital.isZero());
      const totalLPCapital = lpAccounts.reduce((sum, lp) => sum.add(lp.capital), new BN(0));
      const largestLPCapital = lpAccounts.reduce((max, lp) =>
        lp.capital.gt(max) ? lp.capital : max, new BN(0)
      );

      // Count long vs short positions (users only, with non-zero positions)
      const userPositions = slabData.accounts.filter(a => a.kind === 0 && !a.positionSize.isZero());
      const totalLongs = userPositions.filter(a => !a.positionSize.isNeg()).length;
      const totalShorts = userPositions.filter(a => a.positionSize.isNeg()).length;

      const marketStats: MarketStats = {
        totalValueLocked: slabData.vaultBalance,  // Vault in SOL
        totalAccounts: slabData.totalAccounts,
        totalUsers: slabData.accounts.filter(a => a.kind === 0).length,
        totalLPs: lpAccounts.length,  // Only LPs with capital > 0
        insuranceFundBalance: slabData.insuranceFund,  // Insurance in SOL
        totalLPCapital,
        largestLPCapital,
        totalLongs,
        totalShorts,
      };
      
      setStats(marketStats);
      setLastUpdated(new Date());
      setLoadingState('success');
    } catch (err) {
      console.error('Error fetching market data:', err);
      setLoadingState('error');
      setError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }, [market]);

  // Initial fetch and interval setup
  useEffect(() => {
    if (market) {
      fetchData();

      // Set up auto-refresh
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [market, fetchData, refreshInterval]);

  return {
    data,
    stats,
    loadingState,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}

export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const start = Date.now();
        const connection = new SolanaConnection(getRpcUrl());
        const slot = await connection.getSlot();
        const end = Date.now();

        setIsConnected(!!slot);
        setLatency(end - start);
      } catch {
        setIsConnected(false);
        setLatency(null);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000);

    return () => clearInterval(interval);
  }, []);

  return { isConnected, latency };
}

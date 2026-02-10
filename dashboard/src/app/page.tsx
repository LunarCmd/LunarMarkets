'use client';

import { useState, useCallback, useEffect } from 'react';
import { MarketConfig } from '@/types';
import { getConfig, getRpcUrl } from '@/lib/config';
import { useMarketData } from '@/hooks/useMarketData';
import { useTokenInfo } from '@/hooks/useTokenInfo';
import { Header } from '@/components/Header';
import { AccountsTable } from '@/components/AccountsTable';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import { SettingsModal } from '@/components/SettingsModal';
import { DexScreenerChart } from '@/components/DexScreenerChart';
import { TradingPanel } from '@/components/TradingPanel';
import { PersonalPositions } from '@/components/PersonalPositions';
import { useWallet } from '@/contexts/WalletContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  Building2,
  Activity,
  Coins
} from 'lucide-react';
import { formatAmount } from '@/lib/utils';
import BN from 'bn.js';

export default function Dashboard() {
  const { defaultMarketId, markets: initialMarkets } = getConfig();
  const [markets, setMarkets] = useLocalStorage<MarketConfig[]>('dashboard-markets', initialMarkets);
  const [selectedMarket, setSelectedMarket] = useState<MarketConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch token info for the selected market
  const { tokenInfo } = useTokenInfo(selectedMarket?.tokenAddress);

  // Initialize selected market
  useEffect(() => {
    if (!selectedMarket && markets.length > 0) {
      const savedMarketId = localStorage.getItem('dashboard-selected-market');
      const market = savedMarketId 
        ? markets.find(m => m.id === savedMarketId)
        : markets.find(m => m.id === defaultMarketId) || markets[0];
      
      if (market) {
        setSelectedMarket(market);
      }
    }
  }, [markets, defaultMarketId, selectedMarket]);

  // Persist selected market
  useEffect(() => {
    if (selectedMarket) {
      localStorage.setItem('dashboard-selected-market', selectedMarket.id);
    }
  }, [selectedMarket]);

  const handleMarketChange = useCallback((market: MarketConfig) => {
    setSelectedMarket(market);
  }, []);

  const handleMarketsUpdate = useCallback((newMarkets: MarketConfig[]) => {
    setMarkets(newMarkets);
    // If current market was removed, select first available
    if (selectedMarket && !newMarkets.find(m => m.id === selectedMarket.id)) {
      setSelectedMarket(newMarkets[0] || null);
    }
  }, [selectedMarket, setMarkets]);

  const { data, stats, loadingState, error, lastUpdated, refetch } = useMarketData(selectedMarket);
  const { publicKey } = useWallet();

  // Fetch data for ALL markets for personal positions view
  const [allMarketsData, setAllMarketsData] = useState<Map<string, { accounts: any[]; oraclePriceE6: number }>>(new Map());

  // Callback to fetch all markets data
  const fetchAllMarketsData = useCallback(async () => {
    const connection = new (await import('@/lib/solana')).SolanaConnection(getRpcUrl());
    const newData = new Map();

    for (const market of markets) {
      try {
        const { fetchSlabData } = await import('@/lib/solana');
        const slabData = await fetchSlabData(connection, market);
        newData.set(market.id, {
          accounts: slabData.accounts,
          oraclePriceE6: slabData.oraclePriceE6.toNumber()
        });
      } catch (err) {
        console.error(`Failed to fetch data for ${market.id}:`, err);
      }
    }

    setAllMarketsData(newData);
  }, [markets]);

  // Auto-refresh all markets data every 5 seconds (same as main market data)
  useEffect(() => {
    if (markets.length > 0) {
      fetchAllMarketsData();
      const interval = setInterval(fetchAllMarketsData, 5000);
      return () => clearInterval(interval);
    }
  }, [markets, fetchAllMarketsData]);

  // Token decimals:
  // - Base token (LIQUID) = 6 decimals for OI, position sizes
  // - Collateral token (SOL) = 9 decimals for vault, cTot, insurance
  const collateralSymbol = selectedMarket?.collateralSymbol || tokenInfo?.symbol || 'SOL';
  const collateralDecimals = selectedMarket?.collateralDecimals || tokenInfo?.decimals || 9;
  const baseSymbol = selectedMarket?.underlyingSymbol || 'LIQUID';
  const baseDecimals = selectedMarket?.underlyingDecimals || 6;

  return (
    <div className="min-h-screen bg-dark-900">
      <Header
        selectedMarket={selectedMarket}
        onMarketChange={handleMarketChange}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Market Info Banner */}
        {tokenInfo && selectedMarket && (
          <div className="mb-6 p-4 bg-primary-900/20 border border-primary-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-primary-400" />
              <div>
                <p className="font-medium text-white">{selectedMarket.name}</p>
                <p className="text-sm text-gray-400">
                  Trading <span className="text-yellow-400 font-mono">{selectedMarket.underlyingSymbol}</span> price •
                  Collateral in <span className="text-primary-400 font-mono">{collateralSymbol}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 font-medium">Error loading data</p>
                <p className="text-red-300/70 text-sm">{error.message}</p>
                
                {error.message?.includes('403') && (
                  <div className="mt-3 p-3 bg-red-950/50 rounded-lg text-sm">
                    <p className="text-red-300 font-medium mb-1">RPC Access Forbidden</p>
                    <p className="text-red-300/70">
                      The public Solana RPC is blocking access to this account. 
                      To fix this, update your <code className="bg-red-900/50 px-1 rounded">.env.local</code> file with a private RPC endpoint:
                    </p>
                    <ul className="mt-2 space-y-1 text-red-300/70 list-disc ml-5">
                      <li>Helius: <code className="bg-red-900/30 px-1 rounded">https://mainnet.helius-rpc.com/?api-key=YOUR_KEY</code></li>
                      <li>QuickNode: <code className="bg-red-900/30 px-1 rounded">https://YOUR_SUBDOMAIN.quicknode.pro/YOUR_TOKEN</code></li>
                      <li>Alchemy: <code className="bg-red-900/30 px-1 rounded">https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY</code></li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 flex items-center justify-between">
          <RefreshIndicator
            loadingState={loadingState}
            lastUpdated={lastUpdated}
            onRefresh={refetch}
          />
        </div>

        {/* Market Stats Section */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mb-8">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Market Statistics</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {/* Vault Balance */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Vault Balance</p>
              <p className="text-lg font-semibold text-white">
                {stats ? formatAmount(stats.totalValueLocked, collateralDecimals) : '—'}
              </p>
              <p className="text-xs text-primary-400">{collateralSymbol}</p>
            </div>
            
            {/* Insurance Fund */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Insurance Fund</p>
              <p className="text-lg font-semibold text-white">
                {stats ? formatAmount(stats.insuranceFundBalance, collateralDecimals) : '—'}
              </p>
              <p className="text-xs text-primary-400">{collateralSymbol}</p>
            </div>
            
            {/* Total Accounts */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Accounts</p>
              <p className="text-lg font-semibold text-white">
                {stats ? stats.totalAccounts.toString() : '—'}
              </p>
              <p className="text-xs text-gray-400">{stats?.totalUsers || 0} users, {stats?.totalLPs || 0} LPs</p>
            </div>
            
            {/* LP Liquidity */}
            <div>
              <p className="text-xs text-gray-500 mb-1">LP Liquidity</p>
              <p className="text-lg font-semibold text-white">
                {stats ? formatAmount(stats.totalLPCapital, collateralDecimals) : '—'}
              </p>
              <p className="text-xs text-green-400">
                {stats && stats.totalLPs > 0 ? `${stats.totalLPs} LP${stats.totalLPs > 1 ? 's' : ''}` : 'No LPs'}
              </p>
            </div>
            
            {/* Open Interest */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Open Interest</p>
              <p className="text-lg font-semibold text-white">
                {data ? formatAmount(data.totalOpenInterest, baseDecimals) : '—'}
              </p>
              <p className="text-xs text-yellow-400">{baseSymbol}</p>
            </div>
            
            {/* Longs vs Shorts */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Positions</p>
              {/* Visual bar showing long/short ratio */}
              {stats && (stats.totalLongs > 0 || stats.totalShorts > 0) ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-green-400">{stats.totalLongs} Long</span>
                    <span className="text-lg font-semibold text-white">{stats.totalLongs + stats.totalShorts}</span>
                    <span className="text-red-400">{stats.totalShorts} Short</span>
                  </div>
                  <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden flex">
                    {stats.totalLongs > 0 && (
                      <div
                        className="bg-green-500 h-full transition-all duration-300"
                        style={{
                          width: `${(stats.totalLongs / (stats.totalLongs + stats.totalShorts)) * 100}%`
                        }}
                      />
                    )}
                    {stats.totalShorts > 0 && (
                      <div
                        className="bg-red-500 h-full transition-all duration-300"
                        style={{
                          width: `${(stats.totalShorts / (stats.totalLongs + stats.totalShorts)) * 100}%`
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-lg font-semibold text-white">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Chart 75% + Trading Panel 25% */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Chart - 75% on large screens */}
          <div className="lg:col-span-3">
            <DexScreenerChart
              market={selectedMarket}
              underlyingAssetAddress={selectedMarket?.underlyingAssetAddress}
              className="h-[620px] lg:h-[775px]"
            />
          </div>

          {/* Trading Panel - 25% on large screens */}
          <div className="lg:col-span-1">
            <TradingPanel
              market={selectedMarket}
              accounts={data?.accounts || []}
              vaultBalance={data?.vaultBalance || new BN(0)}
              vaultAddress={data?.vaultAddress}
              vaultAuthorityBump={data?.vaultAuthorityBump}
              unitScale={data?.unitScale}
              totalOpenInterest={data?.totalOpenInterest || new BN(0)}
              oraclePriceE6={data?.oraclePriceE6 || new BN(0)}
              initialMarginBps={data?.initialMarginBps || new BN(1000)}
              baseSymbol={baseSymbol}
              baseDecimals={baseDecimals}
              collateralSymbol={collateralSymbol}
              collateralDecimals={collateralDecimals}
              className="h-full max-h-[775px] overflow-auto"
            />
          </div>
        </div>

        {/* Personal Positions - Adaptive Height */}
        <div className="mb-8 bg-primary-900/20 border border-primary-800/50 rounded-lg p-6">
          <PersonalPositions
            markets={markets}
            allMarketData={allMarketsData}
            connectedWallet={publicKey}
            onPositionClosed={fetchAllMarketsData}
            onMarketChange={handleMarketChange}
          />
        </div>

        {/* Open Positions Table - Full Width */}
        <div>
          <AccountsTable
            accounts={data?.accounts || []}
            isLoading={loadingState === 'loading'}
            baseSymbol={baseSymbol}
            baseDecimals={baseDecimals}
            collateralSymbol={collateralSymbol}
            collateralDecimals={collateralDecimals}
            oraclePriceE6={data?.oraclePriceE6?.toNumber() || 0}
            marketId={selectedMarket?.id || ''}
          />
        </div>

        {/* Empty State */}
        {!selectedMarket && (
          <div className="mt-12 text-center">
            <Building2 className="w-16 h-16 mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No Market Selected</h2>
            <p className="text-gray-500 mt-2">
              Select a market from the dropdown above or configure one in settings
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-700 mt-12 py-6">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>Percolator Risk Engine Dashboard</p>
            <p>Educational Research Project</p>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onMarketsUpdate={handleMarketsUpdate}
      />
    </div>
  );
}

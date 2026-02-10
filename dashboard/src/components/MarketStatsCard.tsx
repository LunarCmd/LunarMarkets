'use client';

import { FC } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { MarketConfig } from '@/types';
import { formatAmount } from '@/lib/utils';
import BN from 'bn.js';

interface MarketStatsCardProps {
  market: MarketConfig;
}

export const MarketStatsCard: FC<MarketStatsCardProps> = ({ market }) => {
  const { data: marketData, stats, loadingState, lastUpdated } = useMarketData(market);

  if (loadingState === 'loading' && !stats) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
        <p className="text-red-400">Failed to load market stats</p>
      </div>
    );
  }

  if (!marketData || !stats) return null;

  const StatItem = ({ 
    label, 
    value, 
    subValue,
    isLoading = false 
  }: { 
    label: string; 
    value: string;
    subValue?: string;
    isLoading?: boolean;
  }) => (
    <div className="rounded-lg bg-slate-800/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      {isLoading ? (
        <div className="mt-1 h-6 w-24 animate-pulse rounded bg-slate-700" />
      ) : (
        <>
          <p className="text-lg font-semibold text-slate-200">{value}</p>
          {subValue && <p className="text-xs text-slate-500">{subValue}</p>}
        </>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">Market Stats</h2>
        <span className="text-xs text-slate-500">
          {lastUpdated?.toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Oracle Price */}
        <StatItem
          label="Oracle Price"
          value={`$${formatAmount(marketData.oraclePriceE6, 6)}`}
          subValue="USD per token"
          isLoading={loadingState === 'loading'}
        />

        {/* Total Open Interest - in base token (LIQUID) like official app */}
        <StatItem
          label="Open Interest"
          value={`${formatAmount(marketData.totalOpenInterest, 9)}`}
          subValue="Total position size"
          isLoading={loadingState === 'loading'}
        />

        {/* Vault Balance - in SOL */}
        <StatItem
          label="Vault Balance"
          value={`${formatAmount(stats.totalValueLocked, 9)} SOL`}
          isLoading={loadingState === 'loading'}
        />

        {/* Total Capital (cTot) - in SOL */}
        <StatItem
          label="Total Capital"
          value={`${formatAmount(marketData.cTot, 9)} SOL`}
          subValue="Sum of all accounts"
          isLoading={loadingState === 'loading'}
        />

        {/* Insurance Fund */}
        <StatItem
          label="Insurance Fund"
          value={`${formatAmount(stats.insuranceFundBalance, 9)} SOL`}
          isLoading={loadingState === 'loading'}
        />

        {/* Accounts */}
        <StatItem
          label="Accounts"
          value={`${stats.totalAccounts}`}
          subValue={`${stats.totalUsers} users, ${stats.totalLPs} LPs`}
          isLoading={loadingState === 'loading'}
        />
      </div>
    </div>
  );
};

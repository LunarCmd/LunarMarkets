'use client';

import { useState, useMemo } from 'react';
import { AccountData, AccountKind } from '@/types';
import { formatAddress, formatAmount } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { getCachedEntryPrice } from '@/lib/entryPriceCache';
import {
  Users,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

type SortField = 'owner' | 'capital' | 'pnl' | 'position';
type SortDirection = 'asc' | 'desc' | null;

interface AccountsTableProps {
  accounts: AccountData[];
  isLoading?: boolean;
  baseSymbol: string;           // Base token (e.g., LIQUID) - for position sizes
  baseDecimals: number;         // Base token decimals (e.g., 6)
  collateralSymbol: string;     // Collateral token (e.g., SOL) - for capital, pnl
  collateralDecimals: number;   // Collateral token decimals (e.g., 9)
  oraclePriceE6: number;        // Current mark price in E6 format (for PnL calculation)
  marketId: string;             // Market ID for entry price caching
}

function AccountRow({ account, baseSymbol, baseDecimals, collateralSymbol, collateralDecimals, oraclePriceE6, marketId }: {
  account: AccountData;
  baseSymbol: string;
  baseDecimals: number;
  collateralSymbol: string;
  collateralDecimals: number;
  oraclePriceE6: number;
  marketId: string;
}) {
  const [copied, setCopied] = useState(false);
  const isLong = !account.positionSize.isNeg();

  // Get entry price - use cached if available, otherwise use on-chain value
  // Cached entry price is more accurate as on-chain value can change when positions are modified
  const cachedEntryPrice = getCachedEntryPrice(marketId, account.accountId.toString());
  const entryPriceE6 = cachedEntryPrice ?? account.entryPrice.toNumber();
  const markPriceE6 = oraclePriceE6; // Current oracle price (updates in real-time)

  // Price change in SOL per BUTTCOIN
  const priceDiffE6 = markPriceE6 - entryPriceE6;

  // Position size in BUTTCOIN (with baseDecimals)
  const positionSizeButtcoin = account.positionSize.toNumber() / Math.pow(10, baseDecimals);

  // PnL = (currentPrice - entryPrice) × positionSize
  // Both prices are in SOL per BUTTCOIN (E6), so result is in SOL (E6)
  // IMPORTANT: Apply 1000x adjustment for decimal mismatch
  const pnlE6 = priceDiffE6 * positionSizeButtcoin;

  // Convert to lamports for display (divide by 1000 for decimal adjustment)
  const pnlLamports = Math.floor(pnlE6 * Math.pow(10, collateralDecimals - 6) / 1000);
  const pnlPositive = pnlLamports >= 0;

  // Calculate leverage: positionValue / capital
  // IMPORTANT: Need to apply 1000x adjustment for decimal mismatch (same as trade calculation)
  const positionValueLamports = Math.abs(positionSizeButtcoin) * (markPriceE6 / 1e6) * Math.pow(10, collateralDecimals) / 1000;
  const capitalLamports = account.capital.toNumber();
  const leverage = capitalLamports > 0 ? positionValueLamports / capitalLamports : 0;

  // Calculate margin %: (capital / positionValue) × 100
  const marginPercent = positionValueLamports > 0 ? (capitalLamports / positionValueLamports) * 100 : 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(account.owner.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr className="hover:bg-dark-700/50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-300">
            {account.owner.toBase58()}
          </span>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-dark-700 text-gray-500 hover:text-white transition-colors flex-shrink-0"
            title="Copy address"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
          <a
            href={`https://solscan.io/account/${account.owner.toBase58()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-dark-700 text-gray-500 hover:text-primary-400 transition-colors flex-shrink-0"
            title="View on Solscan"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-300">
          {formatAmount(account.capital, collateralDecimals)}
        </span>
        <span className="text-xs text-gray-500 ml-1">{collateralSymbol}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className={cn(
          "flex items-center gap-1 text-sm font-medium",
          pnlPositive ? "text-green-400" : "text-red-400"
        )}>
          {pnlPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {pnlPositive ? '+' : '-'}{formatAmount(Math.abs(pnlLamports), collateralDecimals)}
          <span className="text-xs opacity-70">{collateralSymbol}</span>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {isLong ? (
            <ArrowUpRight className="w-4 h-4 text-green-400" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-400" />
          )}
          <span className={cn(
            "text-sm font-medium",
            isLong ? "text-green-400" : "text-red-400"
          )}>
            {isLong ? 'Long' : 'Short'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn(
          "text-sm",
          isLong ? "text-green-400" : "text-red-400"
        )}>
          {formatAmount(account.positionSize.abs(), baseDecimals)} {baseSymbol}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <span className="text-sm text-gray-400">{leverage.toFixed(2)}x</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <span className={cn(
          "text-sm font-medium",
          marginPercent > 20 ? "text-green-400" : marginPercent > 10 ? "text-yellow-400" : "text-red-400"
        )}>
          {marginPercent.toFixed(1)}%
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="text-xs">
          <div className="text-gray-400">{(entryPriceE6 / 1e6).toFixed(9)}</div>
          <div className="text-gray-500 text-[10px]">Entry</div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="text-xs">
          <div className="text-gray-400">{(markPriceE6 / 1e6).toFixed(9)}</div>
          <div className="text-gray-500 text-[10px]">Mark</div>
        </div>
      </td>
    </tr>
  );
}

export function AccountsTable({
  accounts,
  isLoading,
  baseSymbol,
  baseDecimals,
  collateralSymbol,
  collateralDecimals,
  oraclePriceE6,
  marketId
}: AccountsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Filter to only show User positions (exclude LPs and zero positions)
  // Sort by accountId descending to show most recent positions first
  const userPositions = useMemo(() => {
    return accounts
      .filter(account =>
        account.kind === AccountKind.User && !account.positionSize.isZero()
      )
      .sort((a, b) => b.accountId.cmp(a.accountId)); // Most recent first (higher ID = newer)
  }, [accounts]);

  // Sort positions
  const positions = useMemo(() => {
    if (!sortField || !sortDirection) return userPositions;

    return [...userPositions].sort((a, b) => {
      let compareResult = 0;

      switch (sortField) {
        case 'owner':
          compareResult = a.owner.toBase58().localeCompare(b.owner.toBase58());
          break;
        case 'capital':
          compareResult = a.capital.cmp(b.capital);
          break;
        case 'pnl':
          compareResult = a.pnl.cmp(b.pnl);
          break;
        case 'position':
          compareResult = a.positionSize.abs().cmp(b.positionSize.abs());
          break;
      }

      return sortDirection === 'asc' ? compareResult : -compareResult;
    });
  }, [userPositions, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  if (!isLoading && positions.length === 0) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-8">
        <div className="text-center text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No open positions</p>
          <p className="text-sm">Open positions will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Open Positions</h2>
        <span className="text-sm text-gray-500">
          {positions.length} {positions.length === 1 ? 'position' : 'positions'} • PnL calculated from entry vs mark price
        </span>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-dark-900/50 sticky top-0 z-10">
            <tr>
              <th
                onClick={() => handleSort('owner')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  Owner
                  <SortIcon field="owner" />
                </div>
              </th>
              <th
                onClick={() => handleSort('capital')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  Capital
                  <SortIcon field="capital" />
                </div>
              </th>
              <th
                onClick={() => handleSort('pnl')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  PnL
                  <SortIcon field="pnl" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Direction
              </th>
              <th
                onClick={() => handleSort('position')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  Position
                  <SortIcon field="position" />
                </div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Leverage
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Margin
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mark Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {positions.map((account) => (
              <AccountRow
                key={account.accountId.toString()}
                account={account}
                baseSymbol={baseSymbol}
                baseDecimals={baseDecimals}
                collateralSymbol={collateralSymbol}
                collateralDecimals={collateralDecimals}
                oraclePriceE6={oraclePriceE6}
                marketId={marketId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

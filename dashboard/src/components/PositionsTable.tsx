'use client';

import { AccountData, AccountKind } from '@/types';
import { formatAddress, formatAmount } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { 
  Users, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';

interface PositionsTableProps {
  accounts: AccountData[];
  isLoading?: boolean;
  baseSymbol: string;           // Base token (e.g., LIQUID) - for position sizes
  baseDecimals: number;         // Base token decimals (e.g., 6)
  collateralSymbol: string;     // Collateral token (e.g., SOL) - for capital, pnl
  collateralDecimals: number;   // Collateral token decimals (e.g., 9)
}

function PositionRow({ 
  account, 
  baseSymbol, 
  baseDecimals, 
  collateralSymbol, 
  collateralDecimals 
}: { 
  account: AccountData; 
  baseSymbol: string;
  baseDecimals: number;
  collateralSymbol: string;
  collateralDecimals: number;
}) {
  const isLong = !account.positionSize.isNeg();
  const pnlPositive = !account.pnl.isNeg();

  return (
    <tr className="hover:bg-dark-700/50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {isLong ? (
            <ArrowUpRight className="w-4 h-4 text-green-400" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-400" />
          )}
          <span className={cn(
            "px-2 py-0.5 text-xs rounded-full font-medium",
            isLong ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
          )}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-300">
          #{account.accountId.toString()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-mono text-gray-300">
          {formatAddress(account.owner.toBase58(), 4)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-300">
          {formatAmount(account.capital, collateralDecimals)}
        </span>
        <span className="text-xs text-gray-500 ml-1">{collateralSymbol}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={cn(
          "flex items-center gap-1 text-sm",
          pnlPositive ? "text-green-400" : "text-red-400"
        )}>
          {pnlPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {formatAmount(account.pnl.abs(), collateralDecimals)}
          <span className="text-xs opacity-70">{collateralSymbol}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <span className={cn(
            "text-sm font-medium",
            isLong ? "text-green-400" : "text-red-400"
          )}>
            {formatAmount(account.positionSize.abs(), baseDecimals)}
          </span>
          <span className="text-xs text-gray-500">{baseSymbol}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
        {formatAmount(account.entryPrice, 6)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={cn(
          "text-sm",
          !account.feeCredits.isNeg() ? "text-green-400" : "text-red-400"
        )}>
          {formatAmount(account.feeCredits.abs(), collateralDecimals)}
        </span>
        <span className="text-xs text-gray-500 ml-1">{collateralSymbol}</span>
      </td>
    </tr>
  );
}

export function PositionsTable({ 
  accounts, 
  isLoading, 
  baseSymbol,
  baseDecimals,
  collateralSymbol,
  collateralDecimals
}: PositionsTableProps) {
  // Filter: Only accounts with active positions (non-zero position size), exclude LPs
  const positions = accounts.filter(a => 
    a.kind !== AccountKind.LP && !a.positionSize.isZero()
  );

  // Sort by absolute position size (largest first)
  const sortedPositions = [...positions].sort((a, b) => 
    b.positionSize.abs().cmp(a.positionSize.abs())
  );

  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </div>
    );
  }

  if (sortedPositions.length === 0) {
    return (
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-8">
        <div className="text-center text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Active Positions</p>
          <p className="text-sm">Positions will appear here when traders open them</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">Positions</h2>
        </div>
        <span className="text-sm text-gray-500">
          {sortedPositions.length} active • Sizes in <span className="text-yellow-400">{baseSymbol}</span> • Values in <span className="text-primary-400">{collateralSymbol}</span>
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-dark-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Capital
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PnL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fee Credits
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {sortedPositions.map((account, index) => (
              <PositionRow 
                key={index} 
                account={account} 
                baseSymbol={baseSymbol}
                baseDecimals={baseDecimals}
                collateralSymbol={collateralSymbol}
                collateralDecimals={collateralDecimals}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

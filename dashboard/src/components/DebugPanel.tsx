'use client';

import { useState } from 'react';
import { SlabData } from '@/types';
import { formatAmount } from '@/lib/utils';
import { Bug, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebugPanelProps {
  data: SlabData | null;
  baseSymbol: string;
  baseDecimals: number;
  collateralSymbol: string;
  collateralDecimals: number;
}

export function DebugPanel({ data, baseSymbol, baseDecimals, collateralSymbol, collateralDecimals }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw'>('formatted');

  if (!data) return null;

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-dark-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-yellow-400" />
          <span className="font-medium text-white">Debug Panel</span>
          <span className="text-sm text-gray-500">
            ({data.totalAccounts} accounts)
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-dark-700">
          {/* Tabs */}
          <div className="flex gap-4 py-4">
            <button
              onClick={() => setActiveTab('formatted')}
              className={cn(
                "text-sm font-medium transition-colors",
                activeTab === 'formatted' ? "text-primary-400" : "text-gray-400 hover:text-white"
              )}
            >
              Formatted
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={cn(
                "text-sm font-medium transition-colors",
                activeTab === 'raw' ? "text-primary-400" : "text-gray-400 hover:text-white"
              )}
            >
              Raw (no decimals)
            </button>
          </div>

          {activeTab === 'formatted' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Vault Balance</p>
                  <p className="text-sm font-mono text-white">
                    {formatAmount(data.vaultBalance, collateralDecimals)}
                  </p>
                  <p className="text-xs text-primary-400">{collateralSymbol}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Insurance Fund</p>
                  <p className="text-sm font-mono text-white">
                    {formatAmount(data.insuranceFund, collateralDecimals)}
                  </p>
                  <p className="text-xs text-primary-400">{collateralSymbol}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Total Open Interest</p>
                  <p className="text-sm font-mono text-white">
                    {formatAmount(data.totalOpenInterest, baseDecimals)}
                  </p>
                  <p className="text-xs text-yellow-400">{baseSymbol}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Total Capital (cTot)</p>
                  <p className="text-sm font-mono text-white">
                    {formatAmount(data.cTot, collateralDecimals)}
                  </p>
                  <p className="text-xs text-primary-400">{collateralSymbol}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Global Funding Index</p>
                  <p className="text-sm font-mono text-white">{data.globalFundingIndex.toString()}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Last Funding Slot</p>
                  <p className="text-sm font-mono text-white">{data.lastFundingSlot.toString()}</p>
                </div>
              </div>

              <div className="bg-dark-900/50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Slab Address</p>
                <p className="text-sm font-mono text-white">{data.address.toBase58()}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Coins className="w-4 h-4" />
                <span>Base: {baseSymbol} ({baseDecimals}d) • Collateral: {collateralSymbol} ({collateralDecimals}d)</span>
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                <p className="text-xs text-yellow-500 mb-2">Note: Vault/Insurance values may be incorrect if header layout differs from repo</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Vault Balance (Raw)</p>
                  <p className="text-sm font-mono text-white break-all">{data.vaultBalance.toString()}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Insurance Fund (Raw)</p>
                  <p className="text-sm font-mono text-white break-all">{data.insuranceFund.toString()}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Funding Index (Raw)</p>
                  <p className="text-sm font-mono text-white break-all">{data.globalFundingIndex.toString()}</p>
                </div>
                <div className="bg-dark-900/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Last Funding Slot</p>
                  <p className="text-sm font-mono text-white">{data.lastFundingSlot.toString()}</p>
                </div>
              </div>

              <div className="bg-dark-900/50 p-3 rounded-lg overflow-auto max-h-64">
                <p className="text-xs text-gray-500 mb-2">Sample Accounts (Raw)</p>
                <pre className="text-xs text-gray-300">
                  {JSON.stringify(
                    data.accounts.slice(0, 3).map(a => ({
                      id: a.accountId.toString(),
                      kind: a.kind,
                      capital: a.capital.toString(),
                      pnl: a.pnl.toString(),
                      positionSize: a.positionSize.toString(),
                      entryPrice: a.entryPrice.toString(),
                      owner: a.owner.toBase58().slice(0, 8) + '...',
                    })), 
                    null, 2
                  )}
                </pre>
              </div>

              {data.accounts.length > 3 && (
                <p className="text-xs text-gray-500">
                  + {data.accounts.length - 3} more accounts
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

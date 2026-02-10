'use client';

import { useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { MarketConfig, AccountData } from '@/types';
import { formatAmount } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { getCachedEntryPrice, clearEntryPrice } from '@/lib/entryPriceCache';
import { clearPositionMarker } from '@/lib/positionMarkers';
import { buildTradeTransaction } from '@/lib/transactions';
import { useWallet } from '@/contexts/WalletContext';
import BN from 'bn.js';
import {
  User,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  X
} from 'lucide-react';

interface PersonalPositionsProps {
  markets: MarketConfig[];
  allMarketData: Map<string, { accounts: AccountData[]; oraclePriceE6: number }>;
  connectedWallet: PublicKey | null;
  onPositionClosed?: () => void;
  onMarketChange?: (market: MarketConfig) => void;
}

interface PositionWithMarket {
  market: MarketConfig;
  account: AccountData;
  oraclePriceE6: number;
}

export function PersonalPositions({ markets, allMarketData, connectedWallet, onPositionClosed, onMarketChange }: PersonalPositionsProps) {
  const { connection, signAndSendTransaction } = useWallet();
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [closeStatus, setCloseStatus] = useState<string | null>(null);

  // Get all positions for connected wallet across all markets
  const myPositions = useMemo(() => {
    if (!connectedWallet) return [];

    const positions: PositionWithMarket[] = [];

    markets.forEach(market => {
      const marketData = allMarketData.get(market.id);
      if (!marketData) return;

      const { accounts, oraclePriceE6 } = marketData;

      accounts.forEach(account => {
        // Only show user accounts (not LPs) that belong to connected wallet with non-zero positions
        if (
          account.kind === 0 && // User account
          account.owner.equals(connectedWallet) &&
          !account.positionSize.isZero()
        ) {
          positions.push({
            market,
            account,
            oraclePriceE6
          });
        }
      });
    });

    return positions;
  }, [markets, allMarketData, connectedWallet]);

  const handleClosePosition = async (market: MarketConfig, account: AccountData) => {
    if (!connection || !connectedWallet) return;

    const positionKey = `${market.id}-${account.accountId.toString()}`;
    setClosingPositionId(positionKey);
    setCloseStatus(`Closing position...`);

    try {
      // Get market data
      const marketData = allMarketData.get(market.id);
      if (!marketData) {
        throw new Error('Market data not available');
      }

      // Close position by trading opposite direction with full size
      const closeSizeBN = account.positionSize.neg();

      // Find an LP to trade against
      const lpAccount = marketData.accounts.find(a => a.kind === 1);
      if (!lpAccount) {
        throw new Error('No LP available to trade against');
      }

      const transaction = await buildTradeTransaction({
        connection,
        userPublicKey: connectedWallet,
        lpOwner: lpAccount.owner,
        slabAddress: new PublicKey(market.slabAddress),
        programId: new PublicKey(market.programId),
        oracleAddress: market.oracleAddress ? new PublicKey(market.oracleAddress) : PublicKey.default,
        matcherProgram: lpAccount.matcherProgram,
        matcherContext: lpAccount.matcherContext,
        lpIdx: lpAccount.accountId.toNumber(),
        userIdx: account.accountId.toNumber(),
        size: closeSizeBN,
      });

      const signature = await signAndSendTransaction(transaction);

      // Clear cached entry price and position marker
      clearEntryPrice(market.id, account.accountId.toString());
      clearPositionMarker(market.id, account.accountId.toString(), connectedWallet.toBase58());

      setCloseStatus(`Position closed! ${signature.slice(0, 8)}...`);

      // Trigger data refresh to update the positions table
      if (onPositionClosed) {
        onPositionClosed();
      }

      setTimeout(() => {
        setCloseStatus(null);
        setClosingPositionId(null);
      }, 3000);
    } catch (err) {
      setCloseStatus(`Failed: ${(err as Error).message}`);
      setTimeout(() => {
        setCloseStatus(null);
        setClosingPositionId(null);
      }, 5000);
    }
  };

  if (!connectedWallet) {
    return (
      <div className="text-center py-8 text-gray-500">
        <User className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium">Connect Wallet</p>
        <p className="text-xs">Connect to view your positions across all markets</p>
      </div>
    );
  }

  if (myPositions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium">No Open Positions</p>
        <p className="text-xs">You don't have any open positions</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">My Positions</h3>
          <p className="text-xs text-gray-500">{myPositions.length} {myPositions.length === 1 ? 'position' : 'positions'} across all markets</p>
        </div>
        {closeStatus && (
          <p className="text-xs text-primary-400">{closeStatus}</p>
        )}
      </div>

      <div className={cn(
        "overflow-x-auto bg-dark-900/50 rounded-lg border border-dark-700",
        myPositions.length > 3 && "max-h-[300px] overflow-y-auto"
      )}>
        <table className="w-full">
          <thead className="bg-dark-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Capital
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PnL
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
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
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Close
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {myPositions.map(({ market, account, oraclePriceE6 }) => {
              const isLong = !account.positionSize.isNeg();
              const collateralDecimals = market.collateralDecimals || 9;
              const baseDecimals = market.underlyingDecimals || 6;
              const collateralSymbol = market.collateralSymbol || 'SOL';
              const baseSymbol = market.underlyingSymbol || 'LIQUID';

              // Get cached entry price if available
              const cachedEntryPrice = getCachedEntryPrice(market.id, account.accountId.toString());
              const entryPriceE6 = cachedEntryPrice ?? account.entryPrice.toNumber();
              const markPriceE6 = oraclePriceE6;

              // Calculate PnL
              const priceDiffE6 = markPriceE6 - entryPriceE6;
              const positionSizeButtcoin = account.positionSize.toNumber() / Math.pow(10, baseDecimals);
              const pnlE6 = priceDiffE6 * positionSizeButtcoin;
              const pnlLamports = Math.floor(pnlE6 * Math.pow(10, collateralDecimals - 6) / 1000);
              const pnlPositive = pnlLamports >= 0;

              // Calculate leverage and margin
              const positionValueLamports = Math.abs(positionSizeButtcoin) * (markPriceE6 / 1e6) * Math.pow(10, collateralDecimals) / 1000;
              const capitalLamports = account.capital.toNumber();
              const leverage = capitalLamports > 0 ? positionValueLamports / capitalLamports : 0;
              const marginPercent = positionValueLamports > 0 ? (capitalLamports / positionValueLamports) * 100 : 0;

              return (
                <tr key={`${market.id}-${account.accountId.toString()}`} className="hover:bg-dark-700/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>
                      <button
                        onClick={() => onMarketChange?.(market)}
                        className="text-sm font-medium text-white hover:text-primary-400 transition-colors text-left"
                      >
                        {market.name}
                      </button>
                      <p className="text-xs text-gray-500">{baseSymbol}/{collateralSymbol}</p>
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
                        {formatAmount(account.positionSize.abs(), baseDecimals)}
                      </span>
                      <span className="text-xs opacity-70">{baseSymbol}</span>
                    </div>
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
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-xs">
                      <div className="text-gray-400">{(markPriceE6 / 1e6).toFixed(9)}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleClosePosition(market, account)}
                      disabled={closingPositionId === `${market.id}-${account.accountId.toString()}`}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                        closingPositionId === `${market.id}-${account.accountId.toString()}`
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-500 text-white"
                      )}
                      title="Close position"
                    >
                      <X className="w-3 h-3" />
                      Close
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

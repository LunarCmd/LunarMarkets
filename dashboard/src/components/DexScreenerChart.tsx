'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketConfig } from '@/types';
import { cn } from '@/lib/utils';
import { BarChart3, ExternalLink, Maximize2, Minimize2, Copy, Check } from 'lucide-react';

interface DexScreenerChartProps {
  market: MarketConfig | null;
  underlyingAssetAddress?: string;
  className?: string;
}

// Dexscreener chain mapping for Solana
const DEXSCREENER_CHAIN = 'solana';

export function DexScreenerChart({ market, underlyingAssetAddress, className }: DexScreenerChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('dark');
  const [copiedChart, setCopiedChart] = useState(false);
  const [copiedCollateral, setCopiedCollateral] = useState(false);

  // Use underlying asset for chart (e.g., LIQUID), fallback to collateral token (e.g., SOL)
  const tokenAddress = underlyingAssetAddress || market?.tokenAddress;

  const handleCopyChart = async () => {
    if (tokenAddress) {
      await navigator.clipboard.writeText(tokenAddress);
      setCopiedChart(true);
      setTimeout(() => setCopiedChart(false), 2000);
    }
  };

  const handleCopyCollateral = async () => {
    if (market?.tokenAddress) {
      await navigator.clipboard.writeText(market.tokenAddress);
      setCopiedCollateral(true);
      setTimeout(() => setCopiedCollateral(false), 2000);
    }
  };

  useEffect(() => {
    if (!tokenAddress || !containerRef.current) return;

    setIsLoading(true);

    // Create the Dexscreener iframe
    const iframe = document.createElement('iframe');
    const theme = chartTheme;
    const chartUrl = `https://dexscreener.com/${DEXSCREENER_CHAIN}/${tokenAddress}?embed=1&theme=${theme}&trades=0&info=0`;
    
    iframe.src = chartUrl;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.allow = 'clipboard-write';
    iframe.onload = () => setIsLoading(false);

    // Clear container and append iframe
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(iframe);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tokenAddress, chartTheme]);

  const openInDexScreener = () => {
    if (tokenAddress) {
      window.open(`https://dexscreener.com/${DEXSCREENER_CHAIN}/${tokenAddress}`, '_blank');
    }
  };

  if (!market) {
    return (
      <div className={cn(
        "bg-dark-800 rounded-xl border border-dark-700 flex items-center justify-center",
        className
      )}>
        <div className="text-center text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a market to view chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-dark-800 rounded-xl border border-dark-700 overflow-hidden flex flex-col",
      isFullscreen ? "fixed inset-0 z-50" : "",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary-400" />
          <div>
            <h3 className="font-medium text-white">{market.name} Chart</h3>
            <p className="text-xs text-gray-500">Dexscreener • {market.tokenAddress.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400 hover:text-white transition-colors"
            title="Toggle theme"
          >
            {chartTheme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={openInDexScreener}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Open
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading chart...</p>
            </div>
          </div>
        )}
        <div 
          ref={containerRef} 
          className="w-full h-full"
          style={{ minHeight: isFullscreen ? '100vh' : '500px' }}
        />
      </div>

      {/* Token Info Footer */}
      <div className="px-4 py-3 border-t border-dark-700 bg-dark-900/50 space-y-3">
        <div>
          <div className="text-xs text-gray-400 mb-1">Chart Token</div>
          <div className="flex items-center gap-2">
            <code className="bg-dark-700 px-2 py-1 rounded text-gray-300 font-mono text-xs break-all max-w-[325px] overflow-hidden text-ellipsis">
              {tokenAddress}
            </code>
            <button
              onClick={handleCopyChart}
              className="p-1 rounded hover:bg-dark-700 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title="Copy address"
            >
              {copiedChart ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <a
              href={`https://solscan.io/token/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-dark-700 text-gray-400 hover:text-primary-300 transition-colors flex-shrink-0"
              title="View on Solscan"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
        {underlyingAssetAddress && underlyingAssetAddress !== market?.tokenAddress && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Collateral Token</div>
            <div className="flex items-center gap-2">
              <code className="bg-dark-700 px-2 py-1 rounded text-gray-300 font-mono text-xs break-all max-w-[325px] overflow-hidden text-ellipsis">
                {market?.tokenAddress}
              </code>
              <button
                onClick={handleCopyCollateral}
                className="p-1 rounded hover:bg-dark-700 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                title="Copy address"
              >
                {copiedCollateral ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <a
                href={`https://solscan.io/token/${market?.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-dark-700 text-gray-400 hover:text-primary-300 transition-colors flex-shrink-0"
                title="View on Solscan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

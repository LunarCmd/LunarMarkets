'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, LineStyle, CrosshairMode } from 'lightweight-charts';
import { MarketConfig } from '@/types';
import { cn } from '@/lib/utils';
import { useWallet } from '@/contexts/WalletContext';
import {
  getPositionMarkers,
  savePositionMarker,
  clearPositionMarker,
  PositionMarker
} from '@/lib/positionMarkers';
import { BarChart3, ExternalLink, Maximize2, Minimize2, AlertCircle } from 'lucide-react';

interface TradingViewChartProps {
  market: MarketConfig | null;
  underlyingAssetAddress?: string;
  className?: string;
}

interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function TradingViewChart({ market, underlyingAssetAddress, className }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { publicKey } = useWallet();

  const tokenAddress = underlyingAssetAddress || market?.tokenAddress;

  // Fetch OHLCV data from DexScreener
  const fetchChartData = async (token: string): Promise<OHLCVData[]> => {
    try {
      // DexScreener API endpoint for chart data
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch chart data: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.pairs || data.pairs.length === 0) {
        throw new Error('No trading pairs found for this token');
      }

      // Get the most liquid pair
      const pair = data.pairs.reduce((max: any, p: any) =>
        (p.liquidity?.usd || 0) > (max.liquidity?.usd || 0) ? p : max
      );

      // Fetch historical data (using pair address)
      // Note: DexScreener doesn't provide historical OHLCV via public API
      // We'll use current price and generate some sample data for now
      // In production, you'd use a service like Birdeye API or Jupiter API

      const currentPrice = parseFloat(pair.priceUsd || pair.priceNative || '0');

      // Generate last 100 candles (5-minute intervals) with some randomness
      // This is placeholder data - replace with real historical data
      const now = Math.floor(Date.now() / 1000);
      const candles: OHLCVData[] = [];
      let price = currentPrice * 0.95; // Start 5% lower

      for (let i = 100; i >= 0; i--) {
        const time = now - (i * 300); // 5-minute candles
        const change = (Math.random() - 0.5) * 0.02; // 2% max change
        const open = price;
        const close = price * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = Math.random() * 1000000;

        candles.push({
          time,
          open,
          high,
          low,
          close: i === 0 ? currentPrice : close, // Last candle uses real price
          volume
        });

        price = close;
      }

      return candles;
    } catch (err) {
      console.error('Error fetching chart data:', err);
      throw err;
    }
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !tokenAddress) return;

    setIsLoading(true);
    setError(null);

    const initChart = async () => {
      try {
        // Create chart
        const chart = createChart(chartContainerRef.current!, {
          layout: {
            background: { color: '#1a1b1e' },
            textColor: '#d1d4dc',
          },
          grid: {
            vertLines: { color: '#2b2b43' },
            horzLines: { color: '#2b2b43' },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
          },
          rightPriceScale: {
            borderColor: '#2b2b43',
          },
          timeScale: {
            borderColor: '#2b2b43',
            timeVisible: true,
            secondsVisible: false,
          },
        });

        chartRef.current = chart;

        // Add candlestick series using v4.x API
        const candlestickSeries = (chart as any).addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });

        candlestickSeriesRef.current = candlestickSeries;

        // Fetch and set data
        const chartData = await fetchChartData(tokenAddress);
        candlestickSeries.setData(chartData);

        // Add position markers if wallet is connected
        if (publicKey && market) {
          const markers = getPositionMarkers(market.id, publicKey.toBase58());

          markers.forEach(marker => {
            // Add price line for each position
            candlestickSeries.createPriceLine({
              price: marker.entryPrice,
              color: marker.side === 'long' ? '#26a69a' : '#ef5350',
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `${marker.side.toUpperCase()} @ ${marker.entryPrice.toFixed(6)}`,
            });
          });
        }

        // Fit content
        chart.timeScale().fitContent();

        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing chart:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chart');
        setIsLoading(false);
      }
    };

    initChart();

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [tokenAddress, market, publicKey]);

  // Update chart size when fullscreen changes
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
      chartRef.current.timeScale().fitContent();
    }
  }, [isFullscreen]);

  const openInDexScreener = () => {
    if (tokenAddress) {
      window.open(`https://dexscreener.com/solana/${tokenAddress}`, '_blank');
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
            <p className="text-xs text-gray-500">
              TradingView • {publicKey ? 'Position markers enabled' : 'Connect wallet for markers'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            DexScreener
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading chart data...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800 z-10">
            <div className="text-center text-red-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Chart Error</p>
              <p className="text-xs text-gray-500">{error}</p>
              <p className="text-xs text-gray-500 mt-2">Placeholder data shown</p>
            </div>
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="w-full h-full"
          style={{ minHeight: isFullscreen ? '100vh' : '500px' }}
        />
      </div>

      {/* Chart Info */}
      <div className="px-4 py-3 border-t border-dark-700 bg-dark-900/50">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            Position markers: {publicKey ?
              `${getPositionMarkers(market.id, publicKey.toBase58()).length} active` :
              'Connect wallet to see markers'
            }
          </span>
          <span className="text-yellow-500">
            ⚠️ Using sample data - integrate real price feed for production
          </span>
        </div>
      </div>
    </div>
  );
}

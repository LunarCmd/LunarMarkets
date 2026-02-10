'use client';

import { useState, useEffect, useRef } from 'react';
import { MarketConfig } from '@/types';
import { getConfig } from '@/lib/config';
import { cn, formatAddress } from '@/lib/utils';
import { 
  ChevronDown, 
  Server, 
  Activity, 
  Settings,
  Database,
  Layers
} from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useMarketData';

interface HeaderProps {
  selectedMarket: MarketConfig | null;
  onMarketChange: (market: MarketConfig) => void;
  onSettingsClick: () => void;
}

export function Header({ selectedMarket, onMarketChange, onSettingsClick }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { markets, appName, appDescription } = getConfig();
  const { isConnected, latency } = useConnectionStatus();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleMarketSelect = (market: MarketConfig) => {
    onMarketChange(market);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  return (
    <header className="bg-dark-800 border-b border-dark-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{appName}</h1>
                <p className="text-xs text-gray-400">{appDescription}</p>
              </div>
            </div>
          </div>

          {/* Market Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                "bg-dark-700 hover:bg-dark-600 border border-dark-600",
                "text-white font-medium"
              )}
            >
              <Database className="w-4 h-4 text-primary-400" />
              <span>{selectedMarket?.name || 'Select Market'}</span>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                isDropdownOpen && "transform rotate-180"
              )} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 w-80 bg-dark-800 rounded-lg shadow-xl border border-dark-700 z-50">
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Available Markets
                  </p>
                  {markets.map((market) => (
                    <button
                      key={market.id}
                      onClick={() => handleMarketSelect(market)}
                      className={cn(
                        "w-full text-left px-3 py-3 rounded-lg transition-colors",
                        "hover:bg-dark-700",
                        selectedMarket?.id === market.id && "bg-primary-900/30 border border-primary-700/50"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-white">{market.name}</p>
                          <p className="text-xs text-gray-400">{market.description}</p>
                        </div>
                        {selectedMarket?.id === market.id && (
                          <div className="w-2 h-2 bg-primary-500 rounded-full" />
                        )}
                      </div>
                      <div className="mt-2 flex gap-2 text-xs text-gray-500">
                        <span className="bg-dark-900 px-2 py-0.5 rounded">
                          {formatAddress(market.slabAddress)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700">
              <Server className={cn(
                "w-4 h-4",
                isConnected ? "text-green-400" : "text-red-400"
              )} />
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-medium",
                  isConnected ? "text-green-400" : "text-red-400"
                )}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {latency && (
                  <span className="text-xs text-gray-500">
                    {latency}ms
                  </span>
                )}
              </div>
            </div>

            {/* Settings Button */}
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

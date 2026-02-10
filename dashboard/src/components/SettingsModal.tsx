'use client';

import { useState, useEffect } from 'react';
import { MarketConfig } from '@/types';
import { getConfig, getAllMarkets } from '@/lib/config';
import { cn, formatAddress } from '@/lib/utils';
import { X, Plus, Trash2, Edit2, Save, Server, Clock } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMarketsUpdate: (markets: MarketConfig[]) => void;
}

interface FormData {
  id: string;
  name: string;
  description: string;
  slabAddress: string;
  tokenAddress: string;
  programId: string;
  matcherProgramId: string;
  oracleAddress: string;
}

const emptyForm: FormData = {
  id: '',
  name: '',
  description: '',
  slabAddress: '',
  tokenAddress: '',
  programId: '',
  matcherProgramId: '',
  oracleAddress: '',
};

export function SettingsModal({ isOpen, onClose, onMarketsUpdate }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'markets'>('general');
  const [markets, setMarkets] = useLocalStorage<MarketConfig[]>('dashboard-markets', getAllMarkets());
  const [isEditing, setIsEditing] = useState(false);
  const [editingMarket, setEditingMarket] = useState<FormData>(emptyForm);
  const [customRpcUrl, setCustomRpcUrl] = useLocalStorage<string>('custom-rpc-url', '');
  const { refreshInterval } = getConfig();

  // Get default markets from .env (these cannot be deleted)
  const defaultMarketIds = getAllMarkets().map(m => m.id);

  const isDefaultMarket = (marketId: string) => defaultMarketIds.includes(marketId);

  useEffect(() => {
    if (isOpen) {
      setMarkets(getAllMarkets());
    }
  }, [isOpen]);

  const handleSaveMarket = () => {
    if (!editingMarket.id || !editingMarket.name) return;

    // Prevent editing default markets from .env
    if (isDefaultMarket(editingMarket.id)) {
      setIsEditing(false);
      setEditingMarket(emptyForm);
      return;
    }

    const existingIndex = markets.findIndex(m => m.id === editingMarket.id);
    let newMarkets: MarketConfig[];

    if (existingIndex >= 0) {
      // Update existing
      newMarkets = markets.map((m, i) => i === existingIndex ? editingMarket as MarketConfig : m);
    } else {
      // Add new
      newMarkets = [...markets, editingMarket as MarketConfig];
    }

    setMarkets(newMarkets);
    onMarketsUpdate(newMarkets);
    setIsEditing(false);
    setEditingMarket(emptyForm);
  };

  const handleDeleteMarket = (id: string) => {
    // Prevent deletion of default markets from .env
    if (isDefaultMarket(id)) {
      return;
    }
    const newMarkets = markets.filter(m => m.id !== id);
    setMarkets(newMarkets);
    onMarketsUpdate(newMarkets);
  };

  const handleEditMarket = (market: MarketConfig) => {
    setEditingMarket({
      id: market.id,
      name: market.name,
      description: market.description,
      slabAddress: market.slabAddress,
      tokenAddress: market.tokenAddress,
      programId: market.programId,
      matcherProgramId: market.matcherProgramId,
      oracleAddress: market.oracleAddress || '',
    });
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingMarket({
      ...emptyForm,
      id: `market-${Date.now()}`,
    });
    setIsEditing(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-700">
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors",
              activeTab === 'general' 
                ? "text-primary-400 border-b-2 border-primary-400" 
                : "text-gray-400 hover:text-white"
            )}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors",
              activeTab === 'markets' 
                ? "text-primary-400 border-b-2 border-primary-400" 
                : "text-gray-400 hover:text-white"
            )}
          >
            Markets
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-dark-900/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Server className="w-5 h-5 text-primary-400" />
                  <h3 className="font-medium text-white">RPC Configuration</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Custom RPC URL (Optional)</label>
                    <input
                      type="text"
                      value={customRpcUrl}
                      onChange={(e) => setCustomRpcUrl(e.target.value)}
                      placeholder="https://api.mainnet-beta.solana.com"
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {customRpcUrl ?
                        'Using your custom RPC endpoint' :
                        'Leave empty to use default RPC. Recommended providers: Helius, QuickNode, Alchemy'
                      }
                    </p>
                  </div>
                  {customRpcUrl && (
                    <button
                      onClick={() => setCustomRpcUrl('')}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear custom RPC
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-dark-900/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 text-primary-400" />
                  <h3 className="font-medium text-white">Auto-refresh</h3>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Refresh Interval (ms)
                  </label>
                  <input
                    type="text"
                    value={refreshInterval}
                    readOnly
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-300 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Current: {refreshInterval / 1000} seconds
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'markets' && (
            <div className="space-y-4">
              {!isEditing ? (
                <>
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-white">Configured Markets</h3>
                    <button
                      onClick={handleAddNew}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Market
                    </button>
                  </div>

                  <div className="space-y-2">
                    {markets.map((market) => (
                      <div
                        key={market.id}
                        className="flex items-center justify-between p-4 bg-dark-900/50 rounded-lg hover:bg-dark-900 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{market.name}</span>
                            <span className="text-xs text-gray-500">({market.id})</span>
                            {isDefaultMarket(market.id) && (
                              <span className="px-2 py-0.5 text-xs bg-primary-900/50 text-primary-300 border border-primary-700/50 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{market.description}</p>
                          <div className="mt-1 flex gap-2 text-xs text-gray-500">
                            <span>SLAB: {formatAddress(market.slabAddress)}</span>
                            <span>•</span>
                            <span>Token: {formatAddress(market.tokenAddress)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditMarket(market)}
                            className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-colors"
                            title={isDefaultMarket(market.id) ? "View market details" : "Edit market"}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!isDefaultMarket(market.id) && (
                            <button
                              onClick={() => handleDeleteMarket(market.id)}
                              className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete market"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bg-dark-900/50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">
                      {markets.find(m => m.id === editingMarket.id) ? 'Edit Market' : 'Add Market'}
                    </h3>
                    {isDefaultMarket(editingMarket.id) && (
                      <span className="px-2 py-1 text-xs bg-primary-900/50 text-primary-300 border border-primary-700/50 rounded">
                        Default Market (View Only)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">ID</label>
                      <input
                        type="text"
                        value={editingMarket.id}
                        onChange={(e) => setEditingMarket({ ...editingMarket, id: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm"
                        placeholder="unique-id"
                        readOnly={isDefaultMarket(editingMarket.id)}
                        disabled={isDefaultMarket(editingMarket.id)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={editingMarket.name}
                        onChange={(e) => setEditingMarket({ ...editingMarket, name: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm"
                        placeholder="Market Name"
                        readOnly={isDefaultMarket(editingMarket.id)}
                        disabled={isDefaultMarket(editingMarket.id)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <input
                      type="text"
                      value={editingMarket.description}
                      onChange={(e) => setEditingMarket({ ...editingMarket, description: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm"
                      placeholder="Market description"
                      readOnly={isDefaultMarket(editingMarket.id)}
                      disabled={isDefaultMarket(editingMarket.id)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">SLAB Address</label>
                    <input
                      type="text"
                      value={editingMarket.slabAddress}
                      onChange={(e) => setEditingMarket({ ...editingMarket, slabAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm font-mono"
                      placeholder="11111111111111111111111111111111"
                      readOnly={isDefaultMarket(editingMarket.id)}
                      disabled={isDefaultMarket(editingMarket.id)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Token Address</label>
                    <input
                      type="text"
                      value={editingMarket.tokenAddress}
                      onChange={(e) => setEditingMarket({ ...editingMarket, tokenAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm font-mono"
                      placeholder="So11111111111111111111111111111111111111112"
                      readOnly={isDefaultMarket(editingMarket.id)}
                      disabled={isDefaultMarket(editingMarket.id)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Program ID</label>
                    <input
                      type="text"
                      value={editingMarket.programId}
                      onChange={(e) => setEditingMarket({ ...editingMarket, programId: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm font-mono"
                      placeholder="Program ID"
                      readOnly={isDefaultMarket(editingMarket.id)}
                      disabled={isDefaultMarket(editingMarket.id)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Matcher Program ID</label>
                    <input
                      type="text"
                      value={editingMarket.matcherProgramId}
                      onChange={(e) => setEditingMarket({ ...editingMarket, matcherProgramId: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm font-mono"
                      placeholder="Matcher Program ID"
                      readOnly={isDefaultMarket(editingMarket.id)}
                      disabled={isDefaultMarket(editingMarket.id)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Oracle Address (optional)</label>
                    <input
                      type="text"
                      value={editingMarket.oracleAddress}
                      onChange={(e) => setEditingMarket({ ...editingMarket, oracleAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm font-mono"
                      placeholder="Oracle Address"
                      readOnly={isDefaultMarket(editingMarket.id)}
                      disabled={isDefaultMarket(editingMarket.id)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-dark-700">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditingMarket(emptyForm);
                      }}
                      className="px-4 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 transition-colors"
                    >
                      {isDefaultMarket(editingMarket.id) ? 'Close' : 'Cancel'}
                    </button>
                    {!isDefaultMarket(editingMarket.id) && (
                      <button
                        onClick={handleSaveMarket}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        Save Market
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

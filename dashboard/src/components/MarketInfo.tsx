'use client';

import { MarketConfig } from '@/types';
import { formatAddress } from '@/lib/utils';
import { 
  ExternalLink, 
  Copy, 
  Check,
  Database,
  Building2,
  Puzzle,
  Coins,
  Landmark,
  Tag,
  TrendingUp
} from 'lucide-react';
import { useState } from 'react';

interface MarketInfoProps {
  market: MarketConfig;
}

function CopyableAddress({ address, label, icon: Icon }: { 
  address: string; 
  label: string;
  icon: React.ElementType;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="py-3 border-b border-dark-700 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="bg-dark-700 px-2 py-1 rounded text-gray-300 font-mono text-xs break-all max-w-[325px] overflow-hidden text-ellipsis">
          {address}
        </code>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-dark-600 text-gray-500 hover:text-white transition-colors flex-shrink-0"
          title="Copy address"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
        <a
          href={`https://solscan.io/account/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-dark-600 text-gray-500 hover:text-primary-400 transition-colors flex-shrink-0"
          title="View on Solscan"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export function MarketInfo({ market }: MarketInfoProps) {
  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-dark-700">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">{market.name}</h2>
        </div>
        <p className="text-sm text-gray-400">{market.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/30 rounded text-xs text-yellow-400">
            <TrendingUp className="w-3 h-3" />
            Trading {market.underlyingSymbol || 'LIQUID'}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-900/30 rounded text-xs text-primary-400">
            <Coins className="w-3 h-3" />
            Collateral: {market.collateralSymbol || 'SOL'}
          </span>
        </div>
      </div>
      
      <div className="p-6 space-y-1">
        <CopyableAddress 
          address={market.slabAddress} 
          label="SLAB Address"
          icon={Database}
        />
        <CopyableAddress 
          address={market.tokenAddress} 
          label="Collateral Token"
          icon={Coins}
        />
        {market.underlyingAssetAddress && (
          <CopyableAddress 
            address={market.underlyingAssetAddress} 
            label="Underlying Asset"
            icon={TrendingUp}
          />
        )}
        <CopyableAddress 
          address={market.programId} 
          label="Program ID"
          icon={Building2}
        />
        <CopyableAddress 
          address={market.matcherProgramId} 
          label="Matcher Program ID"
          icon={Puzzle}
        />
        {market.oracleAddress && (
          <CopyableAddress 
            address={market.oracleAddress} 
            label="Oracle Address"
            icon={Landmark}
          />
        )}
      </div>
    </div>
  );
}

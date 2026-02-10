'use client';

import { AlertTriangle, ExternalLink, HelpCircle } from 'lucide-react';
import { formatAddress } from '@/lib/utils';

interface SlabWarningProps {
  slabAddress: string;
  discriminator: string;
  dataSize: number;
}

export function SlabWarning({ slabAddress, discriminator, dataSize }: SlabWarningProps) {
  return (
    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-yellow-400 mb-2">Slab Data Format Mismatch</h3>
          <p className="text-sm text-yellow-200/80 mb-3">
            The account data format doesn't match the expected Percolator RiskEngine struct. 
            The values parsed are unrealistically large, suggesting a different data layout.
          </p>
          
          <div className="bg-yellow-950/30 rounded-lg p-3 mb-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-yellow-500">Discriminator:</span>
              <code className="font-mono text-yellow-300">{discriminator}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-500">Data Size:</span>
              <span className="text-yellow-300">{dataSize.toLocaleString()} bytes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-500">Slab Address:</span>
              <a 
                href={`https://explorer.solana.com/address/${slabAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-yellow-300 hover:text-yellow-200 flex items-center gap-1"
              >
                {formatAddress(slabAddress, 6)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="space-y-2 text-sm text-yellow-200/70">
            <p className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Please verify:
                <ol className="list-decimal ml-5 mt-1 space-y-1">
                  <li>The SLAB_ADDRESS is the correct RiskEngine account</li>
                  <li>The PROGRAM_ID matches the deployed Percolator program</li>
                  <li>The deployed program version matches this dashboard's expected format</li>
                </ol>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

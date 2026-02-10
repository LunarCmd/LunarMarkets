'use client';

import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { LoadingState } from '@/types';
import { cn } from '@/lib/utils';

interface RefreshIndicatorProps {
  loadingState: LoadingState;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function RefreshIndicator({ loadingState, lastUpdated, onRefresh }: RefreshIndicatorProps) {
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';

    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();

    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">
        Last updated: {formatLastUpdated()}
      </span>
    </div>
  );
}

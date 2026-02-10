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
  const getStatusIcon = () => {
    switch (loadingState) {
      case 'loading':
        return <RefreshCw className="w-4 h-4 animate-spin text-primary-400" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <RefreshCw className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (loadingState) {
      case 'loading':
        return 'Updating...';
      case 'success':
        return 'Up to date';
      case 'error':
        return 'Update failed';
      default:
        return 'Idle';
    }
  };

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
    <div className="flex items-center gap-4">
      <button
        onClick={onRefresh}
        disabled={loadingState === 'loading'}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
          "bg-dark-700 hover:bg-dark-600 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <RefreshCw className={cn(
          "w-4 h-4",
          loadingState === 'loading' && "animate-spin"
        )} />
        Refresh
      </button>

      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon()}
        <span className={cn(
          "text-gray-400",
          loadingState === 'success' && "text-green-400",
          loadingState === 'error' && "text-red-400"
        )}>
          {getStatusText()}
        </span>
        <span className="text-gray-600">•</span>
        <span className="text-gray-500">
          Last updated: {formatLastUpdated()}
        </span>
      </div>
    </div>
  );
}

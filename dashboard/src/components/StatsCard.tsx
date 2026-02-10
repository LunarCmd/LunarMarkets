'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  isLoading?: boolean;
}

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  className,
  isLoading = false 
}: StatsCardProps) {
  return (
    <div className={cn(
      "bg-dark-800 rounded-xl border border-dark-700 p-6",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <div className="mt-2">
            {isLoading ? (
              <div className="h-8 w-32 bg-dark-700 animate-pulse rounded" />
            ) : (
              <p className="text-2xl font-bold text-white">{value}</p>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-dark-700 text-primary-400">
          {icon}
        </div>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium",
            trend.isPositive ? "text-green-400" : "text-red-400"
          )}>
            {trend.isPositive ? '+' : ''}{trend.value.toFixed(2)}%
          </span>
          <span className="text-sm text-gray-500">vs last period</span>
        </div>
      )}
    </div>
  );
}

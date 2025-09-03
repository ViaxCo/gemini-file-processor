import React from 'react';
import { AlertTriangle, RefreshCw, Info, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useQuotaMonitoring } from '@/hooks/useQuotaMonitoring';

interface QuotaMonitorProps {
  projectNumber?: string;
  model?: string; // The currently selected Gemini model
  isModelLoaded?: boolean; // Add this line
  className?: string;
  showRefreshButton?: boolean;
  autoRefresh?: boolean;
  variant?: 'card' | 'toolbar';
}

export function QuotaMonitor({
  projectNumber,
  model,
  isModelLoaded, // Add this line
  className,
  showRefreshButton = true,
  autoRefresh = true,
  variant = 'card',
}: QuotaMonitorProps) {
  const { data, loading, error, lastUpdated, refresh, isNearLimit, isAtLimit, remainingRequests } =
    useQuotaMonitoring({
      projectNumber,
      model,
      isModelLoaded, // Add this line
      autoRefresh,
      refreshInterval: 5 * 60 * 1000, // 5 minutes
    });

  if (!projectNumber) {
    if (variant === 'toolbar') {
      return (
        <div className={className}>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Info size={14} />
            <span>Quota: add project number</span>
          </div>
        </div>
      );
    }
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info size={16} />
            <span className="text-sm">Project number required for quota monitoring</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    if (variant === 'toolbar') {
      return (
        <div className={className}>
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle size={14} />
            <span>Error loading quota</span>
            {showRefreshButton && (
              <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="h-6 px-1">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </Button>
            )}
          </div>
        </div>
      );
    }
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-destructive" />
            Quota Monitor Error
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-3 text-sm text-destructive">{error}</p>
          {showRefreshButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'toolbar') {
    if (loading && !data) {
      return (
        <div className={className}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap size={14} />
            <span>Loading quota…</span>
          </div>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <span className="inline-flex items-center gap-1 text-xs">
          <Zap size={14} />
          {data ? (
            <>
              <span>{data.currentUsage}/{data.dailyLimit}</span>
              <Badge variant={isAtLimit ? 'destructive' : isNearLimit ? 'outline' : 'secondary'} className="text-[10px] px-1">
                {data.usagePercentage}%
              </Badge>
            </>
          ) : (
            <span className="text-muted-foreground">No data</span>
          )}
        </span>
        {showRefreshButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-6 w-6 p-0"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap size={16} />
            API Quota Usage
          </CardTitle>
          {showRefreshButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && !data ? (
          <div className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            {/* Usage Statistics */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Daily Usage</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {data.currentUsage} / {data.dailyLimit}
                </span>
                <Badge
                  variant={isAtLimit ? 'destructive' : isNearLimit ? 'outline' : 'secondary'}
                  className="text-xs"
                >
                  {data.usagePercentage}%
                </Badge>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <Progress value={data.usagePercentage} className="h-2" />
              <div
                className={`absolute inset-y-0 left-0 h-2 rounded-full transition-all ${
                  isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-orange-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(data.usagePercentage, 100)}%` }}
              />
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <span className="block">Remaining</span>
                <span className="font-medium text-foreground">{remainingRequests} requests</span>
              </div>
              <div>
                <span className="block">Model</span>
                <span className="font-medium text-foreground">{data.model}</span>
              </div>
            </div>

            {/* Warning Messages */}
            {isAtLimit && (
              <div className="flex items-start gap-2 rounded bg-destructive/10 p-2 text-xs">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-destructive" />
                <span className="text-destructive">
                  Daily quota limit reached. Consider upgrading to paid tier.
                </span>
              </div>
            )}

            {isNearLimit && !isAtLimit && (
              <div className="flex items-start gap-2 rounded bg-orange-50 p-2 text-xs dark:bg-orange-950/20">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-orange-600" />
                <span className="text-orange-700 dark:text-orange-400">
                  Approaching daily quota limit ({data.usagePercentage}% used).
                </span>
              </div>
            )}

            {/* Real Data Notice */}
            <div className="border-t pt-1 text-xs text-muted-foreground">
              <span className="text-green-600">✓ Live data</span> from Google Cloud monitoring
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="text-xs text-muted-foreground">
                Updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

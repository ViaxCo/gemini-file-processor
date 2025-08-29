import { useState, useEffect, useCallback } from 'react';

interface QuotaUsageData {
  currentUsage: number;
  dailyLimit: number;
  usagePercentage: number;
  model: string;
}

interface QuotaMonitoringState {
  data: QuotaUsageData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface UseQuotaMonitoringOptions {
  projectNumber?: string;
  model?: string; // The selected Gemini model
  isModelLoaded?: boolean; // Whether the model is loaded from storage
  refreshInterval?: number; // in milliseconds, default 5 minutes
  autoRefresh?: boolean;
}

export function useQuotaMonitoring({
  projectNumber,
  model,
  isModelLoaded,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
  autoRefresh = true,
}: UseQuotaMonitoringOptions = {}) {
  const [state, setState] = useState<QuotaMonitoringState>({
    data: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const fetchQuotaData = useCallback(async () => {
    if (!projectNumber) {
      setState((prev) => ({ ...prev, error: 'Project number is required', loading: false }));
      return;
    }

    if (!model) {
      setState((prev) => ({ ...prev, error: 'Model is required', loading: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(
        `/api/quota?projectNumber=${projectNumber}&model=${encodeURIComponent(model)}`,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: QuotaUsageData = await response.json();

      setState({
        data,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch quota data',
      }));
    }
  }, [projectNumber, model]);

  const refresh = useCallback(() => {
    if (isModelLoaded) {
      fetchQuotaData();
    }
  }, [fetchQuotaData, isModelLoaded]);

  // Initial fetch - only when model is loaded from storage
  useEffect(() => {
    if (projectNumber && model && isModelLoaded) {
      fetchQuotaData();
    }
  }, [projectNumber, model, isModelLoaded, fetchQuotaData]);

  // Auto refresh interval
  useEffect(() => {
    if (!autoRefresh || !projectNumber || !model || !isModelLoaded) return;

    const intervalId = setInterval(fetchQuotaData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, projectNumber, model, isModelLoaded, refreshInterval, fetchQuotaData]);

  return {
    ...state,
    refresh,
    isNearLimit: state.data ? state.data.usagePercentage >= 80 : false,
    isAtLimit: state.data ? state.data.usagePercentage >= 95 : false,
    remainingRequests: state.data
      ? Math.max(0, state.data.dailyLimit - state.data.currentUsage)
      : 0,
  };
}

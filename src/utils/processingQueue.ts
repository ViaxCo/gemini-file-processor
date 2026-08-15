import type { ProcessingFailure } from '@/services/processingErrors';

export const ACTIVE_REQUEST_LIMIT = 3;
export const PROVIDER_FAILURE_PAUSE_THRESHOLD = 3;

export function canRetryProcessingResult(result: {
  isCompleted: boolean;
  isProcessing: boolean;
  error?: unknown;
  queueStatus?: string;
}) {
  if (result.isProcessing || result.queueStatus === 'pending') return false;
  return result.isCompleted || !!result.error || result.queueStatus === 'cancelled';
}

export function getQueueProgress(
  results: ReadonlyArray<{
    isCompleted: boolean;
    isProcessing: boolean;
    error?: unknown;
    queueStatus?: string;
  }>,
) {
  let completed = 0;
  let active = 0;
  let failed = 0;
  let cancelled = 0;
  let waiting = 0;

  for (const result of results) {
    if (result.error) failed += 1;
    else if (result.queueStatus === 'cancelled') cancelled += 1;
    else if (result.isCompleted) completed += 1;
    else if (result.isProcessing) active += 1;
    else waiting += 1;
  }

  return {
    total: results.length,
    completed,
    active,
    waiting,
    failed,
    cancelled,
    settled: completed + failed + cancelled,
  };
}

export function estimateRemainingSeconds(
  progress: ReturnType<typeof getQueueProgress>,
  averageRequestDurationMs: number | undefined,
  rateLimit: { limit: number; interval: number },
) {
  if (!averageRequestDurationMs || progress.settled < 3) return;
  if (progress.waiting === 0 && progress.active === 0) return 0;

  const requestStartInterval = rateLimit.interval / Math.max(1, rateLimit.limit);
  const concurrencyInterval = averageRequestDurationMs / ACTIVE_REQUEST_LIMIT;
  const effectiveInterval = Math.max(requestStartInterval, concurrencyInterval);
  const activeTail = progress.active > 0 ? averageRequestDurationMs : 0;

  return Math.ceil((progress.waiting * effectiveInterval + activeTail) / 1000);
}

export function isImmediateProviderWideFailure(failure: ProcessingFailure) {
  return ['authentication', 'daily_quota', 'model_unavailable'].includes(failure.category);
}

export function isRepeatedProviderWideFailure(failure: ProcessingFailure) {
  return ['overloaded', 'network', 'server_error'].includes(failure.category);
}

export function getProviderFailureSignature(failure: ProcessingFailure) {
  return [failure.category, failure.httpStatus ?? '', failure.providerCode ?? ''].join(':');
}

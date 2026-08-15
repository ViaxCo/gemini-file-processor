import { describe, expect, it } from 'vitest';
import {
  ACTIVE_REQUEST_LIMIT,
  estimateRemainingSeconds,
  getProviderFailureSignature,
  getQueueProgress,
  isImmediateProviderWideFailure,
} from './processingQueue';
import type { ProcessingFailure } from '@/services/processingErrors';

const failure = (category: ProcessingFailure['category']): ProcessingFailure => ({
  kind: category === 'daily_quota' ? 'deferred' : 'permanent',
  category,
  title: 'Test failure',
  message: 'Test failure',
  provider: 'test',
  model: 'test-success',
  technicalMessage: 'Test failure',
  retryable: false,
  recoveryAction: 'retry',
  httpStatus: 429,
  providerCode: 'TEST',
});

describe('processing queue policy', () => {
  it('counts every queue state once', () => {
    expect(
      getQueueProgress([
        { isCompleted: true, isProcessing: false },
        { isCompleted: false, isProcessing: true },
        { isCompleted: false, isProcessing: false },
        { isCompleted: false, isProcessing: false, error: new Error('failed') },
        { isCompleted: false, isProcessing: false, queueStatus: 'cancelled' },
      ]),
    ).toEqual({
      total: 5,
      completed: 1,
      active: 1,
      waiting: 1,
      failed: 1,
      cancelled: 1,
      settled: 3,
    });
  });

  it('uses both provider rate and active request limits for the estimate', () => {
    const progress = {
      total: 13,
      completed: 3,
      active: ACTIVE_REQUEST_LIMIT,
      waiting: 7,
      failed: 0,
      cancelled: 0,
      settled: 3,
    };

    expect(estimateRemainingSeconds(progress, 3_000, { limit: 5, interval: 60_000 })).toBe(87);
  });

  it('waits for three settled files before estimating', () => {
    const progress = {
      total: 4,
      completed: 2,
      active: 1,
      waiting: 1,
      failed: 0,
      cancelled: 0,
      settled: 2,
    };

    expect(
      estimateRemainingSeconds(progress, 1_000, { limit: 10, interval: 60_000 }),
    ).toBeUndefined();
  });

  it.each(['authentication', 'daily_quota', 'model_unavailable'] as const)(
    'pauses immediately for %s',
    (category) => {
      expect(isImmediateProviderWideFailure(failure(category))).toBe(true);
    },
  );

  it('does not immediately pause for one temporary failure', () => {
    expect(isImmediateProviderWideFailure(failure('overloaded'))).toBe(false);
  });

  it('builds a stable provider failure signature', () => {
    expect(getProviderFailureSignature(failure('daily_quota'))).toBe('daily_quota:429:TEST');
  });
});

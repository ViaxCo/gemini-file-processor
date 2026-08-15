import { describe, expect, it } from 'vitest';
import {
  createProviderRequestError,
  getRetryDelayMs,
  toProcessingFailure,
} from './processingErrors';

describe('processing errors', () => {
  it('recognizes a short-term Gemini rate limit and its retry delay', () => {
    const error = createProviderRequestError(429, {
      error: {
        message: 'Quota exceeded for requests per minute.',
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }],
          },
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '39s',
          },
        ],
      },
    });

    const failure = toProcessingFailure(error, 'gemini', 'gemini-2.5-flash');

    expect(failure).toMatchObject({
      category: 'rate_limit',
      retryable: true,
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      retryAfterMs: 39_000,
    });
  });

  it('does not automatically retry an identified daily quota', () => {
    const error = createProviderRequestError(429, {
      error: {
        message: 'Daily quota reached.',
        status: 'RESOURCE_EXHAUSTED',
        details: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
      },
    });

    expect(toProcessingFailure(error, 'gemini', 'gemini-2.5-flash')).toMatchObject({
      category: 'daily_quota',
      kind: 'deferred',
      retryable: false,
      recoveryAction: 'retry_later',
    });
  });

  it('recognizes an invalid Gemini API key even when the HTTP status is 400', () => {
    const error = createProviderRequestError(400, {
      error: {
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
        details: [{ reason: 'API_KEY_INVALID' }],
      },
    });

    expect(toProcessingFailure(error, 'gemini', 'gemini-2.5-flash')).toMatchObject({
      category: 'authentication',
      retryable: false,
      recoveryAction: 'check_api_key',
    });
  });

  it('automatically retries blocked content and allows a manual retry afterward', () => {
    const error = createProviderRequestError(400, {
      error: {
        message: 'The provider blocked this content.',
        status: 'SAFETY',
      },
    });

    expect(toProcessingFailure(error, 'gemini', 'gemini-2.5-flash')).toMatchObject({
      category: 'content_blocked',
      kind: 'temporary',
      retryable: true,
      recoveryAction: 'retry',
    });
  });

  it.each([
    [503, 'UNAVAILABLE', 'overloaded'],
    [408, 'DEADLINE_EXCEEDED', 'timeout'],
    [500, 'INTERNAL', 'server_error'],
    [404, 'NOT_FOUND', 'model_unavailable'],
  ])('classifies HTTP %i as %s', (status, providerCode, category) => {
    const error = createProviderRequestError(status, {
      error: { message: 'Provider message', status: providerCode },
    });

    expect(toProcessingFailure(error, 'gemini', 'gemini-2.5-flash').category).toBe(category);
  });

  it('recognizes a network failure without an HTTP response', () => {
    const failure = toProcessingFailure(
      new TypeError('Failed to fetch'),
      'gemini',
      'gemini-2.5-flash',
    );

    expect(failure).toMatchObject({ category: 'network', retryable: true });
  });

  it('redacts API keys from safe technical details', () => {
    const failure = toProcessingFailure(
      new Error('Request failed with key=AIza123456789012345678901234567890'),
      'gemini',
      'gemini-2.5-flash',
    );

    expect(failure.technicalMessage).toBe('Request failed with key=[redacted]');
  });

  it('redacts request URLs from safe technical details', () => {
    const failure = toProcessingFailure(
      new Error('Request failed at https://example.com/generate?key=secret'),
      'gemini',
      'gemini-2.5-flash',
    );

    expect(failure.technicalMessage).toBe('Request failed at [redacted URL]');
  });

  it('uses exponential backoff with jitter and a longer provider delay', () => {
    const failure = toProcessingFailure(
      createProviderRequestError(503, { error: { message: 'Unavailable' } }, '10'),
      'gemini',
      'gemini-2.5-flash',
    );

    expect(getRetryDelayMs(failure, 0, () => 1)).toBe(10_000);
    expect(getRetryDelayMs({ ...failure, retryAfterMs: undefined }, 1, () => 1)).toBe(2_500);
  });
});

import type { AIProvider } from '@/config/providerConfig';

export const MAX_PROCESSING_ATTEMPTS = 4;

export type ProcessingFailureCategory =
  | 'rate_limit'
  | 'daily_quota'
  | 'overloaded'
  | 'network'
  | 'timeout'
  | 'authentication'
  | 'invalid_request'
  | 'model_unavailable'
  | 'content_blocked'
  | 'invalid_response'
  | 'server_error'
  | 'unknown';

export type ProcessingFailure = {
  kind: 'temporary' | 'deferred' | 'permanent';
  category: ProcessingFailureCategory;
  title: string;
  message: string;
  provider: AIProvider;
  model: string;
  technicalMessage: string;
  retryable: boolean;
  httpStatus?: number;
  providerCode?: string;
  retryAfterMs?: number;
  quotaType?: 'rpm' | 'tpm' | 'rpd' | 'unknown';
};

export const PROCESSING_FAILURE_LABELS: Record<ProcessingFailureCategory, string> = {
  rate_limit: 'rate limited',
  daily_quota: 'daily quota',
  overloaded: 'overloaded',
  network: 'network error',
  timeout: 'timeout',
  authentication: 'API key error',
  invalid_request: 'invalid request',
  model_unavailable: 'model unavailable',
  content_blocked: 'content blocked',
  invalid_response: 'invalid response',
  server_error: 'provider error',
  unknown: 'unknown error',
};

type ProviderRequestErrorOptions = {
  message: string;
  httpStatus?: number;
  providerCode?: string;
  evidence?: string;
  retryAfterMs?: number;
};

export class ProviderRequestError extends Error {
  readonly httpStatus?: number;
  readonly providerCode?: string;
  readonly evidence?: string;
  readonly retryAfterMs?: number;

  constructor(options: ProviderRequestErrorOptions) {
    super(options.message);
    this.name = 'ProviderRequestError';
    this.httpStatus = options.httpStatus;
    this.providerCode = options.providerCode;
    this.evidence = options.evidence;
    this.retryAfterMs = options.retryAfterMs;
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
};

const safeStringify = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

const parseDurationMs = (value: unknown): number | undefined => {
  const duration = asString(value)?.trim();
  if (!duration) return undefined;

  const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s)$/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  return match[2]?.toLowerCase() === 's' ? amount * 1000 : amount;
};

const findRetryDelayMs = (value: unknown): number | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findRetryDelayMs(item);
      if (match !== undefined) return match;
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) return undefined;
  const direct = parseDurationMs(record.retryDelay);
  if (direct !== undefined) return direct;

  for (const nested of Object.values(record)) {
    const match = findRetryDelayMs(nested);
    if (match !== undefined) return match;
  }
};

const parseRetryAfterHeader = (value?: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

export function createProviderRequestError(
  httpStatus: number | undefined,
  payload: unknown,
  retryAfterHeader?: string | null,
): ProviderRequestError {
  const root = asRecord(payload);
  const body = asRecord(root?.error) ?? root;
  const message =
    asString(body?.message) ?? `Provider request failed${httpStatus ? ` (${httpStatus})` : ''}`;
  const rawCode = body?.status ?? body?.type ?? body?.code;
  const providerCode =
    typeof rawCode === 'number' || rawCode === httpStatus ? undefined : asString(rawCode);
  const evidence = safeStringify(body?.details ?? body);
  const retryAfterMs = findRetryDelayMs(body?.details) ?? parseRetryAfterHeader(retryAfterHeader);

  return new ProviderRequestError({
    message,
    httpStatus,
    providerCode,
    evidence,
    retryAfterMs,
  });
}

const sanitizeProviderMessage = (message: string): string =>
  message
    .replace(/\bhttps?:\/\/[^\s]+/gi, '[redacted URL]')
    .replace(/(\bkey=)[^&\s]+/gi, '$1[redacted]')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[redacted API key]')
    .replace(/(\bBearer\s+)[A-Za-z0-9._~-]+/gi, '$1[redacted]')
    .replace(/(api[\s_-]?key\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');

const describeFailure = (
  category: ProcessingFailureCategory,
): Pick<ProcessingFailure, 'kind' | 'title' | 'message' | 'retryable'> => {
  switch (category) {
    case 'rate_limit':
      return {
        kind: 'temporary',
        title: 'Rate limited',
        message: 'The provider is limiting requests.',
        retryable: true,
      };
    case 'daily_quota':
      return {
        kind: 'deferred',
        title: 'Daily quota reached',
        message: 'The provider daily quota has been reached.',
        retryable: false,
      };
    case 'overloaded':
      return {
        kind: 'temporary',
        title: 'Model overloaded',
        message: 'The selected model is temporarily overloaded.',
        retryable: true,
      };
    case 'network':
      return {
        kind: 'temporary',
        title: 'Network error',
        message: 'The provider could not be reached.',
        retryable: true,
      };
    case 'timeout':
      return {
        kind: 'temporary',
        title: 'Request timed out',
        message: 'The provider took too long to respond.',
        retryable: true,
      };
    case 'authentication':
      return {
        kind: 'permanent',
        title: 'API key problem',
        message: 'The API key is invalid or does not have access.',
        retryable: false,
      };
    case 'invalid_request':
      return {
        kind: 'permanent',
        title: 'Invalid request',
        message: 'The provider rejected the request.',
        retryable: false,
      };
    case 'model_unavailable':
      return {
        kind: 'permanent',
        title: 'Model unavailable',
        message: 'The selected model is unavailable.',
        retryable: false,
      };
    case 'content_blocked':
      return {
        kind: 'temporary',
        title: 'Content blocked',
        message: 'The provider blocked this request or its output.',
        retryable: true,
      };
    case 'invalid_response':
      return {
        kind: 'temporary',
        title: 'Invalid response',
        message: 'The provider returned no usable content.',
        retryable: true,
      };
    case 'server_error':
      return {
        kind: 'temporary',
        title: 'Provider error',
        message: 'The provider had a temporary server error.',
        retryable: true,
      };
    default:
      return {
        kind: 'permanent',
        title: 'Unknown error',
        message: 'The request failed for an unknown reason.',
        retryable: false,
      };
  }
};

const classifyFailure = (
  error: Error,
  httpStatus?: number,
  providerCode?: string,
  evidence?: string,
): ProcessingFailureCategory => {
  const signal = `${providerCode ?? ''} ${error.message} ${evidence ?? ''}`.toLowerCase();

  if (/safety|recitation|prohibited_content|content[_\s-]?blocked|blocklist|spii/.test(signal)) {
    return 'content_blocked';
  }
  if (
    httpStatus === 403 &&
    /model.{0,30}(?:not[_\s-]?found|does not exist|not supported|unavailable)/.test(signal)
  ) {
    return 'model_unavailable';
  }
  if (
    /api[_\s-]?key[_\s-]?invalid|invalid api key|authentication|unauthori[sz]ed|permission_denied/.test(
      signal,
    ) ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return 'authentication';
  }
  if (httpStatus === 429) {
    return /per.?day|daily|requestsperday|tokensperday|permodelperday/.test(signal)
      ? 'daily_quota'
      : 'rate_limit';
  }
  if (
    httpStatus === 503 ||
    providerCode?.toUpperCase() === 'UNAVAILABLE' ||
    /overload|model[_\s-]?capacity[_\s-]?exhausted/.test(signal)
  ) {
    return 'overloaded';
  }
  if (
    httpStatus === 408 ||
    httpStatus === 504 ||
    error.name === 'TimeoutError' ||
    /timed?\s*out|timeout|deadline_exceeded/.test(signal)
  ) {
    return 'timeout';
  }
  if (
    error instanceof TypeError ||
    /network|failed to fetch|connection (?:failed|lost|reset)|offline/.test(signal)
  ) {
    return 'network';
  }
  if (
    httpStatus === 404 ||
    /model.{0,30}(?:not[_\s-]?found|does not exist|not supported|unavailable)/.test(signal)
  ) {
    return 'model_unavailable';
  }
  if (httpStatus === 400 || /invalid_argument|invalid_request|bad request/.test(signal)) {
    return 'invalid_request';
  }
  if (/no response body|no content received|no usable content|invalid response/.test(signal)) {
    return 'invalid_response';
  }
  if (httpStatus !== undefined && httpStatus >= 500) return 'server_error';
  return 'unknown';
};

const classifyQuotaType = (
  category: ProcessingFailureCategory,
  providerCode?: string,
  evidence?: string,
): ProcessingFailure['quotaType'] => {
  if (category !== 'rate_limit' && category !== 'daily_quota') return undefined;
  const signal = `${providerCode ?? ''} ${evidence ?? ''}`.toLowerCase();
  if (/per.?day|requestsperday|tokensperday|permodelperday/.test(signal)) return 'rpd';
  if (/token.*per.?minute|inputtokenspermodelperminute|tpm/.test(signal)) return 'tpm';
  if (/request.*per.?minute|requestsperminute|rpm/.test(signal)) return 'rpm';
  return 'unknown';
};

export function toProcessingFailure(
  error: unknown,
  provider: AIProvider,
  model: string,
): ProcessingFailure {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const requestError = error instanceof ProviderRequestError ? error : undefined;
  const category = classifyFailure(
    normalizedError,
    requestError?.httpStatus,
    requestError?.providerCode,
    requestError?.evidence,
  );

  return {
    ...describeFailure(category),
    category,
    provider,
    model,
    technicalMessage: sanitizeProviderMessage(normalizedError.message),
    httpStatus: requestError?.httpStatus,
    providerCode: requestError?.providerCode,
    retryAfterMs: requestError?.retryAfterMs,
    quotaType: classifyQuotaType(category, requestError?.providerCode, requestError?.evidence),
  };
}

export function getRetryDelayMs(
  failure: ProcessingFailure,
  completedRetryCount: number,
  random = Math.random,
): number {
  const exponentialDelay = Math.min(60_000, 1000 * 2 ** completedRetryCount);
  const jitteredDelay = exponentialDelay + Math.round(exponentialDelay * 0.25 * random());
  return Math.max(jitteredDelay, failure.retryAfterMs ?? 0);
}

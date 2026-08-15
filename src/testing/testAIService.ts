import { createProviderRequestError } from '../services/processingErrors';

const providerError = (httpStatus: number, message: string, status: string, details?: unknown[]) =>
  createProviderRequestError(httpStatus, {
    error: { message, status, details },
  });

const TEST_ERRORS = {
  'test-rate-limited': () =>
    providerError(429, 'Test AI request rate limit reached.', 'RESOURCE_EXHAUSTED'),
  'test-daily-quota': () =>
    providerError(429, 'Test AI daily request quota reached.', 'RESOURCE_EXHAUSTED', [
      { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-TestTier' },
    ]),
  'test-overloaded': () => providerError(503, 'Test AI is temporarily overloaded.', 'UNAVAILABLE'),
  'test-network': () => new TypeError('Network request failed while contacting Test AI.'),
  'test-invalid-key': () =>
    providerError(400, 'Test AI key is invalid.', 'INVALID_ARGUMENT', [
      { reason: 'API_KEY_INVALID' },
    ]),
  'test-invalid-request': () =>
    providerError(400, 'Test AI rejected the request.', 'INVALID_ARGUMENT'),
  'test-content-blocked': () => providerError(400, 'Test AI blocked the content.', 'SAFETY'),
  'test-unknown': () => new Error('Unexpected Test AI failure.'),
} satisfies Record<string, () => Error>;

function mixedErrorModel(fileName: string): keyof typeof TEST_ERRORS | undefined {
  const checksum = [...fileName].reduce((total, character) => total + character.charCodeAt(0), 0);
  const models = Object.keys(TEST_ERRORS) as Array<keyof typeof TEST_ERRORS>;
  return checksum % 4 === 0 ? undefined : models[checksum % models.length];
}

export function getTestAIError(model: string, fileName: string, attempt = 1): Error | undefined {
  if (model === 'test-temporary' && attempt < 3) return TEST_ERRORS['test-overloaded']();
  const errorModel = model === 'test-mixed' ? mixedErrorModel(fileName) : model;
  if (!errorModel) return undefined;
  return TEST_ERRORS[errorModel as keyof typeof TEST_ERRORS]?.();
}

export async function processFileWithTestAI(
  fileName: string,
  fileContent: string,
  model: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  attempt = 1,
): Promise<void> {
  if (signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');

  const error = getTestAIError(model, fileName, attempt);
  if (error) throw error;

  const chunks =
    process.env.NODE_ENV !== 'production' && model === 'test-low-confidence'
      ? [`Test AI returned a short unrelated response for ${fileName}.`]
      : [`Test AI processed ${fileName}.\n\n`, fileContent];
  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');
    onChunk(chunk);
  }
}

const simulatedGeminiCalls = new Map<string, number>();

export function resetSimulatedGemini(): void {
  simulatedGeminiCalls.clear();
}

export async function processFileWithSimulatedGemini(
  fileName: string,
  fileContent: string,
  apiKey: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');
  const calls = simulatedGeminiCalls.get(apiKey) ?? 0;
  simulatedGeminiCalls.set(apiKey, calls + 1);

  if (apiKey.includes('invalid-key')) {
    throw providerError(403, 'Simulated Gemini API key is invalid.', 'PERMISSION_DENIED', [
      { reason: 'API_KEY_INVALID' },
    ]);
  }
  if (apiKey.includes('daily-limit')) {
    throw providerError(429, 'Simulated Gemini daily quota reached.', 'RESOURCE_EXHAUSTED', [
      { quotaId: 'GenerateContentRequestsPerDayPerProjectPerModel-FreeTier' },
    ]);
  }
  if (calls === 0 && apiKey.includes('rpm-once')) {
    throw providerError(429, 'Simulated Gemini RPM reached.', 'RESOURCE_EXHAUSTED', [
      { quotaId: 'GenerateContentRequestsPerMinutePerProjectPerModel-FreeTier' },
      { retryDelay: '1s' },
    ]);
  }
  if (calls === 0 && apiKey.includes('tpm-once')) {
    throw providerError(429, 'Simulated Gemini TPM reached.', 'RESOURCE_EXHAUSTED', [
      { quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier' },
      { retryDelay: '1s' },
    ]);
  }

  await new Promise((resolve) => setTimeout(resolve, 20));
  if (signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');
  onChunk(`Simulated Gemini processed ${fileName}.\n\n`);
  onChunk(fileContent);
}

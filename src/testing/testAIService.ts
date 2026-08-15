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

  const chunks = [`Test AI processed ${fileName}.\n\n`, fileContent];
  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');
    onChunk(chunk);
  }
}

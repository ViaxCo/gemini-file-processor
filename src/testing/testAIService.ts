const ERRORS: Record<string, string> = {
  'test-rate-limited': '429 RESOURCE_EXHAUSTED: Test AI request rate limit reached.',
  'test-overloaded': '503 UNAVAILABLE: Test AI is temporarily overloaded.',
  'test-network': 'Network request failed while contacting Test AI.',
};

function mixedError(fileName: string): string | undefined {
  const checksum = [...fileName].reduce((total, character) => total + character.charCodeAt(0), 0);
  if (checksum % 11 === 0) return ERRORS['test-network'];
  if (checksum % 7 === 0) return ERRORS['test-overloaded'];
  if (checksum % 5 === 0) return ERRORS['test-rate-limited'];
}

export function getTestAIError(model: string, fileName: string): string | undefined {
  return model === 'test-mixed' ? mixedError(fileName) : ERRORS[model];
}

export async function processFileWithTestAI(
  fileName: string,
  fileContent: string,
  model: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');

  const error = getTestAIError(model, fileName);
  if (error) throw new Error(error);

  const chunks = [`Test AI processed ${fileName}.\n\n`, fileContent];
  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');
    onChunk(chunk);
  }
}

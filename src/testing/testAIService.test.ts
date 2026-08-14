import { describe, expect, it, vi } from 'vitest';
import { getTestAIError, processFileWithTestAI } from './testAIService';

describe('Test AI', () => {
  it.each([
    ['test-rate-limited', '429 RESOURCE_EXHAUSTED'],
    ['test-overloaded', '503 UNAVAILABLE'],
    ['test-network', 'Network request failed'],
  ])('returns the expected %s failure', (model, message) => {
    expect(getTestAIError(model, 'test.txt')).toContain(message);
  });

  it('streams a successful local response', async () => {
    const onChunk = vi.fn();

    await processFileWithTestAI(
      'Bible+Doctrine+Track+1.txt',
      'Short fake transcript.',
      'test-success',
      onChunk,
    );

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls.flat().join('')).toContain('Short fake transcript.');
  });
});

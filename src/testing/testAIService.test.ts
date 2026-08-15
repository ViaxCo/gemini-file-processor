import { describe, expect, it, vi } from 'vitest';
import { getTestAIError, processFileWithTestAI } from './testAIService';

describe('Test AI', () => {
  it.each([
    ['test-rate-limited', 'rate limit'],
    ['test-overloaded', 'overloaded'],
    ['test-network', 'Network request failed'],
  ])('returns the expected %s failure', (model, message) => {
    expect(getTestAIError(model, 'test.txt')?.message).toContain(message);
  });

  it('recovers from the temporary test failure on the third attempt', () => {
    expect(getTestAIError('test-temporary', 'test.txt', 1)).toBeInstanceOf(Error);
    expect(getTestAIError('test-temporary', 'test.txt', 2)).toBeInstanceOf(Error);
    expect(getTestAIError('test-temporary', 'test.txt', 3)).toBeUndefined();
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

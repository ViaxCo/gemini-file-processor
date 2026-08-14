import { describe, expect, it } from 'vitest';
import { createTestFiles } from './testFiles';

describe('createTestFiles', () => {
  it.each([10, 50, 100] as const)('creates a repeatable batch of %i files', (count) => {
    const first = createTestFiles(count);
    const second = createTestFiles(count);

    expect(first).toHaveLength(count);
    expect(first.map((file) => file.name)).toEqual(second.map((file) => file.name));
    expect(new Set(first.map((file) => file.name)).size).toBe(count);
    expect(first.every((file) => file.type === 'text/plain' && file.size > 0)).toBe(true);
  });

  it('includes multiple series and a long filename', () => {
    const names = createTestFiles(50).map((file) => file.name);

    expect(names.some((name) => name.includes('Bible+Doctrine+on+Sin'))).toBe(true);
    expect(names.some((name) => name.includes('Binding+and+Loosing'))).toBe(true);
    expect(names).toContain('Bible+Doctrine+on+Sin+Track+4+4th+Jan+2024.txt');
    expect(Math.max(...names.map((name) => name.length))).toBeGreaterThan(80);
  });
});

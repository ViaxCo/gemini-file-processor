import { describe, expect, it } from 'vitest';
import { formatSeriesFolderName, suggestSeriesFolderName } from './driveFolderName';

describe('formatSeriesFolderName', () => {
  it('trims and uppercases a series folder name', () => {
    expect(formatSeriesFolderName('  Bible Doctrine on Sin  ')).toBe('BIBLE DOCTRINE ON SIN');
  });

  it('suggests the shared series title for selected tracks', () => {
    expect(
      suggestSeriesFolderName([
        'Bible Doctrine on Sin - Track 1',
        'Bible Doctrine on Sin - Track 2',
      ]),
    ).toBe('BIBLE DOCTRINE ON SIN');
  });

  it('does not suggest a folder name for mixed series', () => {
    expect(
      suggestSeriesFolderName(['Bible Doctrine on Sin - Track 1', 'Binding and Loosing - Track 1']),
    ).toBe('');
  });

  it('uses the complete Display Name for one file without a track number', () => {
    expect(suggestSeriesFolderName(['A Standalone Teaching.docx'])).toBe('A STANDALONE TEACHING');
  });

  it('keeps punctuation that is part of the series title', () => {
    expect(suggestSeriesFolderName(['Dr. Paul - Track 1', 'Dr. Paul - Track 2'])).toBe('DR. PAUL');
  });
});

import { describe, expect, it } from 'vitest';
import { applyBulkRenameRules, DEFAULT_BULK_RENAME_RULES } from './bulkRename';

describe('applyBulkRenameRules', () => {
  it('cleans a transcript track name', () => {
    expect(
      applyBulkRenameRules(
        'In+the+Spirit+By+the+Spirit+Series+7a+-+The+Power+of+the+Holy+Spirit+Track+6+6th+Jan+2021.txt',
        DEFAULT_BULK_RENAME_RULES,
      ),
    ).toBe('In the Spirit By the Spirit Series 7a - The Power of the Holy Spirit - Track 6');
  });

  it('does not damage an already cleaned name', () => {
    const cleaned = applyBulkRenameRules(
      'Bible+Doctrine+on+Sin+Track+1+1st+Jan+2024.txt',
      DEFAULT_BULK_RENAME_RULES,
    );

    expect(applyBulkRenameRules(cleaned, DEFAULT_BULK_RENAME_RULES)).toBe(cleaned);
  });

  it('treats a plain find value as plain text', () => {
    expect(
      applyBulkRenameRules('Part.1', {
        ...DEFAULT_BULK_RENAME_RULES,
        findPattern: '.',
        replacement: ' ',
        useRegex: false,
        removeInputExtension: false,
        formatTrackTitles: false,
      }),
    ).toBe('Part 1');
  });

  it('keeps the name usable while a regular expression is incomplete', () => {
    expect(
      applyBulkRenameRules('Teaching+Track+2.txt', {
        ...DEFAULT_BULK_RENAME_RULES,
        findPattern: '[',
      }),
    ).toBe('Teaching - Track 2');
  });
});

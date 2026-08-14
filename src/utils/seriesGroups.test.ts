import { describe, expect, it } from 'vitest';
import { groupFilesBySeries } from './seriesGroups';

describe('groupFilesBySeries', () => {
  it('sorts series alphabetically and tracks by number', () => {
    const groups = groupFilesBySeries([
      { index: 0, displayName: 'Bible Doctrine on Sin - Track 10' },
      { index: 1, displayName: 'Binding and Loosing - Track 2' },
      { index: 2, displayName: 'Bible Doctrine on Sin - Track 2' },
      { index: 3, displayName: 'Binding and Loosing - Track 1' },
      { index: 4, displayName: 'Bible Doctrine on Sin - Track 1' },
    ]);

    expect(groups.map((group) => group.title)).toEqual([
      'Bible Doctrine on Sin',
      'Binding and Loosing',
    ]);
    expect(groups[0]?.indices).toEqual([4, 2, 0]);
    expect(groups[1]?.indices).toEqual([3, 1]);
  });

  it('ignores capitalization and repeated spaces when matching', () => {
    const [group] = groupFilesBySeries([
      { index: 0, displayName: 'Bible  Doctrine on Sin - Track 1' },
      { index: 1, displayName: 'bible doctrine on sin - Track 2' },
    ]);

    expect(group?.indices).toEqual([0, 1]);
  });

  it('keeps punctuation differences in separate groups', () => {
    const groups = groupFilesBySeries([
      { index: 0, displayName: 'Faith for Life - Track 1' },
      { index: 1, displayName: 'Faith: for Life - Track 2' },
    ]);

    expect(groups).toHaveLength(2);
  });

  it('puts files without a clear track title in Ungrouped Files last', () => {
    const groups = groupFilesBySeries([
      { index: 0, displayName: 'Standalone Teaching.docx' },
      { index: 1, displayName: 'Bible Doctrine on Sin - Track 1.txt' },
      { index: 2, displayName: 'Original Soundtrack 1.md' },
    ]);

    expect(groups.map((group) => group.title)).toEqual([
      'Bible Doctrine on Sin',
      'Ungrouped Files',
    ]);
    expect(groups[1]?.indices).toEqual([0, 2]);
  });
});

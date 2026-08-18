import { describe, expect, it, vi } from 'vitest';
import { createAndAssignSeriesGroups } from './seriesAssignments';

const groups = [
  { title: 'First Series', folderName: 'FIRST SERIES', indices: [0, 1] },
  { title: 'Second Series', folderName: 'SECOND SERIES', indices: [2] },
  { title: 'Third Series', folderName: 'THIRD SERIES', indices: [3, 4] },
];

describe('createAndAssignSeriesGroups', () => {
  it('creates and assigns each group in order', async () => {
    const events: string[] = [];
    let activeCreations = 0;
    let maximumActiveCreations = 0;
    const createFolder = vi.fn(async (name: string, parentId: string) => {
      events.push(`create:${name}:${parentId}`);
      activeCreations += 1;
      maximumActiveCreations = Math.max(maximumActiveCreations, activeCreations);
      await Promise.resolve();
      activeCreations -= 1;
      return { id: name, name };
    });
    const onProgress = vi.fn();
    const onAssigned = vi.fn((indices: readonly number[], folder: { name: string }) => {
      events.push(`assign:${folder.name}:${indices.join(',')}`);
    });

    const result = await createAndAssignSeriesGroups(
      groups,
      createFolder,
      'parent-folder',
      onProgress,
      onAssigned,
    );

    expect(maximumActiveCreations).toBe(1);
    expect(events).toEqual([
      'create:FIRST SERIES:parent-folder',
      'assign:FIRST SERIES:0,1',
      'create:SECOND SERIES:parent-folder',
      'assign:SECOND SERIES:2',
      'create:THIRD SERIES:parent-folder',
      'assign:THIRD SERIES:3,4',
    ]);
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      current: 2,
      total: 3,
      title: 'Second Series',
    });
    expect(result).toEqual({
      completed: [
        { title: 'First Series', fileCount: 2 },
        { title: 'Second Series', fileCount: 1 },
        { title: 'Third Series', fileCount: 2 },
      ],
      failed: [],
    });
  });

  it('continues after a group fails and reports the failed group', async () => {
    const onAssigned = vi.fn();
    const createFolder = vi.fn(async (name: string) => {
      if (name === 'SECOND SERIES') throw new Error('Drive rejected the folder');
      return { id: name, name };
    });

    const result = await createAndAssignSeriesGroups(
      groups,
      createFolder,
      'parent-folder',
      vi.fn(),
      onAssigned,
    );

    expect(createFolder).toHaveBeenCalledTimes(3);
    expect(onAssigned).toHaveBeenCalledTimes(2);
    expect(result.completed).toEqual([
      { title: 'First Series', fileCount: 2 },
      { title: 'Third Series', fileCount: 2 },
    ]);
    expect(result.failed[0]?.title).toBe('Second Series');
    expect(result.failed[0]?.error).toEqual(new Error('Drive rejected the folder'));
  });
});

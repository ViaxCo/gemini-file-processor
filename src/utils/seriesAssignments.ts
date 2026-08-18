import type { DriveFolder } from '@/services/googleDriveService';

export async function createAndAssignSeriesGroups(
  groups: ReadonlyArray<{
    title: string;
    folderName: string;
    indices: readonly number[];
  }>,
  createFolder: (name: string, parentId: string) => Promise<DriveFolder>,
  parentId: string,
  onProgress: (progress: { current: number; total: number; title: string }) => void,
  onAssigned: (indices: readonly number[], folder: DriveFolder) => void,
) {
  const completed: Array<{ title: string; fileCount: number }> = [];
  const failed: Array<{ title: string; error: unknown }> = [];

  for (const [index, group] of groups.entries()) {
    onProgress({ current: index + 1, total: groups.length, title: group.title });

    try {
      const folder = await createFolder(group.folderName, parentId);
      onAssigned(group.indices, folder);
      completed.push({ title: group.title, fileCount: group.indices.length });
    } catch (error) {
      failed.push({ title: group.title, error });
    }
  }

  return { completed, failed };
}

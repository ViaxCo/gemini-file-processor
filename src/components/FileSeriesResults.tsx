import { FileSeriesGroup } from '@/components/FileSeriesGroup';
import type { FileResult } from '@/hooks/useAIProcessor';
import type { groupFilesBySeries } from '@/utils/seriesGroups';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

const GROUP_PAGE_SIZE = 50;

export function FileSeriesResults({
  groups,
  fileResults,
  selected,
  isUploaded,
  onToggleGroup,
  renderFile,
}: {
  groups: ReturnType<typeof groupFilesBySeries>;
  fileResults: FileResult[];
  selected: ReadonlySet<number>;
  isUploaded: (index: number) => boolean;
  onToggleGroup: (indices: number[]) => void;
  renderFile: (index: number) => ReactNode;
}) {
  const [openGroupId, setOpenGroupId] = useState<string>();
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const initializedOpenGroup = useRef(false);

  useEffect(() => {
    if (groups.length === 0) return;
    if (!initializedOpenGroup.current) {
      initializedOpenGroup.current = true;
      setOpenGroupId(groups[0]!.id);
      return;
    }
    if (openGroupId && !groups.some((group) => group.id === openGroupId)) {
      setOpenGroupId(groups[0]!.id);
    }
  }, [groups, openGroupId]);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const isOpen = openGroupId === group.id;
        const pageCount = Math.ceil(group.indices.length / GROUP_PAGE_SIZE);
        const page = Math.min(groupPages[group.id] ?? 0, Math.max(0, pageCount - 1));
        const pageStart = page * GROUP_PAGE_SIZE;
        const visibleIndices = isOpen
          ? group.indices.slice(pageStart, pageStart + GROUP_PAGE_SIZE)
          : [];
        const status = {
          completed: 0,
          active: 0,
          waiting: 0,
          failed: 0,
          uploaded: 0,
        };
        let selectedCount = 0;

        for (const index of group.indices) {
          const result = fileResults[index]!;
          if (result.error) status.failed += 1;
          else if (result.isCompleted) status.completed += 1;
          else if (result.isProcessing) status.active += 1;
          else if (result.queueStatus !== 'cancelled') status.waiting += 1;
          if (isUploaded(index)) status.uploaded += 1;
          if (selected.has(index)) selectedCount += 1;
        }

        return (
          <FileSeriesGroup
            key={group.id}
            title={group.title}
            fileCount={group.indices.length}
            isUngrouped={group.isUngrouped}
            onToggleSelection={() => onToggleGroup(group.indices)}
            isOpen={isOpen}
            onOpenChange={(open) => setOpenGroupId(open ? group.id : undefined)}
            status={status}
            selectedCount={selectedCount}
            page={page}
            pageCount={pageCount}
            visibleStart={group.indices.length === 0 ? 0 : pageStart + 1}
            visibleEnd={Math.min(pageStart + GROUP_PAGE_SIZE, group.indices.length)}
            onPageChange={(nextPage) =>
              setGroupPages((previous) => ({ ...previous, [group.id]: nextPage }))
            }
          >
            {visibleIndices.map(renderFile)}
          </FileSeriesGroup>
        );
      })}
    </div>
  );
}

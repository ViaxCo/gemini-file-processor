'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Ellipsis, FolderPlus, Loader2 } from 'lucide-react';

interface ContextualActionBarProps {
  selectedCount: number;
  onAssignFolder?: () => void;
  onUploadSelected?: () => void;
  onRetrySelected?: () => void;
  onAbortSelected?: () => void;
  onDownloadSelected?: (format: 'markdown' | 'docx') => void;
  onBulkRename?: () => void;
  isDriveAuthenticated?: boolean;
  isUploadSessionActive?: boolean;
  allSelected?: boolean;
  onToggleSelectAll?: (checked: boolean) => void;
  uploadSelectedCount?: number;
  createAndAssignSummary?: string;
  createAndAssignLabel?: string;
  onCreateAndAssign?: () => void;
  isCreateAndAssignDisabled?: boolean;
  isCreatingAndAssigning?: boolean;
}

export function ContextualActionBar({
  selectedCount,
  onAssignFolder,
  onUploadSelected,
  onRetrySelected,
  onAbortSelected,
  onDownloadSelected,
  onBulkRename,
  isDriveAuthenticated = false,
  isUploadSessionActive = false,
  allSelected = false,
  onToggleSelectAll,
  uploadSelectedCount,
  createAndAssignSummary,
  createAndAssignLabel = 'Create & Assign',
  onCreateAndAssign,
  isCreateAndAssignDisabled = false,
  isCreatingAndAssigning = false,
}: ContextualActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="sticky bottom-0 z-30 mt-3 grid gap-2 rounded-lg border bg-card/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {onToggleSelectAll ? (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={allSelected}
              onChange={(event) => onToggleSelectAll(event.target.checked)}
            />
            <span>All</span>
          </label>
        ) : null}
        <span className="shrink-0 font-medium text-foreground tabular-nums">
          {selectedCount} selected
        </span>
        {createAndAssignSummary ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="min-w-0 truncate rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={createAndAssignSummary}
                tabIndex={0}
              >
                <span aria-hidden="true">·</span>{' '}
                <span className="font-medium text-foreground">{createAndAssignSummary}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words">
              {createAndAssignSummary}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {onAssignFolder ? (
          <Button variant="outline" size="sm" onClick={onAssignFolder}>
            <span className="sm:hidden">Assign</span>
            <span className="hidden sm:inline">Assign Folder</span>
          </Button>
        ) : null}
        {onCreateAndAssign && createAndAssignSummary ? (
          <Button
            size="sm"
            onClick={onCreateAndAssign}
            disabled={isCreateAndAssignDisabled || isCreatingAndAssigning}
          >
            {isCreatingAndAssigning ? <Loader2 className="animate-spin" /> : <FolderPlus />}
            <span className="sm:hidden">{isCreatingAndAssigning ? 'Creating…' : 'Create'}</span>
            <span className="hidden sm:inline">{createAndAssignLabel}</span>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="More actions for selected files">
              <Ellipsis />
              <span className="hidden sm:inline">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onBulkRename ? (
              <DropdownMenuItem onSelect={onBulkRename}>Bulk Rename</DropdownMenuItem>
            ) : null}
            {onUploadSelected ? (
              <DropdownMenuItem
                onSelect={onUploadSelected}
                disabled={
                  !isDriveAuthenticated || isUploadSessionActive || (uploadSelectedCount ?? 0) === 0
                }
              >
                Upload Selected
                {typeof uploadSelectedCount === 'number' ? ` (${uploadSelectedCount})` : ''}
              </DropdownMenuItem>
            ) : null}
            {onRetrySelected ? (
              <DropdownMenuItem onSelect={onRetrySelected}>Retry Selected</DropdownMenuItem>
            ) : null}
            {onDownloadSelected ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDownloadSelected('markdown')}>
                  Download as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onDownloadSelected('docx')}>
                  Download as Word
                </DropdownMenuItem>
              </>
            ) : null}
            {onAbortSelected ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onAbortSelected}>
                  Abort Selected
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

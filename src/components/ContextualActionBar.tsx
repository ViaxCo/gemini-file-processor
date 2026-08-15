'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderPlus, Loader2 } from 'lucide-react';

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
  quickFolderName?: string;
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
  quickFolderName,
  onCreateAndAssign,
  isCreateAndAssignDisabled = false,
  isCreatingAndAssigning = false,
}: ContextualActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="sticky bottom-0 mt-4 grid gap-2 rounded-md border bg-card/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          {onToggleSelectAll && (
            <label className="flex cursor-pointer items-center gap-2 text-xs select-none">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={allSelected}
                onChange={(e) => onToggleSelectAll?.(e.target.checked)}
              />
              <span className="text-muted-foreground">Select All - </span>
            </label>
          )}
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
        </div>
        {quickFolderName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="block truncate rounded-sm text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`New folder: ${quickFolderName}`}
                tabIndex={0}
              >
                New folder: <span className="font-medium text-foreground">{quickFolderName}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words">{quickFolderName}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {onBulkRename && (
          <Button variant="outline" size="sm" onClick={onBulkRename}>
            Bulk Rename
          </Button>
        )}
        {onAssignFolder && (
          <Button variant="outline" size="sm" onClick={onAssignFolder}>
            Assign Folder
          </Button>
        )}
        {onCreateAndAssign && quickFolderName ? (
          <Button
            size="sm"
            onClick={onCreateAndAssign}
            disabled={isCreateAndAssignDisabled || isCreatingAndAssigning}
          >
            {isCreatingAndAssigning ? <Loader2 className="animate-spin" /> : <FolderPlus />}
            {isCreatingAndAssigning ? 'Creating…' : 'Create & Assign'}
          </Button>
        ) : null}
        {onUploadSelected && (
          <Button
            variant="default"
            size="sm"
            onClick={onUploadSelected}
            disabled={
              !isDriveAuthenticated || isUploadSessionActive || (uploadSelectedCount ?? 0) === 0
            }
          >
            {`Upload Selected${typeof uploadSelectedCount === 'number' ? ` (${uploadSelectedCount})` : ''}`}
          </Button>
        )}
        {onRetrySelected && (
          <Button variant="outline" size="sm" onClick={onRetrySelected}>
            Retry Selected
          </Button>
        )}
        {onAbortSelected && (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground dark:hover:bg-destructive"
            onClick={onAbortSelected}
          >
            Abort Selected
          </Button>
        )}
        {onDownloadSelected && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                Download Selected
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDownloadSelected('markdown')}>
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownloadSelected('docx')}>
                Word (.docx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

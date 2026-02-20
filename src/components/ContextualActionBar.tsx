'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ContextualActionBarProps {
  selectedCount: number;
  onAssignFolder?: () => void;
  onUploadSelected?: () => void;
  onRetrySelected?: () => void;
  onAbortSelected?: () => void;
  onDownloadSelected?: (format: 'markdown' | 'docx') => void;
  onBulkRename?: () => void;
  isDriveAuthenticated?: boolean;
  isUploadingSelected?: boolean;
  allSelected?: boolean;
  onToggleSelectAll?: (checked: boolean) => void;
  uploadSelectedCount?: number;
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
  isUploadingSelected = false,
  allSelected = false,
  onToggleSelectAll,
  uploadSelectedCount,
}: ContextualActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/60">
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
      <div className="flex flex-wrap items-center gap-2">
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
        {onUploadSelected && (
          <Button
            variant="default"
            size="sm"
            onClick={onUploadSelected}
            disabled={
              !isDriveAuthenticated || isUploadingSelected || (uploadSelectedCount ?? 0) === 0
            }
          >
            {isUploadingSelected ? (
              <span className="mr-1 inline-flex h-4 w-4 items-center justify-center">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
              </span>
            ) : null}
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

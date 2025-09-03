'use client';

import { GoogleDriveFolderSelector } from '@/components/GoogleDriveFolderSelector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DriveFolder } from '@/hooks/useGoogleDrive';
import { useMemo } from 'react';

interface AssignFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  // Forwarded Google Drive state/actions from useGoogleDrive
  isAuthenticated: boolean;
  folders: DriveFolder[];
  selectedFolder: DriveFolder | null;
  isLoadingFolders: boolean;
  isLoadingMoreFolders: boolean;
  hasMoreFolders: boolean;
  loadFolders: (parentId?: string) => Promise<void>;
  loadMoreFolders: () => Promise<void>;
  selectFolder: (folder: DriveFolder | null) => void;
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>;

  // Callback invoked when user confirms assignment
  onAssign: (folderId: string | null, folderName: string) => void;
}

export function AssignFolderModal(props: AssignFolderModalProps) {
  const {
    open,
    onOpenChange,
    selectedCount,
    isAuthenticated,
    folders,
    selectedFolder,
    isLoadingFolders,
    isLoadingMoreFolders,
    hasMoreFolders,
    loadFolders,
    loadMoreFolders,
    selectFolder,
    createFolder,
    onAssign,
  } = props;

  const footerLabel = useMemo(() => {
    const n = selectedCount;
    return n > 1 ? `Assign to ${n} files` : 'Assign to 1 file';
  }, [selectedCount]);

  const handleAssign = () => {
    const id = selectedFolder?.id ?? null;
    const name = selectedFolder?.name ?? 'Root (My Drive)';
    onAssign(id, name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-2xl p-0 sm:p-0">
        <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 sm:py-4">
          <div className="relative">
            <DialogTitle className="pr-10 text-base sm:text-lg">
              Assign Destination Folder
            </DialogTitle>
            <DialogClose asChild>
              <button
                aria-label="Close"
                className="absolute top-0 right-0 rounded-xs p-1 text-muted-foreground transition-colors hover:text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="overflow-hidden px-4 pb-4 sm:px-6">
          <p className="mb-3 text-xs text-muted-foreground sm:text-sm">
            Choose a Google Drive folder to assign to the selected file
            {selectedCount > 1 ? 's' : ''}. You can navigate into folders or create a new one.
          </p>
          <GoogleDriveFolderSelector
            folders={folders}
            selectedFolder={selectedFolder}
            isLoadingFolders={isLoadingFolders}
            isLoadingMoreFolders={isLoadingMoreFolders}
            hasMoreFolders={hasMoreFolders}
            loadFolders={loadFolders}
            loadMoreFolders={loadMoreFolders}
            selectFolder={selectFolder}
            createFolder={createFolder}
            isAuthenticated={isAuthenticated}
            onFolderSelect={() => {
              /* handled by hook selection */
            }}
          />
        </div>
        <DialogFooter className="px-4 pb-4 sm:px-6">
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              size="sm"
              disabled={!isAuthenticated}
              className="whitespace-nowrap"
            >
              {footerLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

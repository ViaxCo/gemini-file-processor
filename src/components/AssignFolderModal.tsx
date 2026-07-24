'use client';

import { GoogleDriveFolderSelector } from '@/components/GoogleDriveFolderSelector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DriveDestination, DriveFolder, FolderLoadOptions } from '@/hooks/useGoogleDrive';
import { useEffect, useMemo, useState } from 'react';

interface AssignFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  initialDestination: DriveDestination | undefined;
  isAuthenticated: boolean;
  folders: DriveFolder[];
  isLoadingFolders: boolean;
  isLoadingMoreFolders: boolean;
  hasMoreFolders: boolean;
  loadFolders: (parentId?: string, options?: FolderLoadOptions) => Promise<boolean>;
  loadMoreFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>;
  error?: string | null;
  onAssign: (folderId: string | null, folderName: string) => void;
}

export function AssignFolderModal({
  open,
  onOpenChange,
  selectedCount,
  initialDestination,
  isAuthenticated,
  folders,
  isLoadingFolders,
  isLoadingMoreFolders,
  hasMoreFolders,
  loadFolders,
  loadMoreFolders,
  createFolder,
  error,
  onAssign,
}: AssignFolderModalProps) {
  const [draftDestination, setDraftDestination] = useState(initialDestination);

  useEffect(() => {
    if (open) setDraftDestination(initialDestination);
  }, [open, initialDestination?.id, initialDestination?.name]);

  const footerLabel = useMemo(
    () => (selectedCount > 1 ? `Assign to ${selectedCount} files` : 'Assign to 1 file'),
    [selectedCount],
  );

  const handleAssign = () => {
    if (!draftDestination) return;

    onAssign(draftDestination.id, draftDestination.name);
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="overflow-hidden px-4 pb-4 sm:px-6">
          <DialogDescription className="mb-3 text-xs sm:text-sm">
            Choose a Google Drive destination for the selected file
            {selectedCount > 1 ? 's' : ''}. Changes apply only after you confirm.
          </DialogDescription>
          <GoogleDriveFolderSelector
            folders={folders}
            destination={draftDestination}
            isLoadingFolders={isLoadingFolders}
            isLoadingMoreFolders={isLoadingMoreFolders}
            hasMoreFolders={hasMoreFolders}
            loadFolders={loadFolders}
            loadMoreFolders={loadMoreFolders}
            onDestinationChange={setDraftDestination}
            createFolder={createFolder}
            isAuthenticated={isAuthenticated}
            error={error}
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
              disabled={!isAuthenticated || !draftDestination}
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

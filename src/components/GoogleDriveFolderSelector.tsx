import { Check, ChevronDown, ChevronRight, Folder, FolderPlus, Home, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DriveFolder, useGoogleDrive } from '../hooks/useGoogleDrive';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface GoogleDriveFolderSelectorProps {
  // From useGoogleDrive hook
  folders: DriveFolder[];
  selectedFolder: DriveFolder | null;
  isLoadingFolders: boolean;
  isLoadingMoreFolders: boolean;
  hasMoreFolders: boolean;
  loadFolders: (parentId?: string) => Promise<void>;
  loadMoreFolders: () => Promise<void>;
  selectFolder: (folder: DriveFolder | null) => void;
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>;
  isAuthenticated: boolean;

  // Own props
  onFolderSelect?: (folderId: string | null, folderName: string) => void;
}

export function GoogleDriveFolderSelector({
  folders,
  selectedFolder,
  isLoadingFolders,
  isLoadingMoreFolders,
  hasMoreFolders,
  loadFolders,
  loadMoreFolders,
  selectFolder,
  createFolder,
  isAuthenticated,
  onFolderSelect,
}: GoogleDriveFolderSelectorProps): JSX.Element {
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string }>>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthenticated) {
    return (
      <Card className="p-3 sm:p-4">
        <div className="text-center text-muted-foreground">
          <Folder className="mx-auto mb-2 h-6 w-6 opacity-50 sm:h-8 sm:w-8" />
          <p className="text-xs sm:text-sm">Connect to Google Drive to select folders</p>
        </div>
      </Card>
    );
  }

  const handleFolderSelect = (folder: DriveFolder | null) => {
    selectFolder(folder);
    onFolderSelect?.(folder?.id || null, folder?.name || 'Root');
  };

  const handleBreadcrumbNavigation = async (targetIndex: number) => {
    const targetFolderId = targetIndex === -1 ? undefined : breadcrumb[targetIndex].id;
    await loadFolders(targetFolderId);
    setBreadcrumb(breadcrumb.slice(0, targetIndex + 1));
  };

  const handleFolderNavigation = async (folder: DriveFolder) => {
    await loadFolders(folder.id);
    setBreadcrumb([...breadcrumb, { id: folder.id, name: folder.name }]);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      const parentId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : undefined;
      await createFolder(newFolderName.trim(), parentId);
      setNewFolderName('');
      setShowCreateFolder(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMoreFolders || isLoadingMoreFolders) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMoreFolders();
    }
  }, [hasMoreFolders, isLoadingMoreFolders, loadMoreFolders]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (showCreateFolder && newFolderInputRef.current) {
      const timer = setTimeout(() => {
        newFolderInputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [showCreateFolder]);

  return (
    <Card className="max-w-full space-y-2 overflow-hidden p-3 sm:p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-0">
        <h3 className="text-sm font-medium sm:text-base">Select Google Drive Folder</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateFolder(!showCreateFolder)}
          className="shrink-0 text-xs sm:text-sm"
        >
          <FolderPlus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
          New Folder
        </Button>
      </div>

      <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] sm:text-sm [&::-webkit-scrollbar]:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleBreadcrumbNavigation(-1)}
          className="h-5 shrink-0 px-1 sm:h-6 sm:px-2"
        >
          <Home className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        </Button>
        {breadcrumb.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60 sm:h-3 sm:w-3" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBreadcrumbNavigation(index)}
              className="h-5 shrink-0 px-1 text-xs whitespace-nowrap sm:h-6 sm:px-2 sm:text-sm"
            >
              {folder.name}
            </Button>
          </React.Fragment>
        ))}
      </div>

      {showCreateFolder && (
        <div className="space-y-2 rounded-md bg-muted/50 p-2 sm:p-3">
          <Input
            ref={newFolderInputRef}
            placeholder="Enter folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 sm:space-x-0">
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || isCreatingFolder}
              className="text-xs sm:text-sm"
            >
              {isCreatingFolder && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Create
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateFolder(false);
                setNewFolderName('');
              }}
              className="text-xs sm:text-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {selectedFolder && (
        <div className="flex flex-col justify-between gap-2 rounded-md border border-primary/20 bg-primary/10 p-2 sm:flex-row sm:items-center sm:gap-0">
          <div className="flex min-w-0 flex-1 items-center space-x-2">
            <Check className="h-3 w-3 shrink-0 text-primary sm:h-4 sm:w-4" />
            <span
              className="truncate text-xs text-primary sm:text-sm"
              title={`Selected: ${selectedFolder.name}`}
            >
              Selected: {selectedFolder.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFolderSelect(null)}
            className="shrink-0 self-start text-xs text-primary hover:bg-primary/10 hover:text-primary sm:self-auto sm:text-sm"
          >
            Clear
          </Button>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="max-h-40 space-y-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:max-h-128 [&::-webkit-scrollbar]:hidden"
      >
        {isLoadingFolders ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-xs text-muted-foreground sm:text-sm">Loading folders...</span>
          </div>
        ) : folders.length === 0 ? (
          <div className="space-y-2 py-4 text-center text-muted-foreground sm:space-y-3 sm:py-6">
            <Folder className="mx-auto mb-2 h-6 w-6 opacity-50 sm:h-8 sm:w-8" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground sm:text-sm">
                No folders found in Google Drive
              </p>
              <p className="text-xs text-muted-foreground">
                Create your first folder to get started
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
              className="mt-2 text-xs sm:mt-3 sm:text-sm"
            >
              <FolderPlus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              Create First Folder
            </Button>
          </div>
        ) : (
          <>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group flex touch-manipulation items-center justify-between rounded-md p-2 transition-colors hover:bg-primary/10"
              >
                <div className="flex min-w-0 flex-1 items-center space-x-2 overflow-hidden">
                  <Folder className="h-3 w-3 shrink-0 text-primary sm:h-4 sm:w-4" />
                  <span
                    className="max-w-[120px] truncate text-xs text-foreground sm:max-w-none sm:text-sm"
                    title={folder.name}
                  >
                    {folder.name}
                  </span>
                </div>
                <div className="flex space-x-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFolderSelect(folder)}
                    className="h-5 px-1 text-xs text-primary hover:bg-primary/10 hover:text-primary sm:h-6 sm:px-2"
                  >
                    Select
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFolderNavigation(folder)}
                    className="h-5 px-1 text-primary hover:bg-primary/10 hover:text-primary sm:h-6 sm:px-2"
                  >
                    <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {hasMoreFolders && (
              <div className="flex items-center justify-center py-2 sm:py-3">
                {isLoadingMoreFolders ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin sm:h-4 sm:w-4" />
                    <span className="text-xs text-muted-foreground sm:text-sm">
                      Loading more folders...
                    </span>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreFolders}
                    className="text-xs text-primary hover:bg-primary/10 hover:text-primary sm:text-sm"
                  >
                    <ChevronDown className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    Load More Folders
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
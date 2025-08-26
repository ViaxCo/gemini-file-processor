import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { Folder, FolderPlus, ChevronRight, Home, Loader2, Check, ChevronDown } from 'lucide-react';

interface GoogleDriveFolderSelectorProps {
  onFolderSelect?: (folderId: string | null, folderName: string) => void;
  isAuthenticated?: boolean;
}

export function GoogleDriveFolderSelector({
  onFolderSelect,
  isAuthenticated: authProp,
}: GoogleDriveFolderSelectorProps): JSX.Element {
  const {
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
  } = useGoogleDrive();

  // State variables must be declared before being used in useEffect
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string }>>([]);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use prop if provided, otherwise fall back to hook
  const authenticated = authProp !== undefined ? authProp : isAuthenticated;

  // Reset attempt flag when authentication changes
  useEffect(() => {
    if (!authenticated) {
      setHasAttemptedLoad(false);
    }
  }, [authenticated]);

  // Load folders when authentication changes
  useEffect(() => {
    if (authenticated && !hasAttemptedLoad && !isLoadingFolders) {
      setHasAttemptedLoad(true);
      loadFolders();
    }
  }, [authenticated, hasAttemptedLoad, isLoadingFolders]); // Only load once per authentication session

  if (!authenticated) {
    return (
      <Card className="p-3 sm:p-4">
        <div className="text-muted-foreground text-center">
          <Folder className="mx-auto mb-2 h-6 w-6 opacity-50 sm:h-8 sm:w-8" />
          <p className="text-xs sm:text-sm">Connect to Google Drive to select folders</p>
        </div>
      </Card>
    );
  }

  const handleFolderSelect = (folder: any) => {
    selectFolder(folder);
    onFolderSelect?.(folder?.id || null, folder?.name || 'Root');
  };

  const handleBreadcrumbNavigation = async (targetIndex: number) => {
    const targetFolder = targetIndex === -1 ? null : breadcrumb[targetIndex];
    setHasAttemptedLoad(false); // Reset flag for new folder
    await loadFolders(targetFolder?.id);
    setBreadcrumb(breadcrumb.slice(0, targetIndex + 1));
    setHasAttemptedLoad(true); // Set flag after loading
  };

  const handleFolderNavigation = async (folder: any) => {
    setHasAttemptedLoad(false); // Reset flag for new folder
    await loadFolders(folder.id);
    setBreadcrumb([...breadcrumb, { id: folder.id, name: folder.name }]);
    setHasAttemptedLoad(true); // Set flag after loading
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

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMoreFolders || isLoadingMoreFolders) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Load more when user scrolls to within 100px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMoreFolders();
    }
  }, [hasMoreFolders, isLoadingMoreFolders, loadMoreFolders]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

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

      {/* Breadcrumb navigation */}
      <div className="text-muted-foreground flex items-center space-x-1 overflow-x-auto pb-1 text-xs [-ms-overflow-style:none] [scrollbar-width:none] sm:text-sm [&::-webkit-scrollbar]:hidden">
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
            <ChevronRight className="text-muted-foreground/60 h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
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

      {/* Create folder form */}
      {showCreateFolder && (
        <div className="bg-muted/50 space-y-2 rounded-md p-2 sm:p-3">
          <Input
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

      {/* Selected folder indicator */}
      {selectedFolder && (
        <div className="bg-primary/10 border-primary/20 flex flex-col justify-between gap-2 rounded-md border p-2 sm:flex-row sm:items-center sm:gap-0">
          <div className="flex min-w-0 flex-1 items-center space-x-2">
            <Check className="text-primary h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
            <span
              className="text-primary truncate text-xs sm:text-sm"
              title={`Selected: ${selectedFolder.name}`}
            >
              Selected: {selectedFolder.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFolderSelect(null)}
            className="text-primary hover:text-primary hover:bg-primary/10 shrink-0 self-start text-xs sm:self-auto sm:text-sm"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Folders list */}
      <div
        ref={scrollContainerRef}
        className="max-h-40 space-y-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:max-h-130 [&::-webkit-scrollbar]:hidden"
      >
        {isLoadingFolders ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-muted-foreground text-xs sm:text-sm">Loading folders...</span>
          </div>
        ) : folders.length === 0 ? (
          <div className="text-muted-foreground space-y-2 py-4 text-center sm:space-y-3 sm:py-6">
            <Folder className="mx-auto mb-2 h-6 w-6 opacity-50 sm:h-8 sm:w-8" />
            <div className="space-y-1">
              <p className="text-foreground text-xs font-medium sm:text-sm">
                No folders found in Google Drive
              </p>
              <p className="text-muted-foreground text-xs">
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
                className="hover:bg-primary/10 group flex touch-manipulation items-center justify-between rounded-md p-2 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center space-x-2 overflow-hidden">
                  <Folder className="text-primary h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                  <span
                    className="text-foreground max-w-[120px] truncate text-xs sm:max-w-none sm:text-sm"
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
                    className="text-primary hover:text-primary hover:bg-primary/10 h-5 px-1 text-xs sm:h-6 sm:px-2"
                  >
                    Select
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFolderNavigation(folder)}
                    className="text-primary hover:text-primary hover:bg-primary/10 h-5 px-1 sm:h-6 sm:px-2"
                  >
                    <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Load more indicator */}
            {hasMoreFolders && (
              <div className="flex items-center justify-center py-2 sm:py-3">
                {isLoadingMoreFolders ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin sm:h-4 sm:w-4" />
                    <span className="text-muted-foreground text-xs sm:text-sm">
                      Loading more folders...
                    </span>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreFolders}
                    className="text-primary hover:text-primary hover:bg-primary/10 text-xs sm:text-sm"
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

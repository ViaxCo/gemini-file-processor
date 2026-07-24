import { DriveDestination, DriveFolder } from '@/hooks/useGoogleDrive';
import { ChevronDown, ChevronRight, Folder, FolderPlus, Loader2 } from 'lucide-react';
import { UIEvent } from 'react';
import { Button } from './ui/button';

export function GoogleDriveFolderList({
  folders,
  isLoading,
  isLoadingMore,
  hasMore,
  onSelect,
  onOpen,
  onLoadMore,
  onCreateFolder,
}: {
  folders: DriveFolder[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onSelect: (destination: DriveDestination) => void;
  onOpen: (folder: DriveFolder) => void;
  onLoadMore: () => Promise<void>;
  onCreateFolder: () => void;
}) {
  const loadMoreNearBottom = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMore || isLoadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100) onLoadMore();
  };

  return (
    <div
      onScroll={loadMoreNearBottom}
      className="max-h-40 space-y-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:max-h-130 [&::-webkit-scrollbar]:hidden"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-xs text-muted-foreground sm:text-sm">Loading folders...</span>
        </div>
      ) : folders.length === 0 ? (
        <div className="space-y-2 py-4 text-center text-muted-foreground sm:space-y-3 sm:py-6">
          <Folder className="mx-auto h-6 w-6 opacity-50 sm:h-8 sm:w-8" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground sm:text-sm">
              No folders in this location
            </p>
            <p className="text-xs">Create a folder here or use this location as-is.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateFolder}
            className="text-xs sm:text-sm"
          >
            <FolderPlus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            Create Folder
          </Button>
        </div>
      ) : (
        <>
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="group flex touch-manipulation items-center justify-between gap-2 rounded-md p-2 transition-colors hover:bg-primary/10"
            >
              <div className="flex min-w-0 flex-1 items-center space-x-2 overflow-hidden">
                <Folder className="h-3 w-3 shrink-0 text-primary sm:h-4 sm:w-4" />
                <span className="truncate text-xs text-foreground sm:text-sm" title={folder.name}>
                  {folder.name}
                </span>
              </div>
              <div className="flex space-x-1 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelect(folder)}
                  className="h-11 px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary sm:h-8"
                >
                  Select
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpen(folder)}
                  className="h-11 w-11 p-0 text-primary hover:bg-primary/10 hover:text-primary sm:h-8 sm:w-8"
                  aria-label={`Open ${folder.name}`}
                >
                  <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </Button>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex items-center justify-center py-2 sm:py-3">
              {isLoadingMore ? (
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
                  onClick={onLoadMore}
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
  );
}

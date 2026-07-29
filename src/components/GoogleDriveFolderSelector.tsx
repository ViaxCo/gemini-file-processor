import { AlertCircle, Check, ChevronRight, Folder, FolderPlus, Home } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import {
  DriveDestination,
  DriveFolder,
  FolderLoadOptions,
  FolderLoadResult,
  MY_DRIVE_ROOT,
} from '../hooks/useGoogleDrive';
import { GoogleDriveCreateFolderForm } from './GoogleDriveCreateFolderForm';
import { GoogleDriveFolderList } from './GoogleDriveFolderList';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface GoogleDriveFolderSelectorProps {
  folders: DriveFolder[];
  destination: DriveDestination | undefined;
  initialLocation: DriveFolder[];
  isLoadingFolders: boolean;
  isLoadingMoreFolders: boolean;
  hasMoreFolders: boolean;
  loadFolders: (parentId?: string, options?: FolderLoadOptions) => Promise<FolderLoadResult>;
  loadMoreFolders: () => Promise<void>;
  onDestinationChange: (folder: DriveDestination, location: DriveFolder[]) => void;
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>;
  isAuthenticated: boolean;
  error?: string | null;
}

export function GoogleDriveFolderSelector({
  folders,
  destination,
  initialLocation,
  isLoadingFolders,
  isLoadingMoreFolders,
  hasMoreFolders,
  loadFolders,
  loadMoreFolders,
  onDestinationChange,
  createFolder,
  isAuthenticated,
  error,
}: GoogleDriveFolderSelectorProps): React.ReactElement {
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<DriveFolder[]>([]);
  const currentFolder = breadcrumb[breadcrumb.length - 1];
  const currentDestination = currentFolder ?? MY_DRIVE_ROOT;

  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    const loadInitialLocation = async () => {
      const folder = initialLocation[initialLocation.length - 1];
      if (folder?.id) {
        const result = await loadFolders(folder.id, {
          clearExisting: true,
          verifyLocation: initialLocation,
        });
        if (!active) return;
        if (result.status === 'success' && result.location) {
          setBreadcrumb(result.location);
          return;
        }
        if (result.status !== 'invalid-location') return;
      }

      if (!active) return;
      setBreadcrumb([]);
      await loadFolders(undefined, { clearExisting: true });
    };

    void loadInitialLocation();
    return () => {
      active = false;
    };
  }, [isAuthenticated, initialLocation, loadFolders]);

  const navigateToBreadcrumb = async (targetIndex: number) => {
    setShowCreateFolder(false);
    const folderId = targetIndex === -1 ? undefined : breadcrumb[targetIndex]?.id;
    if ((await loadFolders(folderId)).status === 'success') {
      setBreadcrumb((current) => current.slice(0, targetIndex + 1));
    }
  };

  const openFolder = async (folder: DriveFolder) => {
    setShowCreateFolder(false);
    if ((await loadFolders(folder.id)).status === 'success') {
      setBreadcrumb((current) => [...current, folder]);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="p-3 sm:p-4">
        <div className="text-center text-muted-foreground">
          <Folder className="mx-auto mb-2 h-6 w-6 opacity-50 sm:h-8 sm:w-8" />
          <p className="text-xs sm:text-sm">Reconnect to Google Drive to select a destination.</p>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-full space-y-2 overflow-hidden p-3 sm:p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <h3 className="text-sm font-medium sm:text-base">Select Google Drive Destination</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={destination?.id === currentDestination.id ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => onDestinationChange(currentDestination, breadcrumb)}
            disabled={isLoadingFolders}
            className="text-xs sm:text-sm"
          >
            {currentFolder ? (
              <Folder className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <Home className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            )}
            {currentFolder ? 'Use This Folder' : 'Use My Drive'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateFolder((current) => !current)}
            disabled={isLoadingFolders}
            className="text-xs sm:text-sm"
          >
            <FolderPlus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            New Folder
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] sm:text-sm [&::-webkit-scrollbar]:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateToBreadcrumb(-1)}
          disabled={isLoadingFolders}
          className="h-5 shrink-0 px-1 sm:h-6 sm:px-2"
          aria-label="Go to My Drive"
        >
          <Home className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        </Button>
        {breadcrumb.map((folder, index) => (
          <Fragment key={folder.id}>
            <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60 sm:h-3 sm:w-3" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToBreadcrumb(index)}
              disabled={isLoadingFolders}
              className="h-5 shrink-0 px-1 text-xs whitespace-nowrap sm:h-6 sm:px-2 sm:text-sm"
            >
              {folder.name}
            </Button>
          </Fragment>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showCreateFolder && (
        <GoogleDriveCreateFolderForm
          onCreate={async (name) => {
            await createFolder(name, currentFolder?.id);
            setShowCreateFolder(false);
          }}
          onCancel={() => setShowCreateFolder(false)}
        />
      )}

      {destination ? (
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-primary/20 bg-primary/10 p-2">
          <Check className="h-3 w-3 shrink-0 text-primary sm:h-4 sm:w-4" />
          <span className="truncate text-xs text-primary sm:text-sm" title={destination.name}>
            Destination: {destination.name}
          </span>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground sm:text-sm">
          The selected files have different destinations. Choose one to replace them.
        </div>
      )}

      <GoogleDriveFolderList
        folders={folders}
        isLoading={isLoadingFolders}
        isLoadingMore={isLoadingMoreFolders}
        hasMore={hasMoreFolders}
        onSelect={(folder) => onDestinationChange(folder, [...breadcrumb, folder])}
        onOpen={openFolder}
        onLoadMore={loadMoreFolders}
        onCreateFolder={() => setShowCreateFolder(true)}
      />
    </Card>
  );
}

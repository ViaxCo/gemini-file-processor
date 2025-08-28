import { useCallback, useEffect, useState } from 'react';
import {
  DriveFile,
  DriveFolder,
  GoogleDriveConfig,
  GoogleDriveService,
} from '../services/googleDriveService';

export interface UseGoogleDriveReturn {
  // Authentication
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authenticate: () => void;
  logout: () => Promise<void>;

  // Folders
  folders: DriveFolder[];
  selectedFolder: DriveFolder | null;
  isLoadingFolders: boolean;
  isLoadingMoreFolders: boolean;
  hasMoreFolders: boolean;
  loadFolders: (parentId?: string) => Promise<void>;
  loadMoreFolders: () => Promise<void>;
  selectFolder: (folder: DriveFolder | null) => void;
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>;

  // File operations
  uploadToGoogleDocs: (
    fileId: string,
    title: string,
    content: string,
    folderId?: string,
  ) => Promise<DriveFile>;
  uploadStatuses: Record<string, 'idle' | 'uploading' | 'completed' | 'error'>;
  resetUploadStatuses: () => void;
  clearUploadStatus: (fileId: string) => void;

  // Error handling
  error: string | null;
  clearError: () => void;
}

const GOOGLE_DRIVE_CONFIG: GoogleDriveConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
};

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [driveService] = useState(() => new GoogleDriveService(GOOGLE_DRIVE_CONFIG));
  const [isAuthenticated, setIsAuthenticated] = useState(() => driveService.isAuthenticated());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingMoreFolders, setIsLoadingMoreFolders] = useState(false);
  const [hasMoreFolders, setHasMoreFolders] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [currentParentId, setCurrentParentId] = useState<string | undefined>(undefined);
  const [uploadStatuses, setUploadStatuses] = useState<
    Record<string, 'idle' | 'uploading' | 'completed' | 'error'>
  >({});
  const [error, setError] = useState<string | null>(null);

  const loadFolders = useCallback(
    async (parentId?: string) => {
      if (!driveService.isAuthenticated()) {
        // This check is important for manual calls
        return;
      }

      setIsLoadingFolders(true);
      setError(null);
      setCurrentParentId(parentId);
      try {
        const result = await driveService.listFolders(parentId);
        setFolders(result.folders);
        setNextPageToken(result.nextPageToken);
        setHasMoreFolders(!!result.nextPageToken);
      } catch (err: any) {
        console.error('Error loading folders:', err);
        setError(err.message || 'Failed to load folders');
        // If auth fails, update state
        if (err.message.includes('Authentication')) {
          setIsAuthenticated(false);
        }
      } finally {
        setIsLoadingFolders(false);
      }
    },
    [driveService],
  );

  // Automatically load folders when authentication state changes to true
  useEffect(() => {
    if (isAuthenticated) {
      loadFolders();
    }
  }, [isAuthenticated, loadFolders]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const authenticate = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const success = await driveService.signIn();
      setIsAuthenticated(success);
      if (!success) {
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [driveService]);

  const logout = useCallback(async () => {
    try {
      await driveService.signOut();
      setIsAuthenticated(false);
      setFolders([]);
      setSelectedFolder(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout');
    }
  }, [driveService]);

  const selectFolder = useCallback((folder: DriveFolder | null) => {
    setSelectedFolder(folder);
  }, []);

  const loadMoreFolders = useCallback(async () => {
    if (!nextPageToken || isLoadingMoreFolders) {
      return;
    }

    setIsLoadingMoreFolders(true);
    setError(null);
    try {
      const result = await driveService.listFolders(currentParentId, nextPageToken);
      setFolders((prevFolders) => [...prevFolders, ...result.folders]);
      setNextPageToken(result.nextPageToken);
      setHasMoreFolders(!!result.nextPageToken);
    } catch (err: any) {
      console.error('Error loading more folders:', err);
      setError(err.message || 'Failed to load more folders');
    } finally {
      setIsLoadingMoreFolders(false);
    }
  }, [driveService, nextPageToken, currentParentId, isLoadingMoreFolders]);

  const createFolder = useCallback(
    async (name: string, parentId?: string): Promise<DriveFolder> => {
      setError(null);
      try {
        const newFolder = await driveService.createFolder(name, parentId);
        // Refresh the current folder list
        await loadFolders(parentId);
        return newFolder;
      } catch (err: any) {
        setError(err.message || 'Failed to create folder');
        throw err;
      }
    },
    [driveService, loadFolders],
  );

  const resetUploadStatuses = useCallback(() => {
    setUploadStatuses({});
  }, []);

  const clearUploadStatus = useCallback((fileId: string) => {
    setUploadStatuses((prev) => {
      const newStatuses = { ...prev };
      delete newStatuses[fileId];
      return newStatuses;
    });
  }, []);

  const uploadToGoogleDocs = useCallback(
    async (
      fileId: string,
      title: string,
      content: string,
      folderId?: string,
    ): Promise<DriveFile> => {
      setUploadStatuses((prev) => ({ ...prev, [fileId]: 'uploading' }));
      setError(null);
      try {
        const file = await driveService.createGoogleDoc(
          title,
          content,
          folderId || selectedFolder?.id,
        );
        setUploadStatuses((prev) => ({ ...prev, [fileId]: 'completed' }));
        return file;
      } catch (err: any) {
        setError(err.message || 'Failed to upload to Google Docs');
        setUploadStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
        throw err;
      }
    },
    [driveService, selectedFolder],
  );

  return {
    isAuthenticated,
    isAuthenticating,
    authenticate,
    logout,
    folders,
    selectedFolder,
    isLoadingFolders,
    isLoadingMoreFolders,
    hasMoreFolders,
    loadFolders,
    loadMoreFolders,
    selectFolder,
    createFolder,
    uploadToGoogleDocs,
    uploadStatuses,
    resetUploadStatuses,
    clearUploadStatus,
    error,
    clearError,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleDriveAuthenticationError, GoogleDriveService } from '../services/googleDriveService';
import type {
  DriveFile,
  DriveFolder,
  GoogleDriveConfig,
  TokenExpiryInfo,
} from '../services/googleDriveService';

export type { DriveFile, DriveFolder, TokenExpiryInfo };
export type DriveDestination = { id: string | null; name: string };
export type DrivePreparationStatus = 'preparing' | 'ready' | 'error';
export type FolderLoadOptions = { clearExisting?: boolean };
export const MY_DRIVE_ROOT: DriveDestination = { id: null, name: 'Root (My Drive)' };

export interface UseGoogleDriveReturn {
  // Authentication
  preparationStatus: DrivePreparationStatus;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  prepareDrive: () => void;
  connect: () => void;
  refresh: () => void;
  logout: () => Promise<void>;
  tokenExpiryInfo: TokenExpiryInfo;

  // Folders
  folders: DriveFolder[];
  isLoadingFolders: boolean;
  isLoadingMoreFolders: boolean;
  hasMoreFolders: boolean;
  loadFolders: (parentId?: string, options?: FolderLoadOptions) => Promise<boolean>;
  loadMoreFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>;

  // File operations
  uploadToGoogleDocs: (
    fileId: string,
    title: string,
    content: string,
    folderId?: string | null,
  ) => Promise<DriveFile>;
  uploadStatuses: Record<string, 'idle' | 'uploading' | 'completed' | 'error'>;
  resetUploadStatuses: () => void;
  clearUploadStatus: (fileId: string) => void;

  // Error handling
  error: string | null;
}

const GOOGLE_DRIVE_CONFIG: GoogleDriveConfig = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
};

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [driveService, setDriveService] = useState<GoogleDriveService | null>(null);
  const [preparationStatus, setPreparationStatus] = useState<DrivePreparationStatus>('preparing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingMoreFolders, setIsLoadingMoreFolders] = useState(false);
  const [hasMoreFolders, setHasMoreFolders] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<
    Record<string, 'idle' | 'uploading' | 'completed' | 'error'>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [tokenExpiryInfo, setTokenExpiryInfo] = useState<TokenExpiryInfo>({
    isNearExpiry: false,
  });
  const folderRequestIdRef = useRef(0);
  const currentFolderPageRef = useRef<{ parentId?: string; pageToken?: string }>({});
  const isLoadingFoldersRef = useRef(false);
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const service = new GoogleDriveService(GOOGLE_DRIVE_CONFIG);
    setDriveService(service);
    setTokenExpiryInfo(service.getTokenExpiryInfo());
  }, []);

  const prepareDrive = useCallback(async () => {
    if (!driveService) return;

    setPreparationStatus('preparing');
    setError(null);
    try {
      await driveService.prepare();
      setPreparationStatus('ready');
      setIsAuthenticated(driveService.hasValidSession());
      setTokenExpiryInfo(driveService.getTokenExpiryInfo());
    } catch (err) {
      setPreparationStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to prepare Google Drive');
    }
  }, [driveService]);

  useEffect(() => {
    if (driveService) prepareDrive();
  }, [driveService, prepareDrive]);

  // Periodically check token expiration after Drive is ready.
  useEffect(() => {
    if (!driveService || preparationStatus !== 'ready') return;

    const checkTokenExpiry = () => {
      const info = driveService.getTokenExpiryInfo();
      setTokenExpiryInfo(info);
      setIsAuthenticated(driveService.hasValidSession());
    };

    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, [driveService, preparationStatus]);

  const loadFolders = useCallback(
    async (parentId?: string, options?: FolderLoadOptions) => {
      if (!driveService) return false;

      if (!driveService.hasValidSession()) {
        folderRequestIdRef.current += 1;
        isLoadingFoldersRef.current = false;
        isLoadingMoreRef.current = false;
        setIsAuthenticated(false);
        setIsLoadingFolders(false);
        setIsLoadingMoreFolders(false);
        setError('Google Drive session expired. Reconnect to continue.');
        return false;
      }

      const requestId = ++folderRequestIdRef.current;
      if (options?.clearExisting) {
        currentFolderPageRef.current = {};
        setFolders([]);
      }
      isLoadingFoldersRef.current = true;
      isLoadingMoreRef.current = false;
      setIsLoadingFolders(true);
      setIsLoadingMoreFolders(false);
      setHasMoreFolders(false);
      setError(null);

      try {
        const result = await driveService.listFolders(parentId);
        if (requestId !== folderRequestIdRef.current) return false;

        currentFolderPageRef.current = { parentId, pageToken: result.nextPageToken };
        setFolders(result.folders);
        setHasMoreFolders(!!result.nextPageToken);
        return true;
      } catch (err) {
        if (requestId !== folderRequestIdRef.current) return false;

        console.error('Error loading folders:', err);
        setHasMoreFolders(!!currentFolderPageRef.current.pageToken);
        setError(err instanceof Error ? err.message : 'Failed to load folders');
        if (err instanceof GoogleDriveAuthenticationError) setIsAuthenticated(false);
        return false;
      } finally {
        if (requestId === folderRequestIdRef.current) {
          isLoadingFoldersRef.current = false;
          setIsLoadingFolders(false);
        }
      }
    },
    [driveService],
  );

  // Load My Drive once preparation and authentication are complete.
  useEffect(() => {
    if (preparationStatus === 'ready' && isAuthenticated) loadFolders();
  }, [preparationStatus, isAuthenticated, loadFolders]);

  const requestAuthentication = useCallback(
    (action: 'connect' | 'refresh') => {
      if (!driveService || preparationStatus !== 'ready') {
        setError('Google Drive is not ready');
        return;
      }

      setIsAuthenticating(true);
      setError(null);
      driveService
        .requestAccessToken()
        .then((success) => {
          const hasValidSession = driveService.hasValidSession();
          setIsAuthenticated(hasValidSession);

          if (success) {
            setTokenExpiryInfo(driveService.getTokenExpiryInfo());
          } else if (hasValidSession && action === 'refresh') {
            setError('Refresh did not complete. Your current session is still connected.');
          } else {
            setError('Authentication failed. Please try again.');
          }
        })
        .catch((err) => {
          setIsAuthenticated(driveService.hasValidSession());
          setError(err instanceof Error ? err.message : 'Authentication failed');
        })
        .finally(() => setIsAuthenticating(false));
    },
    [driveService, preparationStatus],
  );

  const connect = useCallback(() => requestAuthentication('connect'), [requestAuthentication]);
  const refresh = useCallback(() => requestAuthentication('refresh'), [requestAuthentication]);

  const logout = useCallback(async () => {
    if (!driveService) {
      setError('Google Drive service not available');
      return;
    }

    setError(null);
    try {
      folderRequestIdRef.current += 1;
      currentFolderPageRef.current = {};
      isLoadingFoldersRef.current = false;
      isLoadingMoreRef.current = false;
      setIsLoadingFolders(false);
      setIsLoadingMoreFolders(false);
      setHasMoreFolders(false);
      await driveService.signOut();
      setIsAuthenticated(false);
      setFolders([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout');
    }
  }, [driveService]);

  const loadMoreFolders = useCallback(async () => {
    const currentPage = currentFolderPageRef.current;
    if (
      !driveService ||
      !currentPage.pageToken ||
      isLoadingFoldersRef.current ||
      isLoadingMoreRef.current
    ) {
      return;
    }

    const requestId = folderRequestIdRef.current;
    isLoadingMoreRef.current = true;
    setIsLoadingMoreFolders(true);
    setError(null);

    try {
      const result = await driveService.listFolders(currentPage.parentId, currentPage.pageToken);
      if (requestId !== folderRequestIdRef.current) return;

      currentFolderPageRef.current = { ...currentPage, pageToken: result.nextPageToken };
      setFolders((previous) => [...previous, ...result.folders]);
      setHasMoreFolders(!!result.nextPageToken);
    } catch (err) {
      if (requestId !== folderRequestIdRef.current) return;

      console.error('Error loading more folders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more folders');
      if (err instanceof GoogleDriveAuthenticationError) setIsAuthenticated(false);
    } finally {
      if (requestId === folderRequestIdRef.current) {
        isLoadingMoreRef.current = false;
        setIsLoadingMoreFolders(false);
      }
    }
  }, [driveService]);

  const createFolder = useCallback(
    async (name: string, parentId?: string): Promise<DriveFolder> => {
      if (!driveService) {
        throw new Error('Google Drive service not available');
      }

      setError(null);
      try {
        const newFolder = await driveService.createFolder(name, parentId);
        if (currentFolderPageRef.current.parentId === parentId) await loadFolders(parentId);
        return newFolder;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create folder');
        if (err instanceof GoogleDriveAuthenticationError) setIsAuthenticated(false);
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
      folderId?: string | null,
    ): Promise<DriveFile> => {
      if (!driveService) {
        throw new Error('Google Drive service not available');
      }
      if (!driveService.hasValidSession()) {
        const authError = new Error('Google Drive session expired. Reconnect to continue.');
        setIsAuthenticated(false);
        setError(authError.message);
        throw authError;
      }

      setUploadStatuses((prev) => ({ ...prev, [fileId]: 'uploading' }));
      setError(null);
      try {
        // Add timeout to prevent hanging uploads
        const uploadPromise = driveService.createGoogleDoc(title, content, folderId ?? undefined);
        const timeoutPromise = new Promise<never>(
          (_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 30000), // 30 second timeout
        );
        const file = await Promise.race([uploadPromise, timeoutPromise]);
        setUploadStatuses((prev) => ({ ...prev, [fileId]: 'completed' }));
        return file;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload to Google Docs');
        setUploadStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
        if (err instanceof GoogleDriveAuthenticationError) setIsAuthenticated(false);
        throw err;
      }
    },
    [driveService],
  );

  return {
    preparationStatus,
    isAuthenticated,
    isAuthenticating,
    prepareDrive,
    connect,
    refresh,
    logout,
    tokenExpiryInfo,
    folders,
    isLoadingFolders,
    isLoadingMoreFolders,
    hasMoreFolders,
    loadFolders,
    loadMoreFolders,
    createFolder,
    uploadToGoogleDocs,
    uploadStatuses,
    resetUploadStatuses,
    clearUploadStatus,
    error,
  };
}

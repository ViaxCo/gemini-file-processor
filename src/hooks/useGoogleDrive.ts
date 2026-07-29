import { makeFileKey } from '@/services/responseStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleDriveAuthenticationError,
  GoogleDriveService,
  GoogleDriveUnknownUploadError,
} from '../services/googleDriveService';
import type { DriveFile, DriveFolder, TokenExpiryInfo } from '../services/googleDriveService';

export type { DriveFile, DriveFolder, TokenExpiryInfo };
export type DriveDestination = { id: string | null; name: string };
export type DrivePreparationStatus = 'preparing' | 'ready' | 'error';
export type UploadStatus = 'idle' | 'uploading' | 'verifying' | 'completed' | 'error' | 'unknown';
export type DriveUploadRequest = {
  uploadKey: string;
  title: string;
  content: string;
  folderId?: string | null;
};
export type DriveUploadResult = { uploadKey: string; file: DriveFile };
export type FolderLoadOptions = { clearExisting?: boolean; verifyLocation?: DriveFolder[] };
export type FolderLoadResult =
  | { status: 'success'; location?: DriveFolder[] }
  | { status: 'invalid-location' | 'error' | 'stale' };
export const MY_DRIVE_ROOT: DriveDestination = { id: null, name: 'Root (My Drive)' };

export interface UseGoogleDriveReturn {
  // Authentication
  preparationStatus: DrivePreparationStatus;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isUploadSessionActive: boolean;
  isUploadBlockingProcessing: boolean;
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
  loadFolders: (parentId?: string, options?: FolderLoadOptions) => Promise<FolderLoadResult>;
  loadMoreFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>;

  // File operations
  uploadToGoogleDocs: (
    uploads: DriveUploadRequest[],
  ) => Promise<PromiseSettledResult<DriveUploadResult>[]>;
  uploadStatuses: Record<string, UploadStatus>;
  resetUploadStatuses: () => boolean;
  clearUploadStatus: (uploadKey: string) => boolean;
  discardUnknownUpload: (uploadKey: string) => boolean;

  // Error handling
  error: string | null;
}

const GOOGLE_DRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export const makeUploadKey = (batchId: number, index: number, file: File): string =>
  `${batchId}::${index}::${makeFileKey(file)}`;

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [driveService, setDriveService] = useState<GoogleDriveService | null>(null);
  const [preparationStatus, setPreparationStatus] = useState<DrivePreparationStatus>('preparing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isUploadSessionActive, setIsUploadSessionActive] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingMoreFolders, setIsLoadingMoreFolders] = useState(false);
  const [hasMoreFolders, setHasMoreFolders] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, UploadStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [tokenExpiryInfo, setTokenExpiryInfo] = useState<TokenExpiryInfo>({
    isNearExpiry: false,
  });
  const folderRequestIdRef = useRef(0);
  const currentFolderPageRef = useRef<{ parentId?: string; pageToken?: string }>({});
  const isLoadingFoldersRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const uploadOperationKeysRef = useRef<Record<string, string>>({});
  const unknownUploadKeysRef = useRef(new Set<string>());
  const uploadSessionRef = useRef(false);
  const folderFileIdsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const service = new GoogleDriveService(GOOGLE_DRIVE_CLIENT_ID);
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

  // Confirm restored credentials without coupling authentication to folder loading.
  useEffect(() => {
    if (!driveService || preparationStatus !== 'ready' || !isAuthenticated) return;

    let cancelled = false;
    driveService.validateSession().catch((err) => {
      if (cancelled || !(err instanceof GoogleDriveAuthenticationError)) return;
      setIsAuthenticated(false);
      setError('Google Drive session expired. Reconnect to continue.');
    });

    return () => {
      cancelled = true;
    };
  }, [driveService, preparationStatus, isAuthenticated]);

  const loadFolders = useCallback(
    async (parentId?: string, options?: FolderLoadOptions): Promise<FolderLoadResult> => {
      if (!driveService) return { status: 'error' };

      if (!driveService.hasValidSession()) {
        folderRequestIdRef.current += 1;
        isLoadingFoldersRef.current = false;
        isLoadingMoreRef.current = false;
        setIsAuthenticated(false);
        setIsLoadingFolders(false);
        setIsLoadingMoreFolders(false);
        setError('Google Drive session expired. Reconnect to continue.');
        return { status: 'error' };
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
        const verifiedLocation = options?.verifyLocation
          ? await driveService.resolveFolderPath(options.verifyLocation)
          : undefined;
        if (requestId !== folderRequestIdRef.current) return { status: 'stale' };
        if (options?.verifyLocation && !verifiedLocation) {
          return { status: 'invalid-location' };
        }

        const result = await driveService.listFolders(parentId);
        if (requestId !== folderRequestIdRef.current) return { status: 'stale' };

        currentFolderPageRef.current = { parentId, pageToken: result.nextPageToken };
        setFolders(result.folders);
        setHasMoreFolders(!!result.nextPageToken);
        return { status: 'success', location: verifiedLocation ?? undefined };
      } catch (err) {
        if (requestId !== folderRequestIdRef.current) return { status: 'stale' };

        console.error('Error loading folders:', err);
        setHasMoreFolders(!!currentFolderPageRef.current.pageToken);
        setError(err instanceof Error ? err.message : 'Failed to load folders');
        if (err instanceof GoogleDriveAuthenticationError) setIsAuthenticated(false);
        return { status: 'error' };
      } finally {
        if (requestId === folderRequestIdRef.current) {
          isLoadingFoldersRef.current = false;
          setIsLoadingFolders(false);
        }
      }
    },
    [driveService],
  );

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

      const operationKey = JSON.stringify([parentId || 'root', name]);
      setError(null);
      try {
        const newFolder = await driveService.createFolder(name, parentId, {
          fileId: folderFileIdsRef.current[operationKey],
          onFileIdReserved: (fileId) => {
            folderFileIdsRef.current[operationKey] = fileId;
          },
        });
        delete folderFileIdsRef.current[operationKey];
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

  const resetUploadStatuses = useCallback((): boolean => {
    if (uploadSessionRef.current || unknownUploadKeysRef.current.size > 0) return false;

    uploadOperationKeysRef.current = {};
    setUploadStatuses({});
    return true;
  }, []);

  const clearUploadStatus = useCallback((uploadKey: string): boolean => {
    if (uploadSessionRef.current || unknownUploadKeysRef.current.has(uploadKey)) return false;

    delete uploadOperationKeysRef.current[uploadKey];
    setUploadStatuses((prev) => {
      const newStatuses = { ...prev };
      delete newStatuses[uploadKey];
      return newStatuses;
    });
    return true;
  }, []);

  const discardUnknownUpload = useCallback((uploadKey: string): boolean => {
    if (uploadSessionRef.current || !unknownUploadKeysRef.current.has(uploadKey)) return false;

    delete uploadOperationKeysRef.current[uploadKey];
    unknownUploadKeysRef.current.delete(uploadKey);
    setUploadStatuses((prev) => {
      const newStatuses = { ...prev };
      delete newStatuses[uploadKey];
      return newStatuses;
    });
    if (unknownUploadKeysRef.current.size === 0) setError(null);
    return true;
  }, []);

  const uploadToGoogleDocs = useCallback(
    async (uploads: DriveUploadRequest[]): Promise<PromiseSettledResult<DriveUploadResult>[]> => {
      if (uploads.length === 0) return [];
      if (!driveService) throw new Error('Google Drive service not available');
      if (uploadSessionRef.current) throw new Error('Another upload is already in progress');
      if (!driveService.hasValidSession()) {
        const authError = new Error('Google Drive session expired. Reconnect to continue.');
        setIsAuthenticated(false);
        setError(authError.message);
        throw authError;
      }

      uploadSessionRef.current = true;
      setIsUploadSessionActive(true);
      setError(null);
      try {
        return await Promise.allSettled(
          uploads.map(async ({ uploadKey, title, content, folderId }) => {
            const operationKey = uploadOperationKeysRef.current[uploadKey];
            const wasUnknown = unknownUploadKeysRef.current.has(uploadKey);
            setUploadStatuses((prev) => ({
              ...prev,
              [uploadKey]: operationKey ? 'verifying' : 'uploading',
            }));

            try {
              const file = await driveService.createGoogleDoc(
                title,
                content,
                folderId ?? undefined,
                {
                  operationKey,
                  reconcileOnly: wasUnknown,
                  onOperationKeyCreated: (createdOperationKey) => {
                    uploadOperationKeysRef.current[uploadKey] = createdOperationKey;
                  },
                  onPhaseChange: (status) => {
                    setUploadStatuses((prev) => ({ ...prev, [uploadKey]: status }));
                  },
                },
              );
              delete uploadOperationKeysRef.current[uploadKey];
              unknownUploadKeysRef.current.delete(uploadKey);
              setUploadStatuses((prev) => ({ ...prev, [uploadKey]: 'completed' }));
              return { uploadKey, file };
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Failed to upload to Google Docs';
              const isUnknown =
                err instanceof GoogleDriveUnknownUploadError ||
                (wasUnknown && err instanceof GoogleDriveAuthenticationError);
              if (isUnknown) unknownUploadKeysRef.current.add(uploadKey);
              else {
                delete uploadOperationKeysRef.current[uploadKey];
                unknownUploadKeysRef.current.delete(uploadKey);
              }
              setError(message);
              setUploadStatuses((prev) => ({
                ...prev,
                [uploadKey]: isUnknown ? 'unknown' : 'error',
              }));
              if (!driveService.hasValidSession()) setIsAuthenticated(false);
              throw err;
            }
          }),
        );
      } finally {
        uploadSessionRef.current = false;
        setIsUploadSessionActive(false);
      }
    },
    [driveService],
  );

  const isUploadBlockingProcessing =
    isUploadSessionActive || Object.values(uploadStatuses).includes('unknown');

  return {
    preparationStatus,
    isAuthenticated,
    isAuthenticating,
    isUploadSessionActive,
    isUploadBlockingProcessing,
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
    discardUnknownUpload,
    error,
  };
}

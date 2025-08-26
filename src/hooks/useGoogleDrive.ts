import { useState, useCallback, useEffect } from 'react'
import { GoogleDriveService, DriveFolder, DriveFile, GoogleDriveConfig } from '../services/googleDriveService'

export interface UseGoogleDriveReturn {
  // Authentication
  isAuthenticated: boolean
  isAuthenticating: boolean
  authUrl: string | null
  authenticate: () => void
  handleAuthCallback: (code: string) => Promise<void>
  logout: () => Promise<void>

  // Folders
  folders: DriveFolder[]
  selectedFolder: DriveFolder | null
  isLoadingFolders: boolean
  isLoadingMoreFolders: boolean
  hasMoreFolders: boolean
  loadFolders: (parentId?: string) => Promise<void>
  loadMoreFolders: () => Promise<void>
  selectFolder: (folder: DriveFolder | null) => void
  createFolder: (name: string, parentId?: string) => Promise<DriveFolder>

  // File operations
  uploadToGoogleDocs: (title: string, content: string, folderId?: string) => Promise<DriveFile>
  isUploading: boolean

  // Error handling
  error: string | null
  clearError: () => void
}

const GOOGLE_DRIVE_CONFIG: GoogleDriveConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || ''
}

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [driveService] = useState(() => new GoogleDriveService(GOOGLE_DRIVE_CONFIG))
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isLoadingMoreFolders, setIsLoadingMoreFolders] = useState(false)
  const [hasMoreFolders, setHasMoreFolders] = useState(false)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined)
  const [currentParentId, setCurrentParentId] = useState<string | undefined>(undefined)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialLoad, setHasInitialLoad] = useState(false)

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Check if we already have a stored token
      const hasStoredToken = localStorage.getItem('google_drive_token') !== null
      
      if (hasStoredToken) {
        setIsAuthenticated(true)
        // Wait a bit longer for GAPI to initialize and restore token
        setTimeout(() => {
          const authenticated = driveService.isAuthenticated()
          setIsAuthenticated(authenticated)
          if (authenticated && !hasInitialLoad) {
            setHasInitialLoad(true)
            loadFolders()
          }
        }, 1500) // Increased timeout for token restoration
      } else {
        // No stored token, wait for service to initialize
        setTimeout(() => {
          const authenticated = driveService.isAuthenticated()
          setIsAuthenticated(authenticated)
          if (authenticated && !hasInitialLoad) {
            setHasInitialLoad(true)
            loadFolders()
          }
        }, 1000)
      }
    }
    checkAuth()
  }, []) // Remove driveService dependency to prevent re-runs

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const authenticate = useCallback(async () => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const success = await driveService.signIn()
      if (success) {
        setIsAuthenticated(true)
        setHasInitialLoad(true)
        await loadFolders()
      } else {
        setError('Authentication failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsAuthenticating(false)
    }
  }, [driveService])

  const handleAuthCallback = useCallback(async (code: string) => {
    // This is now handled by the signIn method directly
    console.log('Auth callback handled automatically by gapi')
  }, [driveService])

  const logout = useCallback(async () => {
    try {
      await driveService.signOut()
      setIsAuthenticated(false)
      setFolders([])
      setSelectedFolder(null)
      setAuthUrl(null)
      setError(null)
      setHasInitialLoad(false) // Reset initial load flag
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout')
    }
  }, [driveService])

  const loadFolders = useCallback(async (parentId?: string) => {
    // Check authentication at call time, not in dependencies
    if (!driveService.isAuthenticated()) {
      return
    }

    setIsLoadingFolders(true)
    setError(null)
    setCurrentParentId(parentId)
    try {
      const result = await driveService.listFolders(parentId)
      setFolders(result.folders)
      setNextPageToken(result.nextPageToken)
      setHasMoreFolders(!!result.nextPageToken)
      console.log(`Loaded ${result.folders.length} folders`, result.folders)
    } catch (err) {
      console.error('Error loading folders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load folders')
      setFolders([]) // Clear folders on error
      setHasMoreFolders(false)
      setNextPageToken(undefined)
    } finally {
      setIsLoadingFolders(false)
    }
  }, [driveService])

  const selectFolder = useCallback((folder: DriveFolder | null) => {
    setSelectedFolder(folder)
  }, [])

  const loadMoreFolders = useCallback(async () => {
    if (!driveService.isAuthenticated() || !nextPageToken || isLoadingMoreFolders) {
      return
    }

    setIsLoadingMoreFolders(true)
    setError(null)
    try {
      const result = await driveService.listFolders(currentParentId, nextPageToken)
      setFolders(prevFolders => [...prevFolders, ...result.folders])
      setNextPageToken(result.nextPageToken)
      setHasMoreFolders(!!result.nextPageToken)
      console.log(`Loaded ${result.folders.length} more folders`)
    } catch (err) {
      console.error('Error loading more folders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load more folders')
    } finally {
      setIsLoadingMoreFolders(false)
    }
  }, [driveService, nextPageToken, currentParentId, isLoadingMoreFolders])

  const createFolder = useCallback(async (name: string, parentId?: string): Promise<DriveFolder> => {
    setError(null)
    try {
      const newFolder = await driveService.createFolder(name, parentId)
      await loadFolders(parentId) // Refresh the folder list
      return newFolder
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create folder'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [driveService, loadFolders])

  const uploadToGoogleDocs = useCallback(async (
    title: string, 
    content: string, 
    folderId?: string
  ): Promise<DriveFile> => {
    setIsUploading(true)
    setError(null)
    try {
      const file = await driveService.createGoogleDoc(
        title,
        content,
        folderId || selectedFolder?.id
      )
      return file
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload to Google Docs'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }, [driveService, selectedFolder])

  return {
    // Authentication
    isAuthenticated,
    isAuthenticating,
    authUrl,
    authenticate,
    handleAuthCallback,
    logout,

    // Folders
    folders,
    selectedFolder,
    isLoadingFolders,
    isLoadingMoreFolders,
    hasMoreFolders,
    loadFolders,
    loadMoreFolders,
    selectFolder,
    createFolder,

    // File operations
    uploadToGoogleDocs,
    isUploading,

    // Error handling
    error,
    clearError
  }
}
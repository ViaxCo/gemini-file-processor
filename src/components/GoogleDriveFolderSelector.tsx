import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { useGoogleDrive } from '../hooks/useGoogleDrive'
import {
  Folder,
  FolderPlus,
  ChevronRight,
  Home,
  Loader2,
  Check,
  ChevronDown
} from 'lucide-react'

interface GoogleDriveFolderSelectorProps {
  onFolderSelect?: (folderId: string | null, folderName: string) => void
  isAuthenticated?: boolean
}

export function GoogleDriveFolderSelector({ onFolderSelect, isAuthenticated: authProp }: GoogleDriveFolderSelectorProps): JSX.Element {
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
    createFolder
  } = useGoogleDrive()

  // State variables must be declared before being used in useEffect
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string }>>([])
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Use prop if provided, otherwise fall back to hook
  const authenticated = authProp !== undefined ? authProp : isAuthenticated

  // Reset attempt flag when authentication changes
  useEffect(() => {
    if (!authenticated) {
      setHasAttemptedLoad(false)
    }
  }, [authenticated])

  // Load folders when authentication changes
  useEffect(() => {
    if (authenticated && !hasAttemptedLoad && !isLoadingFolders) {
      setHasAttemptedLoad(true)
      loadFolders()
    }
  }, [authenticated, hasAttemptedLoad, isLoadingFolders]) // Only load once per authentication session

  if (!authenticated) {
    return (
      <Card className="p-3 sm:p-4">
        <div className="text-center text-muted-foreground">
          <Folder className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs sm:text-sm">Connect to Google Drive to select folders</p>
        </div>
      </Card>
    )
  }

  const handleFolderSelect = (folder: any) => {
    selectFolder(folder)
    onFolderSelect?.(folder?.id || null, folder?.name || 'Root')
  }

  const handleBreadcrumbNavigation = async (targetIndex: number) => {
    const targetFolder = targetIndex === -1 ? null : breadcrumb[targetIndex]
    setHasAttemptedLoad(false) // Reset flag for new folder
    await loadFolders(targetFolder?.id)
    setBreadcrumb(breadcrumb.slice(0, targetIndex + 1))
    setHasAttemptedLoad(true) // Set flag after loading
  }

  const handleFolderNavigation = async (folder: any) => {
    setHasAttemptedLoad(false) // Reset flag for new folder
    await loadFolders(folder.id)
    setBreadcrumb([...breadcrumb, { id: folder.id, name: folder.name }])
    setHasAttemptedLoad(true) // Set flag after loading
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setIsCreatingFolder(true)
    try {
      const parentId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : undefined
      await createFolder(newFolderName.trim(), parentId)
      setNewFolderName('')
      setShowCreateFolder(false)
    } catch (error) {
      console.error('Failed to create folder:', error)
    } finally {
      setIsCreatingFolder(false)
    }
  }

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMoreFolders || isLoadingMoreFolders) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    // Load more when user scrolls to within 100px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMoreFolders()
    }
  }, [hasMoreFolders, isLoadingMoreFolders, loadMoreFolders])

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  return (
    <Card className="p-3 sm:p-4 space-y-2 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <h3 className="font-medium text-sm sm:text-base">Select Google Drive Folder</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateFolder(!showCreateFolder)}
          className="shrink-0 text-xs sm:text-sm"
        >
          <FolderPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
          New Folder
        </Button>
      </div>

      {/* Breadcrumb navigation */}
      <div className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleBreadcrumbNavigation(-1)}
          className="h-5 sm:h-6 px-1 sm:px-2 shrink-0"
        >
          <Home className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        </Button>
        {breadcrumb.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-muted-foreground/60" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBreadcrumbNavigation(index)}
              className="h-5 sm:h-6 px-1 sm:px-2 shrink-0 whitespace-nowrap text-xs sm:text-sm"
            >
              {folder.name}
            </Button>
          </React.Fragment>
        ))}
      </div>

      {/* Create folder form */}
      {showCreateFolder && (
        <div className="p-2 sm:p-3 bg-muted/50 rounded-md space-y-2">
          <Input
            placeholder="Enter folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:space-x-0">
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || isCreatingFolder}
              className="text-xs sm:text-sm"
            >
              {isCreatingFolder && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Create
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateFolder(false)
                setNewFolderName('')
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
        <div className="p-2 bg-primary/10 border border-primary/20 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
            <span className="text-xs sm:text-sm text-primary truncate" title={`Selected: ${selectedFolder.name}`}>
              Selected: {selectedFolder.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFolderSelect(null)}
            className="text-primary hover:text-primary hover:bg-primary/10 text-xs sm:text-sm shrink-0 self-start sm:self-auto"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Folders list */}
      <div
        ref={scrollContainerRef}
        className="space-y-1 max-h-40 sm:max-h-90 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {isLoadingFolders ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs sm:text-sm text-muted-foreground">Loading folders...</span>
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-4 sm:py-6 text-muted-foreground space-y-2 sm:space-y-3">
            <Folder className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-foreground">No folders found in Google Drive</p>
              <p className="text-xs text-muted-foreground">Create your first folder to get started</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
              className="mt-2 sm:mt-3 text-xs sm:text-sm"
            >
              <FolderPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Create First Folder
            </Button>
          </div>
        ) : (
          <>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-2 hover:bg-accent rounded-md group touch-manipulation transition-colors"
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0 overflow-hidden">
                  <Folder className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm text-foreground truncate max-w-[120px] sm:max-w-none" title={folder.name}>
                    {folder.name}
                  </span>
                </div>
                <div className="flex space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFolderSelect(folder)}
                    className="h-5 sm:h-6 px-1 sm:px-2 text-xs hover:bg-muted/100 transition-colors"
                  >
                    Select
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFolderNavigation(folder)}
                    className="h-5 sm:h-6 px-1 sm:px-2 hover:bg-muted/100 transition-colors"
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
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-2" />
                    <span className="text-xs sm:text-sm text-muted-foreground">Loading more folders...</span>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreFolders}
                    className="text-primary hover:text-primary hover:bg-primary/10 text-xs sm:text-sm"
                  >
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Load More Folders
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { Copy, Download, Loader2, MessageCircle, Upload, FolderOpen, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';
import { copyToClipboard, downloadAsMarkdown } from '../utils/fileUtils';
import { AssignFolderModal } from '@/components/AssignFolderModal';

interface ResponseDisplayProps {
  response: string;
  isProcessing?: boolean;
  file?: File;
  // Google Drive integration (optional)
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error';
  uploadToGoogleDocs?: (
    fileId: string,
    title: string,
    content: string,
    folderId?: string | null,
  ) => Promise<any>;
  isDriveAuthenticated?: boolean;
  selectedFolderName?: string | null;
  selectedFolderId?: string | null;
  // Folder selection (Assign Folder modal) passthroughs
  driveFolders?: any[];
  driveSelectedFolder?: any | null;
  driveIsLoadingFolders?: boolean;
  driveIsLoadingMoreFolders?: boolean;
  driveHasMoreFolders?: boolean;
  driveLoadFolders?: (parentId?: string) => Promise<void>;
  driveLoadMoreFolders?: () => Promise<void>;
  driveSelectFolder?: (folder: any | null) => void;
  driveCreateFolder?: (name: string, parentId?: string) => Promise<any>;
  // Retry
  hasError?: boolean;
  onRetry?: () => void;
}

export const ResponseDisplay = ({
  response,
  isProcessing = false,
  file,
  uploadStatus,
  uploadToGoogleDocs,
  isDriveAuthenticated = false,
  selectedFolderName = null,
  selectedFolderId = null,
  driveFolders = [],
  driveSelectedFolder = null,
  driveIsLoadingFolders = false,
  driveIsLoadingMoreFolders = false,
  driveHasMoreFolders = false,
  driveLoadFolders,
  driveLoadMoreFolders,
  driveSelectFolder,
  driveCreateFolder,
  hasError = false,
  onRetry,
}: ResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [lastResponseLength, setLastResponseLength] = useState<number>(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [assignedFolder, setAssignedFolder] = useState<{ id: string | null; name: string } | null>(
    null,
  );

  useEffect(() => {
    // Reset scrolling state when response is cleared or starts fresh
    if (response.length === 0) {
      setIsUserScrolling(false);
      setLastResponseLength(0);
      return;
    }

    // Auto-scroll only when response is actively being streamed and user hasn't manually scrolled
    if (scrollViewportRef.current && response.length > lastResponseLength && !isUserScrolling) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
    setLastResponseLength(response.length);
  }, [response, lastResponseLength, isUserScrolling]);

  const handleScroll = () => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance

      // If user scrolled up from bottom, mark as user scrolling
      if (!isAtBottom) {
        setIsUserScrolling(true);
      } else {
        // If user scrolled back to bottom, resume auto-scrolling
        setIsUserScrolling(false);
      }
    }
  };

  const handleCopyResponse = async (): Promise<void> => {
    const success = await copyToClipboard(response);
    if (success) {
      toast.success('Response copied to clipboard');
    } else {
      toast.error('Failed to copy response');
    }
    setCopyFeedback(success ? 'Copied!' : 'Failed to copy');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleDownloadResponse = (): void => {
    const fileName = file ? file.name.replace(/\.txt$/, '') : 'response.md';
    downloadAsMarkdown(response, fileName);
    toast.success('File downloaded successfully');
  };

  const canUpload = Boolean(
    response && file && uploadToGoogleDocs && isDriveAuthenticated && uploadStatus !== 'completed',
  );

  const handleUpload = async (): Promise<void> => {
    if (!file || !uploadToGoogleDocs) return;
    if (!isDriveAuthenticated) {
      toast.error('Connect Google Drive to upload');
      return;
    }
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const folderId = assignedFolder?.id ?? selectedFolderId ?? undefined;
    try {
      await uploadToGoogleDocs(file.name, baseName, response, folderId ?? null);
      toast.success('Uploaded to Google Docs');
    } catch (e) {
      toast.error('Upload failed');
    }
  };

  const destinationName = assignedFolder?.name || selectedFolderName || 'Root (My Drive)';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>AI Response</CardTitle>
        {response && (
          <Toggle
            pressed={showMarkdown}
            onPressedChange={setShowMarkdown}
            variant="outline"
            size="sm"
          >
            {showMarkdown ? 'Raw' : 'Formatted'}
          </Toggle>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative h-48 overflow-hidden sm:h-64 lg:h-143">
          <div
            ref={scrollViewportRef}
            onScroll={handleScroll}
            className="size-full overflow-auto rounded-md p-1"
          >
            {isProcessing && !response ? (
              <div className="h-full space-y-4 p-4">
                <div className="mb-4 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    AI is analyzing your file...
                  </span>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ) : response ? (
              <div className="max-w-none overflow-hidden text-sm leading-relaxed sm:text-base">
                {showMarkdown ? (
                  <div className="overflow-wrap-anywhere leading-relaxed break-words text-foreground">
                    <Streamdown>{response}</Streamdown>
                  </div>
                ) : (
                  <pre className="overflow-wrap-anywhere max-w-full overflow-x-auto font-sans leading-relaxed break-words whitespace-pre-wrap text-foreground">
                    {response}
                  </pre>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="px-4 text-center">
                  <MessageCircle
                    className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16"
                    strokeWidth={1}
                  />
                  <p className="text-base font-medium text-foreground sm:text-lg">
                    No response yet
                  </p>
                  <p className="text-xs sm:text-sm">
                    Upload a file and add instructions to get started
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {response && (
          <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
            <Button
              onClick={handleCopyResponse}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
              disabled={isProcessing}
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">{copyFeedback || 'Copy Response'}</span>
              <span className="sm:hidden">{copyFeedback || 'Copy'}</span>
            </Button>
            <Button
              onClick={handleDownloadResponse}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
              disabled={isProcessing}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
                disabled={isProcessing}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="ml-1">Retry</span>
              </Button>
            )}

            {/* Upload to Google Docs */}
            {uploadToGoogleDocs && (
              <Button
                onClick={handleUpload}
                variant="default"
                size="sm"
                className="text-xs sm:text-sm"
                disabled={isProcessing || !canUpload || uploadStatus === 'uploading'}
              >
                {uploadStatus === 'uploading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">
                  {uploadStatus === 'completed' ? 'Uploaded' : 'Upload to Drive'}
                </span>
                <span className="ml-1 sm:hidden">
                  {uploadStatus === 'completed' ? 'Uploaded' : 'Upload'}
                </span>
              </Button>
            )}

            {/* Assign destination folder */}
            {uploadToGoogleDocs && (
              <Button
                onClick={() => setIsAssignOpen(true)}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
                disabled={!isDriveAuthenticated}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Assign Folder</span>
                <span className="ml-1 sm:hidden">Folder</span>
              </Button>
            )}

            {/* Destination hint */}
            {uploadToGoogleDocs && (
              <div className="flex items-center text-xs text-muted-foreground sm:text-sm">
                Destination: {destinationName}
              </div>
            )}
          </div>
        )}

        {hasError && !response && (
          <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground dark:hover:bg-destructive"
                disabled={isProcessing}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Retry</span>
                <span className="ml-1 sm:hidden">Retry</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Assign Folder Modal for single file */}
      <AssignFolderModal
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        selectedCount={1}
        isAuthenticated={!!isDriveAuthenticated}
        folders={driveFolders as any}
        selectedFolder={driveSelectedFolder as any}
        isLoadingFolders={!!driveIsLoadingFolders}
        isLoadingMoreFolders={!!driveIsLoadingMoreFolders}
        hasMoreFolders={!!driveHasMoreFolders}
        loadFolders={driveLoadFolders || (async () => {})}
        loadMoreFolders={driveLoadMoreFolders || (async () => {})}
        selectFolder={driveSelectFolder || (() => {})}
        createFolder={driveCreateFolder || (async (name: string) => ({ id: null, name }))}
        onAssign={(folderId, folderName) => {
          setAssignedFolder({ id: folderId, name: folderName });
        }}
      />
    </Card>
  );
};

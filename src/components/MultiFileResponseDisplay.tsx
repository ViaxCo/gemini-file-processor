import { AssignFolderModal } from '@/components/AssignFolderModal';
import { ContextualActionBar } from '@/components/ContextualActionBar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UnifiedFileCard } from '@/components/UnifiedFileCard';
import { ViewResponseModal } from '@/components/ViewResponseModal';
import { BulkRenameModal } from '@/components/BulkRenameModal';
import { getConfidenceScore } from '@/utils/confidenceScore';
import { downloadProcessedFile, extractTextFromFile } from '@/utils/fileUtils';
import { AlertCircle, DownloadCloud, FileText, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileResult, ProcessingProfile } from '../hooks/useAIProcessor';
import {
  DriveDestination,
  DriveFolder,
  DriveUploadRequest,
  DriveUploadResult,
  FolderLoadOptions,
  FolderLoadResult,
  MY_DRIVE_ROOT,
  UploadStatus,
  makeUploadKey,
} from '../hooks/useGoogleDrive';

interface MultiFileResponseDisplayProps {
  fileResults: FileResult[];
  processingBatchId: number;
  processingProfile: ProcessingProfile;
  onRetryFile?: (index: number) => void;
  onRetryAllFailed?: () => void;
  onAbortFile?: (index: number) => void;
  onAbortSelected?: (indices: number[]) => void;
  onAbortAll?: () => void;
  uploadStatuses?: Record<string, UploadStatus>;
  isWaitingForNextBatch?: boolean;
  throttleSecondsRemaining?: number;
  // Google Drive integration for inline uploads
  uploadToGoogleDocs?: (
    uploads: DriveUploadRequest[],
  ) => Promise<PromiseSettledResult<DriveUploadResult>[]>;
  isDriveAuthenticated?: boolean;
  isUploadSessionActive?: boolean;
  discardUnknownUpload?: (uploadKey: string) => boolean;

  // Google Drive folder selection (for Assign Folder modal)
  driveFolders?: DriveFolder[];
  driveIsLoadingFolders?: boolean;
  driveIsLoadingMoreFolders?: boolean;
  driveHasMoreFolders?: boolean;
  driveLoadFolders?: (parentId?: string, options?: FolderLoadOptions) => Promise<FolderLoadResult>;
  driveLoadMoreFolders?: () => Promise<void>;
  driveCreateFolder?: (name: string, parentId?: string) => Promise<DriveFolder>;
  driveError?: string | null;
  driveAssignmentLocation?: DriveFolder[];
  onDriveAssignmentLocationChange?: (location: DriveFolder[]) => void;
}

// Replaced FileItem with UnifiedFileCard per Phase 2

const canStartUpload = (status?: UploadStatus) =>
  !status || status === 'idle' || status === 'error';
const EMPTY_DRIVE_LOCATION: DriveFolder[] = [];

export const MultiFileResponseDisplay = ({
  fileResults,
  processingBatchId,
  processingProfile,
  onRetryFile,
  onRetryAllFailed,
  onAbortFile,
  onAbortSelected,
  onAbortAll,
  uploadStatuses,
  isWaitingForNextBatch = false,
  throttleSecondsRemaining = 0,
  uploadToGoogleDocs,
  isDriveAuthenticated = false,
  isUploadSessionActive = false,
  discardUnknownUpload,
  driveFolders = [],
  driveIsLoadingFolders = false,
  driveIsLoadingMoreFolders = false,
  driveHasMoreFolders = false,
  driveLoadFolders,
  driveLoadMoreFolders,
  driveCreateFolder,
  driveError,
  driveAssignmentLocation = EMPTY_DRIVE_LOCATION,
  onDriveAssignmentLocationChange,
}: MultiFileResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [displayNames, setDisplayNames] = useState<Record<number, string>>({});
  const [downloadAllFeedback, setDownloadAllFeedback] = useState<string>('');
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [isBulkRenameOpen, setIsBulkRenameOpen] = useState<boolean>(false);
  const [destinationAssignments, setDestinationAssignments] = useState<
    Record<number, { destination: DriveDestination; location: DriveFolder[] }>
  >({});
  const [lowConfidenceIndices, setLowConfidenceIndices] = useState<number[]>([]);
  const lowConfidenceSet = useMemo(() => new Set(lowConfidenceIndices), [lowConfidenceIndices]);
  const uploadKeys = useMemo(
    () => fileResults.map((result, index) => makeUploadKey(processingBatchId, index, result.file)),
    [processingBatchId, fileResults],
  );
  const initialAssignment = useMemo(() => {
    const assignments = [...selected].map(
      (index) =>
        destinationAssignments[index] ?? {
          destination: MY_DRIVE_ROOT,
          location: EMPTY_DRIVE_LOCATION,
        },
    );
    const first = assignments[0];

    return first &&
      assignments.every((assignment) => assignment.destination.id === first.destination.id)
      ? first
      : undefined;
  }, [selected, destinationAssignments]);

  // Compute low-confidence files whenever results change
  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      const indices: number[] = [];
      await Promise.all(
        fileResults.map(async (r, i) => {
          if (!r || !r.isCompleted || !!r.error || !r.response || r.processingProfile === 'book') {
            return;
          }
          try {
            const original = await extractTextFromFile(r.file);
            if (cancelled) return;
            const { level } = getConfidenceScore(original, r.response);
            if (level === 'low') indices.push(i);
          } catch {
            // ignore
          }
        }),
      );
      if (!cancelled) setLowConfidenceIndices(indices);
    };
    void compute();
    return () => {
      cancelled = true;
    };
  }, [fileResults]);

  // Order indices so that uploaded items ('completed' upload status) sink to the bottom
  const orderedIndices = useMemo(() => {
    const indices = fileResults.map((_, i) => i);
    if (!uploadStatuses) return indices;
    const notUploaded: number[] = [];
    const uploaded: number[] = [];
    for (const i of indices) {
      const status = uploadStatuses[uploadKeys[i]!];
      if (status === 'completed') uploaded.push(i);
      else notUploaded.push(i);
    }
    return [...notUploaded, ...uploaded];
  }, [fileResults, uploadStatuses, uploadKeys]);

  const completedResults = fileResults.filter(
    (result) => result.isCompleted && !result.error && result.response,
  );
  const uploadEligible = fileResults
    .map((result, index) => ({ result, index }))
    .filter(({ result, index }) => {
      const status = uploadStatuses?.[uploadKeys[index]!];
      return (
        result.isCompleted &&
        !result.error &&
        result.response &&
        canStartUpload(status) &&
        !lowConfidenceSet.has(index)
      );
    });
  const allCompleted = fileResults.length > 0 && fileResults.every((result) => result.isCompleted);
  const isAnyProcessing = fileResults.some((result) => result.isProcessing);
  const pendingCount = fileResults.filter(
    (result) => !result.isCompleted && !result.isProcessing && !result.error,
  ).length;
  const hasPending = pendingCount > 0;
  const completedCount = fileResults.filter((result) => result.isCompleted).length;
  const errorCount = fileResults.filter((result) => result.error).length;
  const processingCount = fileResults.filter((result) => result.isProcessing).length;
  const uploadedCount = useMemo(() => {
    if (!uploadStatuses) return 0;
    return fileResults.reduce(
      (acc, _result, index) => acc + (uploadStatuses[uploadKeys[index]!] === 'completed' ? 1 : 0),
      0,
    );
  }, [fileResults, uploadStatuses, uploadKeys]);
  const progressPercentage =
    fileResults.length > 0 ? (completedCount / fileResults.length) * 100 : 0;

  const allSelected = useMemo(
    () => fileResults.length > 0 && fileResults.every((_, i) => selected.has(i)),
    [fileResults, selected],
  );
  const selectedCount = selected.size;
  const hasUnknownUpload = Object.values(uploadStatuses || {}).includes('unknown');
  const isDriveLifecycleBlockingProcessing = isUploadSessionActive || hasUnknownUpload;
  const selectedUploadItems = uploadEligible.filter(({ index }) => selected.has(index));
  const uploadSelectedEligibleCount = selectedUploadItems.length;
  const viewedResult = viewIndex != null ? (fileResults[viewIndex] ?? null) : null;
  const viewedUploadStatus =
    viewIndex != null ? uploadStatuses?.[uploadKeys[viewIndex]!] : undefined;

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(fileResults.map((_, i) => i)));
    } else {
      setSelected(new Set());
    }
  };

  const handleRetrySelected = () => {
    if (!onRetryFile || isDriveLifecycleBlockingProcessing) return;
    const count = selected.size;
    if (count === 0) return;
    const message = `Retry processing for ${count} selected file${count > 1 ? 's' : ''}?`;
    if (!confirm(message)) return;
    [...selected].forEach((i) => onRetryFile(i));
  };

  const handleDownloadSelected = async (format: 'markdown' | 'docx') => {
    const indices = [...selected];
    if (indices.length === 0) return;

    let successCount = 0;
    let failedCount = 0;
    for (const i of indices) {
      const r = fileResults[i];
      if (!r || !r.isCompleted || r.error || !r.response) {
        continue;
      }

      const name = displayNames[i] || r.file.name.replace(/\.[^.]+$/, '');
      try {
        await downloadProcessedFile(r.response, name, format);
        successCount++;
      } catch {
        failedCount++;
      }
    }

    if (successCount > 0) {
      toast.success(
        `Downloaded ${successCount} file${successCount > 1 ? 's' : ''} as ${format === 'docx' ? '.docx' : '.md'}`,
      );
    }

    if (failedCount > 0) {
      toast.error(`Failed to download ${failedCount} file${failedCount > 1 ? 's' : ''}`);
    }
  };

  const handleDownloadAll = async (format: 'markdown' | 'docx'): Promise<void> => {
    if (completedResults.length === 0) return;

    let successCount = 0;
    let failedCount = 0;
    for (const result of completedResults) {
      try {
        await downloadProcessedFile(
          result.response,
          result.file.name.replace(/\.[^.]+$/, ''),
          format,
        );
        successCount++;
      } catch {
        failedCount++;
      }
    }

    if (successCount > 0) {
      toast.success(
        `Downloaded ${successCount} file${successCount > 1 ? 's' : ''} as ${
          format === 'docx' ? '.docx' : '.md'
        }`,
      );
      setDownloadAllFeedback(
        failedCount === 0
          ? 'Downloaded all files!'
          : `Downloaded ${successCount} of ${completedResults.length} files`,
      );
      setTimeout(() => setDownloadAllFeedback(''), 3000);
    }

    if (failedCount > 0) {
      toast.error(`Failed to download ${failedCount} file${failedCount > 1 ? 's' : ''}`);
    }
  };

  const uploadItems = async (
    items: Array<{ result: FileResult; index: number }>,
  ): Promise<PromiseSettledResult<number>[]> => {
    if (!uploadToGoogleDocs) return [];

    const results = await uploadToGoogleDocs(
      items.map(({ result, index }) => ({
        uploadKey: uploadKeys[index]!,
        title: (displayNames[index] || result.file.name).replace(/\.[^.]+$/, ''),
        content: result.response,
        folderId: destinationAssignments[index]?.destination.id,
      })),
    );
    return results.map((result, index) =>
      result.status === 'fulfilled' ? { status: 'fulfilled', value: items[index]!.index } : result,
    );
  };

  const finishBulkUpload = (
    results: PromiseSettledResult<number>[],
    successMessage: (count: number) => string,
  ) => {
    const succeeded = results
      .filter((result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled')
      .map((result) => result.value);
    const failed = results.length - succeeded.length;

    if (succeeded.length > 0) {
      setSelected((previous) => {
        const next = new Set(previous);
        for (const index of succeeded) next.delete(index);
        return next;
      });
    }

    if (failed === 0) toast.success(successMessage(succeeded.length));
    else if (succeeded.length > 0) {
      toast.warning(`${succeeded.length} uploaded; ${failed} need attention.`);
    } else toast.error('No files were uploaded. Check their statuses and try again.');
  };

  const handleDiscardUnknownUpload = (index: number) => {
    if (!discardUnknownUpload) return;
    const fileName = fileResults[index]?.file.name || 'this file';
    const confirmed = confirm(
      `Drive could not confirm whether "${fileName}" was created. Discarding this status allows another upload and may create a duplicate. Continue?`,
    );
    if (!confirmed) return;

    if (discardUnknownUpload(uploadKeys[index]!)) {
      toast.warning('Unconfirmed upload discarded. A future upload may create a duplicate.');
    }
  };

  const handleUploadSingle = async (index: number): Promise<void> => {
    if (!uploadToGoogleDocs || !isDriveAuthenticated) return;
    const result = fileResults[index];
    if (!result?.isCompleted || !result.response || result.error) return;

    try {
      const [uploadResult] = await uploadItems([{ result, index }]);
      if (!uploadResult || uploadResult.status === 'rejected') {
        throw uploadResult?.reason || new Error('Upload failed');
      }
      toast.success('Uploaded to Google Docs');
      setSelected((previous) => {
        if (!previous.has(index)) return previous;
        const next = new Set(previous);
        next.delete(index);
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleUploadSelected = async (): Promise<void> => {
    if (!uploadToGoogleDocs || !isDriveAuthenticated || selectedUploadItems.length === 0) return;

    try {
      const results = await uploadItems(selectedUploadItems);
      finishBulkUpload(
        results,
        (count) => `Uploaded ${count} selected file${count === 1 ? '' : 's'}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleUploadAll = async (): Promise<void> => {
    if (!uploadToGoogleDocs || !isDriveAuthenticated || uploadEligible.length === 0) return;

    try {
      const results = await uploadItems(uploadEligible);
      finishBulkUpload(results, (count) => `Uploaded ${count} file${count === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  if (fileResults.length === 0) {
    return (
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>AI Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground sm:h-64 lg:h-96">
            <div className="px-4 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16" strokeWidth={1} />
              <p className="text-base font-medium text-foreground sm:text-lg">
                No files processed yet
              </p>
              <p className="text-xs sm:text-sm">Upload files and add instructions to get started</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg sm:text-xl">AI Responses</CardTitle>
        <div className="flex items-center gap-3">
          {allCompleted && completedResults.length > 0 && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-shrink-0 text-xs sm:text-sm"
                        disabled={isAnyProcessing}
                      >
                        <DownloadCloud className="h-4 w-4" />
                        <span className="hidden whitespace-nowrap sm:inline">
                          {downloadAllFeedback || 'Download All'}
                        </span>
                        <span className="whitespace-nowrap sm:hidden">
                          {downloadAllFeedback || 'Download'}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Download all completed files</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownloadAll('markdown')}>
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadAll('docx')}>
                  Word (.docx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {uploadToGoogleDocs && uploadEligible.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleUploadAll}
                  variant="default"
                  size="sm"
                  className="flex-shrink-0 text-xs sm:text-sm"
                  disabled={isAnyProcessing || !isDriveAuthenticated || isUploadSessionActive}
                >
                  <DownloadCloud className="h-4 w-4 rotate-180" />
                  <span className="hidden whitespace-nowrap sm:inline">Upload All</span>
                  <span className="whitespace-nowrap sm:hidden">Upload</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload all completed files to Google Docs</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-189 space-y-4 overflow-y-auto pr-2 lg:overflow-y-auto">
          <div className="sticky top-0 z-20 space-y-3 border-b border-border/70 bg-card/92 pt-1 pb-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/72">
            <div className="flex flex-col justify-between gap-2 text-sm sm:flex-row sm:items-center">
              <span className="text-muted-foreground">
                Processing Results ({fileResults.length} file{fileResults.length !== 1 ? 's' : ''})
              </span>
              <div className="flex flex-wrap gap-2">
                {completedCount > 0 && <Badge variant="default">{completedCount} completed</Badge>}
                {processingCount > 0 && (
                  <Badge variant="secondary">{processingCount} processing</Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    {errorCount} error{errorCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {uploadedCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-500 text-white dark:bg-emerald-600 [a&]:hover:bg-emerald-500/90"
                  >
                    {uploadedCount} uploaded
                  </Badge>
                )}
                {pendingCount > 0 && <Badge variant="outline">{pendingCount} queued</Badge>}
              </div>
            </div>
            {(isAnyProcessing || hasPending || isWaitingForNextBatch) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                {(hasPending || isWaitingForNextBatch) && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Pending files: {pendingCount}</span>
                    {isWaitingForNextBatch && (
                      <span>
                        {Math.ceil(throttleSecondsRemaining || 0) > 0
                          ? `Next batch in ${Math.ceil(throttleSecondsRemaining || 0)}s`
                          : 'Scheduling next batch…'}
                      </span>
                    )}
                  </div>
                )}
                {(isAnyProcessing || hasPending) && onAbortAll && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground dark:hover:bg-destructive"
                      onClick={() => onAbortAll?.()}
                    >
                      Abort All
                    </Button>
                  </div>
                )}
              </div>
            )}
            {errorCount > 0 && (
              <Alert variant="destructive" className="items-center">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <span>
                    {errorCount} file{errorCount > 1 ? 's' : ''} failed to process. Check individual
                    files for details.
                  </span>
                  {onRetryAllFailed && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={onRetryAllFailed}
                          variant="outline"
                          size="sm"
                          className="ml-2 h-7 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground dark:hover:bg-destructive"
                          disabled={isDriveLifecycleBlockingProcessing}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          <span className="hidden sm:inline">Retry All</span>
                          <span className="sm:hidden">Retry</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Retry all failed files</TooltipContent>
                    </Tooltip>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {lowConfidenceIndices.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <span>
                    {lowConfidenceIndices.length} file{lowConfidenceIndices.length > 1 ? 's' : ''}{' '}
                    have low confidence. Review and retry if needed.
                  </span>
                  {onRetryFile && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => {
                            // Retry all low-confidence files without confirmation
                            lowConfidenceIndices.forEach((index) => onRetryFile(index));
                          }}
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          disabled={isDriveLifecycleBlockingProcessing}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          <span className="hidden sm:inline">Retry Low Confidence</span>
                          <span className="sm:hidden">Retry</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Retry all low-confidence files</TooltipContent>
                    </Tooltip>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {fileResults.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground sm:h-64 lg:h-96">
              <div className="px-4 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16" strokeWidth={1} />
                <p className="text-base font-medium text-foreground sm:text-lg">
                  No files processed yet
                </p>
                <p className="text-xs sm:text-sm">
                  Upload files and add instructions to get started
                </p>
              </div>
            </div>
          ) : (
            <>
              {orderedIndices.map((orderedIndex) => {
                const result = fileResults[orderedIndex]!;
                const resultProfile = result.processingProfile ?? processingProfile;
                const uploadStatus = uploadStatuses?.[uploadKeys[orderedIndex]!];
                return (
                  <UnifiedFileCard
                    key={`${result.file.name}-${orderedIndex}`}
                    result={result}
                    index={orderedIndex}
                    selected={selected.has(orderedIndex)}
                    onSelectChange={(checked) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(orderedIndex);
                        else next.delete(orderedIndex);
                        return next;
                      });
                    }}
                    displayName={displayNames[orderedIndex] || result.file.name}
                    onNameChange={(newName) =>
                      setDisplayNames((prev) => ({ ...prev, [orderedIndex]: newName }))
                    }
                    showMarkdown={showMarkdown}
                    onToggleMarkdown={setShowMarkdown}
                    onRetry={
                      onRetryFile && !isDriveLifecycleBlockingProcessing
                        ? () => onRetryFile(orderedIndex)
                        : undefined
                    }
                    onAbort={onAbortFile ? () => onAbortFile(orderedIndex) : undefined}
                    uploadStatus={uploadStatus}
                    destinationFolderName={
                      destinationAssignments[orderedIndex]?.destination.name ?? MY_DRIVE_ROOT.name
                    }
                    onUpload={
                      uploadToGoogleDocs ? () => handleUploadSingle(orderedIndex) : undefined
                    }
                    onDiscardUpload={
                      uploadStatus === 'unknown' && discardUnknownUpload
                        ? () => handleDiscardUnknownUpload(orderedIndex)
                        : undefined
                    }
                    canUpload={isDriveAuthenticated}
                    uploadDisabled={isUploadSessionActive}
                    onViewResponse={() => {
                      setViewIndex(orderedIndex);
                      setIsViewOpen(true);
                    }}
                    processingProfile={resultProfile}
                  />
                );
              })}

              <ViewResponseModal
                open={isViewOpen}
                onOpenChange={(open) => {
                  setIsViewOpen(open);
                  if (!open) setViewIndex(null);
                }}
                result={viewedResult}
                displayName={
                  viewIndex != null
                    ? displayNames[viewIndex] || fileResults[viewIndex]?.file.name
                    : undefined
                }
                onRetry={
                  viewIndex != null && onRetryFile && !isDriveLifecycleBlockingProcessing
                    ? () => onRetryFile(viewIndex)
                    : undefined
                }
                onUpload={
                  viewIndex != null && uploadToGoogleDocs
                    ? () => handleUploadSingle(viewIndex)
                    : undefined
                }
                onDiscardUpload={
                  viewIndex != null && viewedUploadStatus === 'unknown' && discardUnknownUpload
                    ? () => handleDiscardUnknownUpload(viewIndex)
                    : undefined
                }
                canUpload={isDriveAuthenticated}
                uploadDisabled={isUploadSessionActive}
                uploadStatus={viewedUploadStatus}
                destinationFolderName={
                  viewIndex != null
                    ? (destinationAssignments[viewIndex]?.destination.name ?? MY_DRIVE_ROOT.name)
                    : undefined
                }
                processingProfile={viewedResult?.processingProfile ?? processingProfile}
              />
            </>
          )}
          {selectedCount > 0 && (
            <ContextualActionBar
              selectedCount={selectedCount}
              onAssignFolder={() => setIsAssignOpen(true)}
              onBulkRename={() => setIsBulkRenameOpen(true)}
              onUploadSelected={
                uploadToGoogleDocs && isDriveAuthenticated ? handleUploadSelected : undefined
              }
              onRetrySelected={
                onRetryFile && !isDriveLifecycleBlockingProcessing ? handleRetrySelected : undefined
              }
              onAbortSelected={onAbortSelected ? () => onAbortSelected([...selected]) : undefined}
              onDownloadSelected={handleDownloadSelected}
              isDriveAuthenticated={isDriveAuthenticated}
              isUploadSessionActive={isUploadSessionActive}
              allSelected={allSelected}
              onToggleSelectAll={(checked) => toggleSelectAll(checked)}
              uploadSelectedCount={uploadSelectedEligibleCount}
            />
          )}
        </div>
      </CardContent>
      <BulkRenameModal
        open={isBulkRenameOpen}
        onOpenChange={setIsBulkRenameOpen}
        items={[...selected].map((idx) => ({
          index: idx,
          currentName: displayNames[idx] || fileResults[idx]?.file.name || '',
        }))}
        onApply={(mapping) => {
          setDisplayNames((prev) => ({ ...prev, ...mapping }));
          setSelected(new Set());
        }}
      />
      <AssignFolderModal
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        selectedCount={selectedCount}
        initialDestination={initialAssignment?.destination}
        initialDestinationLocation={initialAssignment?.location ?? EMPTY_DRIVE_LOCATION}
        initialLocation={driveAssignmentLocation}
        isAuthenticated={!!isDriveAuthenticated}
        folders={driveFolders}
        isLoadingFolders={!!driveIsLoadingFolders}
        isLoadingMoreFolders={!!driveIsLoadingMoreFolders}
        hasMoreFolders={!!driveHasMoreFolders}
        loadFolders={driveLoadFolders || (async () => ({ status: 'error' }))}
        loadMoreFolders={driveLoadMoreFolders || (async () => {})}
        createFolder={driveCreateFolder || (async (name: string) => ({ id: '', name }))}
        error={driveError}
        onAssign={(folderId, folderName, location) => {
          setDestinationAssignments((previous) => {
            const next = { ...previous };
            for (const index of selected) {
              next[index] = { destination: { id: folderId, name: folderName }, location };
            }
            return next;
          });
          onDriveAssignmentLocationChange?.(location);
        }}
      />
    </Card>
  );
};

import { AssignFolderModal } from '@/components/AssignFolderModal';
import { ContextualActionBar } from '@/components/ContextualActionBar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UnifiedFileCard } from '@/components/UnifiedFileCard';
import { ViewResponseModal } from '@/components/ViewResponseModal';
import { BulkRenameModal } from '@/components/BulkRenameModal';
import { getConfidenceScore } from '@/utils/confidenceScore';
import { AlertCircle, DownloadCloud, FileText, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileResult } from '../hooks/useAIProcessor';
import { downloadAsMarkdown } from '../utils/fileUtils';

interface MultiFileResponseDisplayProps {
  fileResults: FileResult[];
  onRetryFile?: (index: number) => void;
  onRetryAllFailed?: () => void;
  uploadStatuses?: Record<string, 'idle' | 'uploading' | 'completed' | 'error'>;
  isWaitingForNextBatch?: boolean;
  throttleSecondsRemaining?: number;
  selectedFolderName?: string | null;
  // Google Drive integration for inline uploads
  uploadToGoogleDocs?: (
    fileId: string,
    title: string,
    content: string,
    folderId?: string | null,
  ) => Promise<any>;
  selectedFolderId?: string | null;
  isDriveAuthenticated?: boolean;

  // Google Drive folder selection (for Assign Folder modal)
  driveFolders?: any[];
  driveSelectedFolder?: any | null;
  driveIsLoadingFolders?: boolean;
  driveIsLoadingMoreFolders?: boolean;
  driveHasMoreFolders?: boolean;
  driveLoadFolders?: (parentId?: string) => Promise<void>;
  driveLoadMoreFolders?: () => Promise<void>;
  driveSelectFolder?: (folder: any | null) => void;
  driveCreateFolder?: (name: string, parentId?: string) => Promise<any>;
}

// Replaced FileItem with UnifiedFileCard per Phase 2

export const MultiFileResponseDisplay = ({
  fileResults,
  onRetryFile,
  onRetryAllFailed,
  uploadStatuses,
  isWaitingForNextBatch = false,
  throttleSecondsRemaining = 0,
  selectedFolderName = null,
  uploadToGoogleDocs,
  selectedFolderId = null,
  isDriveAuthenticated = false,
  driveFolders = [],
  driveSelectedFolder = null,
  driveIsLoadingFolders = false,
  driveIsLoadingMoreFolders = false,
  driveHasMoreFolders = false,
  driveLoadFolders,
  driveLoadMoreFolders,
  driveSelectFolder,
  driveCreateFolder,
}: MultiFileResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [displayNames, setDisplayNames] = useState<Record<number, string>>({});
  const [downloadAllFeedback, setDownloadAllFeedback] = useState<string>('');
  const [isUploadingAll, setIsUploadingAll] = useState<boolean>(false);
  const [isUploadingSelected, setIsUploadingSelected] = useState<boolean>(false);
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [isBulkRenameOpen, setIsBulkRenameOpen] = useState<boolean>(false);
  const [assignedFolders, setAssignedFolders] = useState<
    Record<number, { id: string | null; name: string }>
  >({});
  const [lowConfidenceIndices, setLowConfidenceIndices] = useState<number[]>([]);

  // Compute low-confidence files whenever results change
  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      const indices: number[] = [];
      await Promise.all(
        fileResults.map(async (r, i) => {
          if (!r || !r.isCompleted || !!r.error || !r.response) return;
          try {
            const original = await r.file.text();
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
      const status = uploadStatuses[fileResults[i]!.file.name];
      if (status === 'completed') uploaded.push(i);
      else notUploaded.push(i);
    }
    return [...notUploaded, ...uploaded];
  }, [fileResults, uploadStatuses]);

  const completedResults = fileResults.filter(
    (result) => result.isCompleted && !result.error && result.response,
  );
  const uploadEligible = fileResults.filter(
    (r) =>
      r.isCompleted &&
      !r.error &&
      r.response &&
      (!uploadStatuses || uploadStatuses[r.file.name] !== 'completed'),
  );
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
      (acc, r) => acc + (uploadStatuses[r.file.name] === 'completed' ? 1 : 0),
      0,
    );
  }, [fileResults, uploadStatuses]);
  const progressPercentage =
    fileResults.length > 0 ? (completedCount / fileResults.length) * 100 : 0;

  const allSelected = useMemo(
    () => fileResults.length > 0 && fileResults.every((_, i) => selected.has(i)),
    [fileResults, selected],
  );
  const selectedCount = selected.size;
  const uploadSelectedEligibleCount = useMemo(() => {
    const indices = [...selected];
    if (indices.length === 0) return 0;
    return indices.reduce((count, i) => {
      const r = fileResults[i];
      if (
        r &&
        r.isCompleted &&
        !r.error &&
        r.response &&
        (!uploadStatuses || uploadStatuses[r.file.name] !== 'completed')
      ) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [selected, fileResults, uploadStatuses]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(fileResults.map((_, i) => i)));
    } else {
      setSelected(new Set());
    }
  };

  const handleRetrySelected = () => {
    if (!onRetryFile) return;
    const count = selected.size;
    if (count === 0) return;
    const message = `Retry processing for ${count} selected file${count > 1 ? 's' : ''}?`;
    if (!confirm(message)) return;
    [...selected].forEach((i) => onRetryFile(i));
  };

  const handleDownloadSelected = () => {
    const indices = [...selected];
    if (indices.length === 0) return;
    let count = 0;
    indices.forEach((i) => {
      const r = fileResults[i];
      if (r && r.isCompleted && !r.error && r.response) {
        const name = displayNames[i] || r.file.name.replace(/\.[^.]+$/, '');
        downloadAsMarkdown(r.response, name);
        count++;
      }
    });
    if (count > 0) {
      toast.success(`Downloaded ${count} file${count > 1 ? 's' : ''}`);
    }
  };

  const handleDownloadAll = (): void => {
    if (completedResults.length === 0) return;

    completedResults.forEach((result) => {
      downloadAsMarkdown(result.response, result.file.name.replace('.txt', ''));
    });

    toast.success(
      `Downloaded ${completedResults.length} file${completedResults.length > 1 ? 's' : ''} successfully`,
    );
    setDownloadAllFeedback('Downloaded all files!');
    setTimeout(() => setDownloadAllFeedback(''), 3000);
  };

  const handleUploadSingle = async (index: number): Promise<void> => {
    if (!uploadToGoogleDocs) return;
    const r = fileResults[index];
    if (!r || !r.isCompleted || !r.response || r.error) return;
    const baseName = (displayNames[index] || r.file.name).replace(/\.[^.]+$/, '');
    try {
      const folderIdForItem =
        assignedFolders[index]?.id !== undefined ? assignedFolders[index]?.id : selectedFolderId;
      await uploadToGoogleDocs(r.file.name, baseName, r.response, folderIdForItem);
      toast.success('Uploaded to Google Docs');
      // Deselect if it was selected
      setSelected((prev) => {
        if (!prev.has(index)) return prev;
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    } catch (e) {
      toast.error('Upload failed');
    }
  };

  const handleUploadSelected = async (): Promise<void> => {
    if (!uploadToGoogleDocs || !isDriveAuthenticated) return;
    const indices = [...selected];
    if (indices.length === 0) return;

    const eligible = indices
      .map((i) => ({ r: fileResults[i], i }))
      .filter(
        ({ r }) =>
          r &&
          r.isCompleted &&
          !r.error &&
          r.response &&
          (!uploadStatuses || uploadStatuses[r.file.name] !== 'completed'),
      );

    if (eligible.length === 0) return;
    try {
      setIsUploadingSelected(true);
      const results = await Promise.allSettled(
        eligible.map(async ({ r, i }) => {
          const baseName = (displayNames[i] || r!.file.name).replace(/\.[^.]+$/, '');
          const folderIdForItem =
            assignedFolders[i]?.id !== undefined ? assignedFolders[i]?.id : selectedFolderId;
          await uploadToGoogleDocs(r!.file.name, baseName, r!.response, folderIdForItem);
          return i;
        }),
      );
      const succeeded: number[] = results
        .filter((res): res is PromiseFulfilledResult<number> => res.status === 'fulfilled')
        .map((res) => res.value);
      const failed = results.length - succeeded.length;
      if (succeeded.length > 0) {
        // Deselect successfully uploaded items
        setSelected((prev) => {
          const next = new Set(prev);
          for (const idx of succeeded) next.delete(idx);
          return next;
        });
      }
      if (failed === 0) {
        toast.success(
          `Uploaded ${succeeded.length} selected file${succeeded.length > 1 ? 's' : ''}`,
        );
      } else if (succeeded.length > 0) {
        toast.success(`Uploaded ${succeeded.length} selected; ${failed} failed. Check statuses.`);
      } else {
        toast.error('All selected uploads failed.');
      }
    } catch (e) {
      toast.error('Some selected uploads failed.');
    } finally {
      setIsUploadingSelected(false);
    }
  };

  const handleUploadAll = async (): Promise<void> => {
    if (!uploadToGoogleDocs) return;
    if (!isDriveAuthenticated) {
      toast.error('Connect Google Drive to upload');
      return;
    }
    const items = uploadEligible;
    if (items.length === 0) return;
    try {
      setIsUploadingAll(true);
      const results = await Promise.allSettled(
        items.map(async (r) => {
          const idx = fileResults.indexOf(r);
          const baseName = (displayNames[idx] || r.file.name).replace(/\.[^.]+$/, '');
          const folderIdForItem =
            assignedFolders[idx]?.id !== undefined ? assignedFolders[idx]?.id : selectedFolderId;
          await uploadToGoogleDocs(r.file.name, baseName, r.response, folderIdForItem);
          return idx;
        }),
      );
      const succeeded: number[] = results
        .filter((res): res is PromiseFulfilledResult<number> => res.status === 'fulfilled')
        .map((res) => res.value);
      const failed = results.length - succeeded.length;
      if (succeeded.length > 0) {
        // Deselect successfully uploaded items if they were selected
        setSelected((prev) => {
          const next = new Set(prev);
          for (const idx of succeeded) next.delete(idx);
          return next;
        });
      }
      if (failed === 0) {
        toast.success(`Uploaded ${succeeded.length} file${succeeded.length > 1 ? 's' : ''}`);
      } else if (succeeded.length > 0) {
        toast.success(`Uploaded ${succeeded.length}; ${failed} failed. Check statuses.`);
      } else {
        toast.error('All uploads failed.');
      }
    } catch (e) {
      toast.error('Some uploads failed. Check statuses.');
    } finally {
      setIsUploadingAll(false);
    }
  };

  if (fileResults.length === 0) {
    return (
      <Card>
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
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg sm:text-xl">AI Responses</CardTitle>
        <div className="flex items-center gap-3">
          {allCompleted && completedResults.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleDownloadAll}
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
              </TooltipTrigger>
              <TooltipContent>Download all completed files as markdown</TooltipContent>
            </Tooltip>
          )}
          {uploadToGoogleDocs && uploadEligible.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleUploadAll}
                  variant="default"
                  size="sm"
                  className="flex-shrink-0 text-xs sm:text-sm"
                  disabled={isAnyProcessing || !isDriveAuthenticated || isUploadingAll}
                >
                  {isUploadingAll ? (
                    <span className="inline-flex h-4 w-4 items-center justify-center">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        ></path>
                      </svg>
                    </span>
                  ) : (
                    <DownloadCloud className="h-4 w-4 rotate-180" />
                  )}
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
        <div className="max-h-200 space-y-4 overflow-y-auto pr-2 lg:overflow-y-auto">
          <div className="sticky top-0 z-20 space-y-3 border-b bg-card/95 pt-1 pb-3 backdrop-blur supports-[backdrop-filter]:bg-card/60">
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
              </div>
            )}
            {errorCount > 0 && (
              <Alert variant="destructive">
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
                            lowConfidenceIndices.forEach((i) => onRetryFile(i));
                          }}
                          variant="outline"
                          size="sm"
                          className="ml-2"
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
                    onRetry={onRetryFile ? () => onRetryFile(orderedIndex) : undefined}
                    uploadStatus={uploadStatuses?.[result.file.name]}
                    destinationFolderName={
                      assignedFolders[orderedIndex]?.name ?? selectedFolderName ?? undefined
                    }
                    onUpload={
                      uploadToGoogleDocs ? () => handleUploadSingle(orderedIndex) : undefined
                    }
                    canUpload={isDriveAuthenticated}
                    onViewResponse={() => {
                      setViewIndex(orderedIndex);
                      setIsViewOpen(true);
                    }}
                  />
                );
              })}

              <ViewResponseModal
                open={isViewOpen}
                onOpenChange={(open) => {
                  setIsViewOpen(open);
                  if (!open) setViewIndex(null);
                }}
                result={viewIndex != null ? (fileResults[viewIndex] ?? null) : null}
                displayName={
                  viewIndex != null
                    ? displayNames[viewIndex] || fileResults[viewIndex]?.file.name
                    : undefined
                }
                onRetry={
                  viewIndex != null && onRetryFile ? () => onRetryFile(viewIndex) : undefined
                }
                onUpload={
                  viewIndex != null && uploadToGoogleDocs
                    ? () => handleUploadSingle(viewIndex)
                    : undefined
                }
                canUpload={isDriveAuthenticated}
                uploadStatus={
                  viewIndex != null && fileResults[viewIndex]
                    ? uploadStatuses?.[fileResults[viewIndex].file.name]
                    : undefined
                }
                destinationFolderName={
                  viewIndex != null
                    ? (assignedFolders[viewIndex]?.name ?? selectedFolderName ?? undefined)
                    : undefined
                }
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
              onRetrySelected={onRetryFile ? handleRetrySelected : undefined}
              onDownloadSelected={handleDownloadSelected}
              isDriveAuthenticated={isDriveAuthenticated}
              isUploadingSelected={isUploadingSelected}
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
        }}
      />
      <AssignFolderModal
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        selectedCount={selectedCount}
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
          setAssignedFolders((prev) => {
            const next = { ...prev };
            for (const idx of selected) {
              next[idx] = { id: folderId, name: folderName };
            }
            return next;
          });
        }}
      />
    </Card>
  );
};

import { AssignFolderModal } from '@/components/AssignFolderModal';
import { ContextualActionBar } from '@/components/ContextualActionBar';
import { FileSeriesResults } from '@/components/FileSeriesResults';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { PREFERRED_ASSIGNMENT_ROOT } from '@/config/googleDriveConfig';
import { useAutomaticDriveUploads } from '@/hooks/useAutomaticDriveUploads';
import { makeFileKey } from '@/services/responseStore';
import { PROCESSING_FAILURE_LABELS } from '@/services/processingErrors';
import { canChangeUploadDestination } from '@/utils/automaticUploads';
import { suggestSeriesFolderName } from '@/utils/driveFolderName';
import { downloadProcessedFile } from '@/utils/fileUtils';
import { groupFilesBySeries } from '@/utils/seriesGroups';
import { createAndAssignSeriesGroups } from '@/utils/seriesAssignments';
import {
  AlertCircle,
  ChevronDown,
  DownloadCloud,
  FileText,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { FileResult, ProcessingProfile, QueuePauseReason } from '../hooks/useAIProcessor';
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
  defaultDisplayNames?: Record<string, string>;
  onRetryFile?: (index: number) => void;
  onRetryAllFailed?: () => void;
  onCheckApiKey?: () => void;
  onChooseModel?: () => void;
  onReviewInstructions?: () => void;
  onAbortFile?: (index: number) => void;
  onAbortSelected?: (indices: number[]) => void;
  onAbortAll?: () => void;
  uploadStatuses?: Record<string, UploadStatus>;
  isWaitingForNextBatch?: boolean;
  throttleSecondsRemaining?: number;
  isProcessing?: boolean;
  isPaused?: boolean;
  pauseReason?: QueuePauseReason;
  estimatedRemainingSeconds?: number;
  onPause?: () => void;
  onResume?: () => void;
  // Google Drive integration for inline uploads
  uploadToGoogleDocs?: (
    uploads: DriveUploadRequest[],
  ) => Promise<PromiseSettledResult<DriveUploadResult>[]>;
  isDriveAuthenticated?: boolean;
  isUploadSessionActive?: boolean;
  discardUnknownUpload?: (uploadKey: string) => boolean;
  onAutomaticUploadWaitingChange?: (isWaiting: boolean) => void;

  // Google Drive folder selection (for Assign Folder modal)
  driveFolders?: DriveFolder[];
  driveIsLoadingFolders?: boolean;
  driveIsLoadingMoreFolders?: boolean;
  driveHasMoreFolders?: boolean;
  driveLoadFolders?: (parentId?: string, options?: FolderLoadOptions) => Promise<FolderLoadResult>;
  driveLoadMoreFolders?: () => Promise<void>;
  driveCreateFolder?: (name: string, parentId?: string) => Promise<DriveFolder>;
  driveError?: string | null;
}

// Replaced FileItem with UnifiedFileCard per Phase 2

const canStartUpload = (status?: UploadStatus) =>
  !status || status === 'idle' || status === 'error';
const EMPTY_DRIVE_LOCATION: DriveFolder[] = [];
const EMPTY_DISPLAY_NAMES: Record<string, string> = {};

function formatRemainingTime(seconds: number | undefined, isPaused: boolean) {
  if (isPaused) return 'Paused';
  if (seconds === undefined) return 'Calculating…';
  if (seconds < 60) return 'Less than 1 minute';

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `About ${minutes} minutes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `About ${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
}

function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}

export const MultiFileResponseDisplay = ({
  fileResults,
  processingBatchId,
  processingProfile,
  defaultDisplayNames = EMPTY_DISPLAY_NAMES,
  onRetryFile,
  onRetryAllFailed,
  onCheckApiKey,
  onChooseModel,
  onReviewInstructions,
  onAbortFile,
  onAbortSelected,
  onAbortAll,
  uploadStatuses,
  isWaitingForNextBatch = false,
  throttleSecondsRemaining = 0,
  isProcessing = false,
  isPaused = false,
  pauseReason,
  estimatedRemainingSeconds,
  onPause,
  onResume,
  uploadToGoogleDocs,
  isDriveAuthenticated = false,
  isUploadSessionActive = false,
  discardUnknownUpload,
  onAutomaticUploadWaitingChange,
  driveFolders = [],
  driveIsLoadingFolders = false,
  driveIsLoadingMoreFolders = false,
  driveHasMoreFolders = false,
  driveLoadFolders,
  driveLoadMoreFolders,
  driveCreateFolder,
  driveError,
}: MultiFileResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [displayNames, setDisplayNames] = useState<Record<number, string>>({});
  const [downloadAllFeedback, setDownloadAllFeedback] = useState<string>('');
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [createAndAssignProgress, setCreateAndAssignProgress] = useState<{
    current: number;
    total: number;
    title: string;
  } | null>(null);
  const [isBulkRenameOpen, setIsBulkRenameOpen] = useState<boolean>(false);
  const [destinationAssignments, setDestinationAssignments] = useState<
    Record<number, { destination: DriveDestination; location: DriveFolder[] }>
  >({});
  const lowConfidenceIndices = useMemo(
    () =>
      fileResults.flatMap((result, index) => (result.confidence?.level === 'low' ? [index] : [])),
    [fileResults],
  );
  const lowConfidenceSet = useMemo(() => new Set(lowConfidenceIndices), [lowConfidenceIndices]);
  const [sourceFiles] = useState(() => fileResults.map((result) => result.file));
  const uploadKeys = useMemo(
    () => sourceFiles.map((file, index) => makeUploadKey(processingBatchId, index, file)),
    [processingBatchId, sourceFiles],
  );
  const assignableSelectedIndices = useMemo(
    () =>
      [...selected].filter((index) =>
        canChangeUploadDestination(uploadStatuses?.[uploadKeys[index]!]),
      ),
    [selected, uploadKeys, uploadStatuses],
  );
  const resolvedDisplayNames = useMemo(
    () =>
      sourceFiles.map(
        (file, index) => displayNames[index] ?? defaultDisplayNames[makeFileKey(file)] ?? file.name,
      ),
    [sourceFiles, displayNames, defaultDisplayNames],
  );
  const initialAssignment = useMemo(() => {
    const assignments = assignableSelectedIndices.map(
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
  }, [assignableSelectedIndices, destinationAssignments]);
  const suggestedFolderName = useMemo(
    () =>
      suggestSeriesFolderName(
        assignableSelectedIndices.map((index) => resolvedDisplayNames[index] || ''),
      ),
    [assignableSelectedIndices, resolvedDisplayNames],
  );

  const fileSeriesGroups = useMemo(
    () =>
      groupFilesBySeries(
        sourceFiles.map((file, index) => ({
          index,
          displayName: resolvedDisplayNames[index] || file.name,
        })),
        (index) => uploadStatuses?.[uploadKeys[index]!] === 'completed',
      ),
    [sourceFiles, resolvedDisplayNames, uploadStatuses, uploadKeys],
  );
  const selectedSeriesGroups = useMemo(
    () =>
      fileSeriesGroups.filter(
        (group) =>
          !group.isUngrouped &&
          group.indices.length > 0 &&
          group.indices.every((index) => selected.has(index)),
      ),
    [fileSeriesGroups, selected],
  );
  const selectedSeriesGroupIndices = useMemo(
    () => selectedSeriesGroups.flatMap((group) => group.indices),
    [selectedSeriesGroups],
  );
  const selectedSeriesAssignmentPlans = useMemo(
    () =>
      selectedSeriesGroups.map((group) => ({
        title: group.title,
        indices: group.indices,
        folderName: suggestSeriesFolderName(
          group.indices.map((index) => resolvedDisplayNames[index] || ''),
        ),
      })),
    [resolvedDisplayNames, selectedSeriesGroups],
  );
  const isCompleteSeriesGroupSelection =
    selectedSeriesGroups.length > 0 && selectedSeriesGroupIndices.length === selected.size;
  const hasCreateAndAssignSelection =
    isCompleteSeriesGroupSelection &&
    selectedSeriesAssignmentPlans.length > 0 &&
    selectedSeriesAssignmentPlans.every((plan) => plan.folderName);
  const canCreateAndAssignSeries =
    hasCreateAndAssignSelection &&
    assignableSelectedIndices.length === selected.size &&
    selectedSeriesGroupIndices.every((index) => !destinationAssignments[index]);
  const createAndAssignSummary = useMemo(() => {
    if (createAndAssignProgress) {
      return `Creating ${createAndAssignProgress.current} of ${createAndAssignProgress.total}: ${createAndAssignProgress.title}`;
    }

    if (!hasCreateAndAssignSelection) return '';
    if (selectedSeriesAssignmentPlans.length === 1) {
      return `New folder: ${selectedSeriesAssignmentPlans[0]!.folderName}`;
    }

    return `${selectedSeriesAssignmentPlans.length} new folders for selected groups`;
  }, [createAndAssignProgress, hasCreateAndAssignSelection, selectedSeriesAssignmentPlans]);
  const createAndAssignLabel = createAndAssignProgress
    ? `Creating ${createAndAssignProgress.current}/${createAndAssignProgress.total}…`
    : selectedSeriesAssignmentPlans.length > 1
      ? 'Create & Assign Groups'
      : 'Create & Assign';
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
  const automaticUploadRequests = useMemo(
    () =>
      fileResults.flatMap((result, index) => {
        const assignment = destinationAssignments[index];
        if (
          !assignment ||
          !result.isCompleted ||
          result.error ||
          !result.response ||
          lowConfidenceSet.has(index)
        ) {
          return [];
        }

        return [
          {
            uploadKey: uploadKeys[index]!,
            title: (resolvedDisplayNames[index] || result.file.name).replace(/\.[^.]+$/, ''),
            content: result.response,
            folderId: assignment.destination.id,
          },
        ];
      }),
    [destinationAssignments, fileResults, lowConfidenceSet, resolvedDisplayNames, uploadKeys],
  );
  useAutomaticDriveUploads({
    requests: automaticUploadRequests,
    uploadStatuses,
    isDriveAuthenticated,
    isUploadSessionActive,
    uploadToGoogleDocs,
    onWaitingForConnectionChange: onAutomaticUploadWaitingChange,
  });
  const allCompleted = fileResults.length > 0 && fileResults.every((result) => result.isCompleted);
  const isAnyProcessing = fileResults.some((result) => result.isProcessing);
  const pendingCount = fileResults.filter(
    (result) =>
      !result.isCompleted &&
      !result.isProcessing &&
      !result.error &&
      result.queueStatus !== 'cancelled',
  ).length;
  const hasPending = pendingCount > 0;
  const completedCount = fileResults.filter((result) => result.isCompleted).length;
  const errorCount = fileResults.filter((result) => result.error).length;
  const cancelledCount = fileResults.filter((result) => result.queueStatus === 'cancelled').length;
  const processingCount = fileResults.filter((result) => result.isProcessing).length;
  const failureSummary = useMemo(() => {
    const counts = new Map<keyof typeof PROCESSING_FAILURE_LABELS, number>();
    for (const result of fileResults) {
      if (!result.error) continue;
      counts.set(result.error.category, (counts.get(result.error.category) ?? 0) + 1);
    }
    return [...counts].map(([category, count]) => {
      const label = PROCESSING_FAILURE_LABELS[category];
      return `${label[0]?.toUpperCase()}${label.slice(1)}: ${count}`;
    });
  }, [fileResults]);
  const uploadedCount = useMemo(() => {
    if (!uploadStatuses) return 0;
    return fileResults.reduce(
      (acc, _result, index) => acc + (uploadStatuses[uploadKeys[index]!] === 'completed' ? 1 : 0),
      0,
    );
  }, [fileResults, uploadStatuses, uploadKeys]);
  const assignedCount = useMemo(
    () =>
      fileResults.reduce(
        (count, _result, index) => count + (destinationAssignments[index] ? 1 : 0),
        0,
      ),
    [destinationAssignments, fileResults],
  );
  const unassignedCount = fileResults.length - assignedCount;
  const settledCount = completedCount + errorCount + cancelledCount;
  const progressPercentage = fileResults.length > 0 ? (settledCount / fileResults.length) * 100 : 0;
  const canControlQueue = isProcessing || isAnyProcessing || hasPending;
  const showsQueueProgress = canControlQueue || isWaitingForNextBatch;
  const showsQueueEstimate = hasPending || isWaitingForNextBatch || isProcessing;

  const allSelected = useMemo(
    () => fileResults.length > 0 && fileResults.every((_, i) => selected.has(i)),
    [fileResults, selected],
  );
  const selectedCount = selected.size;
  const hasUnknownUpload = Object.values(uploadStatuses || {}).includes('unknown');
  const isDriveLifecycleBlockingProcessing = isUploadSessionActive || hasUnknownUpload;
  const selectedUploadItems = uploadEligible.filter(({ index }) => selected.has(index));
  const uploadSelectedEligibleCount = selectedUploadItems.length;
  const countUnassigned = (items: Array<{ index: number }>) =>
    items.reduce((count, { index }) => count + (destinationAssignments[index] ? 0 : 1), 0);
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

      const name = (resolvedDisplayNames[i] || r.file.name).replace(/\.[^.]+$/, '');
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

    const unassignedCount = countUnassigned(items);
    if (unassignedCount > 0) {
      throw new Error(
        `Assign a destination to ${unassignedCount} file${unassignedCount === 1 ? '' : 's'} before uploading.`,
      );
    }

    const results = await uploadToGoogleDocs(
      items.map(({ result, index }) => ({
        uploadKey: uploadKeys[index]!,
        title: (resolvedDisplayNames[index] || result.file.name).replace(/\.[^.]+$/, ''),
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
    if (!destinationAssignments[index]) {
      toast.error('Assign a destination before uploading.');
      return;
    }

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

    const unassignedCount = countUnassigned(selectedUploadItems);
    if (unassignedCount > 0) {
      toast.error(
        `Assign a destination to ${unassignedCount} selected file${unassignedCount === 1 ? '' : 's'} before uploading.`,
      );
      return;
    }

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

    const unassignedCount = countUnassigned(uploadEligible);
    if (unassignedCount > 0) {
      toast.error(
        `Assign a destination to ${unassignedCount} file${unassignedCount === 1 ? '' : 's'} before uploading.`,
      );
      return;
    }

    try {
      const results = await uploadItems(uploadEligible);
      finishBulkUpload(results, (count) => `Uploaded ${count} file${count === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleCreateAndAssignSeries = async () => {
    const preferredRoot = PREFERRED_ASSIGNMENT_ROOT[0];
    if (
      !driveCreateFolder ||
      !preferredRoot ||
      !canCreateAndAssignSeries ||
      createAndAssignProgress
    ) {
      return;
    }

    const completedIndices = new Set<number>();
    try {
      const result = await createAndAssignSeriesGroups(
        selectedSeriesAssignmentPlans,
        driveCreateFolder,
        preferredRoot.id,
        setCreateAndAssignProgress,
        (indices, folder) => {
          for (const index of indices) completedIndices.add(index);
          setDestinationAssignments((previous) => {
            const next = { ...previous };
            for (const index of indices) {
              next[index] = {
                destination: folder,
                location: [...PREFERRED_ASSIGNMENT_ROOT, folder],
              };
            }
            return next;
          });
        },
      );

      setSelected((previous) => {
        const next = new Set(previous);
        for (const index of completedIndices) next.delete(index);
        return next;
      });

      const assignedFileCount = result.completed.reduce(
        (count, group) => count + group.fileCount,
        0,
      );
      const completedGroupLabel = `${result.completed.length} group${
        result.completed.length === 1 ? '' : 's'
      }`;

      if (result.failed.length === 0) {
        toast.success(`Created and assigned ${completedGroupLabel} (${assignedFileCount} files).`);
      } else {
        const failedGroupNames = result.failed.map((group) => `“${group.title}”`).join(', ');
        const message = `Could not create folders for ${failedGroupNames}.`;
        if (result.completed.length > 0) {
          toast.warning(
            `Created and assigned ${completedGroupLabel} (${assignedFileCount} files). ${message}`,
          );
        } else {
          toast.error(message);
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create and assign the folders.',
      );
    } finally {
      setCreateAndAssignProgress(null);
    }
  };

  const handleCardSelection = useCallback((index: number, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);
  const handleCardName = useCallback((index: number, name: string) => {
    setDisplayNames((previous) => ({ ...previous, [index]: name }));
  }, []);
  const handleCardRetry = useStableCallback((index: number) => {
    if (!isDriveLifecycleBlockingProcessing) onRetryFile?.(index);
  });
  const handleCardAbort = useStableCallback((index: number) => onAbortFile?.(index));
  const handleCardUpload = useStableCallback((index: number) => handleUploadSingle(index));
  const handleCardDiscardUpload = useStableCallback((index: number) =>
    handleDiscardUnknownUpload(index),
  );
  const handleViewResponse = useCallback((index: number) => {
    setViewIndex(index);
    setIsViewOpen(true);
  }, []);
  const isResultUploaded = useCallback(
    (index: number) => uploadStatuses?.[uploadKeys[index]!] === 'completed',
    [uploadKeys, uploadStatuses],
  );
  const handleToggleGroup = useCallback((indices: number[]) => {
    setSelected((previous) => {
      const next = new Set(previous);
      const isFullySelected = indices.every((index) => previous.has(index));
      for (const index of indices) {
        if (isFullySelected) next.delete(index);
        else next.add(index);
      }
      return next;
    });
  }, []);
  const renderFileCard = useCallback(
    (orderedIndex: number) => {
      const result = fileResults[orderedIndex]!;
      const resultProfile = result.processingProfile ?? processingProfile;
      const uploadStatus = uploadStatuses?.[uploadKeys[orderedIndex]!];
      return (
        <UnifiedFileCard
          key={`${result.file.name}-${orderedIndex}`}
          result={result}
          index={orderedIndex}
          selected={selected.has(orderedIndex)}
          onSelectChange={handleCardSelection}
          displayName={resolvedDisplayNames[orderedIndex] || result.file.name}
          onNameChange={handleCardName}
          showMarkdown={showMarkdown}
          onToggleMarkdown={setShowMarkdown}
          onRetry={onRetryFile && !isDriveLifecycleBlockingProcessing ? handleCardRetry : undefined}
          onCheckApiKey={onCheckApiKey}
          onChooseModel={onChooseModel}
          onReviewInstructions={onReviewInstructions}
          onAbort={onAbortFile ? handleCardAbort : undefined}
          uploadStatus={uploadStatus}
          destinationFolderName={destinationAssignments[orderedIndex]?.destination.name}
          onUpload={uploadToGoogleDocs ? handleCardUpload : undefined}
          onDiscardUpload={
            uploadStatus === 'unknown' && discardUnknownUpload ? handleCardDiscardUpload : undefined
          }
          canUpload={isDriveAuthenticated}
          uploadDisabled={isUploadSessionActive}
          onViewResponse={handleViewResponse}
          processingProfile={resultProfile}
        />
      );
    },
    [
      destinationAssignments,
      discardUnknownUpload,
      fileResults,
      handleCardAbort,
      handleCardDiscardUpload,
      handleCardName,
      handleCardRetry,
      handleCardSelection,
      handleCardUpload,
      handleViewResponse,
      isDriveAuthenticated,
      isDriveLifecycleBlockingProcessing,
      isUploadSessionActive,
      onAbortFile,
      onCheckApiKey,
      onChooseModel,
      onRetryFile,
      onReviewInstructions,
      processingProfile,
      resolvedDisplayNames,
      selected,
      showMarkdown,
      uploadKeys,
      uploadStatuses,
      uploadToGoogleDocs,
    ],
  );

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
    <Card className="overflow-hidden border-border/70 lg:h-full lg:min-h-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between space-y-0 pb-2 lg:shrink-0">
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
      <CardContent className="lg:min-h-0 lg:flex-1">
        <div className="space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <div className="sticky top-0 z-20 space-y-2 border-b border-border/70 bg-card/92 pt-1 pb-2 backdrop-blur-md supports-[backdrop-filter]:bg-card/72">
            <Collapsible className="group/details">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Processing Results</span>
                    <span className="text-muted-foreground tabular-nums">
                      {fileResults.length} file{fileResults.length === 1 ? '' : 's'}
                    </span>
                    {showsQueueProgress ? (
                      <span className="ml-auto font-medium tabular-nums sm:ml-0">
                        {Math.round(progressPercentage)}%
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                    {isPaused ? <span className="font-medium text-foreground">Paused</span> : null}
                    {processingCount > 0 ? <span>{processingCount} active</span> : null}
                    {pendingCount > 0 ? <span>{pendingCount} queued</span> : null}
                    {!showsQueueProgress ? <span>{completedCount} complete</span> : null}
                    {showsQueueEstimate ? (
                      <span>{formatRemainingTime(estimatedRemainingSeconds, isPaused)}</span>
                    ) : null}
                    {isWaitingForNextBatch ? (
                      <span>
                        {Math.ceil(throttleSecondsRemaining || 0) > 0
                          ? `Next batch in ${Math.ceil(throttleSecondsRemaining || 0)}s`
                          : 'Scheduling next batch…'}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  {!isPaused && onPause && canControlQueue ? (
                    <Button variant="outline" size="sm" onClick={onPause}>
                      <Pause />
                      Pause
                    </Button>
                  ) : null}
                  {isPaused && onResume ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onResume}
                      disabled={processingCount > 0}
                    >
                      <Play />
                      {processingCount > 0 ? 'Finishing…' : 'Resume'}
                    </Button>
                  ) : null}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="px-2 text-muted-foreground">
                      Details
                      <ChevronDown className="transition-transform group-data-[state=open]/details:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              {showsQueueProgress ? (
                <Progress value={progressPercentage} className="mt-2 h-1.5" />
              ) : null}
              <CollapsibleContent>
                <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {completedCount > 0 ? (
                      <Badge variant="default">{completedCount} completed</Badge>
                    ) : null}
                    {processingCount > 0 ? (
                      <Badge variant="secondary">{processingCount} processing</Badge>
                    ) : null}
                    {errorCount > 0 ? (
                      <Badge variant="destructive">
                        {errorCount} error{errorCount > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                    {cancelledCount > 0 ? (
                      <Badge variant="outline">{cancelledCount} cancelled</Badge>
                    ) : null}
                    {uploadedCount > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500 text-white dark:bg-emerald-600 [a&]:hover:bg-emerald-500/90"
                      >
                        {uploadedCount} uploaded
                      </Badge>
                    ) : null}
                    <Badge variant="outline">{assignedCount} assigned</Badge>
                    {unassignedCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-600/35 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:text-amber-300"
                      >
                        {unassignedCount} unassigned
                      </Badge>
                    ) : null}
                    {pendingCount > 0 ? (
                      <Badge variant="outline">{pendingCount} queued</Badge>
                    ) : null}
                  </div>
                  {isPaused ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {pauseReason?.kind === 'automatic' ? (
                        <>
                          <span className="font-medium text-foreground">
                            Queue paused: {pauseReason.failure.title}.
                          </span>{' '}
                          {pauseReason.failure.message}{' '}
                          {pauseReason.failure.category === 'daily_quota'
                            ? 'The queue will resume automatically.'
                            : 'Correct the provider access or choose another model, then resume. Provider-wide failed files will retry first.'}
                        </>
                      ) : (
                        'Queue paused. Waiting files will not start until you resume.'
                      )}
                    </p>
                  ) : null}
                  {onAbortAll && canControlQueue ? (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onAbortAll}
                      >
                        Abort All
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {errorCount > 0 || lowConfidenceIndices.length > 0 ? (
              <Collapsible className="group/attention rounded-md border border-border/70 bg-muted/35">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 w-full justify-start gap-2 px-2.5 text-xs hover:bg-muted/60"
                  >
                    <AlertCircle
                      className={errorCount > 0 ? 'text-destructive' : 'text-muted-foreground'}
                    />
                    <span className="font-medium">Needs attention</span>
                    <span
                      className="min-w-0 truncate text-muted-foreground"
                      role={errorCount > 0 ? 'alert' : 'status'}
                    >
                      {errorCount > 0
                        ? `${errorCount} failed${lowConfidenceIndices.length > 0 ? ' · ' : ''}`
                        : ''}
                      {lowConfidenceIndices.length > 0
                        ? `${lowConfidenceIndices.length} low confidence`
                        : ''}
                    </span>
                    <ChevronDown className="ml-auto transition-transform group-data-[state=open]/attention:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 border-t border-border/60 p-2">
                    {errorCount > 0 ? (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 text-destructive">
                          {errorCount} file{errorCount > 1 ? 's' : ''} failed ·{' '}
                          {failureSummary.join(' · ')}
                        </span>
                        {onRetryAllFailed ? (
                          <Button
                            onClick={onRetryAllFailed}
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={isProcessing || isDriveLifecycleBlockingProcessing}
                          >
                            <RotateCcw />
                            Retry All
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {lowConfidenceIndices.length > 0 ? (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 text-muted-foreground">
                          {lowConfidenceIndices.length} file
                          {lowConfidenceIndices.length > 1 ? 's have' : ' has'} low confidence.
                        </span>
                        {onRetryFile ? (
                          <Button
                            onClick={() => {
                              lowConfidenceIndices.forEach((index) => onRetryFile(index));
                            }}
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0"
                            disabled={isDriveLifecycleBlockingProcessing}
                          >
                            <RotateCcw />
                            <span className="hidden sm:inline">Retry Low Confidence</span>
                            <span className="sm:hidden">Retry</span>
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
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
              <FileSeriesResults
                groups={fileSeriesGroups}
                fileResults={fileResults}
                selected={selected}
                isUploaded={isResultUploaded}
                destinationAssignments={destinationAssignments}
                onToggleGroup={handleToggleGroup}
                renderFile={renderFileCard}
              />

              <ViewResponseModal
                open={isViewOpen}
                onOpenChange={(open) => {
                  setIsViewOpen(open);
                  if (!open) setViewIndex(null);
                }}
                result={viewedResult}
                displayName={
                  viewIndex != null
                    ? resolvedDisplayNames[viewIndex] || fileResults[viewIndex]?.file.name
                    : undefined
                }
                onRetry={
                  viewIndex != null &&
                  onRetryFile &&
                  !isProcessing &&
                  !isDriveLifecycleBlockingProcessing
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
                    ? destinationAssignments[viewIndex]?.destination.name
                    : undefined
                }
                processingProfile={viewedResult?.processingProfile ?? processingProfile}
              />
            </>
          )}
          {selectedCount > 0 && (
            <ContextualActionBar
              selectedCount={selectedCount}
              onAssignFolder={
                assignableSelectedIndices.length > 0 ? () => setIsAssignOpen(true) : undefined
              }
              onBulkRename={() => setIsBulkRenameOpen(true)}
              onUploadSelected={
                uploadToGoogleDocs && isDriveAuthenticated ? handleUploadSelected : undefined
              }
              onRetrySelected={
                onRetryFile && !isProcessing && !isDriveLifecycleBlockingProcessing
                  ? handleRetrySelected
                  : undefined
              }
              onAbortSelected={onAbortSelected ? () => onAbortSelected([...selected]) : undefined}
              onDownloadSelected={handleDownloadSelected}
              isDriveAuthenticated={isDriveAuthenticated}
              isUploadSessionActive={isUploadSessionActive}
              allSelected={allSelected}
              onToggleSelectAll={(checked) => toggleSelectAll(checked)}
              uploadSelectedCount={uploadSelectedEligibleCount}
              createAndAssignSummary={createAndAssignSummary}
              createAndAssignLabel={createAndAssignLabel}
              onCreateAndAssign={
                hasCreateAndAssignSelection ? handleCreateAndAssignSeries : undefined
              }
              isCreateAndAssignDisabled={
                !isDriveAuthenticated || !driveCreateFolder || !canCreateAndAssignSeries
              }
              isCreatingAndAssigning={createAndAssignProgress !== null}
            />
          )}
        </div>
      </CardContent>
      <BulkRenameModal
        open={isBulkRenameOpen}
        onOpenChange={setIsBulkRenameOpen}
        items={[...selected].map((idx) => ({
          index: idx,
          currentName: resolvedDisplayNames[idx] || fileResults[idx]?.file.name || '',
        }))}
        onApply={(mapping) => {
          setDisplayNames((prev) => ({ ...prev, ...mapping }));
          setSelected(new Set());
        }}
      />
      <AssignFolderModal
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        selectedCount={assignableSelectedIndices.length}
        initialDestination={initialAssignment?.destination}
        initialDestinationLocation={initialAssignment?.location ?? EMPTY_DRIVE_LOCATION}
        initialLocation={PREFERRED_ASSIGNMENT_ROOT}
        suggestedFolderName={suggestedFolderName}
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
            for (const index of assignableSelectedIndices) {
              next[index] = { destination: { id: folderId, name: folderName }, location };
            }
            return next;
          });
          setSelected(new Set());
        }}
      />
    </Card>
  );
};

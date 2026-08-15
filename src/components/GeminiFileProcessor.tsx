'use client';

import ErrorBoundary from '@/components/ErrorBoundary';
import { FileUpload } from '@/components/FileUpload';
import { GoogleDriveAuth } from '@/components/GoogleDriveAuth';
import { InstructionsPanel } from '@/components/InstructionsPanel';
import { MultiFileResponseDisplay } from '@/components/MultiFileResponseDisplay';
import { Badge } from '@/components/ui/badge';
import { providerNeedsApiKey } from '@/config/providerConfig';
import { Toaster } from '@/components/ui/sonner';
import { useAIProcessor } from '@/hooks/useAIProcessor';
import { makeUploadKey, useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useInstructions } from '@/hooks/useInstructions';
import { useProviderSelector } from '@/hooks/useProviderSelector';
import { cn } from '@/lib/utils';
import { makeFileKey } from '@/services/responseStore';
import { getAutomaticDisplayName } from '@/utils/bulkRename';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const ProviderSelector = dynamic(
  () => import('@/components/ProviderSelector').then((mod) => mod.ProviderSelector),
  {
    ssr: false,
    loading: () => <div className="h-32 rounded-xl border border-border/70 bg-background/40" />,
  },
);

const ThemeToggle = dynamic(
  () => import('@/components/ThemeToggle').then((mod) => mod.ThemeToggle),
  {
    ssr: false,
    loading: () => <div className="h-9 w-9 rounded-md border border-border/70 bg-background/40" />,
  },
);

const focusRecoveryTarget = (target: 'api-key' | 'model' | 'instructions'): void => {
  const element =
    document.querySelector<HTMLElement>(`[data-recovery-target="${target}"]`) ??
    document.querySelector<HTMLElement>('#provider-settings');
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => element.focus(), 300);
};

const focusApiKey = () => focusRecoveryTarget('api-key');
const focusModel = () => focusRecoveryTarget('model');
const focusInstructions = () => focusRecoveryTarget('instructions');

export function AIFileProcessor() {
  const PROCESSING_PROFILE_KEY = 'ai-file-processor-processing-profile';
  const [files, setFiles] = useState<File[]>([]);
  const [defaultDisplayNames, setDefaultDisplayNames] = useState<Record<string, string>>({});
  const [processingProfile, setProcessingProfile] = useState<'transcript' | 'book'>('transcript');
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [hasWaitingAutomaticUploads, setHasWaitingAutomaticUploads] = useState(false);
  const {
    selectedProvider,
    selectedModel,
    apiKey,
    geminiProjects,
    setSelectedProvider,
    setSelectedModel,
    setApiKey,
    setGeminiProjects,
  } = useProviderSelector();
  const {
    fileResults,
    processingBatchId,
    isProcessing,
    isPaused,
    pauseReason,
    queueProgress,
    estimatedRemainingSeconds,
    pauseQueue,
    resumeQueue,
    abortAll,
    abortFile,
    abortSelected,
    processFiles,
    retryFile,
    retryAllFailed,
    clearResults,
    isWaitingForNextBatch,
    throttleSecondsRemaining,
  } = useAIProcessor();
  const { instruction, markInstructionAsProcessed, getLastProcessedInstruction } =
    useInstructions();

  // Single source of truth for Google Drive state
  const googleDrive = useGoogleDrive();
  const hasProviderAccess =
    !providerNeedsApiKey(selectedProvider) ||
    (selectedProvider === 'gemini' ? geminiProjects.length > 0 : !!apiKey);

  const handleProcess = async (instruction: string): Promise<void> => {
    if (files.length === 0) return;
    if (!hasProviderAccess) {
      toast.error('API Key Required', {
        description: 'Please enter your API key before processing files.',
      });
      return;
    }
    if (googleDrive.isUploadBlockingProcessing) {
      toast.error('Finish or verify the current Drive upload before processing new files.');
      return;
    }
    if (
      hasWaitingAutomaticUploads &&
      !confirm(
        'Some assigned files are waiting for Google Drive. Start a new processing batch without uploading them?',
      )
    ) {
      return;
    }
    if (!googleDrive.resetUploadStatuses()) {
      toast.error('Finish or verify the current Drive upload before processing new files.');
      return;
    }
    setHasWaitingAutomaticUploads(false);
    markInstructionAsProcessed(instruction);
    await processFiles(
      files,
      instruction,
      selectedProvider,
      selectedModel,
      apiKey,
      processingProfile,
      geminiProjects,
    );
  };

  const handleFilesChange = (nextFiles: File[]): number => {
    if (isProcessing) return 0;
    const currentKeys = new Set(files.map(makeFileKey));
    const nextDisplayNames = { ...defaultDisplayNames };
    const cleanedEntries: Array<{ key: string; cleaned: string }> = [];

    for (const file of nextFiles) {
      const key = makeFileKey(file);
      const existingName = defaultDisplayNames[key];
      const displayName = existingName ?? getAutomaticDisplayName(file.name);

      if (!currentKeys.has(key) && displayName !== file.name) {
        nextDisplayNames[key] = displayName;
        cleanedEntries.push({ key, cleaned: displayName });
      }
    }

    setFiles(nextFiles);
    setDefaultDisplayNames(nextDisplayNames);

    if (cleanedEntries.length > 0) {
      toast.success(
        `${cleanedEntries.length} Display Name${cleanedEntries.length === 1 ? '' : 's'} cleaned`,
        {
          description: 'Original uploaded files did not change.',
          action: {
            label: 'Undo',
            onClick: () =>
              setDefaultDisplayNames((current) => {
                const next = { ...current };
                for (const entry of cleanedEntries) {
                  if (next[entry.key] === entry.cleaned) delete next[entry.key];
                }
                return next;
              }),
          },
        },
      );
    }

    return cleanedEntries.length;
  };

  const handleClearAll = (): boolean => {
    if (googleDrive.isUploadBlockingProcessing) {
      toast.error('Finish or verify the current Drive upload before clearing this batch.');
      return false;
    }
    if (
      hasWaitingAutomaticUploads &&
      !confirm('Some assigned files are waiting for Google Drive. Clear them without uploading?')
    ) {
      return false;
    }
    if (!googleDrive.resetUploadStatuses()) {
      toast.error('Finish or verify the current Drive upload before clearing this batch.');
      return false;
    }
    abortAll();
    setFiles([]);
    setDefaultDisplayNames({});
    setHasWaitingAutomaticUploads(false);
    clearResults();
    return true;
  };

  const handleClearFiles = (): void => {
    if (isProcessing) return;
    setFiles([]);
  };

  const handleResumeQueue = (): void => {
    if (!hasProviderAccess) {
      toast.error('API Key Required', {
        description: 'Correct the API key before resuming this queue.',
      });
      return;
    }
    resumeQueue(selectedProvider, selectedModel, apiKey, geminiProjects);
  };

  const handleRetryFile = async (index: number) => {
    if (googleDrive.isUploadBlockingProcessing) {
      toast.error('Finish or verify the Drive upload before reprocessing files.');
      return;
    }
    const fileToRetry = fileResults[index];
    if (
      fileToRetry &&
      !googleDrive.clearUploadStatus(makeUploadKey(processingBatchId, index, fileToRetry.file))
    ) {
      toast.error('Finish or verify the Drive upload before reprocessing this file.');
      return;
    }

    // Use the last processed instruction, or fall back to current instruction
    const instructionToUse = getLastProcessedInstruction() || instruction.trim();

    if (!instructionToUse) {
      toast.error('Please provide instructions before retrying');
      return;
    }

    if (!hasProviderAccess) {
      toast.error('API Key Required', {
        description: 'Please enter your API key before retrying.',
      });
      return;
    }

    const retryProfile = fileToRetry?.processingProfile ?? processingProfile;
    await retryFile(
      index,
      instructionToUse,
      selectedProvider,
      selectedModel,
      apiKey,
      retryProfile,
      geminiProjects,
    );
  };

  const handleRetryAllFailed = async () => {
    if (googleDrive.isUploadBlockingProcessing) {
      toast.error('Finish or verify the Drive upload before reprocessing files.');
      return;
    }
    const failedEntries = fileResults
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => !!result.error);

    failedEntries.forEach(({ result, index }) => {
      googleDrive.clearUploadStatus(makeUploadKey(processingBatchId, index, result.file));
    });

    // Use the last processed instruction, or fall back to current instruction
    const instructionToUse = getLastProcessedInstruction() || instruction.trim();

    if (!instructionToUse) {
      toast.error('Please provide instructions before retrying');
      return;
    }

    if (!hasProviderAccess) {
      toast.error('API Key Required', {
        description: 'Please enter your API key before retrying.',
      });
      return;
    }

    const groupedFailedIndices = {
      transcript: [] as number[],
      book: [] as number[],
    };

    failedEntries.forEach(({ result, index }) => {
      const profile = result.processingProfile ?? processingProfile;
      groupedFailedIndices[profile].push(index);
    });

    if (groupedFailedIndices.transcript.length > 0) {
      await retryAllFailed(
        instructionToUse,
        selectedProvider,
        selectedModel,
        apiKey,
        'transcript',
        groupedFailedIndices.transcript,
        geminiProjects,
      );
    }

    if (groupedFailedIndices.book.length > 0) {
      await retryAllFailed(
        instructionToUse,
        selectedProvider,
        selectedModel,
        apiKey,
        'book',
        groupedFailedIndices.book,
        geminiProjects,
      );
    }
  };

  const canProcess =
    files.length > 0 && hasProviderAccess && !googleDrive.isUploadBlockingProcessing;
  const completedCount = queueProgress.completed;
  const processingCount = queueProgress.active;
  const errorCount = queueProgress.failed;
  const cancelledCount = queueProgress.cancelled;
  const hasActiveResults = fileResults.length > 0;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(PROCESSING_PROFILE_KEY);
      setProcessingProfile(stored === 'book' ? 'book' : 'transcript');
    } catch (error) {
      console.error('Error loading processing profile:', error);
      setProcessingProfile('transcript');
    } finally {
      setIsProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isProfileLoaded || typeof window === 'undefined') return;
    try {
      localStorage.setItem(PROCESSING_PROFILE_KEY, processingProfile);
    } catch (error) {
      console.error('Error saving processing profile:', error);
    }
  }, [processingProfile, isProfileLoaded]);

  useEffect(() => {
    if (!isProcessing) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isProcessing]);

  return (
    <div className="min-h-screen">
      <div
        className={cn(
          'mx-auto w-full max-w-7xl px-4 pt-5 pb-8 sm:px-6 sm:pt-7 lg:px-8 lg:pt-10',
          hasActiveResults && 'lg:py-4',
        )}
      >
        <div
          className={cn(
            'mb-6 rounded-3xl border border-border/70 bg-card/78 p-4 shadow-xl backdrop-blur-md sm:p-6',
            hasActiveResults && 'lg:mb-4 lg:p-4',
          )}
        >
          <div
            className={cn(
              'grid gap-5',
              hasActiveResults
                ? 'lg:grid-cols-[minmax(0,1fr)_560px] lg:gap-4'
                : 'xl:grid-cols-[1fr_auto]',
            )}
          >
            <div
              className={cn(
                'space-y-4',
                hasActiveResults &&
                  'lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:space-y-0 lg:gap-x-3 lg:gap-y-2',
              )}
            >
              <Badge
                variant="outline"
                className={cn(
                  'w-fit border-primary/40 bg-primary/10',
                  hasActiveResults && 'lg:col-start-1 lg:row-start-1',
                )}
              >
                Batch-ready AI workspace
              </Badge>
              <div
                className={cn(
                  'space-y-2',
                  hasActiveResults && 'lg:col-span-2 lg:row-start-2 lg:space-y-1',
                )}
              >
                <h1
                  className={cn(
                    'text-3xl leading-tight font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl',
                    hasActiveResults && 'lg:text-3xl',
                  )}
                >
                  AI File Processor
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Process `.txt`, `.md`, or `.docx` files in a responsive queue with live progress,
                  retries, and optional Google Docs export.
                </p>
              </div>
              <div
                className={cn(
                  'flex flex-wrap gap-2',
                  hasActiveResults && 'lg:col-start-2 lg:row-start-1 lg:justify-end',
                )}
              >
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {completedCount} complete
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Loader2 className={`h-3.5 w-3.5 ${processingCount > 0 ? 'animate-spin' : ''}`} />
                  {processingCount} active
                </Badge>
                <Badge variant={errorCount > 0 ? 'destructive' : 'outline'} className="gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errorCount} errors
                </Badge>
                {cancelledCount > 0 ? (
                  <Badge variant="outline">{cancelledCount} cancelled</Badge>
                ) : null}
                <Badge variant="outline">
                  {hasActiveResults ? `${queueProgress.waiting} waiting` : `${files.length} ready`}
                </Badge>
                {isPaused ? <Badge variant="secondary">Paused</Badge> : null}
              </div>
            </div>
            <div
              className={cn(
                'min-w-0 space-y-3 rounded-2xl border border-border/70 bg-background/65 p-3 sm:p-4 xl:min-w-[360px]',
                hasActiveResults && 'lg:space-y-2 lg:p-2',
              )}
            >
              <ProviderSelector
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onProviderChange={setSelectedProvider}
                onModelChange={setSelectedModel}
                onApiKeyChange={setApiKey}
                apiKey={apiKey}
                geminiProjects={geminiProjects}
                onGeminiProjectsChange={setGeminiProjects}
                compact={hasActiveResults}
                disabled={isProcessing && !isPaused}
              />
              <div className="flex flex-wrap items-center gap-2">
                <GoogleDriveAuth {...googleDrive} />
                <div className="ml-auto">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          <ErrorBoundary>
            <div className="space-y-5 lg:col-span-2">
              <FileUpload
                files={files}
                displayNames={defaultDisplayNames}
                onFilesChange={handleFilesChange}
                onClearFiles={handleClearFiles}
                disabled={isProcessing}
              />
              <InstructionsPanel
                onProcess={handleProcess}
                onClearAll={handleClearAll}
                isProcessing={isProcessing}
                isDriveUploadBlocking={googleDrive.isUploadBlockingProcessing}
                canProcess={canProcess}
                fileCount={files.length}
                processingProfile={processingProfile}
                onProcessingProfileChange={setProcessingProfile}
              />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div
              className={cn(
                'lg:col-span-3',
                hasActiveResults &&
                  'lg:sticky lg:top-4 lg:h-[calc(100dvh-17rem)] lg:self-start xl:h-[calc(100dvh-15.5rem)]',
              )}
            >
              <MultiFileResponseDisplay
                key={processingBatchId}
                fileResults={fileResults}
                processingBatchId={processingBatchId}
                processingProfile={processingProfile}
                defaultDisplayNames={defaultDisplayNames}
                onRetryFile={handleRetryFile}
                onRetryAllFailed={handleRetryAllFailed}
                onCheckApiKey={focusApiKey}
                onChooseModel={focusModel}
                onReviewInstructions={focusInstructions}
                onAbortAll={abortAll}
                onAbortFile={(i) => abortFile(i)}
                onAbortSelected={(indices) => abortSelected(indices)}
                uploadStatuses={googleDrive.uploadStatuses}
                isWaitingForNextBatch={isWaitingForNextBatch}
                throttleSecondsRemaining={throttleSecondsRemaining}
                isProcessing={isProcessing}
                isPaused={isPaused}
                pauseReason={pauseReason}
                estimatedRemainingSeconds={estimatedRemainingSeconds}
                onPause={pauseQueue}
                onResume={handleResumeQueue}
                uploadToGoogleDocs={googleDrive.uploadToGoogleDocs}
                isDriveAuthenticated={googleDrive.isAuthenticated}
                isUploadSessionActive={googleDrive.isUploadSessionActive}
                discardUnknownUpload={googleDrive.discardUnknownUpload}
                onAutomaticUploadWaitingChange={setHasWaitingAutomaticUploads}
                driveFolders={googleDrive.folders}
                driveIsLoadingFolders={googleDrive.isLoadingFolders}
                driveIsLoadingMoreFolders={googleDrive.isLoadingMoreFolders}
                driveHasMoreFolders={googleDrive.hasMoreFolders}
                driveLoadFolders={googleDrive.loadFolders}
                driveLoadMoreFolders={googleDrive.loadMoreFolders}
                driveCreateFolder={googleDrive.createFolder}
                driveError={googleDrive.error}
              />
            </div>
          </ErrorBoundary>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

// Export with old name for backwards compatibility during transition
export { AIFileProcessor as GeminiFileProcessor };

'use client';

import ErrorBoundary from '@/components/ErrorBoundary';
import { FileUpload } from '@/components/FileUpload';
import { GoogleDriveAuth } from '@/components/GoogleDriveAuth';
import { InstructionsPanel } from '@/components/InstructionsPanel';
import { MultiFileResponseDisplay } from '@/components/MultiFileResponseDisplay';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { useAIProcessor } from '@/hooks/useAIProcessor';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useInstructions } from '@/hooks/useInstructions';
import { useProviderSelector } from '@/hooks/useProviderSelector';
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

export function AIFileProcessor() {
  const PROCESSING_PROFILE_KEY = 'ai-file-processor-processing-profile';
  const [files, setFiles] = useState<File[]>([]);
  const [processingProfile, setProcessingProfile] = useState<'transcript' | 'book'>('transcript');
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const {
    selectedProvider,
    selectedModel,
    apiKey,
    setSelectedProvider,
    setSelectedModel,
    setApiKey,
  } = useProviderSelector();
  const {
    fileResults,
    isProcessing,
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

  const handleProcess = async (instruction: string): Promise<void> => {
    if (files.length === 0) return;
    if (!apiKey) {
      toast.error('API Key Required', {
        description: 'Please enter your API key before processing files.',
      });
      return;
    }
    markInstructionAsProcessed(instruction);
    await processFiles(
      files,
      instruction,
      selectedProvider,
      selectedModel,
      apiKey,
      processingProfile,
    );
  };

  const handleClearAll = (): void => {
    setFiles([]);
    clearResults();
  };

  const handleClearFiles = (): void => {
    setFiles([]);
  };

  const handleRetryFile = async (index: number) => {
    const fileToRetry = fileResults[index];
    if (fileToRetry) {
      googleDrive.clearUploadStatus(fileToRetry.file.name);
    }

    // Use the last processed instruction, or fall back to current instruction
    const instructionToUse = getLastProcessedInstruction() || instruction.trim();

    if (!instructionToUse) {
      toast.error('Please provide instructions before retrying');
      return;
    }

    if (!apiKey) {
      toast.error('API Key Required', {
        description: 'Please enter your API key before retrying.',
      });
      return;
    }

    await retryFile(
      index,
      instructionToUse,
      selectedProvider,
      selectedModel,
      apiKey,
      processingProfile,
    );
  };

  const handleRetryAllFailed = async () => {
    fileResults.forEach((result) => {
      if (result.error) {
        googleDrive.clearUploadStatus(result.file.name);
      }
    });

    // Use the last processed instruction, or fall back to current instruction
    const instructionToUse = getLastProcessedInstruction() || instruction.trim();

    if (!instructionToUse) {
      toast.error('Please provide instructions before retrying');
      return;
    }

    if (!apiKey) {
      toast.error('API Key Required', {
        description: 'Please enter your API key before retrying.',
      });
      return;
    }

    await retryAllFailed(
      instructionToUse,
      selectedProvider,
      selectedModel,
      apiKey,
      processingProfile,
    );
  };

  const canProcess = files.length > 0 && !!apiKey;
  const completedCount = fileResults.filter((result) => result.isCompleted && !result.error).length;
  const processingCount = fileResults.filter((result) => result.isProcessing).length;
  const errorCount = fileResults.filter((result) => result.error).length;

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

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-8 sm:px-6 sm:pt-7 lg:px-8 lg:pt-10">
        <div className="mb-6 rounded-3xl border border-border/70 bg-card/78 p-4 shadow-xl backdrop-blur-md sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <Badge variant="outline" className="w-fit border-primary/40 bg-primary/10">
                Batch-ready AI workspace
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl leading-tight font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  AI File Processor
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Upload up to 20 `.txt` or `.docx` files. Process in queued batches with live
                  progress, retries, and optional Google Docs export.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
                <Badge variant="outline">{files.length}/20 queued</Badge>
              </div>
            </div>
            <div className="min-w-0 space-y-3 rounded-2xl border border-border/70 bg-background/65 p-3 sm:p-4 xl:min-w-[360px]">
              <ProviderSelector
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onProviderChange={setSelectedProvider}
                onModelChange={setSelectedModel}
                onApiKeyChange={setApiKey}
                apiKey={apiKey}
              />
              <div className="flex flex-wrap items-center gap-2">
                <GoogleDriveAuth {...googleDrive} variant="toolbar" />
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
              <FileUpload files={files} onFilesChange={setFiles} onClearFiles={handleClearFiles} />
              <InstructionsPanel
                onProcess={handleProcess}
                onClearAll={handleClearAll}
                isProcessing={isProcessing}
                canProcess={canProcess}
                fileCount={files.length}
                processingProfile={processingProfile}
                onProcessingProfileChange={setProcessingProfile}
              />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="lg:col-span-3">
              <MultiFileResponseDisplay
                fileResults={fileResults}
                processingProfile={processingProfile}
                onRetryFile={handleRetryFile}
                onRetryAllFailed={handleRetryAllFailed}
                onAbortAll={abortAll}
                onAbortFile={(i) => abortFile(i)}
                onAbortSelected={(indices) => abortSelected(indices)}
                uploadStatuses={googleDrive.uploadStatuses}
                isWaitingForNextBatch={isWaitingForNextBatch}
                throttleSecondsRemaining={throttleSecondsRemaining}
                selectedFolderName={googleDrive.selectedFolder?.name || null}
                uploadToGoogleDocs={googleDrive.uploadToGoogleDocs}
                selectedFolderId={googleDrive.selectedFolder?.id || null}
                isDriveAuthenticated={googleDrive.isAuthenticated}
                driveFolders={googleDrive.folders}
                driveSelectedFolder={googleDrive.selectedFolder}
                driveIsLoadingFolders={googleDrive.isLoadingFolders}
                driveIsLoadingMoreFolders={googleDrive.isLoadingMoreFolders}
                driveHasMoreFolders={googleDrive.hasMoreFolders}
                driveLoadFolders={googleDrive.loadFolders}
                driveLoadMoreFolders={googleDrive.loadMoreFolders}
                driveSelectFolder={googleDrive.selectFolder}
                driveCreateFolder={googleDrive.createFolder}
                driveGetFolder={googleDrive.getFolder}
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

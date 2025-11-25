'use client';

import ErrorBoundary from '@/components/ErrorBoundary';
import { FileUpload } from '@/components/FileUpload';
import { GoogleDriveAuth } from '@/components/GoogleDriveAuth';
import { InstructionsPanel } from '@/components/InstructionsPanel';
import { ModelSelector } from '@/components/ModelSelector';
import { MultiFileResponseDisplay } from '@/components/MultiFileResponseDisplay';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import { useAIProcessor } from '@/hooks/useAIProcessor';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useInstructions } from '@/hooks/useInstructions';
import { useModelSelector } from '@/hooks/useModelSelector';
import { useState } from 'react';

export function GeminiFileProcessor() {
  const [files, setFiles] = useState<File[]>([]);
  const { selectedModel, setSelectedModel } = useModelSelector();
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
    markInstructionAsProcessed(instruction);
    await processFiles(files, instruction, selectedModel);
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
      alert('Please provide instructions before retrying');
      return;
    }

    await retryFile(index, instructionToUse, selectedModel);
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
      alert('Please provide instructions before retrying');
      return;
    }

    await retryAllFailed(instructionToUse, selectedModel);
  };

  const canProcess = files.length > 0;

  // Single-file response view removed; unified multi-file view is used for all cases

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4">
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Gemini File Processor
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
                Upload any number of .txt files. Processing runs in queued batches of 10 every 90
                seconds with real-time updates.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
                <div className="w-full sm:w-auto">
                  <GoogleDriveAuth {...googleDrive} variant="toolbar" />
                </div>
              </div>
              <div className="flex flex-row flex-wrap items-center gap-3">
                {/* <QuotaMonitor
                  projectNumber={process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER}
                  model={selectedModel}
                  isModelLoaded={isModelLoaded}
                  variant="toolbar"
                  className=""
                  showRefreshButton={true}
                  autoRefresh={true}
                /> */}
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <ErrorBoundary>
            <div className="space-y-6 lg:col-span-2">
              <FileUpload files={files} onFilesChange={setFiles} onClearFiles={handleClearFiles} />
              <InstructionsPanel
                onProcess={handleProcess}
                onClearAll={handleClearAll}
                isProcessing={isProcessing}
                canProcess={canProcess}
                fileCount={files.length}
              />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="lg:col-span-3">
              <MultiFileResponseDisplay
                fileResults={fileResults}
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

'use client';

import ErrorBoundary from '@/components/ErrorBoundary';
import { FileUpload } from '@/components/FileUpload';
import { GoogleDriveAuth } from '@/components/GoogleDriveAuth';
import { InstructionsPanel } from '@/components/InstructionsPanel';
import { MultiFileResponseDisplay } from '@/components/MultiFileResponseDisplay';
import { ProviderSelector } from '@/components/ProviderSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import { useAIProcessor } from '@/hooks/useAIProcessor';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useInstructions } from '@/hooks/useInstructions';
import { useProviderSelector } from '@/hooks/useProviderSelector';
import { useState } from 'react';
import { toast } from 'sonner';

export function AIFileProcessor() {
  const [files, setFiles] = useState<File[]>([]);
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
    await processFiles(files, instruction, selectedProvider, selectedModel, apiKey);
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

    await retryFile(index, instructionToUse, selectedProvider, selectedModel, apiKey);
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

    await retryAllFailed(instructionToUse, selectedProvider, selectedModel, apiKey);
  };

  const canProcess = files.length > 0 && !!apiKey;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4">
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                AI File Processor
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
                Upload up to 20 .txt files at once. Select your AI provider and model to process
                files.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <ProviderSelector
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onProviderChange={setSelectedProvider}
                onModelChange={setSelectedModel}
                onApiKeyChange={setApiKey}
                apiKey={apiKey}
              />
              <div className="flex flex-row flex-wrap items-center gap-3">
                <div className="w-full sm:w-auto">
                  <GoogleDriveAuth {...googleDrive} variant="toolbar" />
                </div>
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

// Export with old name for backwards compatibility during transition
export { AIFileProcessor as GeminiFileProcessor };

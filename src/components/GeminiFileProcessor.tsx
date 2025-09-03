'use client';

import { FileUpload } from '@/components/FileUpload';
import { GoogleDriveAuth } from '@/components/GoogleDriveAuth';
import { GoogleDriveFolderSelector } from '@/components/GoogleDriveFolderSelector';
import { GoogleDriveUpload } from '@/components/GoogleDriveUpload';
import { InstructionsPanel } from '@/components/InstructionsPanel';
import { ModelSelector } from '@/components/ModelSelector';
import { MultiFileResponseDisplay } from '@/components/MultiFileResponseDisplay';
import { QuotaMonitor } from '@/components/QuotaMonitor';
import { ResponseDisplay } from '@/components/ResponseDisplay';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import { useAIProcessor } from '@/hooks/useAIProcessor';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useInstructions } from '@/hooks/useInstructions';
import { useModelSelector } from '@/hooks/useModelSelector';
import { useState } from 'react';

export function GeminiFileProcessor() {
  const [files, setFiles] = useState<File[]>([]);
  const { selectedModel, setSelectedModel, isModelLoaded } = useModelSelector();
  const {
    fileResults,
    isProcessing,
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

  const handleFolderSelect = (_folderId: string | null, _folderName: string) => {
    // This logic might need to be adjusted if folder selection is managed within the hook
    // For now, we assume the hook's selectFolder is the source of truth
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
  const hasResults = fileResults.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4">
        <div className="mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Gemini File Processor
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
                Upload up to 10 text files and let Gemini AI process them in parallel with your
                custom instructions
              </p>
            </div>
            <div className="flex items-center gap-3 sm:justify-between">
              <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
              <div className="flex justify-end sm:justify-start lg:justify-end">
                <ThemeToggle />
              </div>
            </div>

            <QuotaMonitor
              projectNumber={process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER}
              model={selectedModel}
              isModelLoaded={isModelLoaded}
              className="max-w-sm"
              showRefreshButton={true}
              autoRefresh={true}
            />
          </div>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Google Drive Integration</h2>
            <div className="space-y-4">
              <GoogleDriveAuth {...googleDrive} />

              {googleDrive.isAuthenticated && (
                <>
                  <Separator />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <GoogleDriveFolderSelector
                      {...googleDrive}
                      onFolderSelect={handleFolderSelect}
                    />
                    {hasResults && (
                      <GoogleDriveUpload
                        {...googleDrive}
                        fileResults={fileResults}
                        selectedFolderId={googleDrive.selectedFolder?.id}
                        selectedFolderName={googleDrive.selectedFolder?.name}
                        isProcessing={isProcessing}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <FileUpload files={files} onFilesChange={setFiles} onClearFiles={handleClearFiles} />
            <InstructionsPanel
              onProcess={handleProcess}
              onClearAll={handleClearAll}
              isProcessing={isProcessing}
              canProcess={canProcess}
              fileCount={files.length}
            />
          </div>

          {files.length <= 1 && fileResults.length <= 1 ? (
            <ResponseDisplay
              response={fileResults[0]?.response || ''}
              isProcessing={isProcessing && fileResults.length > 0 && !fileResults[0]?.isCompleted}
              file={fileResults[0]?.file}
            />
          ) : (
            <MultiFileResponseDisplay
              fileResults={fileResults}
              onRetryFile={handleRetryFile}
              onRetryAllFailed={handleRetryAllFailed}
              uploadStatuses={googleDrive.uploadStatuses}
              isWaitingForNextBatch={isWaitingForNextBatch}
              throttleSecondsRemaining={throttleSecondsRemaining}
            />
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}

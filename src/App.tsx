import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { GoogleDriveAuth } from './components/GoogleDriveAuth';
import { GoogleDriveFolderSelector } from './components/GoogleDriveFolderSelector';
import { GoogleDriveUpload } from './components/GoogleDriveUpload';
import { InstructionsPanel } from './components/InstructionsPanel';
import { ModelSelector } from './components/ModelSelector';
import { MultiFileResponseDisplay } from './components/MultiFileResponseDisplay';
import { ResponseDisplay } from './components/ResponseDisplay';
import { ThemeToggle } from './components/ThemeToggle';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { Toaster } from './components/ui/sonner';
import { useAIProcessor } from './hooks/useAIProcessor';
import { useModelSelector } from './hooks/useModelSelector';
import { useInstructions } from './hooks/useInstructions';
import { useGoogleDrive } from './hooks/useGoogleDrive';

function App(): JSX.Element {
  const [files, setFiles] = useState<File[]>([]);
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const { selectedModel, setSelectedModel } = useModelSelector();
  const { fileResults, isProcessing, processFiles, retryFile, retryAllFailed, clearResults } =
    useAIProcessor();
  const { instruction, markInstructionAsProcessed, getLastProcessedInstruction } =
    useInstructions();
  const { clearUploadStatus } = useGoogleDrive();

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

  const handleFolderSelect = (folderId: string | null, folderName: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
  };

  const handleRetryFile = async (index: number) => {
    // Get the file name before retrying to clear its upload status
    const fileToRetry = fileResults[index];
    if (fileToRetry) {
      // Clear the Google Drive upload status for this file
      clearUploadStatus(fileToRetry.file.name);
    }

    // Proceed with the retry
    await retryFile(index, getLastProcessedInstruction(), selectedModel);
  };

  const handleRetryAllFailed = async () => {
    // Clear upload status for all failed files before retrying
    fileResults.forEach((result) => {
      if (result.error) {
        clearUploadStatus(result.file.name);
      }
    });

    // Proceed with retry all failed
    await retryAllFailed(getLastProcessedInstruction(), selectedModel);
  };

  const canProcess = files.length > 0;
  const hasResults = fileResults.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4">
        {/* Header */}
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
          </div>
        </div>

        {/* Google Drive Integration Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Google Drive Integration</h2>
            <div className="space-y-4">
              <GoogleDriveAuth onAuthChange={setIsGoogleDriveConnected} />

              {isGoogleDriveConnected && (
                <>
                  <Separator />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <GoogleDriveFolderSelector
                      onFolderSelect={handleFolderSelect}
                      isAuthenticated={isGoogleDriveConnected}
                    />
                    {hasResults && (
                      <GoogleDriveUpload
                        fileResults={fileResults}
                        selectedFolderId={selectedFolderId}
                        selectedFolderName={selectedFolderName}
                        isProcessing={isProcessing}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - File Upload and Instructions */}
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

          {/* Right Column - Results */}
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
            />
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export default App;

import { AlertCircle, CheckCircle, ExternalLink, FileText, Loader2, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface GoogleDriveUploadProps {
  fileResults: Array<{ file: File; response: string; isProcessing: boolean; isCompleted: boolean }>;
  selectedFolderId?: string | null;
  selectedFolderName?: string;
  onUploadComplete?: (uploadedFiles: Array<{ name: string; url: string }>) => void;
  isProcessing?: boolean;
}

export function GoogleDriveUpload({
  fileResults,
  selectedFolderId,
  selectedFolderName,
  onUploadComplete,
  isProcessing = false,
}: GoogleDriveUploadProps): JSX.Element {
  const { isAuthenticated, uploadToGoogleDocs, uploadStatuses, error } = useGoogleDrive();

  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; url: string; originalFileName: string }>
  >([]);

  // Initialize file names with default values
  React.useEffect(() => {
    const defaultNames: Record<string, string> = {};
    fileResults.forEach((result) => {
      if (!fileNames[result.file.name]) {
        // Generate default name from original filename
        const baseName = result.file.name?.replace(/\.[^/.]+$/, ''); // Remove extension
        defaultNames[result.file.name] = baseName;
      }
    });
    if (Object.keys(defaultNames).length > 0) {
      setFileNames((prev) => ({ ...defaultNames, ...prev }));
    }
  }, [fileResults]);

  React.useEffect(() => {
    if (isProcessing) {
      setUploadedFiles([]);
    }
  }, [isProcessing]);

  const handleFileNameChange = (originalFileName: string, newName: string) => {
    setFileNames((prev) => ({
      ...prev,
      [originalFileName]: newName,
    }));
  };

  const handleSingleUpload = async (result: { file: File; response: string }) => {
    if (!isAuthenticated) return;

    const fileName = fileNames[result.file.name] || result.file.name;

    try {
      const uploadedFile = await uploadToGoogleDocs(
        result.file.name, // Pass fileId
        fileName,
        result.response,
        selectedFolderId,
      );

      const newUploadedFile = {
        name: fileName,
        url: uploadedFile.webViewLink || '#',
        originalFileName: result.file.name,
      };

      setUploadedFiles((prev) => [...prev, newUploadedFile]);
      onUploadComplete?.([newUploadedFile]);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleBatchUpload = async () => {
    if (!isAuthenticated || fileResults.length === 0) return;

    try {
      const uploadPromises = fileResults.map(async (result) => {
        const fileName = fileNames[result.file.name] || result.file.name;
        const uploadedFile = await uploadToGoogleDocs(
          result.file.name, // Pass fileId
          fileName,
          result.response,
          selectedFolderId,
        );

        return {
          name: fileName,
          url: uploadedFile.webViewLink || '#',
          originalFileName: result.file.name,
        };
      });

      const results = await Promise.all(uploadPromises);
      setUploadedFiles((prev) => [...prev, ...results]);
      onUploadComplete?.(results);
    } catch (error) {
      console.error('Batch upload failed:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <Upload className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">Connect to Google Drive to upload files</p>
        </div>
      </Card>
    );
  }

  if (fileResults.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">Process files to enable Google Drive upload</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-full space-y-4 overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Upload to Google Drive</h3>
        {fileResults.some((result) => uploadStatuses[result.file.name] !== 'completed') && (
          <Button
            onClick={handleBatchUpload}
            disabled={
              Object.values(uploadStatuses).some((status) => status === 'uploading') || isProcessing
            }
            size="sm"
            className="flex min-w-0 items-center justify-center bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90 sm:px-4 sm:text-sm"
          >
            {Object.values(uploadStatuses).some((status) => status === 'uploading') && (
              <Loader2 className="mr-1 h-3 w-3 flex-shrink-0 animate-spin sm:h-4 sm:w-4" />
            )}
            <span className="truncate">
              <span className="hidden sm:inline">Upload All</span>
              <span className="sm:hidden">Upload</span>
            </span>
          </Button>
        )}
      </div>

      <div className="rounded-md border border-primary/20 bg-primary/10 p-2">
        <p className="text-sm text-primary">
          Destination:{' '}
          <span className="font-medium">{selectedFolderName || 'Root (My Drive)'}</span>
        </p>
      </div>

      {error && (
        <div className="flex items-start space-x-2 rounded-md border border-destructive/20 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="max-h-[500px] space-y-3 overflow-y-auto lg:max-h-120 lg:overflow-y-auto">
        {fileResults.map((result) => {
          const isUploaded = uploadStatuses[result.file.name] === 'completed';
          const isUploadingThisFile = uploadStatuses[result.file.name] === 'uploading';
          const uploadedFile = isUploaded
            ? uploadedFiles.find((f) => f.originalFileName === result.file.name)
            : undefined;

          return (
            <div key={result.file.name} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center space-x-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-medium" title={result.file.name}>
                    {result.file.name}
                  </span>
                  {isUploaded && <CheckCircle className="h-4 w-4 shrink-0 text-primary" />}
                </div>
              </div>

              {!isUploaded && (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Document name in Google Drive:
                    </label>
                    <Input
                      value={fileNames[result.file.name] || ''}
                      onChange={(e) => handleFileNameChange(result.file.name, e.target.value)}
                      placeholder="Enter document name"
                      className="text-sm"
                    />
                  </div>
                  <Button
                    onClick={() => handleSingleUpload(result)}
                    disabled={
                      isUploadingThisFile ||
                      result.isProcessing ||
                      !result.isCompleted ||
                      !fileNames[result.file.name]?.trim()
                    }
                    size="sm"
                    className="flex w-full min-w-0 items-center justify-center px-2 text-xs sm:px-4 sm:text-sm"
                  >
                    {isUploadingThisFile && (
                      <Loader2 className="mr-1 h-3 w-3 flex-shrink-0 animate-spin sm:h-4 sm:w-4" />
                    )}
                    {!isUploadingThisFile && (
                      <Upload className="mr-1 h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                    )}
                    <span className="truncate">
                      <span className="hidden sm:inline">Upload to Google Docs</span>
                      <span className="sm:hidden">Upload</span>
                    </span>
                  </Button>
                </div>
              )}

              {isUploaded && uploadedFile && (
                <div className="rounded-md border border-primary/20 bg-primary/10 p-2">
                  <div className="flex min-w-0 items-center justify-between">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm whitespace-nowrap text-primary">Uploaded as:</span>
                      <span
                        className="text-sm font-medium break-all text-primary"
                        title={uploadedFile.name}
                      >
                        {uploadedFile.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(uploadedFile.url, '_blank')}
                      className="text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="border-t pt-2">
          <p className="text-sm text-primary">
            ✓ {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded successfully
          </p>
        </div>
      )}
    </Card>
  );
}

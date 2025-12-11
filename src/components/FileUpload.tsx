import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onClearFiles?: () => void;
}

export const FileUpload = ({ files, onFilesChange, onClearFiles }: FileUploadProps) => {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'hsl(var(--primary))';
    e.currentTarget.style.backgroundColor = 'hsl(var(--accent) / 0.5)';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.style.borderColor = '';
    e.currentTarget.style.backgroundColor = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.style.borderColor = '';
    e.currentTarget.style.backgroundColor = '';

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const MAX_FILES = 20; // Limit to 20 files due to daily API quota

  const addFiles = (newFiles: File[]): void => {
    const textFiles = newFiles.filter((file) => file.type === 'text/plain');

    if (textFiles.length !== newFiles.length) {
      toast.error('Invalid file type', {
        description: 'Please upload only text files (.txt)',
      });
      return;
    }

    // Check for duplicates (same name and size)
    const duplicates: string[] = [];
    const uniqueFiles = textFiles.filter((newFile) => {
      const isDuplicate = files.some(
        (existingFile) => existingFile.name === newFile.name && existingFile.size === newFile.size,
      );
      if (isDuplicate) {
        duplicates.push(newFile.name);
      }
      return !isDuplicate;
    });

    if (duplicates.length > 0) {
      toast.warning('Duplicate files ignored', {
        description: `The following files are already uploaded: ${duplicates.join(', ')}`,
      });
    }

    if (uniqueFiles.length === 0) {
      return;
    }

    // Check if adding these files would exceed the maximum limit
    const totalFiles = files.length + uniqueFiles.length;
    if (totalFiles > MAX_FILES) {
      const allowedCount = MAX_FILES - files.length;
      if (allowedCount <= 0) {
        toast.error('Maximum file limit reached', {
          description: `You can only upload up to ${MAX_FILES} files at once due to daily API quota limits.`,
        });
        return;
      }
      // Only add files up to the limit
      const filesToAdd = uniqueFiles.slice(0, allowedCount);
      onFilesChange([...files, ...filesToAdd]);
      toast.warning(`Only ${allowedCount} file${allowedCount > 1 ? 's' : ''} added`, {
        description: `Maximum limit of ${MAX_FILES} files reached. ${uniqueFiles.length - allowedCount} file(s) were not added.`,
      });
      return;
    }

    onFilesChange([...files, ...uniqueFiles]);
    toast.success(
      `${uniqueFiles.length} file${uniqueFiles.length > 1 ? 's' : ''} added successfully`,
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      addFiles(Array.from(selectedFiles));
    }
  };

  const removeFile = (index: number): void => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  return (
    <Card className="w-full max-w-full overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Upload Text Files</CardTitle>
          <Badge variant={files.length > 0 ? 'secondary' : 'outline'}>
            {files.length} file{files.length === 1 ? '' : 's'} selected
          </Badge>
        </div>
        {files.length > 5 && (
          <Alert variant="default" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Large batch detected. Files are rate-limited to 5 per minute (Flash) or 10 per minute
              (Flash Lite).
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent className="w-full max-w-full overflow-hidden">
        <div
          className={`w-full max-w-full overflow-hidden rounded-lg border-2 border-dashed p-4 text-center transition-all duration-300 sm:p-6 lg:p-8 ${
            files.length > 0
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary hover:bg-accent/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-primary sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
              <p className="text-sm font-medium text-foreground sm:text-base">
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </p>

              {/* Batch upload progress (first batch up to 10 files) */}
              <div className="mx-auto max-w-md space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Next batch</span>
                  <span>{Math.min(files.length, 10)}/10</span>
                </div>
                <Progress value={(Math.min(files.length, 10) / 10) * 100} className="h-2" />
              </div>

              <div className="max-h-24 w-full max-w-full space-y-2 overflow-y-auto sm:max-h-32">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex w-full min-w-0 items-center justify-between rounded-md border bg-background p-2"
                  >
                    <div className="min-w-0 flex-1 pr-2 text-left">
                      <p
                        className="overflow-wrap-anywhere word-break-break-word text-xs font-medium break-all sm:text-sm"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => removeFile(index)}
                          variant="ghost"
                          size="sm"
                          className="ml-1 h-6 w-6 flex-shrink-0 p-0 sm:ml-2"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove file</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground sm:mb-4 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
              <p className="text-sm font-medium text-foreground sm:text-base lg:text-lg">
                Drag & drop your text files here
              </p>
              <p className="text-sm text-muted-foreground">or</p>
            </div>
          )}

          <input
            type="file"
            onChange={handleFileSelect}
            accept=".txt"
            multiple
            className="hidden"
            id="file-input"
          />

          <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-3 lg:items-center">
            <Button
              onClick={() => document.getElementById('file-input')?.click()}
              className="text-sm sm:text-base"
              variant="default"
              size="sm"
            >
              {files.length > 0 ? 'Add More Files' : 'Browse Files'}
            </Button>

            {files.length > 0 && onClearFiles && (
              <Button
                onClick={onClearFiles}
                variant="outline"
                size="sm"
                className="text-sm sm:text-base"
              >
                Clear Files
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TestFileGenerator } from '@/components/TestFileGenerator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { makeFileKey } from '@/services/responseStore';
import { isSupportedInputFile } from '@/utils/fileUtils';
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface FileUploadProps {
  files: File[];
  displayNames: Record<string, string>;
  onFilesChange: (files: File[]) => number;
  onClearFiles?: () => void;
  disabled?: boolean;
}

const FILE_PREVIEW_PAGE_SIZE = 50;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_DOCX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_FILES = 1000;
const MAX_BATCH_BYTES = 100 * 1024 * 1024;

const getFileSizeLimit = (file: File) =>
  file.name.toLowerCase().endsWith('.docx') ? MAX_DOCX_FILE_BYTES : MAX_TEXT_FILE_BYTES;

export const FileUpload = ({
  files,
  displayNames,
  onFilesChange,
  onClearFiles,
  disabled = false,
}: FileUploadProps) => {
  const [pastedName, setPastedName] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [previewPage, setPreviewPage] = useState(0);
  const previewPageCount = Math.max(1, Math.ceil(files.length / FILE_PREVIEW_PAGE_SIZE));
  const safePreviewPage = Math.min(previewPage, previewPageCount - 1);
  const previewStart = safePreviewPage * FILE_PREVIEW_PAGE_SIZE;
  const previewFiles = files.slice(previewStart, previewStart + FILE_PREVIEW_PAGE_SIZE);

  useEffect(() => {
    if (previewPage >= previewPageCount) setPreviewPage(previewPageCount - 1);
  }, [previewPage, previewPageCount]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (disabled) return;
    e.currentTarget.style.borderColor = 'var(--primary)';
    e.currentTarget.style.backgroundColor = 'var(--accent)';
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

    if (disabled) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const addFiles = (newFiles: File[]): boolean => {
    if (disabled) return false;
    const supportedFiles = newFiles.filter((file) => isSupportedInputFile(file));

    if (supportedFiles.length !== newFiles.length) {
      toast.error('Invalid file type', {
        description: 'Please upload only .txt, .md, or .docx files',
      });
      return false;
    }

    const oversizedFiles = supportedFiles.filter((file) => file.size > getFileSizeLimit(file));
    if (oversizedFiles.length > 0) {
      toast.error(
        `${oversizedFiles.length} file${oversizedFiles.length === 1 ? '' : 's'} too large`,
        {
          description: 'Text and Markdown files can be up to 2 MB. DOCX files can be up to 10 MB.',
        },
      );
    }
    const allowedFiles = supportedFiles.filter((file) => file.size <= getFileSizeLimit(file));

    // Check for duplicates (same name and size)
    const duplicates: string[] = [];
    const uniqueFiles = allowedFiles.filter((newFile) => {
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
        description:
          duplicates.length <= 3
            ? `Already selected: ${duplicates.join(', ')}`
            : `${duplicates.length} files are already selected.`,
      });
    }

    if (uniqueFiles.length === 0) {
      return false;
    }

    const nextFiles = [...files, ...uniqueFiles];
    if (nextFiles.length > MAX_BATCH_FILES) {
      toast.error('Browser batch is too large', {
        description: `Use up to ${MAX_BATCH_FILES} files in one browser batch. Process the remaining files in a later batch.`,
      });
      return false;
    }

    const nextBatchBytes = nextFiles.reduce((total, file) => total + file.size, 0);
    if (nextBatchBytes > MAX_BATCH_BYTES) {
      toast.error('Browser batch is too large', {
        description:
          'Use up to 100 MB of files in one browser batch. Process the remaining files in a later batch.',
      });
      return false;
    }

    const cleanedCount = onFilesChange(nextFiles);
    if (cleanedCount === 0) {
      toast.success(
        `${uniqueFiles.length} file${uniqueFiles.length > 1 ? 's' : ''} added successfully`,
      );
    }
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      addFiles(Array.from(selectedFiles));
    }
    e.target.value = '';
  };

  const removeFile = (index: number): void => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const toPastedFileName = (): string => {
    const raw = pastedName.trim();
    const baseName = raw ? raw.replace(/\.[^.]+$/, '') : `pasted-text-${Date.now()}`;
    return `${baseName || `pasted-text-${Date.now()}`}.txt`;
  };

  const handleAddPastedText = (): void => {
    const content = pastedText.trim();
    if (!content) {
      toast.error('Paste text first', {
        description: 'Add some text before creating a file.',
      });
      return;
    }

    const file = new File([pastedText], toPastedFileName(), { type: 'text/plain' });
    const added = addFiles([file]);
    if (added) {
      setPastedText('');
    }
  };

  return (
    <Card className="w-full max-w-full overflow-hidden border-primary/20">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Upload or Paste Files</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <TestFileGenerator
              currentFileCount={files.length}
              onFilesGenerated={onFilesChange}
              disabled={disabled}
            />
            <Badge variant={files.length > 0 ? 'secondary' : 'outline'}>
              {files.length} file{files.length === 1 ? '' : 's'} selected
            </Badge>
          </div>
        </div>
        {files.length > 5 && (
          <Alert variant="default" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Large batch detected. Requests follow the selected model rate limit, with no more than
              three active requests at one time.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent className="w-full max-w-full overflow-hidden">
        <div
          className={`w-full max-w-full overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-300 sm:p-6 lg:p-8 ${
            files.length > 0
              ? 'border-primary/70 bg-primary/12'
              : 'border-border/80 bg-background/65 hover:border-primary/70 hover:bg-accent/45'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-disabled={disabled}
        >
          {files.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-primary sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
              <p className="text-sm font-medium text-foreground sm:text-base">
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </p>

              <p className="text-xs text-muted-foreground tabular-nums">
                {(files.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(1)} MB
                total
              </p>

              <div className="max-h-24 w-full max-w-full space-y-2 overflow-y-auto sm:max-h-32">
                {previewFiles.map((file, index) => {
                  const fileIndex = previewStart + index;
                  const displayName = displayNames[makeFileKey(file)] ?? file.name;
                  return (
                    <div
                      key={makeFileKey(file)}
                      className="flex w-full min-w-0 items-center justify-between rounded-lg border bg-background/90 p-2"
                    >
                      <div className="min-w-0 flex-1 pr-2 text-left">
                        <p
                          className="overflow-wrap-anywhere word-break-break-word text-xs font-medium break-all sm:text-sm"
                          title={displayName === file.name ? file.name : `Original: ${file.name}`}
                        >
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => removeFile(fileIndex)}
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-6 w-6 flex-shrink-0 p-0 sm:ml-2"
                            disabled={disabled}
                          >
                            <X className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove file</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
              {previewPageCount > 1 ? (
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewPage((page) => Math.max(0, page - 1))}
                    disabled={safePreviewPage === 0}
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <span className="min-w-24 tabular-nums">
                    {previewStart + 1}–
                    {Math.min(previewStart + FILE_PREVIEW_PAGE_SIZE, files.length)} of{' '}
                    {files.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPreviewPage((page) => Math.min(previewPageCount - 1, page + 1))
                    }
                    disabled={safePreviewPage >= previewPageCount - 1}
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground sm:mb-4 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
              <p className="text-sm font-medium text-foreground sm:text-base lg:text-lg">
                Drag & drop your .txt, .md, or .docx files here
              </p>
              <p className="text-sm text-muted-foreground">or</p>
            </div>
          )}

          <input
            type="file"
            onChange={handleFileSelect}
            accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            disabled={disabled}
            className="hidden"
            id="file-input"
          />

          <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-3 lg:items-center">
            <Button
              onClick={() => document.getElementById('file-input')?.click()}
              className="text-sm sm:text-base"
              variant="default"
              size="sm"
              disabled={disabled}
            >
              {files.length > 0 ? 'Add More Files' : 'Browse Files'}
            </Button>

            {files.length > 0 && onClearFiles && (
              <Button
                onClick={onClearFiles}
                variant="outline"
                size="sm"
                className="text-sm sm:text-base"
                disabled={disabled}
              >
                Clear Files
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-border/80 bg-background/90 p-3 text-left sm:mt-6">
            <p className="text-sm font-medium">Or paste text</p>
            <Input
              value={pastedName}
              onChange={(e) => setPastedName(e.target.value)}
              placeholder="Optional filename (without extension)"
              className="text-sm"
              disabled={disabled}
            />
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste text content here..."
              className="h-32 max-h-32 min-h-32 resize-none overflow-y-auto text-sm sm:h-40 sm:max-h-40 sm:min-h-40"
              disabled={disabled}
            />
            <Button
              onClick={handleAddPastedText}
              size="sm"
              className="w-full sm:w-auto"
              disabled={disabled}
            >
              Add Pasted Text
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

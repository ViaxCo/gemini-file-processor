'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProcessingFailurePanel } from '@/components/ProcessingFailurePanel';
import { FileResult, MAX_LOW_CONFIDENCE_RETRIES, ProcessingProfile } from '@/hooks/useAIProcessor';
import type { UploadStatus } from '@/hooks/useGoogleDrive';
import { MAX_PROCESSING_ATTEMPTS } from '@/services/processingErrors';
import { confidenceColorClass } from '@/utils/confidenceScore';
import { copyToClipboard, downloadProcessedFile, extractTextFromFile } from '@/utils/fileUtils';
import {
  AlertCircle,
  CheckCircle,
  CircleSlash2,
  Copy,
  Download,
  Eye,
  Loader2,
  PencilLine,
  RotateCcw,
  Trash2,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
// import { Streamdown } from 'streamdown';

export interface UnifiedFileCardProps {
  result: FileResult;
  index: number;
  selected: boolean;
  onSelectChange: (index: number, selected: boolean) => void;
  displayName: string;
  onNameChange: (index: number, newName: string) => void;
  showMarkdown: boolean;
  onToggleMarkdown: (show: boolean) => void;
  onRetry?: (index: number) => void;
  onAbort?: (index: number) => void;
  onUpload?: (index: number) => void;
  onDiscardUpload?: (index: number) => void;
  onViewResponse?: (index: number) => void; // optional external handler; defaults to local expand
  uploadStatus?: UploadStatus;
  destinationFolderName?: string | null;
  canUpload?: boolean;
  uploadDisabled?: boolean;
  processingProfile: ProcessingProfile;
}

const UPLOAD_LABELS: Record<UploadStatus, string> = {
  idle: 'Upload to Google Docs',
  uploading: 'Uploading…',
  verifying: 'Verifying upload…',
  completed: 'Uploaded',
  error: 'Retry upload',
  unknown: 'Check upload status',
};

export const UnifiedFileCard = memo((props: UnifiedFileCardProps) => {
  const {
    result,
    index,
    selected,
    onSelectChange,
    displayName,
    onNameChange,
    // showMarkdown,
    // onToggleMarkdown,
    onRetry,
    onAbort,
    onUpload,
    onDiscardUpload,
    onViewResponse,
    uploadStatus,
    destinationFolderName,
    canUpload = true,
    uploadDisabled = false,
    processingProfile,
  } = props;

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(displayName);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const confidence = processingProfile === 'book' ? null : (result.confidence ?? null);
  const [lengthRatio, setLengthRatio] = useState<number | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [lastResponseLength, setLastResponseLength] = useState<number>(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setEditValue(displayName);
  }, [displayName]);

  useEffect(() => {
    let cancelled = false;
    const computeLengthRatio = async () => {
      if (processingProfile !== 'book' || !result.isCompleted || !result.response) {
        setLengthRatio(null);
        return;
      }
      try {
        const original = await extractTextFromFile(result.file);
        if (cancelled) return;
        if (!original.length) {
          setLengthRatio(null);
          return;
        }
        setLengthRatio(result.response.length / original.length);
      } catch {
        if (!cancelled) setLengthRatio(null);
      }
    };
    void computeLengthRatio();
    return () => {
      cancelled = true;
    };
  }, [result.isCompleted, result.response, result.file, processingProfile]);

  const failure = result.error ?? result.retryFailure;
  const isCancelled = result.queueStatus === 'cancelled';
  const retryLabel = result.retryFailure
    ? result.retryCount
      ? `API retry ${result.retryCount} of ${MAX_PROCESSING_ATTEMPTS - 1}`
      : 'Retrying'
    : result.lowConfidenceRetryCount
      ? `Low-confidence retry ${result.lowConfidenceRetryCount} of ${MAX_LOW_CONFIDENCE_RETRIES}`
      : undefined;

  const getStatusIcon = () => {
    if (result.error) return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (result.retryFailure) return <Loader2 className="h-4 w-4 animate-spin text-destructive" />;
    if (result.lowConfidenceRetryCount)
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (result.isCompleted) return <CheckCircle className="h-4 w-4 text-primary" />;
    if (result.isProcessing) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (isCancelled) return <CircleSlash2 className="h-4 w-4 text-muted-foreground" />;
    return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(result.response);
    toast[success ? 'success' : 'error'](success ? 'Response copied' : 'Failed to copy');
    setCopyFeedback(success ? 'Copied!' : 'Copy failed');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleDownload = async (format: 'markdown' | 'docx') => {
    const base = displayName.replace(/\.[^.]+$/, '') || result.file.name.replace(/\.[^.]+$/, '');
    try {
      await downloadProcessedFile(result.response, `${base}_processed`, format);
      toast.success('File downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleToggleExpand = () => {
    // If a modal view handler is provided, prefer opening the modal and skip inline expansion
    if (onViewResponse) {
      onViewResponse(index);
      return;
    }
    setIsExpanded((v) => !v);
    if (!isExpanded && result.response && scrollViewportRef.current) {
      setTimeout(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
        }
      }, 300);
    }
  };

  useEffect(() => {
    if (result.response.length === 0) {
      setIsUserScrolling(false);
      setLastResponseLength(0);
      return;
    }
    if (
      scrollViewportRef.current &&
      result.response.length > lastResponseLength &&
      !isUserScrolling &&
      isExpanded
    ) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
    setLastResponseLength(result.response.length);
  }, [result.response, lastResponseLength, isUserScrolling, isExpanded]);

  useEffect(
    () => () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    },
    [],
  );

  // Note: Inline scroll handling removed in favor of modal view
  const isUploadPending = uploadStatus === 'uploading' || uploadStatus === 'verifying';
  const uploadLabel = UPLOAD_LABELS[uploadStatus || 'idle'];

  return (
    <Card className="w-full gap-0 py-3 shadow-sm">
      <CardHeader className="px-3 pb-0 sm:px-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <input
              type="checkbox"
              className="mt-1.5 h-4 w-4 flex-shrink-0 accent-primary"
              checked={selected}
              onChange={(e) => onSelectChange(index, e.target.checked)}
              aria-label="Select file"
            />
            <div className="mt-1 flex-shrink-0">{getStatusIcon()}</div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                {isEditingName ? (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      setIsEditingName(false);
                      if (editValue.trim()) onNameChange(index, editValue.trim());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setEditValue(displayName);
                        setIsEditingName(false);
                      }
                    }}
                    className="h-7 w-full max-w-full truncate"
                    autoFocus
                  />
                ) : (
                  <CardTitle
                    className="truncate overflow-hidden text-sm whitespace-nowrap"
                    title={displayName || result.file.name}
                  >
                    {displayName || result.file.name}
                  </CardTitle>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => setIsEditingName((v) => !v)}
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit filename</TooltipContent>
                </Tooltip>
                {displayName !== result.file.name && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => {
                          setIsEditingName(false);
                          setEditValue(result.file.name);
                          onNameChange(index, result.file.name);
                        }}
                        aria-label="Reset to original filename"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset to original filename</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {result.error ? (
                    <Badge variant="destructive">Error</Badge>
                  ) : retryLabel ? (
                    <Badge variant="secondary">{retryLabel}</Badge>
                  ) : result.isCompleted ? (
                    <Badge variant="default">Completed</Badge>
                  ) : result.isProcessing ? (
                    <Badge variant="secondary">Processing...</Badge>
                  ) : isCancelled ? (
                    <Badge variant="outline">Cancelled</Badge>
                  ) : (
                    <Badge variant="outline">Queued</Badge>
                  )}
                  {uploadStatus === 'completed' && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500 text-white dark:bg-emerald-600 [a&]:hover:bg-emerald-500/90"
                    >
                      Uploaded
                    </Badge>
                  )}
                  <Badge variant="outline">{destinationFolderName || 'Unassigned'}</Badge>
                  {uploadStatus === 'unknown' && (
                    <Badge variant="destructive">Upload unconfirmed</Badge>
                  )}
                  {confidence && result.isCompleted && !result.error && (
                    <span className={`text-xs ${confidenceColorClass(confidence.level)}`}>
                      Confidence {confidence.level} ({Math.round(confidence.score * 100)}%)
                    </span>
                  )}
                  {processingProfile === 'book' &&
                    lengthRatio !== null &&
                    result.isCompleted &&
                    !result.error && (
                      <Badge variant="secondary">Length: {lengthRatio.toFixed(2)}x</Badge>
                    )}
                  {result.previousConfidence && !result.isCompleted && !result.error && (
                    <span
                      className={`text-xs ${confidenceColorClass(result.previousConfidence.level)}`}
                    >
                      Previous Confidence {result.previousConfidence.level} (
                      {Math.round(result.previousConfidence.score * 100)}%)
                    </span>
                  )}
                  {result.recoveredRetryCount ? (
                    <Badge variant="secondary">
                      Recovered after {result.recoveredRetryCount}{' '}
                      {result.recoveredRetryCount === 1 ? 'retry' : 'retries'}
                    </Badge>
                  ) : null}
                </div>

                {(result.response ||
                  failure ||
                  result.isCompleted ||
                  result.isProcessing ||
                  result.queueStatus === 'pending' ||
                  isCancelled) && (
                  <div className="flex flex-wrap items-center gap-1">
                    {result.response ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={handleCopy}
                              variant="ghost"
                              size="sm"
                              disabled={result.isProcessing}
                              className="h-7 w-7 p-0 hover:bg-muted/50"
                              aria-label="Copy response"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {copyFeedback || 'Copy response to clipboard'}
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={result.isProcessing}
                                    className="h-7 w-7 p-0 hover:bg-muted/50"
                                    aria-label="Download response"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Download response</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => handleDownload('markdown')}>
                              Markdown (.md)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('docx')}>
                              Word (.docx)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : null}
                    {onRetry && (result.isCompleted || isCancelled) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => onRetry(index)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted/50"
                            aria-label="Retry"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Retry processing this file</TooltipContent>
                      </Tooltip>
                    )}
                    {onAbort && (result.isProcessing || result.queueStatus === 'pending') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => onAbort(index)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:bg-muted/50"
                            aria-label="Abort"
                          >
                            {/* Use a simple square/stop icon via SVG to avoid adding new imports */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-3.5 w-3.5"
                            >
                              <rect x="6" y="6" width="12" height="12" rx="1" />
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Abort this file</TooltipContent>
                      </Tooltip>
                    )}
                    {onUpload && canUpload && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => onUpload(index)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted/50"
                            aria-label={uploadLabel}
                            disabled={
                              uploadDisabled || isUploadPending || uploadStatus === 'completed'
                            }
                          >
                            {isUploadPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UploadCloud className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{uploadLabel}</TooltipContent>
                      </Tooltip>
                    )}
                    {onDiscardUpload && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => onDiscardUpload(index)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Discard unconfirmed upload"
                            disabled={uploadDisabled}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Discard unconfirmed upload</TooltipContent>
                      </Tooltip>
                    )}
                    {result.response ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleToggleExpand}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted/50"
                            aria-label="View response"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Response</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Removed accordion arrow since responses are viewed in a modal */}
        </div>
        {failure ? (
          <ProcessingFailurePanel
            failure={failure}
            retryCount={result.retryCount}
            nextRetryAt={result.nextRetryAt}
            isRetrying={!!result.retryFailure}
            isProcessing={result.isProcessing}
            onRetry={onRetry ? () => onRetry(index) : undefined}
          />
        ) : null}
      </CardHeader>
    </Card>
  );
});

UnifiedFileCard.displayName = 'UnifiedFileCard';

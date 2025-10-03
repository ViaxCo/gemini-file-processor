'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileResult } from '@/hooks/useAIProcessor';
import { confidenceColorClass, getConfidenceScore } from '@/utils/confidenceScore';
import { copyToClipboard, downloadAsMarkdown } from '@/utils/fileUtils';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  Eye,
  Loader2,
  PencilLine,
  RotateCcw,
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
  onSelectChange: (selected: boolean) => void;
  displayName: string;
  onNameChange: (newName: string) => void;
  showMarkdown: boolean;
  onToggleMarkdown: (show: boolean) => void;
  onRetry?: () => void;
  onAbort?: () => void;
  onUpload?: () => void;
  onViewResponse?: () => void; // optional external handler; defaults to local expand
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error';
  destinationFolderName?: string | null;
  canUpload?: boolean;
}

export const UnifiedFileCard = memo((props: UnifiedFileCardProps) => {
  const {
    result,
    selected,
    onSelectChange,
    displayName,
    onNameChange,
    // showMarkdown,
    // onToggleMarkdown,
    onRetry,
    onAbort,
    onUpload,
    onViewResponse,
    uploadStatus,
    destinationFolderName,
    canUpload = true,
  } = props;

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(displayName);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [confidence, setConfidence] = useState<{
    score: number;
    level: 'high' | 'medium' | 'low';
  } | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [lastResponseLength, setLastResponseLength] = useState<number>(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setEditValue(displayName);
  }, [displayName]);

  // Compute confidence score once response is completed
  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      if (!result.isCompleted || !result.response) {
        setConfidence(null);
        return;
      }
      try {
        const original = await result.file.text();
        if (cancelled) return;
        const { score, level } = getConfidenceScore(original, result.response);
        setConfidence({ score, level });
      } catch {
        // Ignore errors silently; keep confidence null
        setConfidence(null);
      }
    };
    void compute();
    return () => {
      cancelled = true;
    };
  }, [result.isCompleted, result.response, result.file]);

  const getStatusIcon = () => {
    if (result.error) return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (result.isCompleted) return <CheckCircle className="h-4 w-4 text-primary" />;
    if (result.isProcessing) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(result.response);
    toast[success ? 'success' : 'error'](success ? 'Response copied' : 'Failed to copy');
    setCopyFeedback(success ? 'Copied!' : 'Copy failed');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleDownload = () => {
    const base = displayName.replace(/\.[^.]+$/, '') || result.file.name.replace(/\.[^.]+$/, '');
    downloadAsMarkdown(result.response, `${base}_processed.md`);
    toast.success('File downloaded');
  };

  const handleToggleExpand = () => {
    // If a modal view handler is provided, prefer opening the modal and skip inline expansion
    if (onViewResponse) {
      onViewResponse();
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

  return (
    <Card className="w-full gap-0">
      <CardHeader className="pb-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 flex-shrink-0 accent-primary"
              checked={selected}
              onChange={(e) => onSelectChange(e.target.checked)}
              aria-label="Select file"
            />
            <div className="mt-0.5 flex-shrink-0">{getStatusIcon()}</div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2 sm:gap-2">
                {isEditingName ? (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      setIsEditingName(false);
                      if (editValue.trim()) onNameChange(editValue.trim());
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
                          onNameChange(result.file.name);
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {result.error ? (
                  <Badge variant="destructive">Error</Badge>
                ) : result.isCompleted ? (
                  <Badge variant="default">Completed</Badge>
                ) : result.isProcessing ? (
                  <Badge variant="secondary">Processing...</Badge>
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
                <Badge variant="outline">{destinationFolderName || 'Root (My Drive)'}</Badge>
                {confidence && result.isCompleted && !result.error && (
                  <span className={`text-xs ${confidenceColorClass(confidence.level)}`}>
                    Confidence {confidence.level} ({Math.round(confidence.score * 100)}%)
                  </span>
                )}
                {result.previousConfidence && !result.isCompleted && !result.error && (
                  <span
                    className={`text-xs ${confidenceColorClass(result.previousConfidence.level)}`}
                  >
                    Previous Confidence {result.previousConfidence.level} (
                    {Math.round(result.previousConfidence.score * 100)}%)
                  </span>
                )}
                {result.isRetryingDueToError && !result.isCompleted && !result.error && (
                  <span className="text-xs text-rose-600 dark:text-rose-400">
                    Retrying due to error
                  </span>
                )}
                {result.retryCount !== undefined &&
                  result.retryCount > 0 &&
                  !result.isCompleted &&
                  !result.error && <Badge variant="secondary">Retry {result.retryCount}/3</Badge>}
              </div>

              {(result.response || result.error || result.isCompleted) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleCopy}
                        variant="ghost"
                        size="sm"
                        disabled={!result.response || result.isProcessing}
                        className="h-7 w-7 p-0 hover:bg-muted/50"
                        aria-label="Copy response"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copyFeedback || 'Copy response to clipboard'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleDownload}
                        variant="ghost"
                        size="sm"
                        disabled={!result.response || result.isProcessing}
                        className="h-7 w-7 p-0 hover:bg-muted/50"
                        aria-label="Download response"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download as markdown file</TooltipContent>
                  </Tooltip>
                  {onRetry && (result.isCompleted || result.error) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={onRetry}
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
                          onClick={onAbort}
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
                          onClick={onUpload}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-muted/50"
                          aria-label="Upload to Google Drive"
                          disabled={uploadStatus === 'uploading'}
                        >
                          {uploadStatus === 'uploading' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UploadCloud className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {uploadStatus === 'uploading' ? 'Uploading…' : 'Upload to Google Docs'}
                      </TooltipContent>
                    </Tooltip>
                  )}
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
                </div>
              )}
            </div>
          </div>

          {/* Removed accordion arrow since responses are viewed in a modal */}
        </div>
      </CardHeader>
    </Card>
  );
});

UnifiedFileCard.displayName = 'UnifiedFileCard';

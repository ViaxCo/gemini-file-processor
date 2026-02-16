'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { FileResult, ProcessingProfile } from '@/hooks/useAIProcessor';
import { copyToClipboard, downloadAsMarkdown } from '@/utils/fileUtils';
import { generateVerificationSnippet } from '@/utils/verificationSnippet';
import { Copy, Download, Loader2, RotateCcw, UploadCloud, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface ViewResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: FileResult | null;
  displayName?: string;
  // Optional actions and info from parent
  onRetry?: () => void;
  onUpload?: () => void;
  canUpload?: boolean;
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error';
  destinationFolderName?: string | null;
  processingProfile: ProcessingProfile;
}

export function ViewResponseModal({
  open,
  onOpenChange,
  result,
  displayName,
  onRetry,
  onUpload,
  canUpload = true,
  uploadStatus,
  destinationFolderName,
  processingProfile,
}: ViewResponseModalProps) {
  const [showMarkdown, setShowMarkdown] = useState(true);
  const [originalText, setOriginalText] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const viewportRef = useRef<HTMLDivElement>(null);

  // Load original text on-demand when opened
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!open || !result?.file || processingProfile === 'book') return;
      try {
        const text = await result.file.text();
        if (!cancelled) setOriginalText(text);
      } catch {
        if (!cancelled) setOriginalText('');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, result?.file, processingProfile]);

  // Auto-scroll to bottom on open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
    }, 150);
    return () => clearTimeout(t);
  }, [open, result?.response]);

  const verification = useMemo(() => {
    if (processingProfile === 'book') return null;
    if (!originalText || !result?.response) return null;
    return generateVerificationSnippet(originalText, result.response);
  }, [originalText, result?.response, processingProfile]);

  const prettyTitle = useMemo(() => {
    const raw = displayName || result?.file?.name || 'Response';
    const plusFixed = raw.replace(/\+/g, ' ');
    try {
      return decodeURIComponent(plusFixed);
    } catch {
      return plusFixed;
    }
  }, [displayName, result?.file?.name]);

  const handleCopy = async () => {
    const success = await copyToClipboard(result?.response ?? '');
    toast[success ? 'success' : 'error'](success ? 'Response copied' : 'Copy failed');
    setCopyFeedback(success ? 'Copied!' : 'Copy failed');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const base =
      (displayName || result.file.name).replace(/\.[^.]+$/, '') ||
      result.file.name.replace(/\.[^.]+$/, '');
    downloadAsMarkdown(result.response, `${base}_processed.md`);
    toast.success('File downloaded');
  };

  const folderLabel = destinationFolderName ?? 'Root (My Drive)';

  const handleRetryClick = () => {
    // Trigger the retry action, then close the modal immediately
    onRetry?.();
    onOpenChange(false);
  };

  const handleUploadClick = () => {
    // Trigger the upload action, then close the modal immediately
    onUpload?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="min-w-0 overflow-y-auto sm:max-w-3xl md:max-w-4xl"
      >
        <DialogHeader className="sticky top-0 z-10 min-w-0 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 sm:py-4">
          <div className="relative">
            <DialogTitle className="truncate pr-10 text-base sm:text-lg">{prettyTitle}</DialogTitle>
            <DialogClose asChild>
              <button
                aria-label="Close"
                className="absolute top-0 right-0 rounded-xs p-1 text-muted-foreground transition-colors hover:text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="min-w-0 px-4 pb-[env(safe-area-inset-bottom)] sm:px-6 sm:pb-8">
          {processingProfile === 'transcript' && (
            <>
              <div className="min-w-0 rounded-md border bg-muted/30 p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-foreground sm:text-sm">
                    Verification Snippet
                  </div>
                  {verification ? (
                    <div className="text-[11px] text-muted-foreground sm:text-xs">
                      Similarity: {Math.round(verification.similarity * 100)}%
                    </div>
                  ) : null}
                </div>
                {verification ? (
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-md bg-background p-2">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground sm:text-xs">
                        <span>Original (tail)</span>
                        <button
                          className="rounded px-1.5 py-0.5 text-[10px] text-foreground/70 hover:bg-muted"
                          onClick={() => copyToClipboard(verification.originalSnippet)}
                        >
                          Copy
                        </button>
                      </div>
                      <ScrollArea className="h-28 sm:h-36">
                        <pre className="text-xs break-words whitespace-pre-wrap text-foreground sm:text-sm">
                          {verification.originalSnippet}
                        </pre>
                      </ScrollArea>
                    </div>
                    <div className="min-w-0 rounded-md bg-background p-2">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground sm:text-xs">
                        <span>Processed (tail)</span>
                        <button
                          className="rounded px-1.5 py-0.5 text-[10px] text-foreground/70 hover:bg-muted"
                          onClick={() => copyToClipboard(verification.processedSnippet)}
                        >
                          Copy
                        </button>
                      </div>
                      <ScrollArea className="h-28 sm:h-36">
                        <pre className="text-xs break-words whitespace-pre-wrap text-foreground sm:text-sm">
                          {verification.processedSnippet}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing verification…
                  </div>
                )}
              </div>
              <Separator className="my-3" />
            </>
          )}

          {/* Actions */}
          <div className="mb-2 flex min-w-0 flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!result?.response}
                className="text-xs sm:text-sm"
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> {copyFeedback || 'Copy'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!result?.response}
                className="text-xs sm:text-sm"
              >
                <Download className="mr-1 h-3.5 w-3.5" /> Download
              </Button>
              {onRetry && (result?.isCompleted || !!result?.error) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryClick}
                  className="text-xs sm:text-sm"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry
                </Button>
              )}
              {onUpload && canUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={!result?.response || uploadStatus === 'uploading'}
                  className="text-xs sm:text-sm"
                >
                  {uploadStatus === 'uploading' ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-1 h-3.5 w-3.5" />
                  )}
                  {uploadStatus === 'uploading' ? 'Uploading…' : 'Upload'}
                </Button>
              )}
              <Badge variant="outline" className="ml-1">
                {folderLabel}
              </Badge>
            </div>
            <Toggle
              pressed={showMarkdown}
              onPressedChange={setShowMarkdown}
              size="sm"
              variant="outline"
            >
              {showMarkdown ? 'Raw' : 'Formatted'}
            </Toggle>
          </div>

          {/* Body */}
          <div
            ref={viewportRef}
            className="max-h-[40vh] min-w-0 overflow-x-auto overflow-y-auto rounded-md border bg-background p-3 sm:max-h-[55vh]"
          >
            {!result?.response ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> No response yet
              </div>
            ) : showMarkdown ? (
              <div
                className="max-w-full text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground [&_*]:max-w-full [&_*]:min-w-0 [&_code]:break-words [&_pre]:break-words [&_pre]:whitespace-pre-wrap [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_th]:break-words"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
              >
                {result.isProcessing ? (
                  <pre
                    className="max-w-full font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground"
                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                  >
                    {result.response}
                  </pre>
                ) : (
                  <div
                    className="max-w-full [&_*]:max-w-full [&_*]:min-w-0 [&_code]:break-words [&_pre]:break-words [&_pre]:whitespace-pre-wrap"
                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                  >
                    <Streamdown>{result.response}</Streamdown>
                  </div>
                )}
              </div>
            ) : (
              <pre
                className="max-w-full font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
              >
                {result.response}
              </pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

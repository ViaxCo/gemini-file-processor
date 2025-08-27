import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { Copy, Download, Loader2, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';
import { copyToClipboard, downloadAsMarkdown } from '../utils/fileUtils';

interface ResponseDisplayProps {
  response: string;
  isProcessing?: boolean;
  file?: File;
}

export const ResponseDisplay = ({ response, isProcessing = false, file }: ResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [lastResponseLength, setLastResponseLength] = useState<number>(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset scrolling state when response is cleared or starts fresh
    if (response.length === 0) {
      setIsUserScrolling(false);
      setLastResponseLength(0);
      return;
    }

    // Auto-scroll only when response is actively being streamed and user hasn't manually scrolled
    if (scrollViewportRef.current && response.length > lastResponseLength && !isUserScrolling) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
    setLastResponseLength(response.length);
  }, [response, lastResponseLength, isUserScrolling]);

  const handleScroll = () => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance

      // If user scrolled up from bottom, mark as user scrolling
      if (!isAtBottom) {
        setIsUserScrolling(true);
      } else {
        // If user scrolled back to bottom, resume auto-scrolling
        setIsUserScrolling(false);
      }
    }
  };

  const handleCopyResponse = async (): Promise<void> => {
    const success = await copyToClipboard(response);
    if (success) {
      toast.success('Response copied to clipboard');
    } else {
      toast.error('Failed to copy response');
    }
    setCopyFeedback(success ? 'Copied!' : 'Failed to copy');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleDownloadResponse = (): void => {
    const fileName = file ? file.name.replace(/\.txt$/, '') : 'response.md';
    downloadAsMarkdown(response, fileName);
    toast.success('File downloaded successfully');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>AI Response</CardTitle>
        {response && (
          <Toggle
            pressed={showMarkdown}
            onPressedChange={setShowMarkdown}
            variant="outline"
            size="sm"
          >
            {showMarkdown ? 'Raw' : 'Formatted'}
          </Toggle>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative h-48 overflow-hidden sm:h-64 lg:h-143">
          <div
            ref={scrollViewportRef}
            onScroll={handleScroll}
            className="size-full overflow-auto rounded-md p-1"
          >
            {isProcessing && !response ? (
              <div className="h-full space-y-4 p-4">
                <div className="mb-4 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    AI is analyzing your file...
                  </span>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ) : response ? (
              <div className="max-w-none overflow-hidden text-sm leading-relaxed sm:text-base">
                {showMarkdown ? (
                  <div className="overflow-wrap-anywhere leading-relaxed break-words text-foreground">
                    <Streamdown>{response}</Streamdown>
                  </div>
                ) : (
                  <pre className="overflow-wrap-anywhere max-w-full overflow-x-auto font-sans leading-relaxed break-words whitespace-pre-wrap text-foreground">
                    {response}
                  </pre>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="px-4 text-center">
                  <MessageCircle
                    className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16"
                    strokeWidth={1}
                  />
                  <p className="text-base font-medium text-foreground sm:text-lg">
                    No response yet
                  </p>
                  <p className="text-xs sm:text-sm">
                    Upload a file and add instructions to get started
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {response && (
          <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Button
              onClick={handleCopyResponse}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
              disabled={isProcessing}
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">{copyFeedback || 'Copy Response'}</span>
              <span className="sm:hidden">{copyFeedback || 'Copy'}</span>
            </Button>
            <Button
              onClick={handleDownloadResponse}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
              disabled={isProcessing}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

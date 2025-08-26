import { useState, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';
import { copyToClipboard, downloadAsMarkdown } from '../utils/fileUtils';
import { FileResult } from '../hooks/useAIProcessor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  DownloadCloud,
} from 'lucide-react';
import { toast } from 'sonner';

interface MultiFileResponseDisplayProps {
  fileResults: FileResult[];
}

interface FileItemProps {
  result: FileResult;
  index: number;
  showMarkdown: boolean;
  onToggleMarkdown: (show: boolean) => void;
}

const FileItem = ({ result, index, showMarkdown, onToggleMarkdown }: FileItemProps) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const [lastResponseLength, setLastResponseLength] = useState<number>(0);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

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

  const handleScroll = () => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;

      if (!isAtBottom) {
        setIsUserScrolling(true);
      } else {
        setIsUserScrolling(false);
      }
    }
  };

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(result.response);
    if (success) {
      toast.success('Response copied to clipboard');
    } else {
      toast.error('Failed to copy response');
    }
    setCopyFeedback(success ? 'Copied!' : 'Failed to copy');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleDownload = (): void => {
    downloadAsMarkdown(result.response, `${result.file.name.replace('.txt', '')}_processed.md`);
    toast.success('File downloaded successfully');
  };

  const getStatusIcon = () => {
    if (result.error) {
      return <AlertCircle className="text-destructive h-4 w-4" />;
    }
    if (result.isCompleted) {
      return <CheckCircle className="text-primary h-4 w-4" />;
    }
    if (result.isProcessing) {
      return <Loader2 className="text-primary h-4 w-4 animate-spin" />;
    }
    return <FileText className="text-muted-foreground h-4 w-4" />;
  };

  const getStatusText = () => {
    if (result.error) return 'Error';
    if (result.isCompleted) return 'Completed';
    if (result.isProcessing) return 'Processing...';
    return 'Waiting';
  };

  const getStatusBadge = () => {
    if (result.error) {
      return <Badge variant="destructive">Error</Badge>;
    }
    if (result.isCompleted) {
      return <Badge variant="default">Completed</Badge>;
    }
    if (result.isProcessing) {
      return <Badge variant="secondary">Processing...</Badge>;
    }
    return <Badge variant="outline">Waiting</Badge>;
  };

  return (
    <Card className="w-full gap-0">
      <CardHeader className="pb-2">
        <div
          className="flex min-w-0 cursor-pointer items-center justify-between overflow-hidden"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex min-w-0 flex-1 items-center space-x-2 overflow-hidden sm:space-x-3">
            <div className="flex-shrink-0">{getStatusIcon()}</div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <CardTitle
                className="truncate overflow-hidden text-sm whitespace-nowrap sm:text-base lg:text-lg"
                title={result.file.name}
              >
                {result.file.name}
              </CardTitle>
              <div className="mt-1 flex items-center gap-2">{getStatusBadge()}</div>
              {result.response && (result.isCompleted || result.isProcessing) && (
                <div className="mt-2 flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy();
                        }}
                        variant="ghost"
                        size="sm"
                        disabled={!result.response || result.isProcessing}
                        className="hover:bg-muted/50 h-7 w-7 p-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="sr-only">{copyFeedback || 'Copy'}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copyFeedback || 'Copy response to clipboard'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload();
                        }}
                        variant="ghost"
                        size="sm"
                        disabled={!result.response || result.isProcessing}
                        className="hover:bg-muted/50 h-7 w-7 p-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="sr-only">Download</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download as markdown file</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          <div className="ml-2 flex flex-shrink-0 items-center space-x-1 sm:space-x-2">
            <div className="flex-shrink-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          ref={scrollViewportRef}
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`}
          onScroll={handleScroll}
        >
          {result.response && (
            <div className="bg-background mb-4 rounded-md border p-4">
              <div className="mb-2 flex items-center justify-between">
                <div></div>
                <Toggle
                  pressed={showMarkdown}
                  onPressedChange={onToggleMarkdown}
                  variant="outline"
                  size="sm"
                >
                  {showMarkdown ? 'Raw' : 'Formatted'}
                </Toggle>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {showMarkdown ? (
                  <div className="text-foreground overflow-wrap-anywhere text-sm leading-relaxed break-words sm:text-base">
                    <Streamdown>{result.response}</Streamdown>
                  </div>
                ) : (
                  <pre className="text-foreground overflow-wrap-anywhere max-w-full overflow-x-auto font-sans text-sm leading-relaxed break-words whitespace-pre-wrap sm:text-base">
                    {result.response}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const MultiFileResponseDisplay = ({ fileResults }: MultiFileResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true);
  const [downloadAllFeedback, setDownloadAllFeedback] = useState<string>('');

  const completedResults = fileResults.filter(
    (result) => result.isCompleted && !result.error && result.response,
  );
  const allCompleted = fileResults.length > 0 && fileResults.every((result) => result.isCompleted);
  const isAnyProcessing = fileResults.some((result) => result.isProcessing);
  const completedCount = fileResults.filter((result) => result.isCompleted).length;
  const errorCount = fileResults.filter((result) => result.error).length;
  const processingCount = fileResults.filter((result) => result.isProcessing).length;
  const progressPercentage =
    fileResults.length > 0 ? (completedCount / fileResults.length) * 100 : 0;

  const handleDownloadAll = (): void => {
    if (completedResults.length === 0) return;

    completedResults.forEach((result) => {
      downloadAsMarkdown(result.response, `${result.file.name.replace('.txt', '')}_processed.md`);
    });

    toast.success(
      `Downloaded ${completedResults.length} file${completedResults.length > 1 ? 's' : ''} successfully`,
    );
    setDownloadAllFeedback('Downloaded all files!');
    setTimeout(() => setDownloadAllFeedback(''), 3000);
  };

  if (fileResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-48 items-center justify-center sm:h-64 lg:h-96">
            <div className="px-4 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16" strokeWidth={1} />
              <p className="text-foreground text-base font-medium sm:text-lg">
                No files processed yet
              </p>
              <p className="text-xs sm:text-sm">Upload files and add instructions to get started</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg sm:text-xl">AI Responses</CardTitle>
        {allCompleted && completedResults.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleDownloadAll}
                variant="default"
                size="sm"
                className="flex-shrink-0 text-xs sm:text-sm"
                disabled={isAnyProcessing}
              >
                <DownloadCloud className="h-4 w-4" />
                <span className="hidden whitespace-nowrap sm:inline">
                  {downloadAllFeedback || 'Download All'}
                </span>
                <span className="whitespace-nowrap sm:hidden">
                  {downloadAllFeedback || 'Download'}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download all completed files as markdown</TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      <CardContent>
        <div className="max-h-[500px] space-y-4 overflow-y-auto pr-2 lg:max-h-[760px] lg:overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Processing Results ({fileResults.length} file{fileResults.length !== 1 ? 's' : ''})
              </span>
              <div className="flex gap-2">
                {completedCount > 0 && <Badge variant="default">{completedCount} completed</Badge>}
                {processingCount > 0 && (
                  <Badge variant="secondary">{processingCount} processing</Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    {errorCount} error{errorCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            {isAnyProcessing && (
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Progress</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}
            {errorCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorCount} file{errorCount > 1 ? 's' : ''} failed to process. Check individual
                  files for details.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {fileResults.length === 0 ? (
            <div className="text-muted-foreground flex h-48 items-center justify-center sm:h-64 lg:h-96">
              <div className="px-4 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16" strokeWidth={1} />
                <p className="text-foreground text-base font-medium sm:text-lg">
                  No files processed yet
                </p>
                <p className="text-xs sm:text-sm">
                  Upload files and add instructions to get started
                </p>
              </div>
            </div>
          ) : (
            fileResults.map((result, index) => (
              <FileItem
                key={index}
                result={result}
                index={index}
                showMarkdown={showMarkdown}
                onToggleMarkdown={setShowMarkdown}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

import { useState, useRef, useEffect } from 'react'
import { Streamdown } from 'streamdown'
import { copyToClipboard, downloadAsMarkdown } from '../utils/fileUtils'
import { FileResult } from '../hooks/useAIProcessor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toggle } from '@/components/ui/toggle'
import { ChevronDown, ChevronUp, Copy, Download, FileText, Loader2, CheckCircle, AlertCircle, DownloadCloud } from 'lucide-react'

interface MultiFileResponseDisplayProps {
  fileResults: FileResult[]
}

interface FileItemProps {
  result: FileResult
  index: number
  showMarkdown: boolean
  onToggleMarkdown: (show: boolean) => void
}

const FileItem = ({ result, index, showMarkdown, onToggleMarkdown }: FileItemProps) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [copyFeedback, setCopyFeedback] = useState<string>('')
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false)
  const [lastResponseLength, setLastResponseLength] = useState<number>(0)
  const scrollViewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (result.response.length === 0) {
      setIsUserScrolling(false)
      setLastResponseLength(0)
      return
    }

    if (scrollViewportRef.current && result.response.length > lastResponseLength && !isUserScrolling && isExpanded) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight
    }
    setLastResponseLength(result.response.length)
  }, [result.response, lastResponseLength, isUserScrolling, isExpanded])

  const handleScroll = () => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5
      
      if (!isAtBottom) {
        setIsUserScrolling(true)
      } else {
        setIsUserScrolling(false)
      }
    }
  }

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(result.response)
    setCopyFeedback(success ? 'Copied!' : 'Failed to copy')
    setTimeout(() => setCopyFeedback(''), 2000)
  }

  const handleDownload = (): void => {
    downloadAsMarkdown(result.response, `${result.file.name.replace('.txt', '')}_processed.md`)
  }

  const getStatusIcon = () => {
    if (result.error) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    if (result.isCompleted) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    if (result.isProcessing) {
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    }
    return <FileText className="w-4 h-4 text-gray-500" />
  }

  const getStatusText = () => {
    if (result.error) return 'Error'
    if (result.isCompleted) return 'Completed'
    if (result.isProcessing) return 'Processing...'
    return 'Waiting'
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer min-w-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-3 min-w-0 flex-1 overflow-hidden">
            <div className="flex-shrink-0">{getStatusIcon()}</div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <CardTitle className="text-lg truncate overflow-hidden" title={result.file.name}>{result.file.name}</CardTitle>
              <p className="text-sm text-muted-foreground truncate overflow-hidden" title={`${getStatusText()} • ${(result.file.size / 1024).toFixed(2)} KB`}>
                {getStatusText()} • {(result.file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            {result.response && (result.isCompleted || result.isProcessing) && (
              <>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopy()
                  }}
                  variant="outline"
                  size="sm"
                  disabled={!result.response}
                >
                  <Copy className="w-4 h-4" />
                  {copyFeedback || 'Copy'}
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload()
                  }}
                  variant="outline"
                  size="sm"
                  disabled={!result.response}
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div></div>
            {result.response && (
              <Toggle
                pressed={showMarkdown}
                onPressedChange={onToggleMarkdown}
                variant="outline"
                size="sm"
              >
                {showMarkdown ? 'Raw' : 'Markdown'}
              </Toggle>
            )}
          </div>
          
          <div className="h-96 relative">
            <div 
              ref={scrollViewportRef}
              onScroll={handleScroll}
              className="size-full overflow-auto rounded-md p-1 border"
            >
              {result.error ? (
                <div className="h-full flex items-center justify-center text-red-500">
                  <div className="text-center">
                    <AlertCircle className="w-16 h-16 mx-auto mb-4" strokeWidth={1} />
                    <p className="text-lg font-medium">Processing Error</p>
                    <p className="text-sm">{result.error}</p>
                  </div>
                </div>
              ) : result.response ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {showMarkdown ? (
                    <div className="text-foreground leading-relaxed">
                      <Streamdown>{result.response}</Streamdown>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                      {result.response}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    {result.isProcessing ? (
                      <>
                        <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" strokeWidth={1} />
                        <p className="text-lg font-medium text-foreground">Processing...</p>
                        <p className="text-sm">AI is analyzing your file</p>
                      </>
                    ) : (
                      <>
                        <FileText className="w-16 h-16 mx-auto mb-4" strokeWidth={1} />
                        <p className="text-lg font-medium text-foreground">Waiting to process</p>
                        <p className="text-sm">File will be processed shortly</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export const MultiFileResponseDisplay = ({ fileResults }: MultiFileResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true)
  const [downloadAllFeedback, setDownloadAllFeedback] = useState<string>('')

  const completedResults = fileResults.filter(result => result.isCompleted && !result.error && result.response)
  const allCompleted = fileResults.length > 0 && fileResults.every(result => result.isCompleted)

  const handleDownloadAll = (): void => {
    if (completedResults.length === 0) return

    completedResults.forEach(result => {
      downloadAsMarkdown(result.response, `${result.file.name.replace('.txt', '')}_processed.md`)
    })
    
    setDownloadAllFeedback('Downloaded all files!')
    setTimeout(() => setDownloadAllFeedback(''), 3000)
  }

  if (fileResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4" strokeWidth={1} />
              <p className="text-lg font-medium text-foreground">No files processed yet</p>
              <p className="text-sm">Upload files and add instructions to get started</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Processing Results ({fileResults.length} files)</h2>
        {allCompleted && completedResults.length > 0 && (
          <Button
            onClick={handleDownloadAll}
            variant="default"
            className="ml-4"
          >
            <DownloadCloud className="w-4 h-4" />
            {downloadAllFeedback || 'Download All'}
          </Button>
        )}
      </div>
      
      {fileResults.map((result, index) => (
        <FileItem
          key={index}
          result={result}
          index={index}
          showMarkdown={showMarkdown}
          onToggleMarkdown={setShowMarkdown}
        />
      ))}
    </div>
  )
}
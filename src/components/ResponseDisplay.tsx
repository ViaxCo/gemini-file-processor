import { useRef, useEffect, useState } from 'react'
import { Streamdown } from 'streamdown'
import { copyToClipboard, downloadAsMarkdown } from '../utils/fileUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toggle } from '@/components/ui/toggle'
import { MessageCircle, Copy, Download } from 'lucide-react'

interface ResponseDisplayProps {
  response: string
}

export const ResponseDisplay = ({ response }: ResponseDisplayProps) => {
  const [showMarkdown, setShowMarkdown] = useState<boolean>(true)
  const [copyFeedback, setCopyFeedback] = useState<string>('')
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false)
  const [lastResponseLength, setLastResponseLength] = useState<number>(0)
  const scrollViewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Reset scrolling state when response is cleared or starts fresh
    if (response.length === 0) {
      setIsUserScrolling(false)
      setLastResponseLength(0)
      return
    }

    // Auto-scroll only when response is actively being streamed and user hasn't manually scrolled
    if (scrollViewportRef.current && response.length > lastResponseLength && !isUserScrolling) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight
    }
    setLastResponseLength(response.length)
  }, [response, lastResponseLength, isUserScrolling])

  const handleScroll = () => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5 // 5px tolerance

      // If user scrolled up from bottom, mark as user scrolling
      if (!isAtBottom) {
        setIsUserScrolling(true)
      } else {
        // If user scrolled back to bottom, resume auto-scrolling
        setIsUserScrolling(false)
      }
    }
  }

  const handleCopyResponse = async (): Promise<void> => {
    const success = await copyToClipboard(response)
    setCopyFeedback(success ? 'Copied!' : 'Failed to copy')
    setTimeout(() => setCopyFeedback(''), 2000)
  }

  const handleDownloadResponse = (): void => {
    downloadAsMarkdown(response)
  }

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
            {showMarkdown ? 'Raw' : 'Markdown'}
          </Toggle>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-48 sm:h-64 lg:h-96 relative overflow-hidden">
          <div
            ref={scrollViewportRef}
            onScroll={handleScroll}
            className="size-full overflow-auto rounded-md p-1"
          >
            {response ? (
              <div className="text-sm sm:text-base leading-relaxed max-w-none overflow-hidden">
                {showMarkdown ? (
                  <div className="text-foreground leading-relaxed break-words overflow-wrap-anywhere">
                    <Streamdown>{response}</Streamdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed break-words overflow-wrap-anywhere max-w-full overflow-x-auto">
                    {response}
                  </pre>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center px-4">
                  <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" strokeWidth={1} />
                  <p className="text-base sm:text-lg font-medium text-foreground">No response yet</p>
                  <p className="text-xs sm:text-sm">Upload a file and add instructions to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {response && (
          <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleCopyResponse}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">{copyFeedback || 'Copy Response'}</span>
              <span className="sm:hidden">{copyFeedback || 'Copy'}</span>
            </Button>
            <Button
              onClick={handleDownloadResponse}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

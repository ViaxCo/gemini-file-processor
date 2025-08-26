import { useInstructions } from '../hooks/useInstructions'
import { InstructionsModal } from './InstructionsModal'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Zap, Check } from 'lucide-react'

interface InstructionsPanelProps {
  onProcess: (instruction: string) => void
  onClearAll: () => void
  isProcessing: boolean
  canProcess: boolean
  fileCount?: number
}

export const InstructionsPanel = ({ 
  onProcess, 
  onClearAll, 
  isProcessing, 
  canProcess,
  fileCount = 0
}: InstructionsPanelProps) => {
  const {
    instruction,
    setInstruction,
    savedInstructions,
    saveInstruction,
    loadInstruction,
    deleteInstruction,
    isSaved
  } = useInstructions()
  
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false)

  const handleLoadInstruction = (instructionText: string): void => {
    loadInstruction(instructionText)
    setShowInstructionsModal(false)
  }

  const handleClearAll = (): void => {
    setInstruction('')
    onClearAll()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Custom Instructions</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => setShowInstructionsModal(true)}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Saved Instructions</span>
              <span className="sm:hidden">Saved</span>
            </Button>
            <Button
              onClick={saveInstruction}
              disabled={!instruction.trim()}
              variant={isSaved ? "default" : "secondary"}
              size="sm"
              className={`text-xs sm:text-sm transition-all duration-200 ${isSaved ? "bg-green-600 hover:bg-green-700" : ""}`}
            >
              {isSaved ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Saved!</span>
                  <span className="sm:hidden">Saved!</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Save Current</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (canProcess && instruction.trim() && !isProcessing) {
                  onProcess(instruction)
                }
              }
            }}
            placeholder="Enter your instructions for Gemini AI to process the file content..."
            className="h-24 sm:h-32 resize-none mb-4 text-sm sm:text-base"
          />
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              onClick={() => onProcess(instruction)}
              disabled={!canProcess || !instruction.trim() || isProcessing}
              className="flex-1 text-sm sm:text-base"
              size="default"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Processing...</span>
                  <span className="sm:hidden">Processing</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    Process File{fileCount > 1 ? 's' : ''}
                  </span>
                  <span className="sm:hidden">Process</span>
                </>
              )}
            </Button>
            
            <Button
              onClick={handleClearAll}
              variant="secondary"
              size="default"
              className="text-sm sm:text-base"
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      <InstructionsModal
        isOpen={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
        savedInstructions={savedInstructions}
        onLoadInstruction={handleLoadInstruction}
        onDeleteInstruction={deleteInstruction}
      />
    </>
  )
}
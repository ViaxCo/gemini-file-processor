import { useInstructions } from '../hooks/useInstructions'
import { InstructionsModal } from './InstructionsModal'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Zap } from 'lucide-react'

interface InstructionsPanelProps {
  onProcess: (instruction: string) => void
  onClearAll: () => void
  isProcessing: boolean
  canProcess: boolean
}

export const InstructionsPanel = ({ 
  onProcess, 
  onClearAll, 
  isProcessing, 
  canProcess 
}: InstructionsPanelProps) => {
  const {
    instruction,
    setInstruction,
    savedInstructions,
    saveInstruction,
    loadInstruction,
    deleteInstruction
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
          <div className="flex gap-2">
            <Button
              onClick={() => setShowInstructionsModal(true)}
              variant="outline"
              size="sm"
            >
              Saved Instructions
            </Button>
            <Button
              onClick={saveInstruction}
              disabled={!instruction.trim()}
              variant="secondary"
              size="sm"
            >
              Save Current
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
            className="h-32 resize-none mb-4"
          />
          
          <div className="flex gap-3">
            <Button
              onClick={() => onProcess(instruction)}
              disabled={!canProcess || !instruction.trim() || isProcessing}
              className="flex-1"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Process File
                </>
              )}
            </Button>
            
            <Button
              onClick={handleClearAll}
              variant="secondary"
              size="lg"
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
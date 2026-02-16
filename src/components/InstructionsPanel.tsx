import {
  DEFAULT_BOOK_PROMPT,
  DEFAULT_TRANSCRIPT_PROMPT,
  useInstructions,
} from '../hooks/useInstructions';
import { InstructionsModal } from './InstructionsModal';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ProcessingProfile } from '@/hooks/useAIProcessor';
import { Loader2, Zap, Check } from 'lucide-react';

interface InstructionsPanelProps {
  onProcess: (instruction: string) => void;
  onClearAll: () => void;
  isProcessing: boolean;
  canProcess: boolean;
  fileCount?: number;
  processingProfile: ProcessingProfile;
  onProcessingProfileChange: (profile: ProcessingProfile) => void;
}

export const InstructionsPanel = ({
  onProcess,
  onClearAll,
  isProcessing,
  canProcess,
  fileCount = 0,
  processingProfile,
  onProcessingProfileChange,
}: InstructionsPanelProps) => {
  const {
    instruction,
    setInstruction,
    savedInstructions,
    saveInstruction,
    loadInstruction,
    deleteInstruction,
    validateInstruction,
    isSaved,
  } = useInstructions();

  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);

  const handleLoadInstruction = (instructionText: string): void => {
    loadInstruction(instructionText);
    setShowInstructionsModal(false);
  };

  const handleClearAll = (): void => {
    setInstruction('');
    onClearAll();
  };

  const handleProcess = (): void => {
    const validation = validateInstruction(instruction);
    if (validation.isValid) {
      onProcess(instruction);
    } else {
      console.warn('Cannot process:', validation.error);
    }
  };

  const validation = validateInstruction(instruction);
  const isInstructionValid = validation.isValid;
  const handleProcessingProfileToggle = (checked: boolean) => {
    const nextProfile = checked ? 'book' : 'transcript';
    onProcessingProfileChange(nextProfile);
    setInstruction(nextProfile === 'book' ? DEFAULT_BOOK_PROMPT : DEFAULT_TRANSCRIPT_PROMPT);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Custom Instructions</CardTitle>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Book Style Mode</p>
              <p className="text-xs text-muted-foreground">
                {processingProfile === 'book'
                  ? 'No similarity scoring or low-confidence retries'
                  : 'Similarity scoring and low-confidence retries enabled'}
              </p>
            </div>
            <Switch
              checked={processingProfile === 'book'}
              onCheckedChange={handleProcessingProfileToggle}
              aria-label="Toggle book style mode"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
              variant={isSaved ? 'default' : 'secondary'}
              size="sm"
              className={`text-xs transition-all duration-200 sm:text-sm ${isSaved ? 'bg-primary hover:bg-primary/90' : ''}`}
            >
              {isSaved ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
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
          <div className="space-y-2">
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (canProcess && isInstructionValid && !isProcessing) {
                    handleProcess();
                  }
                }
              }}
              placeholder="Enter your instructions for Gemini AI to process the file content..."
              className={`h-24 resize-none text-sm sm:h-32 sm:text-base ${
                instruction && !isInstructionValid
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }`}
            />
            {instruction && !isInstructionValid && validation.error && (
              <p className="text-sm text-destructive">{validation.error}</p>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Press Cmd/Ctrl + Enter to process</span>
              <span>{instruction.length}/10000</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
            <Button
              onClick={handleProcess}
              disabled={!canProcess || !isInstructionValid || isProcessing}
              className="flex-1 text-sm sm:text-base"
              size="default"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Processing...</span>
                  <span className="sm:hidden">Processing</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span className="hidden sm:inline">Process File{fileCount > 1 ? 's' : ''}</span>
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
  );
};

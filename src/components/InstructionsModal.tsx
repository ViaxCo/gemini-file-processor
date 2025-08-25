import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface InstructionsModalProps {
  isOpen: boolean
  onClose: () => void
  savedInstructions: string[]
  onLoadInstruction: (instruction: string) => void
  onDeleteInstruction: (index: number) => void
}

export const InstructionsModal = ({
  isOpen,
  onClose,
  savedInstructions,
  onLoadInstruction,
  onDeleteInstruction
}: InstructionsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved Instructions</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          {savedInstructions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No saved instructions yet.</p>
          ) : (
            <div className="space-y-3 pr-4">
              {savedInstructions.map((instr, index) => (
                <div key={index} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-foreground flex-1 text-sm leading-relaxed">{instr}</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => onLoadInstruction(instr)}
                        size="sm"
                        variant="default"
                      >
                        Load
                      </Button>
                      <Button
                        onClick={() => onDeleteInstruction(index)}
                        size="sm"
                        variant="destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
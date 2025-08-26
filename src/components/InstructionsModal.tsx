import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedInstructions: string[];
  onLoadInstruction: (instruction: string) => void;
  onDeleteInstruction: (index: number) => void;
}

export const InstructionsModal = ({
  isOpen,
  onClose,
  savedInstructions,
  onLoadInstruction,
  onDeleteInstruction,
}: InstructionsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved Instructions</DialogTitle>
          <DialogDescription>View, load, or delete your saved instructions.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {savedInstructions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No saved instructions yet.</p>
          ) : (
            <div className="space-y-3 pr-4">
              {savedInstructions.map((instr, index) => (
                <div key={index} className="rounded-lg bg-muted p-4">
                  <div className="flex flex-col gap-3">
                    <p className="text-sm leading-relaxed text-foreground">{instr}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => onLoadInstruction(instr)} size="sm" variant="default">
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
  );
};

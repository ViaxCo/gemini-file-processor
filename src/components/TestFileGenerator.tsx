'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const BATCH_SIZES = [10, 50, 100] as const;

export function TestFileGenerator({
  currentFileCount,
  onFilesGenerated,
}: {
  currentFileCount: number;
  onFilesGenerated: (files: File[]) => void;
}) {
  const [pendingCount, setPendingCount] = useState<(typeof BATCH_SIZES)[number]>();

  if (process.env.NODE_ENV === 'production') return null;

  const generateFiles = async (count: (typeof BATCH_SIZES)[number]) => {
    const { createTestFiles } = await import('@/testing/testFiles');
    onFilesGenerated(createTestFiles(count));
    setPendingCount(undefined);
    toast.success(`Generated ${count} test files`);
  };

  const requestBatch = (count: (typeof BATCH_SIZES)[number]) => {
    if (currentFileCount > 0) setPendingCount(count);
    else void generateFiles(count);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FlaskConical />
            Generate test files
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {BATCH_SIZES.map((count) => (
            <DropdownMenuItem key={count} onClick={() => requestBatch(count)}>
              {count} files
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pendingCount !== undefined} onOpenChange={() => setPendingCount(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace the current files?</DialogTitle>
            <DialogDescription>
              This will remove {currentFileCount} file{currentFileCount === 1 ? '' : 's'} from the
              upload area and generate {pendingCount} test files. It will not change files on your
              computer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingCount(undefined)}>
              Keep current files
            </Button>
            <Button onClick={() => pendingCount && void generateFiles(pendingCount)}>
              Replace with {pendingCount} test files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { applyBulkRenameRules, DEFAULT_BULK_RENAME_RULES } from '@/utils/bulkRename';
import { useEffect, useMemo, useState } from 'react';

export interface BulkRenameItem {
  index: number;
  currentName: string; // raw display name (can include extension)
}

interface BulkRenameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkRenameItem[];
  onApply: (mapping: Record<number, string>) => void;
}

export function BulkRenameModal({ open, onOpenChange, items, onApply }: BulkRenameModalProps) {
  const [rules, setRules] = useState(DEFAULT_BULK_RENAME_RULES);

  useEffect(() => {
    if (!open) setRules(DEFAULT_BULK_RENAME_RULES);
  }, [open]);

  const preview = useMemo(
    () =>
      items.map((it) => ({
        index: it.index,
        from: it.currentName,
        to: applyBulkRenameRules(it.currentName, rules),
      })),
    [items, rules],
  );

  const handleApply = () => {
    const mapping: Record<number, string> = {};
    for (const p of preview) {
      mapping[p.index] = p.to;
    }
    onApply(mapping);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Bulk Rename</DialogTitle>
          <DialogDescription>
            Review the new Display Names. Your original uploaded files will not change.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="find">
              Find (text or regex)
            </label>
            <Input
              id="find"
              placeholder={rules.useRegex ? 'e.g. (Series\\s*\\d+)[a-z]?' : 'Text to find'}
              value={rules.findPattern}
              onChange={(e) => setRules((current) => ({ ...current, findPattern: e.target.value }))}
            />
            <label className="mt-2 flex min-w-0 items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-primary"
                checked={rules.useRegex}
                onChange={(e) =>
                  setRules((current) => ({ ...current, useRegex: e.target.checked }))
                }
              />
              <span className="min-w-0">Use regex</span>
            </label>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="replace">
              Replace with
            </label>
            <Input
              id="replace"
              placeholder="Replacement"
              value={rules.replacement}
              onChange={(e) => setRules((current) => ({ ...current, replacement: e.target.value }))}
            />
            <div className="mt-2 space-y-2">
              <label className="flex min-w-0 items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-primary"
                  checked={rules.replacePlusWithSpace}
                  onChange={(e) =>
                    setRules((current) => ({
                      ...current,
                      replacePlusWithSpace: e.target.checked,
                    }))
                  }
                />
                <span className="min-w-0">Replace all "+" with spaces</span>
              </label>
              <label className="flex min-w-0 items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-primary"
                  checked={rules.removeInputExtension}
                  onChange={(e) =>
                    setRules((current) => ({
                      ...current,
                      removeInputExtension: e.target.checked,
                    }))
                  }
                />
                <span className="min-w-0">Remove .txt/.md/.docx extension</span>
              </label>
              <label className="flex min-w-0 items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-primary"
                  checked={rules.formatTrackTitles}
                  onChange={(e) =>
                    setRules((current) => ({ ...current, formatTrackTitles: e.target.checked }))
                  }
                />
                <span className="min-w-0">Format track titles</span>
              </label>
            </div>
          </div>
        </div>

        <Separator className="shrink-0" />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="shrink-0 text-xs text-muted-foreground">
            Preview ({items.length} file{items.length === 1 ? '' : 's'})
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-md border">
            <ul className="min-w-0 divide-y text-sm">
              {preview.map((p) => (
                <li key={p.index} className="min-w-0 space-y-1 p-2.5">
                  <div className="min-w-0 text-xs [overflow-wrap:anywhere] break-words text-muted-foreground">
                    <span className="font-medium">Before:</span> {p.from}
                  </div>
                  <div className="min-w-0 [overflow-wrap:anywhere] break-words">
                    <span className="text-xs font-medium text-muted-foreground">After:</span> {p.to}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={items.length === 0}>
            Rename {items.length} file{items.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkRenameModal;

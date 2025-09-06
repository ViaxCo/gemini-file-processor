'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useEffect, useMemo, useState } from 'react';

export interface BulkRenameItem {
  index: number;
  currentName: string; // raw display name (can include extension)
}

export interface BulkRenameRules {
  findPattern: string;
  replacement: string;
  useRegex: boolean;
  replacePlusWithSpace: boolean;
  removeTxtExtension: boolean;
}

interface BulkRenameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkRenameItem[];
  onApply: (mapping: Record<number, string>) => void; // index -> newName
}

function applyRulesToName(name: string, rules: BulkRenameRules): string {
  let next = name;

  if (rules.replacePlusWithSpace) {
    next = next.replace(/\+/g, ' ');
    // collapse multiple spaces created by replacements
    next = next.replace(/\s{2,}/g, ' ').trim();
  }

  if (rules.findPattern) {
    try {
      if (rules.useRegex) {
        const re = new RegExp(rules.findPattern, 'g');
        next = next.replace(re, rules.replacement);
      } else {
        // Escape regex special chars and do global string replace
        const escaped = rules.findPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, 'g');
        next = next.replace(re, rules.replacement);
      }
    } catch {
      // If regex fails to compile, leave as-is
    }
  }

  if (rules.removeTxtExtension) {
    next = next.replace(/\.txt$/i, '');
  }

  // Trim leftover separators and whitespace artifacts
  next = next.replace(/\s{2,}/g, ' ').trim();
  // Remove trailing separators like '-' if left hanging
  next = next.replace(/[\s-]+$/g, '').replace(/^[\s-]+/g, '');

  return next;
}

export function BulkRenameModal({ open, onOpenChange, items, onApply }: BulkRenameModalProps) {
  const [findPattern, setFindPattern] = useState<string>('');
  const [replacement, setReplacement] = useState<string>('');
  const [useRegex, setUseRegex] = useState<boolean>(true);
  const [replacePlusWithSpace, setReplacePlusWithSpace] = useState<boolean>(true);
  const [removeTxtExtension, setRemoveTxtExtension] = useState<boolean>(true);

  useEffect(() => {
    if (!open) {
      // Reset to sensible defaults when closed
      setFindPattern('');
      setReplacement('');
      setUseRegex(true);
      setReplacePlusWithSpace(true);
      setRemoveTxtExtension(true);
    }
  }, [open]);

  const rules: BulkRenameRules = {
    findPattern,
    replacement,
    useRegex,
    replacePlusWithSpace,
    removeTxtExtension,
  };

  const preview = useMemo(() => {
    return items.map((it) => ({
      index: it.index,
      from: it.currentName,
      to: applyRulesToName(it.currentName, rules),
    }));
  }, [
    items,
    rules.findPattern,
    rules.replacement,
    rules.useRegex,
    rules.replacePlusWithSpace,
    rules.removeTxtExtension,
  ]);

  const handleApply = () => {
    const mapping: Record<number, string> = {};
    for (const p of preview) {
      mapping[p.index] = p.to;
    }
    onApply(mapping);
    // Clear only text inputs but keep modal open
    setFindPattern('');
    setReplacement('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk Rename</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="find">
                Find (text or regex)
              </label>
              <Input
                id="find"
                placeholder={useRegex ? 'e.g. (Series\\s*\\d+)[a-z]?' : 'Text to find'}
                value={findPattern}
                onChange={(e) => setFindPattern(e.target.value)}
              />
              <label className="mt-2 inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                />
                Use regex
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="replace">
                Replace with
              </label>
              <Input
                id="replace"
                placeholder="Replacement"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
              <div className="mt-2 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={replacePlusWithSpace}
                    onChange={(e) => setReplacePlusWithSpace(e.target.checked)}
                  />
                  Replace all "+" with spaces
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={removeTxtExtension}
                    onChange={(e) => setRemoveTxtExtension(e.target.checked)}
                  />
                  Remove .txt extension
                </label>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Preview ({items.length} file{items.length === 1 ? '' : 's'})
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <ul className="divide-y text-sm">
                {preview.map((p) => (
                  <li key={p.index} className="flex items-center gap-2 p-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate" title={p.from}>
                        {p.from}
                      </div>
                      <div className="truncate text-muted-foreground" title={p.to}>
                        → {p.to}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={items.length === 0}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BulkRenameModal;

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FileSeriesGroup({
  title,
  fileCount,
  isUngrouped,
  onToggleSelection,
  isOpen,
  onOpenChange,
  status,
  assignment,
  selectedCount,
  page,
  pageCount,
  visibleStart,
  visibleEnd,
  onPageChange,
  children,
}: {
  title: string;
  fileCount: number;
  isUngrouped: boolean;
  onToggleSelection: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  status: {
    completed: number;
    active: number;
    retrying: number;
    waiting: number;
    failed: number;
    uploaded: number;
  };
  assignment: { assignedCount: number; destinationCount: number };
  selectedCount: number;
  page: number;
  pageCount: number;
  visibleStart: number;
  visibleEnd: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}) {
  const itemLabel = isUngrouped
    ? `${fileCount} file${fileCount === 1 ? '' : 's'}`
    : `${fileCount} track${fileCount === 1 ? '' : 's'}`;
  const isFullySelected = fileCount > 0 && selectedCount === fileCount;
  const isPartlySelected = selectedCount > 0 && !isFullySelected;
  const assignmentLabel =
    assignment.assignedCount === 0
      ? 'Unassigned'
      : assignment.assignedCount < fileCount
        ? `${assignment.assignedCount} of ${fileCount} assigned`
        : assignment.destinationCount > 1
          ? `Assigned · ${assignment.destinationCount} folders`
          : 'Assigned';
  const isFullyAssigned = assignment.assignedCount === fileCount;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} asChild>
      <section
        className={cn(
          'overflow-hidden rounded-xl border bg-muted/65 transition-colors',
          isFullySelected && 'border-primary/60 bg-primary/10',
          isPartlySelected && 'border-primary/35',
        )}
        aria-label={title}
      >
        <header className="grid grid-cols-1 gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full min-w-0 justify-start gap-2 px-0 py-0 text-left whitespace-normal hover:bg-transparent"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-primary transition-transform',
                  !isOpen && '-rotate-90',
                )}
              />
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block max-w-full min-w-0 text-sm leading-snug font-semibold [overflow-wrap:anywhere] whitespace-normal sm:text-base">
                  {title}
                </span>
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-normal text-muted-foreground">
                  <Badge variant="secondary" className="h-5 px-1.5 text-[11px] tabular-nums">
                    {itemLabel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 px-1.5 text-[11px] tabular-nums',
                      isFullyAssigned && 'border-primary/35 text-foreground',
                    )}
                  >
                    {assignmentLabel}
                  </Badge>
                  <span>{status.completed} complete</span>
                  {status.retrying > 0 ? <span>{status.retrying} retrying</span> : null}
                  {status.active > 0 ? <span>{status.active} active</span> : null}
                  {status.waiting > 0 ? <span>{status.waiting} waiting</span> : null}
                  {status.failed > 0 ? (
                    <span className="font-medium text-destructive">{status.failed} failed</span>
                  ) : null}
                  {status.uploaded > 0 ? <span>{status.uploaded} uploaded</span> : null}
                </span>
              </span>
            </Button>
          </CollapsibleTrigger>
          {!isUngrouped ? (
            <Button
              variant={isFullySelected ? 'default' : isPartlySelected ? 'secondary' : 'outline'}
              size="sm"
              onClick={onToggleSelection}
              className="w-full sm:w-auto"
              aria-pressed={isPartlySelected ? 'mixed' : isFullySelected}
            >
              {isFullySelected ? <Check /> : null}
              {isFullySelected
                ? 'Selected'
                : isPartlySelected
                  ? `${selectedCount} of ${fileCount} selected`
                  : 'Select Series'}
            </Button>
          ) : null}
        </header>

        <CollapsibleContent>
          <div className="border-t bg-background/35 p-2.5">
            {pageCount > 1 ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/80 p-2">
                <span className="text-xs font-medium text-muted-foreground tabular-nums sm:text-sm">
                  {visibleStart}–{visibleEnd} of {fileCount}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <span className="min-w-16 text-center text-xs text-muted-foreground tabular-nums">
                    {page + 1} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= pageCount - 1}
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2.5">{children}</div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function FileSeriesGroup({
  title,
  fileCount,
  isUngrouped,
  onSelect,
  children,
}: {
  title: string;
  fileCount: number;
  isUngrouped: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const itemLabel = isUngrouped
    ? `${fileCount} file${fileCount === 1 ? '' : 's'}`
    : `${fileCount} track${fileCount === 1 ? '' : 's'}`;

  return (
    <section className="space-y-4" aria-label={title}>
      <header className="flex flex-col gap-3 rounded-xl border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-lg leading-tight font-semibold break-words sm:text-xl">{title}</h3>
          <Badge variant="secondary" className="tabular-nums">
            {itemLabel}
          </Badge>
        </div>
        {!isUngrouped && (
          <Button variant="outline" size="sm" onClick={onSelect} className="w-full sm:w-auto">
            Select Series
          </Button>
        )}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

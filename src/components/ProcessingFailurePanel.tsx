'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getProvider } from '@/config/providerConfig';
import {
  MAX_PROCESSING_ATTEMPTS,
  ProcessingFailure,
  ProcessingRecoveryAction,
} from '@/services/processingErrors';
import { copyToClipboard } from '@/utils/fileUtils';
import {
  ChevronDown,
  Clock3,
  Copy,
  KeyRound,
  PencilLine,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const RECOVERY_LABELS: Record<ProcessingRecoveryAction, string> = {
  retry: 'Retry',
  retry_later: 'Retry Later',
  check_api_key: 'Check API Key',
  choose_model: 'Choose Model',
  review_instructions: 'Review Instructions',
};

const RECOVERY_ICONS = {
  retry: RotateCcw,
  retry_later: Clock3,
  check_api_key: KeyRound,
  choose_model: Settings2,
  review_instructions: PencilLine,
} satisfies Record<ProcessingRecoveryAction, typeof RotateCcw>;

type ProcessingFailurePanelProps = {
  failure: ProcessingFailure;
  retryCount?: number;
  nextRetryAt?: number;
  isRetrying: boolean;
  isProcessing: boolean;
  onRetry?: () => void;
  onCheckApiKey?: () => void;
  onChooseModel?: () => void;
  onReviewInstructions?: () => void;
};

export function ProcessingFailurePanel({
  failure,
  retryCount = 0,
  nextRetryAt,
  isRetrying,
  isProcessing,
  onRetry,
  onCheckApiKey,
  onChooseModel,
  onReviewInstructions,
}: ProcessingFailurePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!nextRetryAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [nextRetryAt]);

  const providerName = getProvider(failure.provider)?.name ?? failure.provider;
  const secondsRemaining = nextRetryAt ? Math.max(0, Math.ceil((nextRetryAt - now) / 1000)) : 0;
  const nextAttempt = retryCount + 1;
  const attemptsUsed = isRetrying && nextRetryAt ? retryCount : retryCount + 1;
  const retryState = nextRetryAt
    ? `Retrying in ${secondsRemaining}s · attempt ${nextAttempt} of ${MAX_PROCESSING_ATTEMPTS}`
    : isRetrying && isProcessing
      ? `Attempt ${nextAttempt} of ${MAX_PROCESSING_ATTEMPTS}`
      : undefined;
  const recoveryHandlers: Record<ProcessingRecoveryAction, (() => void) | undefined> = {
    retry: onRetry,
    retry_later: onRetry,
    check_api_key: onCheckApiKey,
    choose_model: onChooseModel,
    review_instructions: onReviewInstructions,
  };
  const recoveryHandler = recoveryHandlers[failure.recoveryAction];
  const RecoveryIcon = RECOVERY_ICONS[failure.recoveryAction];
  const details = [
    `Provider: ${providerName}`,
    `Model: ${failure.model}`,
    failure.httpStatus ? `HTTP status: ${failure.httpStatus}` : undefined,
    failure.providerCode ? `Provider code: ${failure.providerCode}` : undefined,
    `Attempts used: ${attemptsUsed} of ${MAX_PROCESSING_ATTEMPTS}`,
    failure.retryAfterMs
      ? `Provider retry delay: ${Math.ceil(failure.retryAfterMs / 1000)} seconds`
      : undefined,
    `Message: ${failure.technicalMessage}`,
  ].filter(Boolean);

  const copyDetails = async () => {
    const copied = await copyToClipboard(details.join('\n'));
    toast[copied ? 'success' : 'error'](copied ? 'Error details copied' : 'Copy failed');
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mt-2 rounded-xl border border-destructive/25 bg-destructive/5 px-2.5 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="destructive" className="max-w-full">
          <span className="truncate">
            {failure.title}
            {failure.httpStatus ? ` · ${failure.httpStatus}` : ''}
          </span>
        </Badge>
        <p className="min-w-40 flex-1 text-xs leading-5 text-foreground">{failure.message}</p>
        {retryState ? (
          <span
            className="text-xs font-medium whitespace-nowrap text-destructive"
            role="status"
            aria-live="polite"
          >
            {retryState}
          </span>
        ) : null}
        {!isRetrying && recoveryHandler ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={recoveryHandler}
          >
            <RecoveryIcon className="h-3.5 w-3.5" />
            {RECOVERY_LABELS[failure.recoveryAction]}
          </Button>
        ) : null}
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
            Error details
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="mt-2 border-t border-destructive/20 pt-2">
          <dl className="grid min-w-0 gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="font-medium text-muted-foreground">Provider</dt>
            <dd className="min-w-0 break-words">{providerName}</dd>
            <dt className="font-medium text-muted-foreground">Model</dt>
            <dd className="min-w-0 break-all">{failure.model}</dd>
            {failure.httpStatus ? (
              <>
                <dt className="font-medium text-muted-foreground">HTTP status</dt>
                <dd>{failure.httpStatus}</dd>
              </>
            ) : null}
            {failure.providerCode ? (
              <>
                <dt className="font-medium text-muted-foreground">Provider code</dt>
                <dd className="min-w-0 break-all">{failure.providerCode}</dd>
              </>
            ) : null}
            <dt className="font-medium text-muted-foreground">Attempts used</dt>
            <dd>
              {attemptsUsed} of {MAX_PROCESSING_ATTEMPTS}
            </dd>
            {failure.retryAfterMs ? (
              <>
                <dt className="font-medium text-muted-foreground">Provider retry delay</dt>
                <dd>{Math.ceil(failure.retryAfterMs / 1000)} seconds</dd>
              </>
            ) : null}
            <dt className="font-medium text-muted-foreground">Provider message</dt>
            <dd className="min-w-0 break-words">{failure.technicalMessage}</dd>
          </dl>
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={copyDetails}>
              <Copy className="h-3.5 w-3.5" />
              Copy details
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

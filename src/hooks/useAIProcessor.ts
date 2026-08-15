import { useEffect, useMemo, useRef, useState } from 'react';
import { AIProvider, getModel } from '../config/providerConfig';
import { processFileWithAI } from '../services/aiService';
import type { GeminiProject } from '../services/geminiProjectStore';
import { GeminiQuotaScheduler } from '../services/geminiQuotaScheduler';
import {
  MAX_PROCESSING_ATTEMPTS,
  ProcessingFailure,
  getRetryDelayMs,
  toProcessingFailure,
} from '../services/processingErrors';
import { makeFileKey, responseStore } from '../services/responseStore';
import { extractTextFromFile } from '../utils/fileUtils';
import { scheduleIdleWork } from '../utils/performance';
import {
  ACTIVE_REQUEST_LIMIT,
  PROVIDER_FAILURE_PAUSE_THRESHOLD,
  estimateRemainingSeconds,
  getProviderFailureSignature,
  getQueueProgress,
  isImmediateProviderWideFailure,
} from '../utils/processingQueue';

export type ProcessingProfile = 'transcript' | 'book';
export const MAX_LOW_CONFIDENCE_RETRIES = 3;
export type QueuePauseReason =
  { kind: 'manual' } | { kind: 'automatic'; failure: ProcessingFailure };
type ProcessingQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

const getEffectiveRateLimit = (
  provider: AIProvider,
  model: string,
  geminiProjects: GeminiProject[],
) => {
  const rateLimit = getModel(provider, model)?.rateLimit ?? { limit: 10, interval: 60_000 };
  return provider === 'gemini'
    ? { ...rateLimit, limit: rateLimit.limit * Math.max(1, geminiProjects.length) }
    : rateLimit;
};

const makeGeminiPauseFailure = (
  category: 'daily_quota' | 'authentication',
  message: string,
  model: string,
): ProcessingFailure => ({
  kind: category === 'daily_quota' ? 'deferred' : 'permanent',
  category,
  title: category === 'daily_quota' ? 'All Gemini daily quotas reached' : 'No usable Gemini key',
  message,
  provider: 'gemini',
  model,
  technicalMessage: message,
  retryable: false,
  recoveryAction: category === 'daily_quota' ? 'retry_later' : 'check_api_key',
  quotaType: category === 'daily_quota' ? 'rpd' : undefined,
});

export interface FileResult {
  file: File;
  response: string;
  isProcessing: boolean;
  isCompleted: boolean;
  processingProfile?: ProcessingProfile;
  error?: ProcessingFailure;
  retryFailure?: ProcessingFailure;
  queueStatus?: ProcessingQueueStatus;
  retryCount?: number;
  lowConfidenceRetryCount?: number;
  nextRetryAt?: number;
  recoveredRetryCount?: number;
  lastRequestDurationMs?: number;
  confidence?: { score: number; level: 'high' | 'medium' | 'low' };
  // Store previous confidence score for retries
  previousConfidence?: {
    score: number;
    level: 'high' | 'medium' | 'low';
  };
  // Snapshot before manual retry; used to restore on abort
  previousState?: {
    response: string;
    isCompleted: boolean;
    error?: ProcessingFailure;
    retryFailure?: ProcessingFailure;
    queueStatus?: ProcessingQueueStatus;
    retryCount?: number;
    nextRetryAt?: number;
    recoveredRetryCount?: number;
    confidence?: FileResult['confidence'];
  };
  // Marks a manual retry attempt
  isManuallyRetrying?: boolean;
}

function restorePreviousResult(result: FileResult): FileResult {
  const previous = result.previousState!;
  return {
    ...result,
    response: previous.response,
    isCompleted: previous.isCompleted,
    error: previous.error,
    retryFailure: previous.retryFailure,
    queueStatus: previous.queueStatus,
    retryCount: previous.retryCount,
    lowConfidenceRetryCount: undefined,
    nextRetryAt: previous.nextRetryAt,
    recoveredRetryCount: previous.recoveredRetryCount,
    confidence: previous.confidence,
    isProcessing: false,
    isManuallyRetrying: undefined,
    previousState: undefined,
  };
}

export const useAIProcessor = () => {
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const fileResultsRef = useRef<FileResult[]>([]);
  const resultsPublishTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [processingBatchId, setProcessingBatchId] = useState(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<QueuePauseReason>();
  const [isWaitingForNextBatch, setIsWaitingForNextBatch] = useState<boolean>(false);
  const [throttleSecondsRemaining, setThrottleSecondsRemaining] = useState<number>(0);

  // Internal queue state
  type QueueItem = {
    file: File;
    index: number; // position in fileResults
    key: string;
    profile: ProcessingProfile;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retryCount?: number;
    lowConfidenceRetryCount?: number;
  };
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);
  const abortRef = useRef<boolean>(false);
  const activePromisesRef = useRef<Set<Promise<void>>>(new Set());
  const pausedFailureItemsRef = useRef<Map<number, QueueItem>>(new Map());
  const consecutiveFailuresRef = useRef<{ signature: string; items: QueueItem[] } | undefined>(
    undefined,
  );
  const batchConfigRef = useRef<
    | {
        instruction: string;
        provider: AIProvider;
        model: string;
        apiKey: string;
        geminiProjects: GeminiProject[];
        mode: 'single' | 'batch';
        profile: ProcessingProfile;
      }
    | undefined
  >(undefined);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const retryTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const throttleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestTimestampsRef = useRef<number[]>([]); // timestamps of requests for token bucket algorithm
  const geminiSchedulerRef = useRef<GeminiQuotaScheduler | undefined>(undefined);
  const automaticResumeAtRef = useRef<number | undefined>(undefined);

  // Default rate limit fallback
  const DEFAULT_RATE_LIMIT = { limit: 10, interval: 60000 };
  const [rateLimit, setRateLimit] = useState(DEFAULT_RATE_LIMIT);

  const publishFileResults = (immediate = false): void => {
    if (immediate) {
      if (resultsPublishTimeoutRef.current) clearTimeout(resultsPublishTimeoutRef.current);
      resultsPublishTimeoutRef.current = undefined;
      setFileResults(fileResultsRef.current);
      return;
    }
    if (resultsPublishTimeoutRef.current) return;
    resultsPublishTimeoutRef.current = setTimeout(() => {
      resultsPublishTimeoutRef.current = undefined;
      setFileResults(fileResultsRef.current);
    }, 200);
  };

  const updateFileResults = (
    updater: (previous: FileResult[]) => FileResult[],
    immediate = false,
  ): void => {
    fileResultsRef.current = updater(fileResultsRef.current);
    publishFileResults(immediate);
  };

  const clearRetryTimeout = (index: number): void => {
    const timeout = retryTimeoutsRef.current.get(index);
    if (timeout) clearTimeout(timeout);
    retryTimeoutsRef.current.delete(index);
  };

  const wait = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

  const setPaused = (reason: QueuePauseReason | undefined) => {
    pausedRef.current = !!reason;
    setIsPaused(!!reason);
    setPauseReason(reason);
  };

  // Abort helpers
  const abortFilesByIndices = (indices: number[]): void => {
    if (indices.length === 0) return;
    indices.forEach(clearRetryTimeout);
    // Remove queued items for these indices
    queueRef.current = queueRef.current.filter((q) => !indices.includes(q.index));

    updateFileResults(
      (prev) =>
        prev.map((result, i) => {
          if (!indices.includes(i)) return result;
          const key = makeFileKey(result.file);
          const controller = controllersRef.current.get(key);
          if (controller) {
            try {
              controller.abort();
            } catch {}
            controllersRef.current.delete(key);
          }
          if (result.isManuallyRetrying && result.previousState) {
            return restorePreviousResult(result);
          }
          return {
            ...result,
            isProcessing: false,
            isCompleted: false,
            queueStatus: 'cancelled',
            error: undefined,
            retryFailure: undefined,
            lowConfidenceRetryCount: undefined,
            nextRetryAt: undefined,
            isManuallyRetrying: undefined,
            previousState: undefined,
          };
        }),
      true,
    );
  };

  const abortFile = (index: number): void => abortFilesByIndices([index]);
  const abortSelected = (indices: number[]): void => abortFilesByIndices(indices);

  const abortAll = (): void => {
    abortRef.current = true;
    automaticResumeAtRef.current = undefined;
    queueRef.current = [];
    pausedFailureItemsRef.current.clear();
    consecutiveFailuresRef.current = undefined;
    setPaused(undefined);
    for (const timeout of retryTimeoutsRef.current.values()) clearTimeout(timeout);
    retryTimeoutsRef.current.clear();
    // Abort all active controllers
    for (const [, controller] of controllersRef.current) {
      try {
        controller.abort();
      } catch {}
    }
    controllersRef.current.clear();
    updateFileResults(
      (prev) =>
        prev.map((result) => {
          if (result.isManuallyRetrying && result.previousState) {
            return restorePreviousResult(result);
          }
          if (result.isProcessing || result.queueStatus === 'pending') {
            return {
              ...result,
              isProcessing: false,
              isCompleted: false,
              queueStatus: 'cancelled',
              error: undefined,
              retryFailure: undefined,
              lowConfidenceRetryCount: undefined,
              nextRetryAt: undefined,
              isManuallyRetrying: undefined,
              previousState: undefined,
            };
          }
          return result;
        }),
      true,
    );
  };

  // Public API compatible with current components
  const processFiles = async (
    files: File[],
    instruction: string,
    provider: AIProvider,
    model: string,
    apiKey: string,
    profile: ProcessingProfile = 'transcript',
    geminiProjects: GeminiProject[] = [],
  ): Promise<void> => {
    if (processingRef.current) return;
    if (!files.length || !instruction.trim()) {
      alert('Please select files and provide instructions');
      return;
    }
    // Start a new lifecycle for all state associated with these results.
    setPaused(undefined);
    automaticResumeAtRef.current = undefined;
    pausedFailureItemsRef.current.clear();
    consecutiveFailuresRef.current = undefined;
    requestTimestampsRef.current = [];
    setProcessingBatchId((current) => current + 1);
    setIsProcessing(true);
    // Initialize results for all files (queue: pending)
    const initialResults: FileResult[] = files.map((file) => ({
      file,
      response: '',
      isProcessing: false,
      isCompleted: false,
      processingProfile: profile,
      queueStatus: 'pending',
    }));
    updateFileResults(() => initialResults, true);

    // Seed queue
    addToQueue(files, undefined, 0, 0, profile);

    // Determine processing mode
    const processingMode: 'single' | 'batch' = files.length === 1 ? 'single' : 'batch';

    // Start processing
    await processQueue(
      instruction,
      provider,
      model,
      apiKey,
      processingMode,
      profile,
      geminiProjects,
    );
  };

  const retryFile = async (
    fileIndex: number,
    instruction: string,
    provider: AIProvider,
    model: string,
    apiKey: string,
    profile: ProcessingProfile = 'transcript',
    geminiProjects: GeminiProject[] = [],
  ): Promise<void> => {
    if (processingRef.current) return;
    if (fileIndex < 0 || fileIndex >= fileResults.length) return;

    const fileToRetry = fileResults[fileIndex];
    if (!fileToRetry) return;

    // Reset state and re-queue as a single-file job
    updateFileResults(
      (prev) =>
        prev.map((result, i) =>
          i === fileIndex
            ? {
                ...result,
                // Snapshot current state for potential restore on abort
                previousState: {
                  response: result.response,
                  isCompleted: result.isCompleted,
                  error: result.error,
                  retryFailure: result.retryFailure,
                  queueStatus: result.queueStatus,
                  retryCount: result.retryCount,
                  nextRetryAt: result.nextRetryAt,
                  recoveredRetryCount: result.recoveredRetryCount,
                  confidence: result.confidence,
                },
                isManuallyRetrying: true,
                response: '',
                isProcessing: false,
                isCompleted: false,
                error: undefined,
                retryFailure: undefined,
                queueStatus: 'pending',
                retryCount: undefined,
                lowConfidenceRetryCount: undefined,
                nextRetryAt: undefined,
                recoveredRetryCount: undefined,
                confidence: undefined,
              }
            : result,
        ),
      true,
    );

    // Show processing state immediately when retrying
    setIsProcessing(true);
    addToQueue([fileToRetry.file], fileIndex, 0, 0, profile);
    await processQueue(instruction, provider, model, apiKey, 'single', profile, geminiProjects);
  };

  const retryAllFailed = async (
    instruction: string,
    provider: AIProvider,
    model: string,
    apiKey: string,
    profile: ProcessingProfile = 'transcript',
    targetIndices?: number[],
    geminiProjects: GeminiProject[] = [],
  ): Promise<void> => {
    if (processingRef.current) return;
    // First, identify failed files from current state. When targetIndices is provided,
    // only retry those indices (used to preserve per-file processing profiles).
    const sourceIndices =
      targetIndices ??
      fileResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.error)
        .map(({ index }) => index);

    const failedIndices = sourceIndices.filter((index) => !!fileResults[index]?.error);

    if (failedIndices.length === 0) return;

    // Reset all failed files' states and queue them
    updateFileResults(
      (prev) =>
        prev.map((result, i) =>
          failedIndices.includes(i)
            ? {
                ...result,
                previousState: {
                  response: result.response,
                  isCompleted: result.isCompleted,
                  error: result.error,
                  retryFailure: result.retryFailure,
                  queueStatus: result.queueStatus,
                  retryCount: result.retryCount,
                  nextRetryAt: result.nextRetryAt,
                  recoveredRetryCount: result.recoveredRetryCount,
                  confidence: result.confidence,
                },
                isManuallyRetrying: true,
                response: '',
                isProcessing: false,
                isCompleted: false,
                error: undefined,
                retryFailure: undefined,
                queueStatus: 'pending',
                retryCount: undefined,
                lowConfidenceRetryCount: undefined,
                nextRetryAt: undefined,
                recoveredRetryCount: undefined,
                confidence: undefined,
              }
            : result,
        ),
      true,
    );
    const failedFiles = failedIndices.map((i) => fileResults[i]!.file);
    // Show processing state immediately when retrying all failed
    setIsProcessing(true);
    addToQueue(failedFiles, undefined, 0, 0, profile);
    await processQueue(
      instruction,
      provider,
      model,
      apiKey,
      failedFiles.length === 1 ? 'single' : 'batch',
      profile,
      geminiProjects,
    );
  };

  const clearResults = (): void => {
    setPaused(undefined);
    automaticResumeAtRef.current = undefined;
    setProcessingBatchId((current) => current + 1);
    updateFileResults(() => [], true);
    queueRef.current = [];
    pausedFailureItemsRef.current.clear();
    consecutiveFailuresRef.current = undefined;
    requestTimestampsRef.current = [];
    responseStore.clearAll();
  };

  // Queue management methods
  const addToQueue = (
    files: File[],
    overrideIndex?: number,
    retryCount = 0,
    lowConfidenceRetryCount = 0,
    profile: ProcessingProfile = 'transcript',
    priority = false,
  ): void => {
    const items: QueueItem[] = files.map((file, idx) => {
      // Try to map to the correct fileResults index. Fallback to local idx.
      let index = overrideIndex ?? fileResultsRef.current.findIndex((r) => r.file === file);
      if (index === -1) index = idx;
      return {
        file,
        index,
        key: makeFileKey(file),
        profile,
        status: 'pending',
        retryCount,
        lowConfidenceRetryCount,
      };
    });
    queueRef.current = priority
      ? [
          ...items,
          ...queueRef.current.filter(
            (queued) => !items.some((item) => item.index === queued.index),
          ),
        ]
      : [...queueRef.current, ...items];
  };

  const pauseQueue = (): void => {
    if (processingRef.current) {
      automaticResumeAtRef.current = undefined;
      setPaused({ kind: 'manual' });
    }
  };

  const resumeQueue = (
    provider: AIProvider,
    model: string,
    apiKey: string,
    geminiProjects: GeminiProject[] = [],
  ): void => {
    const config = batchConfigRef.current;
    if (!config || activePromisesRef.current.size > 0) return;

    const changedPool =
      config.provider !== provider || config.model !== model || config.apiKey !== apiKey;
    batchConfigRef.current = { ...config, provider, model, apiKey, geminiProjects };
    if (changedPool) requestTimestampsRef.current = [];

    const failedItems = [...pausedFailureItemsRef.current.values()].map((item) => ({
      ...item,
      status: 'pending' as const,
      retryCount: 0,
    }));
    pausedFailureItemsRef.current.clear();
    consecutiveFailuresRef.current = undefined;

    if (failedItems.length > 0) {
      const failedIndices = new Set(failedItems.map((item) => item.index));
      queueRef.current = [
        ...failedItems,
        ...queueRef.current.filter((item) => !failedIndices.has(item.index)),
      ];
      updateFileResults(
        (previous) =>
          previous.map((result, index) =>
            failedIndices.has(index)
              ? {
                  ...result,
                  response: '',
                  isProcessing: false,
                  isCompleted: false,
                  error: undefined,
                  retryFailure: undefined,
                  retryCount: undefined,
                  nextRetryAt: undefined,
                  queueStatus: 'pending',
                }
              : result,
          ),
        true,
      );
    }

    const nextRateLimit = getEffectiveRateLimit(provider, model, geminiProjects);
    setRateLimit(nextRateLimit);
    if (provider === 'gemini') {
      const projectRateLimit = getModel(provider, model)?.rateLimit ?? DEFAULT_RATE_LIMIT;
      geminiSchedulerRef.current = new GeminiQuotaScheduler(
        geminiProjects,
        model,
        projectRateLimit.limit,
        projectRateLimit.interval,
      );
    } else {
      geminiSchedulerRef.current = undefined;
    }
    automaticResumeAtRef.current = undefined;
    setPaused(undefined);
  };

  const processQueue = async (
    instruction: string,
    provider: AIProvider,
    model: string,
    apiKey: string,
    mode: 'single' | 'batch',
    profile: ProcessingProfile = 'transcript',
    geminiProjects: GeminiProject[] = [],
  ): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    abortRef.current = false;
    batchConfigRef.current = {
      instruction,
      provider,
      model,
      apiKey,
      geminiProjects,
      mode,
      profile,
    };
    const projectRateLimit = getModel(provider, model)?.rateLimit ?? DEFAULT_RATE_LIMIT;
    geminiSchedulerRef.current =
      provider === 'gemini'
        ? new GeminiQuotaScheduler(
            geminiProjects,
            model,
            projectRateLimit.limit,
            projectRateLimit.interval,
          )
        : undefined;
    setRateLimit(getEffectiveRateLimit(provider, model, geminiProjects));

    try {
      // Update UI to show queued files as pending
      updateFileResults((prev) =>
        prev.map((r, i) => ({
          ...r,
          queueStatus: queueRef.current.find((q) => q.index === i)?.status ?? r.queueStatus,
        })),
      );

      const processItem = async (item: QueueItem, geminiProject?: GeminiProject) => {
        const {
          file,
          index,
          key,
          profile: itemProfile = profile,
          retryCount = 0,
          lowConfidenceRetryCount = 0,
        } = item;
        const startedAt = Date.now();
        const config = batchConfigRef.current!;
        const streamToUI = config.mode === 'single';
        if (!streamToUI) {
          responseStore.addResponse(key, '');
        }
        let discardBufferedResponse = false;
        let confidence: FileResult['confidence'];
        try {
          let responseBuffer = '';
          let fullResponse = '';
          let lastUpdateTime = Date.now();
          const flushBufferToUI = () => {
            if (responseBuffer) {
              const currentBuffer = responseBuffer;
              responseBuffer = '';
              scheduleIdleWork(() => {
                if (discardBufferedResponse) return;
                updateFileResults((prev) =>
                  prev.map((result, i) =>
                    i === index ? { ...result, response: result.response + currentBuffer } : result,
                  ),
                );
              });
            }
          };
          const controller = new AbortController();
          controllersRef.current.set(key, controller);
          const metadata = await processFileWithAI(
            file,
            config.instruction,
            config.provider,
            config.model,
            geminiProject?.apiKey ?? config.apiKey,
            (chunk: string) => {
              if (streamToUI) {
                responseBuffer += chunk;
                fullResponse += chunk;
                const now = Date.now();
                if (now - lastUpdateTime >= 100 || responseBuffer.length >= 500) {
                  flushBufferToUI();
                  lastUpdateTime = now;
                }
              } else {
                responseStore.updateResponse(key, chunk);
              }
            },
            { signal: controller.signal, attempt: retryCount + 1 },
          );
          if (geminiProject) {
            geminiSchedulerRef.current?.reportSuccess(geminiProject.id, metadata.inputTokens ?? 0);
          }
          if (streamToUI) flushBufferToUI();

          // For batch processing, get the final response before clearing it
          let finalResponse = '';
          if (!streamToUI) {
            finalResponse = responseStore.getResponse(key);
          } else {
            finalResponse = fullResponse;
          }

          if (itemProfile === 'transcript') {
            const { getConfidenceScore } = await import('../utils/confidenceScore');
            const originalContent = await extractTextFromFile(file);
            const confidenceResult = getConfidenceScore(originalContent, finalResponse);
            const { level, score } = confidenceResult;
            confidence = { level, score };

            if (level === 'low' && lowConfidenceRetryCount < MAX_LOW_CONFIDENCE_RETRIES) {
              console.log(
                `Low confidence for file ${file.name}, retrying... (${lowConfidenceRetryCount + 1}/${MAX_LOW_CONFIDENCE_RETRIES})`,
              );
              updateFileResults((prev) =>
                prev.map((result, i) =>
                  i === index
                    ? {
                        ...result,
                        response: '',
                        isProcessing: false,
                        isCompleted: false,
                        queueStatus: 'pending',
                        retryFailure: undefined,
                        retryCount: undefined,
                        nextRetryAt: undefined,
                        lowConfidenceRetryCount: lowConfidenceRetryCount + 1,
                        previousConfidence: {
                          score,
                          level,
                        },
                      }
                    : result,
                ),
              );

              if (!streamToUI) {
                responseStore.clearResponse(key);
              }
              discardBufferedResponse = true;

              const backoffDelay = Math.pow(2, lowConfidenceRetryCount) * 1000;
              clearRetryTimeout(index);
              const timeout = setTimeout(() => {
                retryTimeoutsRef.current.delete(index);
                if (abortRef.current) return;
                addToQueue(
                  [file],
                  index,
                  retryCount,
                  lowConfidenceRetryCount + 1,
                  itemProfile,
                  true,
                );
                if (!processingRef.current) {
                  const latestConfig = batchConfigRef.current!;
                  void processQueue(
                    latestConfig.instruction,
                    latestConfig.provider,
                    latestConfig.model,
                    latestConfig.apiKey,
                    latestConfig.mode,
                    itemProfile,
                    latestConfig.geminiProjects,
                  );
                }
              }, backoffDelay);
              retryTimeoutsRef.current.set(index, timeout);
              return;
            }
          }

          if (config.mode === 'batch') {
            // Clear the response from the store since we're done with it
            if (!streamToUI) {
              responseStore.clearResponse(key);
            }
          } else {
            // For single file processing, clear the response immediately
            if (!streamToUI) {
              responseStore.clearResponse(key);
            }
          }

          // Clear controller after success
          controllersRef.current.delete(key);
          consecutiveFailuresRef.current = undefined;
          updateFileResults((prev) =>
            prev.map((result, i) =>
              i === index
                ? {
                    ...result,
                    isProcessing: false,
                    isCompleted: true,
                    response: streamToUI ? result.response : finalResponse,
                    processingProfile: itemProfile,
                    queueStatus: 'completed',
                    previousConfidence: undefined, // Clear previous confidence when processing succeeds
                    retryFailure: undefined,
                    nextRetryAt: undefined,
                    recoveredRetryCount: retryCount > 0 ? retryCount : undefined,
                    lastRequestDurationMs: Date.now() - startedAt,
                    confidence,
                    retryCount: undefined,
                    lowConfidenceRetryCount: undefined,
                    // Clear manual retry flags/snapshot on success
                    isManuallyRetrying: undefined,
                    previousState: undefined,
                  }
                : result,
            ),
          );
        } catch (error) {
          discardBufferedResponse = true;
          console.error(`Error processing file ${file.name}:`, error);
          controllersRef.current.delete(key);

          if (!streamToUI) {
            responseStore.clearResponse(key);
          }

          const isAbortError =
            (error instanceof Error && error.name === 'AbortError') ||
            (error instanceof Error && /abort/i.test(error.message));
          if (isAbortError) {
            updateFileResults((prev) =>
              prev.map((result, i) => {
                if (i !== index) return result;
                if (result.isManuallyRetrying && result.previousState) {
                  return restorePreviousResult(result);
                }
                return {
                  ...result,
                  response: '',
                  isProcessing: false,
                  isCompleted: false,
                  queueStatus: 'cancelled',
                  error: undefined,
                  retryFailure: undefined,
                  retryCount: undefined,
                  lowConfidenceRetryCount: undefined,
                  nextRetryAt: undefined,
                  isManuallyRetrying: undefined,
                  previousState: undefined,
                };
              }),
            );
            return;
          }

          const failure = toProcessingFailure(error, config.provider, config.model);
          const isGeminiProjectFailure =
            !!geminiProject &&
            (failure.category === 'rate_limit' ||
              failure.category === 'daily_quota' ||
              failure.category === 'authentication');

          if (isGeminiProjectFailure) {
            geminiSchedulerRef.current?.reportFailure(geminiProject.id, failure);
            updateFileResults((prev) =>
              prev.map((result, i) =>
                i === index
                  ? {
                      ...result,
                      response: '',
                      isProcessing: false,
                      isCompleted: false,
                      queueStatus: 'pending',
                      error: undefined,
                      retryFailure: failure,
                      nextRetryAt: undefined,
                    }
                  : result,
              ),
            );
            addToQueue([file], index, retryCount, lowConfidenceRetryCount, itemProfile, true);
            return;
          }
          if (failure.retryable && retryCount < MAX_PROCESSING_ATTEMPTS - 1) {
            const retryDelay = getRetryDelayMs(failure, retryCount);
            const nextRetryAt = Date.now() + retryDelay;
            updateFileResults((prev) =>
              prev.map((result, i) =>
                i === index
                  ? {
                      ...result,
                      response: '',
                      isProcessing: false,
                      isCompleted: false,
                      queueStatus: 'pending',
                      error: undefined,
                      retryFailure: failure,
                      retryCount: retryCount + 1,
                      nextRetryAt,
                    }
                  : result,
              ),
            );

            clearRetryTimeout(index);
            const timeout = setTimeout(() => {
              retryTimeoutsRef.current.delete(index);
              if (abortRef.current) return;
              addToQueue([file], index, retryCount + 1, lowConfidenceRetryCount, itemProfile, true);
              if (!processingRef.current) {
                void processQueue(
                  config.instruction,
                  config.provider,
                  config.model,
                  config.apiKey,
                  config.mode,
                  itemProfile,
                  config.geminiProjects,
                );
              }
            }, retryDelay);
            retryTimeoutsRef.current.set(index, timeout);
          } else {
            updateFileResults((prev) =>
              prev.map((result, i) =>
                i === index
                  ? {
                      ...result,
                      response: '',
                      isProcessing: false,
                      isCompleted: false,
                      queueStatus: 'failed',
                      error: failure,
                      retryFailure: undefined,
                      nextRetryAt: undefined,
                      retryCount: retryCount > 0 ? retryCount : undefined,
                      lowConfidenceRetryCount: undefined,
                      lastRequestDurationMs: Date.now() - startedAt,
                      isManuallyRetrying: undefined,
                      previousState: undefined,
                    }
                  : result,
              ),
            );

            const signature = getProviderFailureSignature(failure);
            if (isImmediateProviderWideFailure(failure)) {
              pausedFailureItemsRef.current.set(index, item);
              setPaused({ kind: 'automatic', failure });
            } else if (failure.kind === 'temporary') {
              const consecutive = consecutiveFailuresRef.current;
              const items =
                consecutive?.signature === signature ? [...consecutive.items, item] : [item];
              consecutiveFailuresRef.current = { signature, items };
              if (items.length >= PROVIDER_FAILURE_PAUSE_THRESHOLD) {
                for (const failedItem of items) {
                  pausedFailureItemsRef.current.set(failedItem.index, failedItem);
                }
                setPaused({ kind: 'automatic', failure });
              }
            } else {
              consecutiveFailuresRef.current = undefined;
            }
          }
        }
      };

      // Start only the requests allowed by both browser concurrency and provider RPM.
      while (
        !abortRef.current &&
        (queueRef.current.length > 0 ||
          activePromisesRef.current.size > 0 ||
          retryTimeoutsRef.current.size > 0)
      ) {
        if (pausedRef.current) {
          const resumeAt = automaticResumeAtRef.current;
          if (resumeAt !== undefined && resumeAt <= Date.now()) {
            automaticResumeAtRef.current = undefined;
            setPaused(undefined);
            continue;
          }
          setIsWaitingForNextBatch(resumeAt !== undefined);
          setThrottleSecondsRemaining(
            resumeAt === undefined ? 0 : Math.max(0, Math.ceil((resumeAt - Date.now()) / 1000)),
          );
          await wait(200);
          continue;
        }

        const currentConfig = batchConfigRef.current!;
        const activeSlots = ACTIVE_REQUEST_LIMIT - activePromisesRef.current.size;
        const now = Date.now();

        if (currentConfig.provider === 'gemini') {
          const scheduler = geminiSchedulerRef.current;
          const starting: Array<{ item: QueueItem; project: GeminiProject }> = [];
          let blocked: ReturnType<GeminiQuotaScheduler['acquire']> | undefined;

          while (scheduler && starting.length < activeSlots && queueRef.current.length > 0) {
            const acquisition = scheduler.acquire(now);
            if (acquisition.kind !== 'ready') {
              blocked = acquisition;
              break;
            }
            starting.push({ item: queueRef.current.shift()!, project: acquisition.project });
          }

          if (starting.length > 0) {
            setIsWaitingForNextBatch(false);
            setThrottleSecondsRemaining(0);
            const startingIndices = new Set(starting.map(({ item }) => item.index));
            updateFileResults((prev) =>
              prev.map((result, index) =>
                startingIndices.has(index)
                  ? {
                      ...result,
                      isProcessing: true,
                      queueStatus: 'processing',
                      nextRetryAt: undefined,
                    }
                  : result,
              ),
            );

            for (const { item, project } of starting) {
              let activePromise: Promise<void>;
              activePromise = processItem(item, project).finally(() => {
                activePromisesRef.current.delete(activePromise);
              });
              activePromisesRef.current.add(activePromise);
            }
            await wait(0);
            continue;
          }

          if (queueRef.current.length > 0 && activeSlots > 0) {
            blocked ??= scheduler?.acquire(now) ?? { kind: 'key_problem' };
            if (blocked.kind === 'wait') {
              const waitMs = Math.max(0, blocked.nextAt - now);
              setIsWaitingForNextBatch(true);
              setThrottleSecondsRemaining(Math.ceil(waitMs / 1000));
              await Promise.race([
                ...activePromisesRef.current,
                wait(Math.min(1000, Math.max(200, waitMs))),
              ]);
              continue;
            }
            if (blocked.kind === 'daily_exhausted') {
              automaticResumeAtRef.current = blocked.nextAt;
              setPaused({
                kind: 'automatic',
                failure: makeGeminiPauseFailure(
                  'daily_quota',
                  `Every Gemini project reached its daily limit. Processing will resume at ${new Date(blocked.nextAt).toLocaleString()}.`,
                  currentConfig.model,
                ),
              });
              continue;
            }
            if (blocked.kind === 'key_problem') {
              automaticResumeAtRef.current = undefined;
              setPaused({
                kind: 'automatic',
                failure: makeGeminiPauseFailure(
                  'authentication',
                  'Add or correct a Gemini project, then select Resume.',
                  currentConfig.model,
                ),
              });
              continue;
            }
          }

          await Promise.race([...activePromisesRef.current, wait(100)]);
          continue;
        }

        const currentRateLimit =
          getModel(currentConfig.provider, currentConfig.model)?.rateLimit || DEFAULT_RATE_LIMIT;
        const { limit, interval } = currentRateLimit;
        requestTimestampsRef.current = requestTimestampsRef.current.filter(
          (timestamp) => now - timestamp < interval,
        );

        const rateSlots = limit - requestTimestampsRef.current.length;
        const startCount = Math.min(activeSlots, rateSlots, queueRef.current.length);

        if (startCount > 0) {
          setIsWaitingForNextBatch(false);
          setThrottleSecondsRemaining(0);
          const items = queueRef.current.splice(0, startCount);
          const startingIndices = new Set(items.map((item) => item.index));

          updateFileResults((prev) =>
            prev.map((r, i) =>
              startingIndices.has(i)
                ? { ...r, isProcessing: true, queueStatus: 'processing', nextRetryAt: undefined }
                : r,
            ),
          );

          for (const item of items) {
            requestTimestampsRef.current.push(now);
            let activePromise: Promise<void>;
            activePromise = processItem(item).finally(() => {
              activePromisesRef.current.delete(activePromise);
            });
            activePromisesRef.current.add(activePromise);
          }
          await wait(0);
        } else if (queueRef.current.length > 0) {
          let waitMs = 250;
          if (rateSlots <= 0 && requestTimestampsRef.current.length > 0) {
            const oldest = Math.min(...requestTimestampsRef.current);
            const nextMs = Math.max(0, interval - (now - oldest));
            waitMs = Math.min(1000, Math.max(250, nextMs));
            setIsWaitingForNextBatch(true);
            setThrottleSecondsRemaining(Math.ceil(nextMs / 1000));
          } else {
            setIsWaitingForNextBatch(false);
            setThrottleSecondsRemaining(0);
          }

          await Promise.race([...activePromisesRef.current, wait(waitMs)]);
        } else {
          await Promise.race([...activePromisesRef.current, wait(100)]);
        }
      }
    } finally {
      await Promise.allSettled([...activePromisesRef.current]);
      activePromisesRef.current.clear();
      publishFileResults(true);
      processingRef.current = false;
      setIsProcessing(false);
      // Ensure countdown is cleared when processing ends
      if (throttleIntervalRef.current) {
        clearInterval(throttleIntervalRef.current);
        throttleIntervalRef.current = null;
      }
      setIsWaitingForNextBatch(false);
      setThrottleSecondsRemaining(0);
    }
  };

  // Periodically clean up stale responseStore entries during active processing sessions
  useEffect(() => {
    if (isProcessing && !cleanupIntervalRef.current) {
      cleanupIntervalRef.current = setInterval(
        () => {
          // Purge entries that haven't been updated in the last 5 minutes (default)
          responseStore.cleanupStale();
        },
        2 * 60 * 1000,
      ); // run every 2 minutes
    }
    if (!isProcessing && cleanupIntervalRef.current) {
      clearInterval(cleanupIntervalRef.current);
      cleanupIntervalRef.current = null;
    }
  }, [isProcessing]);

  useEffect(() => {
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      for (const timeout of retryTimeoutsRef.current.values()) clearTimeout(timeout);
      retryTimeoutsRef.current.clear();
      if (resultsPublishTimeoutRef.current) clearTimeout(resultsPublishTimeoutRef.current);
      resultsPublishTimeoutRef.current = undefined;
      // Clean up timestamps when component unmounts
      requestTimestampsRef.current = [];
    };
  }, []);

  const queueProgress = useMemo(() => getQueueProgress(fileResults), [fileResults]);
  const averageRequestDurationMs = useMemo(() => {
    const durations = fileResults
      .flatMap((result) =>
        result.lastRequestDurationMs === undefined ? [] : [result.lastRequestDurationMs],
      )
      .slice(-10);
    if (durations.length === 0) return;
    return durations.reduce((total, duration) => total + duration, 0) / durations.length;
  }, [fileResults]);
  const estimatedRemainingSeconds = useMemo(
    () => estimateRemainingSeconds(queueProgress, averageRequestDurationMs, rateLimit),
    [averageRequestDurationMs, queueProgress, rateLimit],
  );

  return {
    fileResults,
    processingBatchId,
    isProcessing,
    isPaused,
    pauseReason,
    queueProgress,
    estimatedRemainingSeconds,
    isWaitingForNextBatch,
    throttleSecondsRemaining,
    processFiles,
    retryFile,
    retryAllFailed,
    clearResults,
    // Expose new queue controls for future UI usage
    addToQueue,
    processQueue,
    pauseQueue,
    resumeQueue,
    abortFile,
    abortSelected,
    abortAll,
  };
};

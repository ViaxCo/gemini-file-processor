import { useEffect, useRef, useState } from 'react';
import { AIProvider, getModel } from '../config/providerConfig';
import { processFileWithAI } from '../services/aiService';
import {
  MAX_PROCESSING_ATTEMPTS,
  ProcessingFailure,
  getRetryDelayMs,
  toProcessingFailure,
} from '../services/processingErrors';
import { makeFileKey, responseStore } from '../services/responseStore';
import { extractTextFromFile } from '../utils/fileUtils';
import { scheduleIdleWork } from '../utils/performance';

export type ProcessingProfile = 'transcript' | 'book';
type ProcessingQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

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
  nextRetryAt?: number;
  recoveredRetryCount?: number;
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
  };
  // Marks a manual retry attempt
  isManuallyRetrying?: boolean;
}

export const useAIProcessor = () => {
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [processingBatchId, setProcessingBatchId] = useState(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
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
  const abortRef = useRef<boolean>(false);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const retryTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const throttleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestTimestampsRef = useRef<number[]>([]); // timestamps of requests for token bucket algorithm

  // Default rate limit fallback
  const DEFAULT_RATE_LIMIT = { limit: 10, interval: 60000 };

  const clearRetryTimeout = (index: number): void => {
    const timeout = retryTimeoutsRef.current.get(index);
    if (timeout) clearTimeout(timeout);
    retryTimeoutsRef.current.delete(index);
  };

  // Abort helpers
  const abortFilesByIndices = (indices: number[]): void => {
    if (indices.length === 0) return;
    indices.forEach(clearRetryTimeout);
    // Remove queued items for these indices
    queueRef.current = queueRef.current.filter((q) => !indices.includes(q.index));

    setFileResults((prev) =>
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
          const snap = result.previousState;
          return {
            ...result,
            response: snap.response,
            isCompleted: snap.isCompleted,
            error: snap.error,
            retryFailure: snap.retryFailure,
            queueStatus: snap.queueStatus,
            retryCount: snap.retryCount,
            nextRetryAt: snap.nextRetryAt,
            recoveredRetryCount: snap.recoveredRetryCount,
            isProcessing: false,
            isManuallyRetrying: undefined,
            previousState: undefined,
          };
        }
        return {
          ...result,
          isProcessing: false,
          isCompleted: false,
          queueStatus: 'cancelled',
          error: undefined,
          retryFailure: undefined,
          nextRetryAt: undefined,
          isManuallyRetrying: undefined,
          previousState: undefined,
        };
      }),
    );
  };

  const abortFile = (index: number): void => abortFilesByIndices([index]);
  const abortSelected = (indices: number[]): void => abortFilesByIndices(indices);

  const abortAll = (): void => {
    abortRef.current = true;
    queueRef.current = [];
    for (const timeout of retryTimeoutsRef.current.values()) clearTimeout(timeout);
    retryTimeoutsRef.current.clear();
    // Abort all active controllers
    for (const [, controller] of controllersRef.current) {
      try {
        controller.abort();
      } catch {}
    }
    controllersRef.current.clear();
    setFileResults((prev) =>
      prev.map((result) => {
        if (result.isManuallyRetrying && result.previousState) {
          const snap = result.previousState;
          return {
            ...result,
            response: snap.response,
            isCompleted: snap.isCompleted,
            error: snap.error,
            retryFailure: snap.retryFailure,
            queueStatus: snap.queueStatus,
            retryCount: snap.retryCount,
            nextRetryAt: snap.nextRetryAt,
            recoveredRetryCount: snap.recoveredRetryCount,
            isProcessing: false,
            isManuallyRetrying: undefined,
            previousState: undefined,
          };
        }
        if (result.isProcessing || result.queueStatus === 'pending') {
          return {
            ...result,
            isProcessing: false,
            isCompleted: false,
            queueStatus: 'cancelled',
            error: undefined,
            retryFailure: undefined,
            nextRetryAt: undefined,
            isManuallyRetrying: undefined,
            previousState: undefined,
          };
        }
        return result;
      }),
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
  ): Promise<void> => {
    if (!files.length || !instruction.trim()) {
      alert('Please select files and provide instructions');
      return;
    }
    // Start a new lifecycle for all state associated with these results.
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
    setFileResults(initialResults);

    // Seed queue
    addToQueue(files, undefined, 0, 0, profile);

    // Determine processing mode
    const processingMode: 'single' | 'batch' = files.length === 1 ? 'single' : 'batch';

    // Start processing
    await processQueue(instruction, provider, model, apiKey, processingMode, profile);
  };

  const retryFile = async (
    fileIndex: number,
    instruction: string,
    provider: AIProvider,
    model: string,
    apiKey: string,
    profile: ProcessingProfile = 'transcript',
  ): Promise<void> => {
    if (fileIndex < 0 || fileIndex >= fileResults.length) return;

    const fileToRetry = fileResults[fileIndex];
    if (!fileToRetry) return;

    // Reset state and re-queue as a single-file job
    setFileResults((prev) =>
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
              },
              isManuallyRetrying: true,
              response: '',
              isProcessing: false,
              isCompleted: false,
              error: undefined,
              retryFailure: undefined,
              queueStatus: 'pending',
              retryCount: undefined,
              nextRetryAt: undefined,
              recoveredRetryCount: undefined,
            }
          : result,
      ),
    );

    // Show processing state immediately when retrying
    setIsProcessing(true);
    addToQueue([fileToRetry.file], fileIndex, 0, 0, profile);
    await processQueue(instruction, provider, model, apiKey, 'single', profile);
  };

  const retryAllFailed = async (
    instruction: string,
    provider: AIProvider,
    model: string,
    apiKey: string,
    profile: ProcessingProfile = 'transcript',
    targetIndices?: number[],
  ): Promise<void> => {
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
    setFileResults((prev) =>
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
              },
              isManuallyRetrying: true,
              response: '',
              isProcessing: false,
              isCompleted: false,
              error: undefined,
              retryFailure: undefined,
              queueStatus: 'pending',
              retryCount: undefined,
              nextRetryAt: undefined,
              recoveredRetryCount: undefined,
            }
          : result,
      ),
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
    );
  };

  const clearResults = (): void => {
    setProcessingBatchId((current) => current + 1);
    setFileResults([]);
    queueRef.current = [];
    responseStore.clearAll();
  };

  // Queue management methods
  const addToQueue = (
    files: File[],
    overrideIndex?: number,
    retryCount = 0,
    lowConfidenceRetryCount = 0,
    profile: ProcessingProfile = 'transcript',
  ): void => {
    const items: QueueItem[] = files.map((file, idx) => {
      // Try to map to the correct fileResults index. Fallback to local idx.
      let index = overrideIndex ?? fileResults.findIndex((r) => r.file === file);
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
    queueRef.current = [...queueRef.current, ...items];
  };

  const pauseQueue = (): void => {
    setIsPaused(true);
  };

  const resumeQueue = (): void => {
    setIsPaused(false);
  };

  const processQueue = async (
    instruction: string,
    provider: AIProvider,
    model: string,
    apiKey: string,
    mode: 'single' | 'batch',
    profile: ProcessingProfile = 'transcript',
  ): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    abortRef.current = false;

    // Get model-specific rate limits from provider config
    const modelConfig = getModel(provider, model);
    const { limit, interval } = modelConfig?.rateLimit || DEFAULT_RATE_LIMIT;

    try {
      // Update UI to show queued files as pending
      setFileResults((prev) =>
        prev.map((r, i) => ({
          ...r,
          queueStatus: queueRef.current.find((q) => q.index === i)?.status ?? r.queueStatus,
        })),
      );

      const processItem = async (item: QueueItem) => {
        const {
          file,
          index,
          key,
          profile: itemProfile = profile,
          retryCount = 0,
          lowConfidenceRetryCount = 0,
        } = item;
        const streamToUI = mode === 'single';
        if (!streamToUI) {
          responseStore.addResponse(key, '');
        }
        let discardBufferedResponse = false;
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
                setFileResults((prev) =>
                  prev.map((result, i) =>
                    i === index ? { ...result, response: result.response + currentBuffer } : result,
                  ),
                );
              });
            }
          };
          const controller = new AbortController();
          controllersRef.current.set(key, controller);
          await processFileWithAI(
            file,
            instruction,
            provider,
            model,
            apiKey,
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
          if (streamToUI) flushBufferToUI();

          // For batch processing, get the final response before clearing it
          let finalResponse = '';
          if (!streamToUI) {
            finalResponse = responseStore.getResponse(key);
            setFileResults((prev) =>
              prev.map((result, i) =>
                i === index ? { ...result, response: finalResponse } : result,
              ),
            );
            // Don't clear the response yet, we need it for confidence checking
          } else {
            finalResponse = fullResponse;
          }

          if (itemProfile === 'transcript') {
            const { getConfidenceScore } = await import('../utils/confidenceScore');
            const originalContent = await extractTextFromFile(file);
            const confidenceResult = getConfidenceScore(originalContent, finalResponse);
            const { level, score } = confidenceResult;

            if (level === 'low' && lowConfidenceRetryCount < 3) {
              console.log(
                `Low confidence for file ${file.name}, retrying... (${lowConfidenceRetryCount + 1}/3)`,
              );
              setFileResults((prev) =>
                prev.map((result, i) =>
                  i === index
                    ? {
                        ...result,
                        response: '',
                        isProcessing: false,
                        isCompleted: false,
                        queueStatus: 'pending',
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
                addToQueue([file], index, retryCount, lowConfidenceRetryCount + 1, itemProfile);
                if (!processingRef.current) {
                  void processQueue(instruction, provider, model, apiKey, mode, itemProfile);
                }
              }, backoffDelay);
              retryTimeoutsRef.current.set(index, timeout);
              return;
            }
          }

          if (mode === 'batch') {
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
          setFileResults((prev) =>
            prev.map((result, i) =>
              i === index
                ? {
                    ...result,
                    isProcessing: false,
                    isCompleted: true,
                    processingProfile: itemProfile,
                    queueStatus: 'completed',
                    previousConfidence: undefined, // Clear previous confidence when processing succeeds
                    retryFailure: undefined,
                    nextRetryAt: undefined,
                    recoveredRetryCount: retryCount > 0 ? retryCount : undefined,
                    retryCount: undefined,
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
            setFileResults((prev) =>
              prev.map((result, i) => {
                if (i !== index) return result;
                if (result.isManuallyRetrying && result.previousState) {
                  const snap = result.previousState;
                  return {
                    ...result,
                    response: snap.response,
                    isCompleted: snap.isCompleted,
                    error: snap.error,
                    retryFailure: snap.retryFailure,
                    queueStatus: snap.queueStatus,
                    retryCount: snap.retryCount,
                    nextRetryAt: snap.nextRetryAt,
                    recoveredRetryCount: snap.recoveredRetryCount,
                    isProcessing: false,
                    isManuallyRetrying: undefined,
                    previousState: undefined,
                  };
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
                  nextRetryAt: undefined,
                  isManuallyRetrying: undefined,
                  previousState: undefined,
                };
              }),
            );
            return;
          }

          const failure = toProcessingFailure(error, provider, model);
          if (failure.retryable && retryCount < MAX_PROCESSING_ATTEMPTS - 1) {
            const retryDelay = getRetryDelayMs(failure, retryCount);
            const nextRetryAt = Date.now() + retryDelay;
            setFileResults((prev) =>
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
              addToQueue([file], index, retryCount + 1, lowConfidenceRetryCount, itemProfile);
              if (!processingRef.current) {
                void processQueue(instruction, provider, model, apiKey, mode, itemProfile);
              }
            }, retryDelay);
            retryTimeoutsRef.current.set(index, timeout);
          } else {
            setFileResults((prev) =>
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
                      isManuallyRetrying: undefined,
                      previousState: undefined,
                    }
                  : result,
              ),
            );
          }
        }
      };

      // Token bucket scheduler: Process items respecting rate limits
      while (
        !abortRef.current &&
        (queueRef.current.length > 0 ||
          requestTimestampsRef.current.length > 0 ||
          retryTimeoutsRef.current.size > 0)
      ) {
        if (isPaused) {
          await new Promise((res) => setTimeout(res, 200));
          continue;
        }

        // Clean up old timestamps (older than the interval)
        const now = Date.now();
        requestTimestampsRef.current = requestTimestampsRef.current.filter(
          (timestamp) => now - timestamp < interval,
        );

        // Check if we can make a new request
        if (requestTimestampsRef.current.length < limit && queueRef.current.length > 0) {
          setIsWaitingForNextBatch(false);
          setThrottleSecondsRemaining(0);

          // Get the next item from the queue
          const item = queueRef.current.shift()!;

          // Mark as processing in UI
          setFileResults((prev) =>
            prev.map((r, i) =>
              i === item.index
                ? { ...r, isProcessing: true, queueStatus: 'processing', nextRetryAt: undefined }
                : r,
            ),
          );

          // Record the request timestamp
          requestTimestampsRef.current.push(now);

          // Process the item without waiting for it to complete
          void processItem(item);

          // Small yield to allow state to update
          await new Promise((res) => setTimeout(res, 50));
        } else if (queueRef.current.length > 0) {
          // We're rate limited - calculate wait time
          let waitMs = 250;
          if (
            requestTimestampsRef.current.length >= limit &&
            requestTimestampsRef.current.length > 0
          ) {
            // Find the oldest timestamp and calculate when we can make the next request
            const oldest = Math.min(...requestTimestampsRef.current);
            const nextMs = Math.max(0, interval - (now - oldest));
            waitMs = Math.min(1000, Math.max(250, nextMs));
            const secs = Math.ceil(nextMs / 1000);
            setIsWaitingForNextBatch(true);
            setThrottleSecondsRemaining(secs);
          }
          await new Promise((res) => setTimeout(res, waitMs));
        } else {
          // No items in queue but some requests are still processing
          await new Promise((res) => setTimeout(res, 100));
        }
      }
    } finally {
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
      // Clean up timestamps when component unmounts
      requestTimestampsRef.current = [];
    };
  }, []);

  return {
    fileResults,
    processingBatchId,
    isProcessing,
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

import { useEffect, useRef, useState } from 'react';
import { processFileWithAI } from '../services/aiService';
import { GeminiModel } from '../components/ModelSelector';
import { scheduleIdleWork } from '../utils/performance';
import { makeFileKey, responseStore } from '../services/responseStore';

export interface FileResult {
  file: File;
  response: string;
  isProcessing: boolean;
  isCompleted: boolean;
  error?: string;
  // New queue status for Phase 1
  queueStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

export const useAIProcessor = () => {
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isWaitingForNextBatch, setIsWaitingForNextBatch] = useState<boolean>(false);
  const [throttleSecondsRemaining, setThrottleSecondsRemaining] = useState<number>(0);

  // Internal queue state
  type QueueItem = {
    file: File;
    index: number; // position in fileResults
    key: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  };
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef<boolean>(false);
  const abortRef = useRef<boolean>(false);
  const throttleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Public API compatible with current components
  const processFiles = async (
    files: File[],
    instruction: string,
    model: GeminiModel,
  ): Promise<void> => {
    if (!files.length || !instruction.trim()) {
      alert('Please select files and provide instructions');
      return;
    }
    // Initialize results for all files (queue: pending)
    const initialResults: FileResult[] = files.map((file) => ({
      file,
      response: '',
      isProcessing: false,
      isCompleted: false,
      queueStatus: 'pending',
    }));
    setFileResults(initialResults);

    // Seed queue
    addToQueue(files);

    // Determine processing mode
    const processingMode: 'single' | 'batch' = files.length === 1 ? 'single' : 'batch';

    // Start processing
    await processQueue(instruction, model, processingMode);
  };

  const retryFile = async (
    fileIndex: number,
    instruction: string,
    model: GeminiModel,
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
              response: '',
              isProcessing: false,
              isCompleted: false,
              error: undefined,
              queueStatus: 'pending',
            }
          : result,
      ),
    );

    addToQueue([fileToRetry.file], fileIndex);
    await processQueue(instruction, model, 'single');
  };

  const retryAllFailed = async (instruction: string, model: GeminiModel): Promise<void> => {
    // First, identify failed files from current state
    const failedIndices = fileResults
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.error)
      .map(({ index }) => index);

    if (failedIndices.length === 0) return;

    // Reset all failed files' states and queue them
    setFileResults((prev) =>
      prev.map((result, i) =>
        failedIndices.includes(i)
          ? {
              ...result,
              response: '',
              isProcessing: false,
              isCompleted: false,
              error: undefined,
              queueStatus: 'pending',
            }
          : result,
      ),
    );
    const failedFiles = failedIndices.map((i) => fileResults[i]!.file);
    addToQueue(failedFiles);
    await processQueue(instruction, model, failedFiles.length === 1 ? 'single' : 'batch');
  };

  const clearResults = (): void => {
    setFileResults([]);
    queueRef.current = [];
    responseStore.clearAll();
  };

  // Queue management methods (Phase 1)
  const addToQueue = (files: File[], overrideIndex?: number): void => {
    const items: QueueItem[] = files.map((file, idx) => {
      // Try to map to the correct fileResults index. Fallback to local idx.
      let index = overrideIndex ?? fileResults.findIndex((r) => r.file === file);
      if (index === -1) index = idx;
      return {
        file,
        index,
        key: makeFileKey(file),
        status: 'pending',
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
    model: GeminiModel,
    mode: 'single' | 'batch',
  ): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    abortRef.current = false;

    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 90_000; // 90 seconds

    try {
      // Update UI to show queued files as pending
      setFileResults((prev) =>
        prev.map((r, i) => ({
          ...r,
          queueStatus: queueRef.current.find((q) => q.index === i)?.status ?? r.queueStatus,
        })),
      );

      while (queueRef.current.length > 0 && !abortRef.current) {
        if (isPaused) {
          // Wait until resumed
          await new Promise((res) => setTimeout(res, 200));
          continue;
        }

        const currentBatch = queueRef.current.splice(0, BATCH_SIZE);

        // Mark batch as processing in UI
        setFileResults((prev) =>
          prev.map((r, i) =>
            currentBatch.some((q) => q.index === i)
              ? { ...r, isProcessing: true, queueStatus: 'processing' }
              : r,
          ),
        );

        // If there are more files remaining beyond this batch, start the countdown NOW
        let deadline: number | null = null;
        if (queueRef.current.length > 0) {
          // Clear any previous countdown
          if (throttleIntervalRef.current) {
            clearInterval(throttleIntervalRef.current);
            throttleIntervalRef.current = null;
          }

          setIsWaitingForNextBatch(true);
          deadline = Date.now() + BATCH_DELAY_MS;
          const updateCountdown = () => {
            const remaining = Math.ceil(((deadline as number) - Date.now()) / 1000);
            const clamped = Math.max(0, remaining);
            setThrottleSecondsRemaining(clamped);
            if (clamped <= 0 && throttleIntervalRef.current) {
              clearInterval(throttleIntervalRef.current);
              throttleIntervalRef.current = null;
            }
          };
          updateCountdown();
          throttleIntervalRef.current = setInterval(updateCountdown, 1000);
        }

        // Process files in this batch concurrently
        await Promise.all(
          currentBatch.map(async (item) => {
            const { file, index, key } = item;

            // For batch mode, stream to responseStore only; for single, stream to UI
            const streamToUI = mode === 'single';

            // Ensure store entry exists when in batch mode
            if (!streamToUI) {
              responseStore.addResponse(key, '');
            }

            try {
              let responseBuffer = '';
              let lastUpdateTime = Date.now();

              const flushBufferToUI = () => {
                if (responseBuffer) {
                  const currentBuffer = responseBuffer;
                  responseBuffer = '';
                  scheduleIdleWork(() => {
                    setFileResults((prev) =>
                      prev.map((result, i) =>
                        i === index
                          ? { ...result, response: result.response + currentBuffer }
                          : result,
                      ),
                    );
                  });
                }
              };

              await processFileWithAI(file, instruction, model, (chunk: string) => {
                if (streamToUI) {
                  responseBuffer += chunk;
                  const now = Date.now();
                  if (now - lastUpdateTime >= 100 || responseBuffer.length >= 500) {
                    flushBufferToUI();
                    lastUpdateTime = now;
                  }
                } else {
                  // Stream to store directly for batch mode
                  responseStore.updateResponse(key, chunk);
                }
              });

              // Finalize flush
              if (streamToUI) {
                flushBufferToUI();
              }

              // On completion, if batch mode, push final content from store to UI
              if (!streamToUI) {
                const finalResponse = responseStore.getResponse(key);
                setFileResults((prev) =>
                  prev.map((result, i) =>
                    i === index
                      ? {
                          ...result,
                          response: finalResponse,
                        }
                      : result,
                  ),
                );
                // Clean up store for this entry to avoid leaks
                responseStore.clearResponse(key);
              }

              // Mark as completed
              setFileResults((prev) =>
                prev.map((result, i) =>
                  i === index
                    ? {
                        ...result,
                        isProcessing: false,
                        isCompleted: true,
                        queueStatus: 'completed',
                      }
                    : result,
                ),
              );
            } catch (error) {
              console.error(`Error processing file ${file.name}:`, error);
              setFileResults((prev) =>
                prev.map((result, i) =>
                  i === index
                    ? {
                        ...result,
                        isProcessing: false,
                        isCompleted: false,
                        queueStatus: 'failed',
                        error: error instanceof Error ? error.message : String(error),
                      }
                    : result,
                ),
              );
            }
          }),
        );

        // If there are more files remaining, throttle between batches.
        // Only wait the remaining time if processing finished earlier than the throttle window.
        if (queueRef.current.length > 0) {
          const remainingMs = deadline ? Math.max(0, deadline - Date.now()) : BATCH_DELAY_MS;
          if (remainingMs > 0) {
            await new Promise((res) => setTimeout(res, remainingMs));
          }

          // Clear countdown for next iteration
          if (throttleIntervalRef.current) {
            clearInterval(throttleIntervalRef.current);
            throttleIntervalRef.current = null;
          }
          setIsWaitingForNextBatch(false);
          setThrottleSecondsRemaining(0);
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
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
    };
  }, [isProcessing]);

  return {
    fileResults,
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
  };
};

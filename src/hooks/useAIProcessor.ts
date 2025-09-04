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
  const startTimesRef = useRef<number[]>([]); // timestamps of starts within WINDOW
  const activeCountRef = useRef<number>(0); // in-flight items

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

    const MAX_PER_WINDOW = 10; // also used as max concurrency
    const WINDOW_MS = 90_000; // 90 seconds safety window

    try {
      // Update UI to show queued files as pending
      setFileResults((prev) =>
        prev.map((r, i) => ({
          ...r,
          queueStatus: queueRef.current.find((q) => q.index === i)?.status ?? r.queueStatus,
        })),
      );

      const processItem = async (item: QueueItem) => {
        const { file, index, key } = item;
        const streamToUI = mode === 'single';
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
              responseStore.updateResponse(key, chunk);
            }
          });
          if (streamToUI) flushBufferToUI();
          if (!streamToUI) {
            const finalResponse = responseStore.getResponse(key);
            setFileResults((prev) =>
              prev.map((result, i) =>
                i === index ? { ...result, response: finalResponse } : result,
              ),
            );
            responseStore.clearResponse(key);
          }
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
        } finally {
          activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        }
      };

      // Sliding-window scheduler: fill capacity immediately when available
      while ((!abortRef.current && (queueRef.current.length > 0 || activeCountRef.current > 0))) {
        if (isPaused) {
          await new Promise((res) => setTimeout(res, 200));
          continue;
        }

        // purge old start timestamps
        const now = Date.now();
        startTimesRef.current = startTimesRef.current.filter((t) => now - t < WINDOW_MS);

        const rateSlots = Math.max(0, MAX_PER_WINDOW - startTimesRef.current.length);
        const concurrencySlots = Math.max(0, MAX_PER_WINDOW - activeCountRef.current);
        const availableSlots = Math.min(rateSlots, concurrencySlots, queueRef.current.length);

        if (availableSlots > 0) {
          setIsWaitingForNextBatch(false);
          setThrottleSecondsRemaining(0);

          const toStart = queueRef.current.splice(0, availableSlots);
          // Mark as processing
          setFileResults((prev) =>
            prev.map((r, i) =>
              toStart.some((q) => q.index === i)
                ? { ...r, isProcessing: true, queueStatus: 'processing' }
                : r,
            ),
          );

          for (const item of toStart) {
            activeCountRef.current++;
            startTimesRef.current.push(Date.now());
            // Fire and forget
            void processItem(item);
          }
          // Small yield to allow state to update
          await new Promise((res) => setTimeout(res, 50));
        } else {
          // No slots: either rate limited or at max concurrency
          let waitMs = 250;
          if (rateSlots === 0 && startTimesRef.current.length > 0) {
            const oldest = startTimesRef.current[0]!;
            const nextMs = Math.max(0, WINDOW_MS - (now - oldest));
            waitMs = Math.min(1000, Math.max(250, nextMs));
            const secs = Math.ceil(nextMs / 1000);
            setIsWaitingForNextBatch(true);
            setThrottleSecondsRemaining(secs);
          }
          await new Promise((res) => setTimeout(res, waitMs));
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

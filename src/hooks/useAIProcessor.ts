import { useState } from 'react';
import { processFileWithAI } from '../services/aiService';
import { GeminiModel } from '../components/ModelSelector';
import { scheduleIdleWork } from '../utils/performance';

export interface FileResult {
  file: File;
  response: string;
  isProcessing: boolean;
  isCompleted: boolean;
  error?: string;
}

export const useAIProcessor = () => {
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const processFiles = async (
    files: File[],
    instruction: string,
    model: GeminiModel,
  ): Promise<void> => {
    if (!files.length || !instruction.trim()) {
      alert('Please select files and provide instructions');
      return;
    }

    setIsProcessing(true);

    // Initialize results for all files
    const initialResults: FileResult[] = files.map((file) => ({
      file,
      response: '',
      isProcessing: true,
      isCompleted: false,
    }));

    setFileResults(initialResults);

    // Process all files in parallel
    const promises = files.map(async (file, index) => {
      try {
        // Batch updates using a buffer to reduce frequent state updates
        let responseBuffer = '';
        let lastUpdateTime = Date.now();

        const flushBuffer = () => {
          if (responseBuffer) {
            const currentBuffer = responseBuffer;
            responseBuffer = '';

            // Use idle callback for non-critical UI updates to prevent blocking
            scheduleIdleWork(() => {
              setFileResults((prev) =>
                prev.map((result, i) =>
                  i === index ? { ...result, response: result.response + currentBuffer } : result,
                ),
              );
            });
          }
        };

        await processFileWithAI(file, instruction, model, (chunk: string) => {
          responseBuffer += chunk;
          const now = Date.now();

          // Flush buffer every 100ms or when buffer gets large
          if (now - lastUpdateTime >= 100 || responseBuffer.length >= 500) {
            flushBuffer();
            lastUpdateTime = now;
          }
        });

        // Flush any remaining buffer
        flushBuffer();

        // Mark as completed
        setFileResults((prev) =>
          prev.map((result, i) =>
            i === index ? { ...result, isProcessing: false, isCompleted: true } : result,
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
                  error: error instanceof Error ? error.message : String(error),
                }
              : result,
          ),
        );
      }
    });

    // Wait for all files to complete
    await Promise.all(promises);
    setIsProcessing(false);
  };

  const retryFile = async (
    fileIndex: number,
    instruction: string,
    model: GeminiModel,
  ): Promise<void> => {
    if (fileIndex < 0 || fileIndex >= fileResults.length) return;

    const fileToRetry = fileResults[fileIndex];

    // Reset the file's state
    setFileResults((prev) =>
      prev.map((result, i) =>
        i === fileIndex
          ? {
              ...result,
              response: '',
              isProcessing: true,
              isCompleted: false,
              error: undefined,
            }
          : result,
      ),
    );

    try {
      // Batch updates for retry as well
      let responseBuffer = '';
      let lastUpdateTime = Date.now();

      const flushBuffer = () => {
        if (responseBuffer) {
          const currentBuffer = responseBuffer;
          responseBuffer = '';
          setFileResults((prev) =>
            prev.map((result, i) =>
              i === fileIndex ? { ...result, response: result.response + currentBuffer } : result,
            ),
          );
        }
      };

      if (!fileToRetry) return;

      await processFileWithAI(fileToRetry.file, instruction, model, (chunk: string) => {
        responseBuffer += chunk;
        const now = Date.now();

        if (now - lastUpdateTime >= 100 || responseBuffer.length >= 500) {
          flushBuffer();
          lastUpdateTime = now;
        }
      });

      flushBuffer();

      // Mark as completed
      setFileResults((prev) =>
        prev.map((result, i) =>
          i === fileIndex ? { ...result, isProcessing: false, isCompleted: true } : result,
        ),
      );
    } catch (error) {
      console.error(`Error retrying file ${fileToRetry?.file.name}:`, error);
      setFileResults((prev) =>
        prev.map((result, i) =>
          i === fileIndex
            ? {
                ...result,
                isProcessing: false,
                isCompleted: false,
                error: error instanceof Error ? error.message : String(error),
              }
            : result,
        ),
      );
    }
  };

  const retryAllFailed = async (instruction: string, model: GeminiModel): Promise<void> => {
    // First, identify failed files from current state
    const failedIndices = fileResults
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.error)
      .map(({ index }) => index);

    if (failedIndices.length === 0) return;

    // Store the files we need to retry
    const failedFilesToRetry = failedIndices.map((index) => ({
      file: fileResults[index]!.file,
      index,
    }));

    // Reset all failed files' states
    setFileResults((prev) =>
      prev.map((result, i) =>
        failedIndices.includes(i)
          ? {
              ...result,
              response: '',
              isProcessing: true,
              isCompleted: false,
              error: undefined,
            }
          : result,
      ),
    );

    // Process all failed files in parallel
    const promises = failedFilesToRetry.map(async ({ file, index }) => {
      try {
        // Batch updates for retry all failed as well
        let responseBuffer = '';
        let lastUpdateTime = Date.now();

        const flushBuffer = () => {
          if (responseBuffer) {
            const currentBuffer = responseBuffer;
            responseBuffer = '';

            // Use idle callback for non-critical UI updates to prevent blocking
            scheduleIdleWork(() => {
              setFileResults((prev) =>
                prev.map((result, i) =>
                  i === index ? { ...result, response: result.response + currentBuffer } : result,
                ),
              );
            });
          }
        };

        await processFileWithAI(file, instruction, model, (chunk: string) => {
          responseBuffer += chunk;
          const now = Date.now();

          if (now - lastUpdateTime >= 100 || responseBuffer.length >= 500) {
            flushBuffer();
            lastUpdateTime = now;
          }
        });

        flushBuffer();

        // Mark as completed
        setFileResults((prev) =>
          prev.map((result, i) =>
            i === index ? { ...result, isProcessing: false, isCompleted: true } : result,
          ),
        );
      } catch (error) {
        console.error(`Error retrying file ${file.name}:`, error);
        setFileResults((prev) =>
          prev.map((result, i) =>
            i === index
              ? {
                  ...result,
                  isProcessing: false,
                  isCompleted: false,
                  error: error instanceof Error ? error.message : String(error),
                }
              : result,
          ),
        );
      }
    });

    await Promise.all(promises);
  };

  const clearResults = (): void => {
    setFileResults([]);
  };

  return {
    fileResults,
    isProcessing,
    processFiles,
    retryFile,
    retryAllFailed,
    clearResults,
  };
};

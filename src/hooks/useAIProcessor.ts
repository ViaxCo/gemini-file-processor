import { useState } from 'react';
import { processFileWithAI } from '../services/aiService';
import { GeminiModel } from '../components/ModelSelector';

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
        await processFileWithAI(file, instruction, model, (chunk: string) => {
          setFileResults((prev) =>
            prev.map((result, i) =>
              i === index ? { ...result, response: result.response + chunk } : result,
            ),
          );
        });

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
      await processFileWithAI(fileToRetry.file, instruction, model, (chunk: string) => {
        setFileResults((prev) =>
          prev.map((result, i) =>
            i === fileIndex ? { ...result, response: result.response + chunk } : result,
          ),
        );
      });

      // Mark as completed
      setFileResults((prev) =>
        prev.map((result, i) =>
          i === fileIndex ? { ...result, isProcessing: false, isCompleted: true } : result,
        ),
      );
    } catch (error) {
      console.error(`Error retrying file ${fileToRetry.file.name}:`, error);
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
    const failedIndices = fileResults
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.error)
      .map(({ index }) => index);

    if (failedIndices.length === 0) return;

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
    const promises = failedIndices.map(async (index) => {
      const fileToRetry = fileResults[index];

      try {
        await processFileWithAI(fileToRetry.file, instruction, model, (chunk: string) => {
          setFileResults((prev) =>
            prev.map((result, i) =>
              i === index ? { ...result, response: result.response + chunk } : result,
            ),
          );
        });

        // Mark as completed
        setFileResults((prev) =>
          prev.map((result, i) =>
            i === index ? { ...result, isProcessing: false, isCompleted: true } : result,
          ),
        );
      } catch (error) {
        console.error(`Error retrying file ${fileToRetry.file.name}:`, error);
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

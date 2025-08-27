import { useState } from 'react';
import { processFileWithAI } from '../services/aiService';

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

  const processFiles = async (files: File[], instruction: string): Promise<void> => {
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
        await processFileWithAI(file, instruction, (chunk: string) => {
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

  const clearResults = (): void => {
    setFileResults([]);
  };

  return {
    fileResults,
    isProcessing,
    processFiles,
    clearResults,
  };
};

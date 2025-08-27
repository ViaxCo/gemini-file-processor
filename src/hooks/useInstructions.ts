import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEYS = {
  CUSTOM_INSTRUCTIONS: 'customInstructions',
  LAST_INSTRUCTION: 'lastInstruction',
  LAST_PROCESSED_INSTRUCTION: 'lastProcessedInstruction',
} as const;

const MAX_INSTRUCTION_LENGTH = 10000;
const MAX_SAVED_INSTRUCTIONS = 50;

const safeLocalStorageOperation = <T>(operation: () => T, fallback: T, errorMessage: string): T => {
  try {
    return operation();
  } catch (error) {
    console.error(errorMessage, error);
    return fallback;
  }
};

export const useInstructions = () => {
  const [instruction, setInstruction] = useState<string>('');
  const [savedInstructions, setSavedInstructions] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [lastProcessedInstruction, setLastProcessedInstruction] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const loadStoredData = () => {
      const saved = safeLocalStorageOperation(
        () => {
          const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_INSTRUCTIONS);
          return stored ? JSON.parse(stored) : [];
        },
        [],
        'Error loading saved instructions:',
      );

      const lastInstruction = safeLocalStorageOperation(
        () => localStorage.getItem(STORAGE_KEYS.LAST_INSTRUCTION) || '',
        '',
        'Error loading last instruction:',
      );

      const lastProcessed = safeLocalStorageOperation(
        () => localStorage.getItem(STORAGE_KEYS.LAST_PROCESSED_INSTRUCTION) || '',
        '',
        'Error loading last processed instruction:',
      );

      if (Array.isArray(saved)) {
        setSavedInstructions(saved.slice(0, MAX_SAVED_INSTRUCTIONS));
      }

      if (typeof lastInstruction === 'string') {
        setInstruction(lastInstruction);
      }

      if (typeof lastProcessed === 'string') {
        setLastProcessedInstruction(lastProcessed);
      }
    };

    loadStoredData();
  }, []);

  const saveToLocalStorage = useCallback((key: string, value: string | string[]) => {
    safeLocalStorageOperation(
      () => {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        return true;
      },
      false,
      `Error saving to localStorage (${key}):`,
    );
  }, []);

  const validateInstruction = useCallback((text: string): { isValid: boolean; error?: string } => {
    if (!text.trim()) {
      return { isValid: false, error: 'Instruction cannot be empty' };
    }

    if (text.length > MAX_INSTRUCTION_LENGTH) {
      return {
        isValid: false,
        error: `Instruction too long (${text.length}/${MAX_INSTRUCTION_LENGTH} characters)`,
      };
    }

    return { isValid: true };
  }, []);

  const setInstructionWithPersistence = useCallback(
    (value: string) => {
      setInstruction(value);
      saveToLocalStorage(STORAGE_KEYS.LAST_INSTRUCTION, value);
    },
    [saveToLocalStorage],
  );

  const saveInstruction = useCallback((): boolean => {
    const validation = validateInstruction(instruction);
    if (!validation.isValid) {
      console.warn('Cannot save instruction:', validation.error);
      return false;
    }

    const trimmedInstruction = instruction.trim();
    const updated = [...savedInstructions];

    if (!updated.includes(trimmedInstruction)) {
      updated.unshift(trimmedInstruction);

      if (updated.length > MAX_SAVED_INSTRUCTIONS) {
        updated.splice(MAX_SAVED_INSTRUCTIONS);
      }

      setSavedInstructions(updated);
      saveToLocalStorage(STORAGE_KEYS.CUSTOM_INSTRUCTIONS, updated);
    }

    setIsSaved(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsSaved(false);
    }, 2000);

    return true;
  }, [instruction, savedInstructions, validateInstruction, saveToLocalStorage]);

  const loadInstruction = useCallback(
    (instructionText: string): void => {
      const validation = validateInstruction(instructionText);
      if (!validation.isValid) {
        console.warn('Cannot load instruction:', validation.error);
        return;
      }

      setInstructionWithPersistence(instructionText);
    },
    [validateInstruction, setInstructionWithPersistence],
  );

  const deleteInstruction = useCallback(
    (index: number): void => {
      if (index < 0 || index >= savedInstructions.length) {
        console.warn('Invalid instruction index for deletion:', index);
        return;
      }

      const updated = savedInstructions.filter((_, i) => i !== index);
      setSavedInstructions(updated);
      saveToLocalStorage(STORAGE_KEYS.CUSTOM_INSTRUCTIONS, updated);
    },
    [savedInstructions, saveToLocalStorage],
  );

  const clearInstruction = useCallback((): void => {
    setInstructionWithPersistence('');
  }, [setInstructionWithPersistence]);

  const markInstructionAsProcessed = useCallback(
    (processedInstruction: string): void => {
      setLastProcessedInstruction(processedInstruction);
      saveToLocalStorage(STORAGE_KEYS.LAST_PROCESSED_INSTRUCTION, processedInstruction);
    },
    [saveToLocalStorage],
  );

  const getLastProcessedInstruction = useCallback((): string => {
    return lastProcessedInstruction;
  }, [lastProcessedInstruction]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    instruction,
    setInstruction: setInstructionWithPersistence,
    savedInstructions,
    saveInstruction,
    loadInstruction,
    deleteInstruction,
    clearInstruction,
    markInstructionAsProcessed,
    getLastProcessedInstruction,
    validateInstruction,
    isSaved,
  };
};

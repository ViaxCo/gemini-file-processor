import { useCallback, useEffect, useRef, useState } from 'react';

// Phase 5.1: Default transcript processing prompt
const DEFAULT_TRANSCRIPT_PROMPT = `Edit the source, correcting all typographical, grammatical, and spelling errors while maintaining the original style and emphasis.

Ensure all biblical references:
- Use exact KJV wording.
- Are explicitly quoted in full including those referenced in passive.
- Formatted in isolation with verse numbers, with the reference line in bold and verses in normal weight, e.g.:

**Genesis 12:2-3 - KJV**
2. And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:
3. And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.

Correct all Hebrew and Greek words with proper transliterations.

Remove all verbal fillers ("uh", "um", etc.) while preserving the complete content and meaning.

Maintain all of the author's:
- Teaching points
- Rhetorical devices
- Emphasis patterns
- Illustrative examples
- Call-and-response elements

Format the text with:
- Consistent punctuation
- Proper capitalization
- Original paragraph structure
- Clear scripture demarcation
- Smart quotes

Don't add any text before or after the source text in your response.`;

const STORAGE_KEYS = {
  CUSTOM_INSTRUCTIONS: 'customInstructions',
  LAST_INSTRUCTION: 'lastInstruction',
  LAST_PROCESSED_INSTRUCTION: 'lastProcessedInstruction',
} as const;

const MAX_INSTRUCTION_LENGTH = 10000;
const MAX_SAVED_INSTRUCTIONS = 50;

const safeLocalStorageOperation = <T>(operation: () => T, fallback: T, errorMessage: string): T => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return fallback;
  }

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
  const [isClient, setIsClient] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Mark that we're in the client environment
    setIsClient(true);

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

      // Phase 5.1: Auto-populate with default prompt on first load when empty
      if (typeof lastInstruction === 'string' && lastInstruction.trim().length > 0) {
        setInstruction(lastInstruction);
      } else {
        setInstruction(DEFAULT_TRANSCRIPT_PROMPT);
        // Persist default so UI is hydrated consistently
        saveToLocalStorage(STORAGE_KEYS.LAST_INSTRUCTION, DEFAULT_TRANSCRIPT_PROMPT);
      }

      if (typeof lastProcessed === 'string') {
        setLastProcessedInstruction(lastProcessed);
      }
    };

    loadStoredData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToLocalStorage = useCallback(
    (key: string, value: string | string[]) => {
      // Don't save if we're not in the client environment
      if (!isClient) return;

      safeLocalStorageOperation(
        () => {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          return true;
        },
        false,
        `Error saving to localStorage (${key}):`,
      );
    },
    [isClient],
  );

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
      if (isClient) {
        saveToLocalStorage(STORAGE_KEYS.LAST_INSTRUCTION, value);
      }
    },
    [saveToLocalStorage, isClient],
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
      if (isClient) {
        saveToLocalStorage(STORAGE_KEYS.CUSTOM_INSTRUCTIONS, updated);
      }
    }

    setIsSaved(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsSaved(false);
    }, 2000);

    return true;
  }, [instruction, savedInstructions, validateInstruction, saveToLocalStorage, isClient]);

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
      if (isClient) {
        saveToLocalStorage(STORAGE_KEYS.CUSTOM_INSTRUCTIONS, updated);
      }
    },
    [savedInstructions, saveToLocalStorage, isClient],
  );

  const clearInstruction = useCallback((): void => {
    setInstructionWithPersistence('');
  }, [setInstructionWithPersistence]);

  const markInstructionAsProcessed = useCallback(
    (processedInstruction: string): void => {
      setLastProcessedInstruction(processedInstruction);
      if (isClient) {
        saveToLocalStorage(STORAGE_KEYS.LAST_PROCESSED_INSTRUCTION, processedInstruction);
      }
    },
    [saveToLocalStorage, isClient],
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

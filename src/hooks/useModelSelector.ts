import { useEffect, useState } from 'react';
import { GeminiModel } from '../components/ModelSelector';

const MODEL_STORAGE_KEY = 'gemini-selected-model';
const DEFAULT_MODEL: GeminiModel = 'gemini-2.5-flash';

export const useModelSelector = () => {
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(DEFAULT_MODEL);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark that we're in the client environment
    setIsClient(true);

    // Load the stored model
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored) {
      setSelectedModel(stored as GeminiModel);
    }
  }, []);

  useEffect(() => {
    // Only save to localStorage if we're in the client environment
    if (isClient) {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel, isClient]);

  return {
    selectedModel,
    setSelectedModel,
  };
};

import { useEffect, useState } from 'react';
import { GeminiModel } from '../components/ModelSelector';

const MODEL_STORAGE_KEY = 'gemini-selected-model';
const DEFAULT_MODEL: GeminiModel = 'gemini-2.5-flash';

export const useModelSelector = () => {
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(DEFAULT_MODEL);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored) {
      setSelectedModel(stored as GeminiModel);
    }
    setIsModelLoaded(true);
  }, []);

  useEffect(() => {
    if (isModelLoaded) {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel, isModelLoaded]);

  return {
    selectedModel,
    setSelectedModel,
    isModelLoaded,
  };
};

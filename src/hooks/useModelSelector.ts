import { useState, useEffect } from 'react';
import { GeminiModel } from '../components/ModelSelector';

const MODEL_STORAGE_KEY = 'gemini-selected-model';
const DEFAULT_MODEL: GeminiModel = 'gemini-2.5-flash';

export const useModelSelector = () => {
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(() => {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    return (stored as GeminiModel) || DEFAULT_MODEL;
  });

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  return {
    selectedModel,
    setSelectedModel,
  };
};

import { useEffect, useState } from 'react';
import { AIProvider, getDefaultModel } from '../config/providerConfig';
import { apiKeyStore } from '../services/apiKeyStore';

const STORAGE_KEY_PROVIDER = 'ai-file-processor-provider';
const STORAGE_KEY_MODEL = 'ai-file-processor-model';

export const useProviderSelector = () => {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER) as AIProvider | null;
    const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);

    if (savedProvider) {
      setSelectedProvider(savedProvider);
      // Load saved API key for the provider
      const savedKey = apiKeyStore.getApiKey(savedProvider);
      setApiKey(savedKey || '');

      // Load saved model or default
      if (savedModel) {
        setSelectedModel(savedModel);
      } else {
        const defaultModel = getDefaultModel(savedProvider);
        if (defaultModel) {
          setSelectedModel(defaultModel.id);
        }
      }
    } else {
      // Load API key for default provider (gemini)
      const savedKey = apiKeyStore.getApiKey('gemini');
      setApiKey(savedKey || '');
    }

    setIsLoaded(true);
  }, []);

  // Save provider preference
  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);

    // Load the default model for the new provider
    const defaultModel = getDefaultModel(provider);
    if (defaultModel) {
      setSelectedModel(defaultModel.id);
      localStorage.setItem(STORAGE_KEY_MODEL, defaultModel.id);
    }

    // Load saved API key for the new provider
    const savedKey = apiKeyStore.getApiKey(provider);
    setApiKey(savedKey || '');
  };

  // Save model preference
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  };

  // Update API key (also saves to apiKeyStore)
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    // Note: The actual saving to localStorage is handled in ProviderSelector component
  };

  return {
    selectedProvider,
    selectedModel,
    apiKey,
    isLoaded,
    setSelectedProvider: handleProviderChange,
    setSelectedModel: handleModelChange,
    setApiKey: handleApiKeyChange,
  };
};

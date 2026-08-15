import { useEffect, useState } from 'react';
import {
  AIProvider,
  getDefaultModel,
  getProvider,
  providerNeedsApiKey,
} from '../config/providerConfig';
import { apiKeyStore } from '../services/apiKeyStore';
import {
  GeminiProject,
  getGeminiProjects,
  saveGeminiProjects,
  subscribeToGeminiProjectStore,
} from '../services/geminiProjectStore';

const STORAGE_KEY_PROVIDER = 'ai-file-processor-provider';
const STORAGE_KEY_MODEL = 'ai-file-processor-model';

export const useProviderSelector = () => {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [geminiProjects, setGeminiProjectsState] = useState<GeminiProject[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER) as AIProvider | null;
    const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);

    if (savedProvider && getProvider(savedProvider)) {
      setSelectedProvider(savedProvider);
      // Load saved API key for the provider
      const projects = getGeminiProjects();
      setGeminiProjectsState(projects);
      const savedKey =
        savedProvider === 'gemini' ? projects[0]?.apiKey : apiKeyStore.getApiKey(savedProvider);
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
      // Load saved preferences for the default provider (gemini)
      const projects = getGeminiProjects();
      setGeminiProjectsState(projects);
      const savedKey = projects[0]?.apiKey;
      setApiKey(savedKey || '');
      if (savedModel) {
        setSelectedModel(savedModel);
      }
    }

    setIsLoaded(true);
  }, []);

  useEffect(
    () =>
      subscribeToGeminiProjectStore(() => {
        const projects = getGeminiProjects();
        setGeminiProjectsState(projects);
        if (selectedProvider === 'gemini') setApiKey(projects[0]?.apiKey ?? '');
      }),
    [selectedProvider],
  );

  // Save provider preference
  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    if (providerNeedsApiKey(provider)) localStorage.setItem(STORAGE_KEY_PROVIDER, provider);

    // Load the default model for the new provider
    const defaultModel = getDefaultModel(provider);
    if (defaultModel) {
      setSelectedModel(defaultModel.id);
      if (providerNeedsApiKey(provider)) localStorage.setItem(STORAGE_KEY_MODEL, defaultModel.id);
    }

    // Load saved API key for the new provider
    setApiKey(
      provider === 'gemini'
        ? (getGeminiProjects()[0]?.apiKey ?? '')
        : providerNeedsApiKey(provider)
          ? apiKeyStore.getApiKey(provider) || ''
          : '',
    );
  };

  // Save model preference
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (providerNeedsApiKey(selectedProvider)) localStorage.setItem(STORAGE_KEY_MODEL, model);
  };

  // Update API key (also saves to apiKeyStore)
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    // Note: The actual saving to localStorage is handled in ProviderSelector component
  };

  const setGeminiProjects = (projects: GeminiProject[]) => {
    saveGeminiProjects(projects);
    setGeminiProjectsState(projects);
    if (selectedProvider === 'gemini') setApiKey(projects[0]?.apiKey ?? '');
  };

  return {
    selectedProvider,
    selectedModel,
    apiKey,
    geminiProjects,
    isLoaded,
    setSelectedProvider: handleProviderChange,
    setSelectedModel: handleModelChange,
    setApiKey: handleApiKeyChange,
    setGeminiProjects,
  };
};

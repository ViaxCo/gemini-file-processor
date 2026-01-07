import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, Check, ExternalLink, Eye, EyeOff, Key, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AIProvider, PROVIDERS, getDefaultModel, getProvider } from '../config/providerConfig';
import { apiKeyStore } from '../services/apiKeyStore';
import { FetchedModel, fetchModels } from '../services/modelFetcher';

interface ProviderSelectorProps {
  selectedProvider: AIProvider;
  selectedModel: string;
  onProviderChange: (provider: AIProvider) => void;
  onModelChange: (model: string) => void;
  onApiKeyChange: (apiKey: string) => void;
  apiKey: string;
}

export const ProviderSelector = ({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  apiKey,
}: ProviderSelectorProps) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [isEditing, setIsEditing] = useState(!apiKey);
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);

  const provider = getProvider(selectedProvider);

  // Sync tempApiKey with apiKey prop when provider changes or apiKey is loaded
  useEffect(() => {
    setTempApiKey(apiKey);
    setIsEditing(!apiKey);
  }, [apiKey, selectedProvider]);

  // Fetch models when API key is available
  useEffect(() => {
    if (!apiKey) {
      setFetchedModels([]);
      setModelFetchError(null);
      return;
    }

    const loadModels = async () => {
      setIsLoadingModels(true);
      setModelFetchError(null);
      try {
        const models = await fetchModels(selectedProvider, apiKey);
        setFetchedModels(models);
        // If current model is not in fetched list, select the first available
        if (models.length > 0 && !models.some((m) => m.id === selectedModel)) {
          const firstModel = models[0];
          if (firstModel) {
            onModelChange(firstModel.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
        setModelFetchError('Failed to load models');
        setFetchedModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, [selectedProvider, apiKey]);

  const handleProviderChange = (newProvider: AIProvider) => {
    onProviderChange(newProvider);
    // Clear fetched models when provider changes
    setFetchedModels([]);
    // Load the default model for the new provider (fallback)
    const defaultModel = getDefaultModel(newProvider);
    if (defaultModel) {
      onModelChange(defaultModel.id);
    }
    // Load saved API key for the new provider
    const savedKey = apiKeyStore.getApiKey(newProvider);
    onApiKeyChange(savedKey || '');
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      apiKeyStore.setApiKey(selectedProvider, tempApiKey.trim());
      onApiKeyChange(tempApiKey.trim());
      setIsEditing(false);
    }
  };

  const handleClearApiKey = () => {
    apiKeyStore.removeApiKey(selectedProvider);
    onApiKeyChange('');
    setTempApiKey('');
    setIsEditing(true);
    setFetchedModels([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveApiKey();
    }
  };

  // Use fetched models if available, otherwise fall back to config models
  const displayModels =
    fetchedModels.length > 0
      ? fetchedModels.map((m) => ({ id: m.id, name: m.name }))
      : provider?.models.map((m) => ({ id: m.id, name: m.name })) || [];

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Provider and Model Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Provider Selector */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
            <span className="text-xs font-medium whitespace-nowrap text-muted-foreground sm:text-sm">
              Provider
            </span>
          </div>
          <Select value={selectedProvider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-full min-w-[140px] sm:w-auto" size="sm">
              <SelectValue placeholder="Select provider">{provider?.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model Selector */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="text-xs font-medium whitespace-nowrap text-muted-foreground sm:text-sm">
            Model
          </span>
          <Select
            value={selectedModel}
            onValueChange={onModelChange}
            disabled={isLoadingModels || displayModels.length === 0}
          >
            <SelectTrigger className="w-full min-w-[200px] sm:w-auto" size="sm">
              {isLoadingModels ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading models...</span>
                </div>
              ) : (
                <SelectValue placeholder={apiKey ? 'Select model' : 'Enter API key first'}>
                  {displayModels.find((m) => m.id === selectedModel)?.name || selectedModel}
                </SelectValue>
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {displayModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fetchedModels.length > 0 && (
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {fetchedModels.length} models
            </span>
          )}
          {modelFetchError && (
            <span className="text-xs whitespace-nowrap text-destructive">{modelFetchError}</span>
          )}
        </div>
      </div>

      {/* API Key Row */}
      <div className="flex w-full items-center gap-2">
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <Key className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
          <span className="text-xs font-medium whitespace-nowrap text-muted-foreground sm:text-sm">
            API Key
          </span>
        </div>

        {isEditing || !apiKey ? (
          <>
            <div className="relative flex-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={provider?.apiKeyPlaceholder || 'Enter API key'}
                className="h-8 pr-10 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-0 right-0 h-8 w-8 p-0"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button
              size="sm"
              variant="default"
              className="h-8 px-3"
              onClick={handleSaveApiKey}
              disabled={!tempApiKey.trim()}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-1 items-center gap-2">
              <span className="text-sm text-muted-foreground">••••••••{apiKey.slice(-4)}</span>
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Saved</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive"
              onClick={handleClearApiKey}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {provider?.apiKeyUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={provider.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </TooltipTrigger>
            <TooltipContent>Get API Key</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

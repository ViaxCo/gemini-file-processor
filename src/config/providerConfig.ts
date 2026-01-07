// AI Provider configuration for multi-provider support
// All providers use OpenAI-compatible chat completions API format except Gemini

export type AIProvider = 'gemini' | 'mistral' | 'openrouter' | 'cerebras' | 'groq';

export interface ModelConfig {
  id: string;
  name: string;
  rateLimit: { limit: number; interval: number }; // requests per interval (ms)
}

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  models: ModelConfig[];
  apiKeyPlaceholder: string;
  apiKeyUrl: string;
  baseUrl: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    apiKeyPlaceholder: 'AIza...',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        rateLimit: { limit: 5, interval: 60000 },
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        rateLimit: { limit: 10, interval: 60000 },
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        rateLimit: { limit: 15, interval: 60000 },
      },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    apiKeyPlaceholder: 'sk-...',
    apiKeyUrl: 'https://console.mistral.ai/api-keys',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        rateLimit: { limit: 1, interval: 1000 },
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        rateLimit: { limit: 1, interval: 1000 },
      },
      {
        id: 'codestral-latest',
        name: 'Codestral',
        rateLimit: { limit: 1, interval: 1000 },
      },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o (OpenAI)',
        rateLimit: { limit: 10, interval: 60000 },
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        rateLimit: { limit: 10, interval: 60000 },
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        rateLimit: { limit: 10, interval: 60000 },
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B',
        rateLimit: { limit: 10, interval: 60000 },
      },
    ],
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    apiKeyPlaceholder: 'csk-...',
    apiKeyUrl: 'https://cloud.cerebras.ai/',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: [
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        rateLimit: { limit: 30, interval: 60000 },
      },
      {
        id: 'llama-4-scout-17b-16e-instruct',
        name: 'Llama 4 Scout 17B',
        rateLimit: { limit: 30, interval: 60000 },
      },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    apiKeyPlaceholder: 'gsk_...',
    apiKeyUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        rateLimit: { limit: 30, interval: 60000 },
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        rateLimit: { limit: 30, interval: 60000 },
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        rateLimit: { limit: 30, interval: 60000 },
      },
    ],
  },
];

export const getProvider = (id: AIProvider): ProviderConfig | undefined => {
  return PROVIDERS.find((p) => p.id === id);
};

export const getModel = (providerId: AIProvider, modelId: string): ModelConfig | undefined => {
  const provider = getProvider(providerId);
  return provider?.models.find((m) => m.id === modelId);
};

export const getDefaultModel = (providerId: AIProvider): ModelConfig | undefined => {
  const provider = getProvider(providerId);
  return provider?.models[0];
};

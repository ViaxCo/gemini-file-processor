// API Key storage service using localStorage
// Keys are stored per-provider for easy management

import { AIProvider } from '../config/providerConfig';

const STORAGE_KEY_PREFIX = 'ai-file-processor-api-key-';

export const apiKeyStore = {
  getApiKey(provider: AIProvider): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${provider}`);
  },

  setApiKey(provider: AIProvider, apiKey: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${provider}`, apiKey);
  },

  removeApiKey(provider: AIProvider): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${provider}`);
  },

  hasApiKey(provider: AIProvider): boolean {
    return !!this.getApiKey(provider);
  },

  clearAll(): void {
    if (typeof window === 'undefined') return;
    const providers: AIProvider[] = ['gemini', 'mistral', 'openrouter', 'cerebras', 'groq'];
    providers.forEach((provider) => {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${provider}`);
    });
  },
};

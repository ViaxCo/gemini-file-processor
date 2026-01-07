// Service to fetch available models from AI providers
// Each provider has a different API structure but all support model listing

import { AIProvider, getProvider } from '../config/providerConfig';

export interface FetchedModel {
  id: string;
  name: string;
  created?: number;
  ownedBy?: string;
}

/**
 * Fetch available models from a provider using their API key
 */
export async function fetchModels(provider: AIProvider, apiKey: string): Promise<FetchedModel[]> {
  if (!apiKey) {
    return [];
  }

  try {
    if (provider === 'gemini') {
      return await fetchGeminiModels(apiKey);
    } else {
      return await fetchOpenAICompatibleModels(provider, apiKey);
    }
  } catch (error) {
    console.error(`Error fetching models from ${provider}:`, error);
    return [];
  }
}

/**
 * Fetch models from Google Gemini API
 */
async function fetchGeminiModels(apiKey: string): Promise<FetchedModel[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  // Filter for models that support generateContent (chat/text generation)
  const models = (data.models || [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent'),
    )
    .map((m: { name: string; displayName?: string }) => ({
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name.replace('models/', ''),
    }));

  // Sort by name, prioritizing gemini-2.x models
  return models.sort((a: FetchedModel, b: FetchedModel) => {
    const aIs2x = a.id.includes('gemini-2');
    const bIs2x = b.id.includes('gemini-2');
    if (aIs2x && !bIs2x) return -1;
    if (!aIs2x && bIs2x) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Fetch models from OpenAI-compatible APIs (Mistral, OpenRouter, Cerebras, Groq)
 */
async function fetchOpenAICompatibleModels(
  provider: AIProvider,
  apiKey: string,
): Promise<FetchedModel[]> {
  const providerConfig = getProvider(provider);
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const url = `${providerConfig.baseUrl}/models`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter requires additional headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : '';
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`${providerConfig.name} API error: ${response.status}`);
  }

  const data = await response.json();
  const modelsRaw = (data.data || []).map(
    (m: { id: string; owned_by?: string; created?: number }) => ({
      id: m.id,
      name: formatModelName(m.id, provider),
      created: m.created,
      ownedBy: m.owned_by,
    }),
  );

  // Deduplicate by model ID (some providers return duplicates)
  const seen = new Set<string>();
  const models = modelsRaw.filter((m: FetchedModel) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  // Sort models by name
  return models.sort((a: FetchedModel, b: FetchedModel) => a.name.localeCompare(b.name));
}

/**
 * Format model ID into a human-readable name
 */
function formatModelName(modelId: string, provider: AIProvider): string {
  // OpenRouter models include provider prefix like "openai/gpt-4o"
  if (provider === 'openrouter' && modelId.includes('/')) {
    const parts = modelId.split('/');
    const providerName = parts[0] ?? '';
    const modelName = parts.slice(1).join('/');
    return `${formatModelPart(modelName)} (${capitalizeFirst(providerName)})`;
  }

  return formatModelPart(modelId);
}

/**
 * Format a model ID part into readable text
 */
function formatModelPart(part: string): string {
  return part
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => {
      // Keep version numbers and abbreviations as-is
      if (/^\d/.test(word) || word.length <= 2) return word;
      return capitalizeFirst(word);
    })
    .join(' ');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

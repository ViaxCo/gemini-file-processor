// Client-side AI service supporting multiple providers
// Uses direct fetch calls to provider APIs with streaming

import { AIProvider, getProvider } from '../config/providerConfig';

export interface ProcessOptions {
  signal?: AbortSignal;
}

/**
 * Process a file with AI using the specified provider and model
 * Supports streaming responses from all providers
 */
export const processFileWithAI = async (
  file: File,
  instruction: string,
  provider: AIProvider,
  model: string,
  apiKey: string,
  onChunk: (chunk: string) => void,
  options?: ProcessOptions,
): Promise<void> => {
  const fileContent = await file.text();
  const prompt = `${instruction}\n\nFile content:\n${fileContent}`;

  if (provider === 'gemini') {
    await streamGemini(prompt, model, apiKey, onChunk, options);
  } else {
    // All other providers use OpenAI-compatible API
    await streamOpenAICompatible(prompt, provider, model, apiKey, onChunk, options);
  }
};

/**
 * Stream response from Google Gemini API
 */
async function streamGemini(
  prompt: string,
  model: string,
  apiKey: string,
  onChunk: (chunk: string) => void,
  options?: ProcessOptions,
): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body received from Gemini');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedChunks = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim() === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              onChunk(content);
              receivedChunks = true;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!receivedChunks) {
    throw new Error('No content received from Gemini API');
  }
}

/**
 * Stream response from OpenAI-compatible APIs (Mistral, OpenRouter, Cerebras, Groq)
 */
async function streamOpenAICompatible(
  prompt: string,
  provider: AIProvider,
  model: string,
  apiKey: string,
  onChunk: (chunk: string) => void,
  options?: ProcessOptions,
): Promise<void> {
  const providerConfig = getProvider(provider);
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const url = `${providerConfig.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter requires additional headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : '';
    headers['X-Title'] = 'AI File Processor';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: true,
      temperature: 0.7,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    const errorMessage = error.error?.message || error.message || `API error: ${response.status}`;
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error(`No response body received from ${providerConfig.name}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedChunks = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim() === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
              receivedChunks = true;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!receivedChunks) {
    throw new Error(`No content received from ${providerConfig.name} API`);
  }
}

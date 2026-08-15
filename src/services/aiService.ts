// Client-side AI service supporting multiple providers
// Uses direct fetch calls to provider APIs with streaming

import { AIProvider, getProvider } from '../config/providerConfig';
import { extractTextFromFile } from '../utils/fileUtils';
import { ProviderRequestError, createProviderRequestError } from './processingErrors';

export interface ProcessOptions {
  signal?: AbortSignal;
  attempt?: number;
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
  const fileContent = await extractTextFromFile(file);

  if (provider === 'test') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test AI is not available in production.');
    }
    const { processFileWithTestAI } = await import('../testing/testAIService');
    await processFileWithTestAI(
      file.name,
      fileContent,
      model,
      onChunk,
      options?.signal,
      options?.attempt,
    );
    return;
  }

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
    const error = await response.json().catch(() => undefined);
    throw createProviderRequestError(response.status, error, response.headers.get('Retry-After'));
  }

  if (!response.body) {
    throw createProviderRequestError(undefined, {
      error: { message: 'No response body received from Gemini', status: 'INVALID_RESPONSE' },
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedChunks = false;
  let blockedCode: string | undefined;

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
            if (data.error) {
              throw createProviderRequestError(undefined, data);
            }
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const finishReason = data.candidates?.[0]?.finishReason;
            const responseBlockedCode = data.promptFeedback?.blockReason || finishReason;
            if (
              typeof responseBlockedCode === 'string' &&
              /SAFETY|RECITATION|PROHIBITED_CONTENT|BLOCKLIST|SPII/.test(responseBlockedCode)
            ) {
              blockedCode = responseBlockedCode;
            }
            if (content) {
              onChunk(content);
              receivedChunks = true;
            }
          } catch (error) {
            if (error instanceof ProviderRequestError) throw error;
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (blockedCode) {
    throw createProviderRequestError(undefined, {
      error: {
        message: `Gemini blocked the response: ${blockedCode}`,
        status: blockedCode,
      },
    });
  }

  if (!receivedChunks) {
    throw createProviderRequestError(undefined, {
      error: { message: 'No content received from Gemini API', status: 'INVALID_RESPONSE' },
    });
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
    const error = await response.json().catch(() => undefined);
    throw createProviderRequestError(response.status, error, response.headers.get('Retry-After'));
  }

  if (!response.body) {
    throw createProviderRequestError(undefined, {
      error: {
        message: `No response body received from ${providerConfig.name}`,
        code: 'INVALID_RESPONSE',
      },
    });
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
            if (data.error) {
              throw createProviderRequestError(undefined, data);
            }
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
              receivedChunks = true;
            }
          } catch (error) {
            if (error instanceof ProviderRequestError) throw error;
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!receivedChunks) {
    throw createProviderRequestError(undefined, {
      error: {
        message: `No content received from ${providerConfig.name} API`,
        code: 'INVALID_RESPONSE',
      },
    });
  }
}

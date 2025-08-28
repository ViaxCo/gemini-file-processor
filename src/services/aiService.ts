import { GeminiModel } from '../components/ModelSelector';

export const processFileWithAI = async (
  file: File,
  instruction: string,
  model: GeminiModel,
  onChunk: (chunk: string) => void,
): Promise<void> => {
  const fileContent = await file.text();

  let receivedChunks = false;
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileContent,
        instruction,
        model,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          onChunk(chunk);
          receivedChunks = true;
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!receivedChunks) {
      throw new Error('AI processing failed: No content received from AI stream.');
    }
  } catch (error) {
    console.error('Error in AI streaming:', error);
    throw error; // Re-throw the error to be caught by useAIProcessor
  }
};

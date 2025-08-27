import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY as string,
});

export const processFileWithAI = async (
  file: File,
  instruction: string,
  onChunk: (chunk: string) => void,
): Promise<void> => {
  const fileContent = await file.text();

  const prompt = `${instruction}\n\nFile content:\n${fileContent}`;

  let receivedChunks = false;
  try {
    const result = streamText({
      model: google(import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'),
      prompt: prompt,
    });

    for await (const chunk of result.textStream) {
      onChunk(chunk);
      receivedChunks = true;
    }

    if (!receivedChunks) {
      throw new Error('AI processing failed: No content received from AI stream.');
    }
  } catch (error) {
    console.error('Error in AI streaming:', error);
    throw error; // Re-throw the error to be caught by useAIProcessor
  }
};

import { afterEach, describe, expect, it, vi } from 'vitest';
import { processFileWithAI } from './aiService';

vi.mock('../utils/fileUtils', () => ({
  extractTextFromFile: vi.fn().mockResolvedValue('file content'),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gemini streaming', () => {
  it('buffers an SSE line split across network chunks', async () => {
    const encoder = new TextEncoder();
    const event = `data: ${JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
      usageMetadata: { promptTokenCount: 12 },
    })}`;
    const splitAt = event.indexOf('Gemini response');
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(event.slice(0, splitAt)));
        controller.enqueue(encoder.encode(event.slice(splitAt)));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    const onChunk = vi.fn();

    const metadata = await processFileWithAI(
      {} as File,
      'Summarize',
      'gemini',
      'gemini-2.5-flash',
      'api-key',
      onChunk,
    );

    expect(onChunk).toHaveBeenCalledOnce();
    expect(onChunk).toHaveBeenCalledWith('Gemini response');
    expect(metadata).toEqual({ inputTokens: 12 });
  });
});

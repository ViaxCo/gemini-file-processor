import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.MY_GEMINI_API_KEY as string,
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MY_GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const { fileContent, instruction, model } = await request.json();

    if (!fileContent || !instruction || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: fileContent, instruction, model' },
        { status: 400 },
      );
    }

    const prompt = `${instruction}\n\nFile content:\n${fileContent}`;

    const result = streamText({
      model: google(model),
      prompt: prompt,
      // Forward the abort signal so cancelling the client request aborts model generation
      abortSignal: request.signal,
    });

    // Return a streaming response
    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Error in Gemini API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

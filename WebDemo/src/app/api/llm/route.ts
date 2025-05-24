import path from 'path';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { type NextRequest, NextResponse } from 'next/server';

dotenv.config(); // Ensure environment variables are loaded

type PromptType = 'slim' | 'flat' | 'hierarchical';

const GEMINI_PRO_2_5_PREVIEW_03 = 'gemini-2.5-pro-preview-03-25';

const promptFileMap: Record<PromptType, string> = {
  slim: 'src/prompts/system-llm-slim.md',
  flat: 'src/prompts/system-llm-flat.md',
  hierarchical: 'src/prompts/system-llm-hier.md',
};

// USER_INPUT_FILE is no longer needed here as we directly use the data.

// Define the expected structure for the LLM response based on your example
interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
interface LLMResponse {
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  usage?: LLMUsage;
  error?: string;
  systemPromptUsed?: string;
  userInputUsed?: string; // This will now describe the data used
  fullSystemPrompt?: string;
  fullUserInput?: string; // This will now be the stringified data
  details?: any;
}

export async function POST(req: NextRequest) {
  try {
    const {
      promptType,
      modelName = GEMINI_PRO_2_5_PREVIEW_03,
      temperature = 0.7,
      data,
    } = (await req.json()) as {
      promptType: PromptType;
      modelName?: string;
      temperature?: number;
      data?: any;
    };

    if (!promptType || !promptFileMap[promptType]) {
      return NextResponse.json(
        { error: 'Invalid prompt type' } as LLMResponse,
        { status: 400 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'No data provided' } as LLMResponse, {
        status: 400,
      });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error(
        'API key is not set in .env or not accessible. Please set the GOOGLE_GENERATIVE_AI_API_KEY environment variable.',
      );
      return NextResponse.json(
        { error: 'API key not configured' } as LLMResponse,
        { status: 500 },
      );
    }

    const projectRoot = process.cwd();
    const systemPromptFilePath = path.join(
      projectRoot,
      promptFileMap[promptType],
    );

    let systemPromptContent = '';

    try {
      systemPromptContent = await fs.readFile(systemPromptFilePath, 'utf-8');
    } catch (error) {
      console.error(
        `Error reading system prompt file ${systemPromptFilePath}:`,
        error,
      );
      return NextResponse.json(
        {
          error: `Failed to read system prompt: ${promptFileMap[promptType]}`,
        } as LLMResponse,
        { status: 500 },
      );
    }

    // Directly combine system prompt and the input data
    const stringifiedData = JSON.stringify(data, null, 2);
    const combinedPrompt = `${systemPromptContent}\n\nInput Data:\n${stringifiedData}`;

    const { text, usage } = await generateText({
      model: google(modelName) as any, // Using 'as any' to bypass potential type errors
      prompt: combinedPrompt,
      temperature: temperature,
    });

    if (!text) {
      return NextResponse.json(
        { error: 'No response from Gemini' } as LLMResponse,
        { status: 500 },
      );
    }

    const responsePayload: LLMResponse = {
      content: text,
      role: 'assistant',
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
      systemPromptUsed: promptFileMap[promptType],
      userInputUsed: 'Direct input data from selected stage',
      fullSystemPrompt: systemPromptContent,
      fullUserInput: stringifiedData,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('Error in /api/llm:', error);
    let errorMessage = 'An unknown error occurred';
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.cause) {
      errorMessage += ` - Cause: ${JSON.stringify(error.cause)}`;
    }
    return NextResponse.json(
      { error: errorMessage, details: error } as LLMResponse,
      { status: 500 },
    );
  }
}

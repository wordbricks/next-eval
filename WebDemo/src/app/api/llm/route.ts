import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import { type NextRequest, NextResponse } from 'next/server';
import type { LLMResponse } from '@/lib/interfaces';

dotenv.config(); // Ensure environment variables are loaded

type PromptType = 'slim' | 'flat' | 'hier';

const GEMINI_PRO_2_5_PREVIEW_03 = 'gemini-2.5-pro-preview-03-25';

// Function to load prompt content from markdown files
const loadPromptContent = async (promptType: PromptType): Promise<string> => {
  const filePath = path.join(process.cwd(), 'src', 'prompts', `system-llm-${promptType}.md`);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt file for ${promptType}:`, error);
    throw new Error(`Prompt file for ${promptType} not found`);
  }
};

export async function POST(req: NextRequest) {
  try {
    const { promptType, data, randomNumber } = (await req.json()) as {
      promptType: PromptType;
      data: string;
      randomNumber?: number | null;
    };

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

    if (randomNumber !== null && randomNumber !== undefined) {
      try {
        const contentPath = path.join(
          process.cwd(),
          'src',
          'assets',
          `sample${randomNumber}_${promptType}_content.json`,
        );
        const usagePath = path.join(
          process.cwd(),
          'src',
          'assets',
          `sample${randomNumber}_${promptType}_usage.json`,
        );

        const contentFile = await fs.readFile(contentPath, 'utf-8');
        const usageFile = await fs.readFile(usagePath, 'utf-8');

        const contentData = contentFile;
        const usageData = JSON.parse(usageFile);

        const responsePayload: LLMResponse = {
          content: contentData,
          usage: usageData,
          systemPromptUsed: `Loaded from local assets (sample${randomNumber})`,
        };
        return NextResponse.json(responsePayload);
      } catch (assetError) {
        console.error(
          `Error loading assets for sample${randomNumber}:`,
          assetError,
        );
        return NextResponse.json(
          {
            error: `Assets for sample ${randomNumber} not found or are invalid.`,
          } as LLMResponse,
          { status: 404 },
        );
      }
    }

    const modelName = GEMINI_PRO_2_5_PREVIEW_03;

    if (!promptType || !['slim', 'flat', 'hier'].includes(promptType)) {
      return NextResponse.json(
        { error: 'Invalid prompt type' } as LLMResponse,
        { status: 400 },
      );
    }

    // Load system prompt content from markdown file
    const systemPromptContent = await loadPromptContent(promptType);

    const combinedPrompt = `${systemPromptContent}\n\nInput Data:\n${data}`;
    const temperature = 1.0;

    const { text, usage } = await generateText({
      model: google(modelName),
      prompt: combinedPrompt,
      temperature: temperature,
    });

    if (!text) {
      const responsePayload: LLMResponse = {
        content: '```json[]```',
        usage: usage
          ? {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined,
        systemPromptUsed: `Loaded from file: system-llm-${promptType}.md`,
      };
      return NextResponse.json(responsePayload);
    }

    const responsePayload: LLMResponse = {
      content: text,
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
      systemPromptUsed: `Loaded from file: system-llm-${promptType}.md`,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error in /api/llm:', error);
    let errorMessage = 'An unknown error occurred';
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.cause) {
      errorMessage += ` - Cause: ${JSON.stringify(error.cause)}`;
    }
    return NextResponse.json({ error: errorMessage } as LLMResponse, {
      status: 500,
    });
  }
}

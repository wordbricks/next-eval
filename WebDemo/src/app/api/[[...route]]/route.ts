import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv'; // Added for process.env access if not globally configured

dotenv.config(); // Ensure environment variables are loaded

// Define LLMResponse interface (assuming from @/lib/interfaces)
// If this is incorrect, please provide the correct definition from @/lib/interfaces/index.ts or similar
export interface LLMResponse {
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  systemPromptUsed?: string;
}

// Type definitions for save-html
type Database = {
  public: {
    Tables: {
      next_eval_user_htmls: {
        Row: {
          id: string;
          created_at: string;
          html: string;
        };
        Insert: {
          id: string;
          created_at?: string;
          html: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      access_role: 'editor' | 'owner' | 'viewer';
      next_eval_type: 'decision' | 'result';
      role: 'user' | 'admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Supabase client for save-html
const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// Type definitions and constants for llm
type PromptType = 'slim' | 'flat' | 'hier';
const GEMINI_PRO_2_5_PREVIEW_03 = 'gemini-2.5-pro-preview-03-25';

// Helper function for llm (moved from llm/route.ts)
const loadPromptContent = async (promptType: PromptType): Promise<string> => {
  const filePath = path.join(process.cwd(), 'src', 'prompts', `system-llm-${promptType}.md`);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt file for ${promptType}:`, error);
    throw new Error(`Prompt file for ${promptType} not found`);
  }
};

const app = new Hono().basePath('/api');

// Root handler (existing)
app.get('/', (c) => {
  return c.json({ message: 'Welcome to the Hono API root at /api/' });
});

// Hello handler (existing)
app.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

// Feedback handler (from feedback/route.ts)
app.post('/feedback', async (c) => {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL is not defined in environment variables.');
    return c.json(
      { message: 'Slack webhook URL is not configured on the server.' },
      500,
    );
  }

  try {
    const body = await c.req.json();

    if (!body.text) {
      return c.json(
        { message: 'Feedback text is missing in the request body.' },
        400,
      );
    }

    const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: body.text }),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error(
        `Failed to send feedback to Slack: ${slackResponse.status} ${slackResponse.statusText}`,
        errorText,
      );
      return c.json(
        { message: 'Failed to send feedback to Slack.', error: errorText },
        slackResponse.status as any, // Use 'as any' if status is not directly a ContentfulStatusCode
      );
    }

    return c.json(
      { message: 'Feedback sent successfully.' },
      200,
    );
  } catch (error) {
    console.error('Error processing feedback request:', error);
    let errorMessage =
      'An unknown error occurred while processing the feedback request.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return c.json(
      { message: 'Error processing feedback request.', error: errorMessage },
      500,
    );
  }
});

// Save HTML handler (from save-html/route.ts)
app.post('/save-html', async (c) => {
  try {
    const { htmlId, htmlContent } = await c.req.json();

    if (!htmlId || !htmlContent) {
      return c.json(
        { error: 'Missing htmlId or htmlContent' },
        400,
      );
    }

    const { data, error } = await supabaseClient
      .from('next_eval_user_htmls')
      .insert([{ id: htmlId, html: htmlContent }]);

    if (error) {
      console.error('Supabase error:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, data }, 200);
  } catch (error) {
    console.error('API error:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return c.json({ error: errorMessage }, 500);
  }
});

// LLM handler (from llm/route.ts)
app.post('/llm', async (c) => {
  try {
    const { promptType, data, randomNumber } = (await c.req.json()) as {
      promptType: PromptType;
      data: string;
      randomNumber?: number | null;
    };

    // Reinstate API key check
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error(
        'API key is not set in .env or not accessible. Please set the GOOGLE_GENERATIVE_AI_API_KEY environment variable.',
      );
      return c.json(
        { error: 'API key not configured' } as LLMResponse,
        500,
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

        const contentData = contentFile; // Assuming content is string, not parsed JSON
        const usageData = JSON.parse(usageFile);

        const responsePayload: LLMResponse = {
          content: contentData,
          usage: usageData,
          systemPromptUsed: `Loaded from local assets (sample${randomNumber})`,
        };
        return c.json(responsePayload);
      } catch (assetError) {
        console.error(
          `Error loading assets for sample${randomNumber}:`,
          assetError,
        );
        return c.json(
          {
            error: `Assets for sample ${randomNumber} not found or are invalid.`,
          } as LLMResponse,
          404,
        );
      }
    }

    const modelName = GEMINI_PRO_2_5_PREVIEW_03;

    if (!promptType || !['slim', 'flat', 'hier'].includes(promptType)) {
      return c.json(
        { error: 'Invalid prompt type' } as LLMResponse,
        400,
      );
    }

    const systemPromptContent = await loadPromptContent(promptType);
    const combinedPrompt = `${systemPromptContent}\n\nInput Data:\n${data}`;
    const temperature = 1.0;

    const { text, usage } = await generateText({
      model: google(modelName), // API key is picked from env by the SDK
      prompt: combinedPrompt,
      temperature: temperature,
    });

    const responsePayload: LLMResponse = {
      content: text || '```json[]```', // Ensure content is never undefined if text is empty
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
      systemPromptUsed: `Loaded from file: system-llm-${promptType}.md`,
    };

    return c.json(responsePayload);
  } catch (error) {
    console.error('Error in /api/llm:', error);
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) { // Check if error is an instance of Error
      errorMessage = error.message;
      // Hono errors might have a cause property, Next.js errors might too
      if (error.cause) {
        errorMessage += ` - Cause: ${JSON.stringify(error.cause)}`;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    return c.json({ error: errorMessage } as LLMResponse, 500 ); // Corrected status code
  }
});

export const GET = handle(app);
export const POST = handle(app);
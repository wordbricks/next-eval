import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database, PromptType } from '../types';

// Constants
export const GEMINI_PRO_2_5_PREVIEW_03 = 'gemini-2.5-pro-preview-03-25';

// Supabase client
export const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// Helper function to load prompt content
export const loadPromptContent = async (promptType: PromptType): Promise<string> => {
  const filePath = path.join(process.cwd(), 'src', 'prompts', `system-llm-${promptType}.md`);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt file for ${promptType}:`, error);
    throw new Error(`Prompt file for ${promptType} not found`);
  }
}; 
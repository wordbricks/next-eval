// Shared type definitions for API routes

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

export type PromptType = 'slim' | 'flat' | 'hier';

export type Database = {
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
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export async function POST(request: Request) {
  try {
    const { htmlId, htmlContent } = await request.json();

    if (!htmlId || !htmlContent) {
      return NextResponse.json(
        { error: 'Missing htmlId or htmlContent' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseClient
      .from('next_eval_user_htmls') // Make sure 'html_documents' matches your table name
      .insert([{ id: htmlId, html: htmlContent }]);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('API error:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

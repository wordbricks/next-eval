import type { Database } from "@/app/api/types/databaseTypes";
import { createClient } from "@supabase/supabase-js";

export const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

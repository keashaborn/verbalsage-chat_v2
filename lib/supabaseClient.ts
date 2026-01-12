import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // stop background refresh loops that can crash the UI (Safari error you saw)
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: "vs_supabase_auth",
    },
  }
);

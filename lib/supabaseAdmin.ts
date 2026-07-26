import "server-only";

import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (client) return client;

  const url = String(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ).trim();
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();

  if (!url || !secretKey.startsWith("sb_secret_")) {
    throw new Error("Supabase administrator client is not configured.");
  }

  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("Supabase administrator client URL is invalid.");
  }

  client = createClient(parsedUrl.toString(), secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}

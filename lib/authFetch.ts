"use client";

import { supabase } from "@/lib/supabaseClient";

export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getSupabaseAccessToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function authFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(url, init);
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}

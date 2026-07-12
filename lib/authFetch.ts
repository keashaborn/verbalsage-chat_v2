"use client";

import { supabase } from "@/lib/supabaseClient";

const REFRESH_SKEW_SECONDS = 60;
let refreshAccessTokenPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token || null;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  const expiresAt = data.session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  if (!expiresAt || expiresAt > now + REFRESH_SKEW_SECONDS) {
    return data.session.access_token;
  }

  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = refreshAccessToken().finally(() => {
      refreshAccessTokenPromise = null;
    });
  }
  return await refreshAccessTokenPromise;
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

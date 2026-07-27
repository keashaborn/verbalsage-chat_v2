"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";

type Msg = { role: "user" | "assistant"; content: string; created_at?: string };

export function ThreadViewer() {
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function load(thread_id: string) {
    setLoading(true);
    try {
      const r = await authFetch(
        `/api/threads/${encodeURIComponent(thread_id)}/messages`,
      );
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as Msg[];
      setMsgs(Array.isArray(data) ? data : []);
    } catch {
      setMsgs([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await authFetch("/api/threads/active", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await response.text());
        const active = (await response.json()) as {
          thread_id?: string | null;
        };
        const tid = String(active?.thread_id || "").trim() || null;
        if (cancelled) return;
        setThreadId(tid);
        if (tid) await load(tid);
      } catch {
        if (!cancelled) {
          setThreadId(null);
          setMsgs([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!threadId) {
    return (
      <div className="mx-auto mt-20 max-w-[44rem] px-6 text-sm text-muted-foreground">
        Select a chat on the left, or click{" "}
        <span className="font-semibold">New Chat</span>.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[44rem] px-6 pt-6">
      {loading && (
        <div className="mb-4 text-xs text-muted-foreground">Loading…</div>
      )}

      <div className="space-y-6">
        {msgs.map((m, idx) => (
          <div
            key={idx}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <div
              className={
                m.role === "user"
                  ? "inline-block rounded-2xl bg-muted px-4 py-2 text-sm"
                  : "inline-block max-w-[42rem] text-sm leading-7 whitespace-pre-wrap"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

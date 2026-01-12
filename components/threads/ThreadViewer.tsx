"use client";

import * as React from "react";

type Msg = { role: "user" | "assistant"; content: string; created_at?: string };

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function ThreadViewer() {
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function load(thread_id: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/threads/${encodeURIComponent(thread_id)}/messages`);
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
    const tid = getCookie("vs_tid");
    setThreadId(tid);
    if (tid) load(tid);
  }, []);

  if (!threadId) {
    return (
      <div className="mx-auto mt-20 max-w-[44rem] px-6 text-sm text-muted-foreground">
        Select a chat on the left, or click <span className="font-semibold">New Chat</span>.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[44rem] px-6 pt-6">
      {loading && <div className="mb-4 text-xs text-muted-foreground">Loading…</div>}

      <div className="space-y-6">
        {msgs.map((m, idx) => (
          <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                m.role === "user"
                  ? "inline-block rounded-2xl bg-muted px-4 py-2 text-sm"
                  : "inline-block max-w-[42rem] whitespace-pre-wrap text-sm leading-7"
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

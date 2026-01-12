"use client";

import * as React from "react";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function Group({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="overflow-hidden rounded-xl border">
        <div className="divide-y">{children}</div>
      </div>
      {footer != null && <div className="px-1 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

function Row({
  left,
  right,
  children,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{left}</div>
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
      {children != null && <div className="mt-2">{children}</div>}
    </div>
  );
}

function ActionRow({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function FeedbackPanel() {
  const [fbText, setFbText] = React.useState<string>("");
  const [fbSending, setFbSending] = React.useState<boolean>(false);
  const [fbStatus, setFbStatus] = React.useState<string>("");

  async function sendFeedback() {
    const msg = fbText.trim();
    if (!msg) {
      setFbStatus("Missing feedback text.");
      return;
    }

    const thread_id = readCookie("vs_tid"); // optional

    setFbSending(true);
    setFbStatus("");
    try {
      const r = await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, thread_id }),
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) {
        setFbStatus(`HTTP ${r.status}: ${t.slice(0, 300)}`);
        return;
      }

      // Keep it readable; raw JSON is still useful.
      try {
        const j = JSON.parse(t);
        setFbStatus(`ok: ${JSON.stringify(j)}`);
      } catch {
        setFbStatus("ok");
      }

      setFbText("");
    } catch (e: any) {
      setFbStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setFbSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Sends operator feedback to Brains (<span className="font-semibold">/vantage/feedback</span>).
      </div>

      <Group
        title="Feedback"
        footer={
          <>
            Tip: include “tag this as …” to attach a label. If <code>vs_tid</code> exists, it is forwarded as{" "}
            <code>thread_id</code>.
          </>
        }
      >
        <Row left="Message">
          <textarea
            className="w-full rounded-lg border bg-background px-2 py-2 text-sm"
            rows={4}
            placeholder='Example: "that was helpful" or "tag this as fm_expansion"'
            value={fbText}
            onChange={(e) => setFbText(e.target.value)}
          />
        </Row>

        <ActionRow
          label={fbSending ? "Sending…" : "Send"}
          disabled={fbSending}
          onClick={sendFeedback}
        />

        {fbStatus ? (
          <Row left={<span className="text-xs text-muted-foreground whitespace-pre-wrap">{fbStatus}</span>} />
        ) : null}
      </Group>
    </div>
  );
}

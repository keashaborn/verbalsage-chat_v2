"use client";

import * as React from "react";

export type RealtimeVoiceOverlayState =
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

type Props = {
  open: boolean;
  state: RealtimeVoiceOverlayState;
  error?: string;
  captionsEnabled: boolean;
  caption?: {
    speaker: "You" | "Assistant";
    text: string;
  } | null;
  onToggleCaptions: () => void;
  onClose: () => void;
};

const STATUS_LABEL: Record<RealtimeVoiceOverlayState, string> = {
  connecting: "Connecting…",
  listening: "Listening",
  processing: "Preparing reply…",
  speaking: "Speaking",
  error: "Voice unavailable",
};

export function RealtimeVoiceOverlay({
  open,
  state,
  error = "",
  captionsEnabled,
  caption = null,
  onToggleCaptions,
  onClose,
}: Props) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh flex-col items-center justify-between bg-background/98 px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-foreground backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Voice conversation"
    >
      <div className="flex w-full justify-end gap-2">
        <button
          type="button"
          className={[
            "grid h-12 min-w-12 place-items-center rounded-full border px-3 text-sm font-semibold shadow-sm",
            captionsEnabled
              ? "border-foreground bg-foreground text-background"
              : "bg-background",
          ].join(" ")}
          onClick={onToggleCaptions}
          aria-label={
            captionsEnabled ? "Hide live captions" : "Show live captions"
          }
          aria-pressed={captionsEnabled}
          title={captionsEnabled ? "Hide captions" : "Show captions"}
        >
          CC
        </button>
        <button
          type="button"
          className="grid h-12 w-12 place-items-center rounded-full border bg-background text-2xl leading-none shadow-sm"
          onClick={onClose}
          aria-label="End voice conversation"
        >
          ×
        </button>
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center gap-8">
        <div
          className="vs-realtime-orb"
          data-realtime-state={state}
          aria-hidden="true"
        >
          <div className="vs-realtime-orb__halo" />
          <div className="vs-realtime-orb__symbol vs-realtime-orb__symbol--back" />
          <div className="vs-realtime-orb__symbol vs-realtime-orb__symbol--front" />
        </div>

        <div className="min-h-16 text-center">
          <div className="text-lg font-medium">{STATUS_LABEL[state]}</div>
          {state === "error" && error ? (
            <div className="mt-2 max-w-md text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        {captionsEnabled && caption?.text ? (
          <div
            className="max-h-36 w-full max-w-2xl overflow-y-auto rounded-2xl border bg-background/85 px-5 py-4 text-center shadow-sm backdrop-blur"
            role="log"
            aria-live="polite"
          >
            <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {caption.speaker}
            </div>
            <div className="text-base leading-relaxed">{caption.text}</div>
          </div>
        ) : null}
      </div>

      <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
        AI-generated voice · transcript saved to your governed chat history
      </div>
    </div>
  );
}

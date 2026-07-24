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
      aria-label="Realtime voice conversation"
    >
      <div className="flex w-full justify-end">
        <button
          type="button"
          className="grid h-12 w-12 place-items-center rounded-full border bg-background text-2xl leading-none shadow-sm"
          onClick={onClose}
          aria-label="End realtime voice conversation"
        >
          ×
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
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
      </div>

      <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
        AI-generated voice · transcript saved to your governed chat history
      </div>
    </div>
  );
}

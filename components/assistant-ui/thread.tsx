import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
  Volume2Icon,
} from "lucide-react";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";

import type { FC } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import * as m from "motion/react-m";

import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { Reasoning, ReasoningGroup } from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";

import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";

export const Thread: FC = () => {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root
          className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
          style={{
            ["--thread-max-width" as string]: "44rem",
          }}
        >
          <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-scroll px-4">
            {/* Empty thread: take up space above the composer so the composer stays bottom */}
            <ThreadPrimitive.If empty={true}>
              <div className="flex flex-1 items-center justify-center">
                <ThreadWelcome />
              </div>
            </ThreadPrimitive.If>

            {/* Non-empty thread: show messages and a little spacer */}
            <ThreadPrimitive.If empty={false}>
              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  EditComposer,
                  AssistantMessage,
                }}
              />
              <div className="min-h-8 grow" />
            </ThreadPrimitive.If>

            {/* Composer always at bottom */}
            <Composer />
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => null;

const ThreadSuggestions: FC = () => null;

const Composer: FC = () => {
  return (
    <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
      <ThreadScrollToBottom />
      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
        <ComposerPrimitive.AttachmentDropzone className="aui-composer-attachment-dropzone group/input-group flex w-full flex-col rounded-3xl border border-input bg-background px-1 pt-2 shadow-xs transition-[color,box-shadow] outline-none has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/50 data-[dragging=true]:border-dashed data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/50 dark:bg-background">
          <ComposerAttachments />
          <ComposerPrimitive.Input
            placeholder="Send a message..."
            className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0"
            rows={1}
            autoFocus
            aria-label="Message input"
          />
          <ComposerAction />
        </ComposerPrimitive.AttachmentDropzone>
      </ComposerPrimitive.Root>
    </div>
  );
};

const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
      <ComposerAddAttachment />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            className="aui-composer-send size-[34px] rounded-full p-1"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
            aria-label="Stop generating"
          >
            <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

function getLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type GrokVoice = "Ara" | "Rex" | "Sal" | "Eve" | "Leo";

let grokWs: WebSocket | null = null;
let grokCtx: AudioContext | null = null;
let grokGain: GainNode | null = null;
let grokNextTime = 0;
let grokSeq = 0;

function stripJsonQuotes(s: string): string {
  // handles values accidentally stored as JSON strings, e.g. "\"grok_realtime\""
  return s.replace(/^"+|"+$/g, "");
}

function lsGetRaw(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key);
    const s = (v ?? fallback).trim();
    const u = stripJsonQuotes(s).trim();
    return u || fallback;
  } catch {
    return fallback;
  }
}

function stopGrokPlaybackHard() {
  grokSeq++;

  try { grokWs?.close(); } catch { }
  grokWs = null;

  // Hard stop any queued audio by tearing down the AudioContext.
  if (grokCtx) {
    try { grokCtx.close(); } catch { }
  }
  grokCtx = null;
  grokGain = null;
  grokNextTime = 0;
}

function ensureGrokAudio(): AudioContext {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!Ctx) throw new Error("WebAudio not supported in this browser.");

  if (!grokCtx) {
    grokCtx = new Ctx();
    grokGain = grokCtx.createGain();
    grokGain.gain.value = 1;
    grokGain.connect(grokCtx.destination);
    grokNextTime = grokCtx.currentTime;
  }
  return grokCtx;
}

function b64ToU8(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pcm16leToF32(pcm: Uint8Array): Float32Array {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const n = Math.floor(pcm.byteLength / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = view.getInt16(i * 2, true);
    out[i] = Math.max(-1, Math.min(1, s / 32768));
  }
  return out;
}

function enqueuePcm16(pcm16: Uint8Array, sampleRate = 24000) {
  const ctx = ensureGrokAudio();
  const gain = grokGain;
  if (!gain) return;

  const f32 = pcm16leToF32(pcm16);
  const buf = ctx.createBuffer(1, f32.length, sampleRate);
  buf.getChannelData(0).set(f32);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(gain);

  const now = ctx.currentTime;
  let t = grokNextTime;
  if (t < now + 0.02) t = now + 0.02; // minimal jitter buffer
  src.start(t);

  grokNextTime = t + buf.duration;
}

async function fetchGrokWsToken(): Promise<string> {
  const r = await authFetch("/api/voice/ws-token", { method: "GET" });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok || !j?.token) throw new Error(j?.error || `ws-token HTTP ${r.status}`);
  return String(j.token);
}

async function speakViaGrok(text: string) {
  const voice = (lsGetRaw("vs_grok_voice", "Ara") as GrokVoice) || "Ara";
  const instructions = lsGetRaw("vs_grok_voice_instructions", "You are a helpful assistant.");
  const volume = Number(lsGetRaw("vs_grok_voice_volume", "1")) || 1;

  // Stop any previous stream/audio so the new utterance is clean.
  stopGrokPlaybackHard();
  const mySeq = grokSeq;

  const ctx = ensureGrokAudio();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => { });
  }
  if (grokGain) grokGain.gain.value = Math.max(0, Math.min(1, volume));

  const token = await fetchGrokWsToken();

  const proto = location.protocol === "https:" ? "wss" : "ws";
  const qs = new URLSearchParams({
    voice,
    token,
    turn: "none",
    in_rate: "24000",
    out_rate: "24000",
  });
  if (instructions.trim()) qs.set("instructions", instructions.trim());

  const wsUrl = `${proto}://${location.host}/ws/voice?${qs.toString()}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    grokWs = ws;

    ws.onopen = () => {
      if (mySeq !== grokSeq) return;

      ws.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      }));

      ws.send(JSON.stringify({
        type: "response.create",
        response: { modalities: ["audio"] },
      }));
    };

    ws.onmessage = (e) => {
      if (mySeq !== grokSeq) return;

      try {
        const ev = JSON.parse(String(e.data));
        const t = ev?.type;

        if (t === "response.output_audio.delta") {
          const b64 = String(ev?.delta ?? "");
          if (!b64) return;
          const u8 = b64ToU8(b64);
          if (u8.byteLength) enqueuePcm16(u8, 24000);
          return;
        }

        if (t === "response.done") {
          try { ws.close(); } catch { }
          if (grokWs === ws) grokWs = null;
          resolve();
          return;
        }

        if (t === "error") {
          try { ws.close(); } catch { }
          if (grokWs === ws) grokWs = null;
          reject(new Error(String(ev?.error || "grok realtime error")));
          return;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      if (mySeq !== grokSeq) return;
      reject(new Error("grok websocket error"));
    };

    ws.onclose = () => {
      if (mySeq !== grokSeq) return;
      if (grokWs === ws) grokWs = null;
      resolve(); // don’t hang if server closes without response.done
    };
  });
}


async function speakTextFromButton(btn: HTMLElement) {
  const root =
    btn.closest(".aui-assistant-message-root") ||
    btn.closest('[data-role="assistant"]');

  if (!root) return;

  const contentEl =
    root.querySelector("[data-vs-message-text]") ||
    root.querySelector(".aui-assistant-message-content");

  const text = (contentEl?.textContent || "").trim();
  if (!text) return;

  const cleaned = text.replace(/\bCopy\b|\bSpeak\b|\bRefresh\b/g, "").trim();
  if (!cleaned) return;

  // Route based on selected voice engine
  const engine = lsGetRaw("vs_voice_engine", "openai_tts");

  if (engine === "grok_realtime") {
    try {
      await speakViaGrok(cleaned);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
    return;
  }

  // Default: OpenAI TTS (/api/tts)
  const voice = String(getLS<string>("vs_voice", "sage")).trim();
  const model = String(getLS<string>("vs_voice_model", "gpt-4o-mini-tts")).trim();
  const speed = Number(getLS<number>("vs_voice_speed", 1.0)) || 1.0;

  const r = await authFetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleaned, voice, speed, model }),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    alert(`TTS error: HTTP ${r.status}\n${err}`);
    return;
  }

  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);

  a.addEventListener("ended", () => {
    try { URL.revokeObjectURL(url); } catch { }
  });

  await a.play();
}

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 last:mb-24"
        data-role="assistant"
      >
        <div
          className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground"
          data-vs-message-text
        >
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              Reasoning: Reasoning,
              ReasoningGroup: ReasoningGroup,
              tools: { Fallback: ToolFallback },
            }}
          />
          <MessageError />
        </div>

        <div className="aui-assistant-message-footer mt-2 ml-2 flex">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <TooltipIconButton
        tooltip="Speak"
        onClick={(e) => {
          e.preventDefault();
          speakTextFromButton(e.currentTarget);
        }}
      >
        <Volume2Icon />
      </TooltipIconButton>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-user-message-root mx-auto grid w-full max-w-[var(--thread-max-width)] animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
        data-role="user"
      >
        <UserMessageAttachments />

        <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
          <div className="aui-user-message-content rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground">
            <MessagePrimitive.Parts />
          </div>
          <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
            <UserActionBar />
          </div>
        </div>

        <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none"
          autoFocus
        />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-xs text-muted-foreground",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch, authFetchJson } from "@/lib/authFetch";
import {
  ChevronDown,
  Copy,
  RefreshCw,
  Volume2,
  Loader2,
  Square,
  Check,
} from "lucide-react";
import { MarkdownMessage } from "@/components/shared/MarkdownMessage";
import {
  useGovernedRealtimeVoice,
  type GovernedVoiceTurnContext,
} from "@/hooks/useGovernedRealtimeVoice";
import { VOICE_TURN_HEADER } from "@/lib/voiceObservability";
import {
  decodeResponseInspectionHeader,
  ResponseTrace,
  type ResponseInspection,
} from "@/components/threads/ResponseTrace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  hasAcceptedVoicePrivacyNotice,
  storeVoicePrivacyNoticeAcceptance,
  VOICE_PRIVACY_NOTICE_VERSION,
} from "@/lib/voicePrivacy";
import { splitForSpeech } from "@/lib/voiceSpeech";

type ChatResult = {
  text: string;
  inspect: ResponseInspection | null;
  inspect_error: string | null;
  answerId: string;
  requestId: string;
};

type VoiceSpeechMetrics = {
  status: "completed" | "failed" | "cancelled";
  firstAudioMs: number | null;
  firstAudioAtMs: number | null;
  totalMs: number;
  segmentCount: number;
  model: string;
  voice: string;
  requestIds: string[];
  providerRequestIds: string[];
};

type VoiceSendOptions = {
  speakReply?: boolean;
  shouldSpeak?: () => boolean;
  voiceTurn?: GovernedVoiceTurnContext;
};

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  v?: number;
  inspect?: ResponseInspection | null;
  inspect_error?: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return authFetchJson<T>(url, init);
}

function getLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;

    // Preferred format: JSON-encoded
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Back-compat for legacy raw localStorage values.
      if (typeof fallback === "string") return raw as any;
      if (typeof fallback === "number") return Number(raw) as any;
      if (typeof fallback === "boolean") return (raw === "true") as any;
      return fallback;
    }
  } catch {
    return fallback;
  }
}

async function recordVoiceTurnTrace(payload: Record<string, unknown>) {
  try {
    await authFetch("/api/voice/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Observability is non-blocking; it must never break the conversation.
  }
}

export function BrainsChatPane() {
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null,
  );
  const [editingText, setEditingText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [voicePrivacyOpen, setVoicePrivacyOpen] = React.useState(false);
  const [voicePrivacySaving, setVoicePrivacySaving] = React.useState(false);
  const [voicePrivacyError, setVoicePrivacyError] = React.useState("");
  const governedVoice = useGovernedRealtimeVoice();

  const voiceStatus = governedVoice.status;
  const voiceIsConnecting =
    voiceStatus === "requesting" || voiceStatus === "connecting";
  const voiceIsActive =
    voiceStatus === "listening" ||
    voiceStatus === "speaking" ||
    voiceStatus === "transcribing" ||
    voiceStatus === "responding";
  const voiceHasError = voiceStatus === "error";
  const voiceConversationEpochRef = React.useRef(0);

  const voiceButtonLabel =
    voiceStatus === "requesting"
      ? "Requesting microphone…"
      : voiceStatus === "connecting"
        ? "Connecting…"
        : voiceIsActive
          ? "End conversation"
          : "Talk";

  const voiceStatusLabel =
    voiceStatus === "requesting"
      ? "Requesting microphone…"
      : voiceStatus === "connecting"
        ? "Preparing secure transcription…"
        : voiceStatus === "listening"
          ? "Listening"
          : voiceStatus === "speaking"
            ? "Listening to you"
            : voiceStatus === "transcribing"
              ? "Transcribing…"
              : voiceStatus === "responding"
                ? "Preparing and speaking reply…"
                : voiceHasError
                  ? governedVoice.lastError
                    ? `Voice error: ${governedVoice.lastError}`
                    : "Voice error"
                  : "Voice off";
  const didAutoScrollForThreadRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function refreshAdminFlag() {
      try {
        const { data } = await supabase.auth.getUser();
        const role = (data?.user as any)?.app_metadata?.role;
        const nextIsAdmin =
          role === "owner" || role === "admin" || role === "developer";
        if (!mounted) return;

        setIsAdmin(nextIsAdmin);

        // Clear stale Inspector payloads when switching from an admin account
        // to a non-admin account in the same browser session.
        if (!nextIsAdmin) {
          setMsgs((prev) =>
            prev.map((m) =>
              m.inspect || m.inspect_error
                ? { ...m, inspect: null, inspect_error: null }
                : m,
            ),
          );
        }
      } catch {
        if (mounted) {
          setIsAdmin(false);
          setMsgs((prev) =>
            prev.map((m) =>
              m.inspect || m.inspect_error
                ? { ...m, inspect: null, inspect_error: null }
                : m,
            ),
          );
        }
      }
    }

    void refreshAdminFlag();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshAdminFlag();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const [text, setText] = React.useState("");

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  // -----------------------------
  // Copy feedback (per message)
  // -----------------------------
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);
  const copiedTimerRef = React.useRef<number | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const copiedKeyTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (copiedTimerRef.current != null)
        window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    };
  }, []);

  async function copyText(t: string, idx?: number, key?: string) {
    try {
      await navigator.clipboard.writeText(t);

      // clear timers
      if (copiedTimerRef.current != null)
        window.clearTimeout(copiedTimerRef.current);
      if (copiedKeyTimerRef.current != null)
        window.clearTimeout(copiedKeyTimerRef.current);

      if (typeof idx === "number") {
        setCopiedIdx(idx);
        copiedTimerRef.current = window.setTimeout(
          () => setCopiedIdx(null),
          900,
        );
      } else if (key) {
        setCopiedKey(key);
        copiedKeyTimerRef.current = window.setTimeout(
          () => setCopiedKey(null),
          900,
        );
      }
    } catch {
      // ignore
    }
  }

  // -----------------------------
  // TTS: single-flight + UI state
  // -----------------------------
  const ttsAbortRef = React.useRef<AbortController | null>(null);
  const ttsPlaybackResolveRef = React.useRef<(() => void) | null>(null);
  const ttsEpochRef = React.useRef<number>(0);

  // WebAudio fallback (Safari can block HTMLAudioElement.play() after async fetch)
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  const [freeformDebug, setFreeformDebug] = React.useState<{
    transcript: string;
    reply: string;
    ms: number;
    inspect: ResponseInspection | null;
    inspect_error: string | null;
  } | null>(null);

  // Realtime is transcription-only; response generation remains backend-governed.

  const audioNodesRef = React.useRef<Set<AudioBufferSourceNode>>(new Set());

  // Screen Wake Lock (best-effort; not supported on all iOS/Safari versions)
  const wakeLockRef = React.useRef<any>(null);
  // Keep-awake video (best-effort)
  const keepAwakeVideoRef = React.useRef<HTMLVideoElement | null>(null);

  const [ttsLoadingIdx, setTtsLoadingIdx] = React.useState<number | null>(null);
  const [ttsPlayingIdx, setTtsPlayingIdx] = React.useState<number | null>(null);

  function bumpTtsEpoch() {
    ttsEpochRef.current += 1;
    return ttsEpochRef.current;
  }

  function ensureAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctx) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    return audioCtxRef.current;
  }

  function unlockAudioForSafari() {
    try {
      const ctx = ensureAudioContext();
      if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
    } catch {}
  }

  async function wakeLockStart() {
    try {
      const wl = (navigator as any)?.wakeLock;
      if (!wl || typeof wl.request !== "function") return;

      // Avoid spamming request() if we already hold one.
      if (wakeLockRef.current) return;

      const sentinel = await wl.request("screen");
      wakeLockRef.current = sentinel;

      // If the UA releases it, clear our ref.
      sentinel?.addEventListener?.("release", () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
      });
    } catch {
      // ignore
    }
  }

  async function wakeLockStop() {
    try {
      const s = wakeLockRef.current;
      if (s && typeof s.release === "function") await s.release();
    } catch {
      // ignore
    } finally {
      wakeLockRef.current = null;
    }
  }

  function keepAwakeStart() {
    try {
      void wakeLockStart();
      const v = keepAwakeVideoRef.current;
      if (!v) return;
      v.muted = true;
      v.loop = true;
      (v as any).playsInline = true;
      const cur = String(v.currentSrc || v.src || "");
      // Use your API media route (you confirmed it returns 200)
      if (!cur.includes("/api/media/awake")) v.src = "/api/media/awake";
      const p = v.play();
      if (p && typeof (p as any).catch === "function")
        (p as Promise<void>).catch(() => {});
    } catch {}
  }

  function keepAwakeStop() {
    try {
      void wakeLockStop();
      const v = keepAwakeVideoRef.current;
      if (!v) return;
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch {}
  }

  function stopTTS() {
    bumpTtsEpoch();
    keepAwakeStop();

    if (ttsAbortRef.current) {
      try {
        ttsAbortRef.current.abort();
      } catch {}
      ttsAbortRef.current = null;
    }

    for (const source of audioNodesRef.current) {
      try {
        source.stop();
      } catch {}
      try {
        source.disconnect();
      } catch {}
    }
    audioNodesRef.current.clear();

    const resolvePlayback = ttsPlaybackResolveRef.current;
    ttsPlaybackResolveRef.current = null;
    resolvePlayback?.();

    setTtsLoadingIdx(null);
    setTtsPlayingIdx(null);
  }

  React.useEffect(() => {
    return () => {
      bumpTtsEpoch();
      keepAwakeStop();

      if (ttsAbortRef.current) {
        try {
          ttsAbortRef.current.abort();
        } catch {}
        ttsAbortRef.current = null;
      }

      for (const source of audioNodesRef.current) {
        try {
          source.stop();
        } catch {}
        try {
          source.disconnect();
        } catch {}
      }
      audioNodesRef.current.clear();

      const resolvePlayback = ttsPlaybackResolveRef.current;
      ttsPlaybackResolveRef.current = null;
      resolvePlayback?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function speak(
    textToSpeak: string,
    idx: number,
    voiceTurnId?: string,
  ): Promise<VoiceSpeechMetrics | null> {
    const t = (textToSpeak || "").trim();
    if (!t) return null;
    const chunks = splitForSpeech(t);
    if (!chunks.length) return null;

    // ignore repeated taps while loading (prevents spam)
    if (ttsLoadingIdx === idx) return null;

    // tap again while playing stops
    if (ttsPlayingIdx === idx) {
      stopTTS();
      return null;
    }

    // replace any existing playback
    stopTTS();
    const epoch = bumpTtsEpoch();

    // best-effort: keep device awake longer
    keepAwakeStart();
    unlockAudioForSafari();

    setTtsLoadingIdx(idx);
    setTtsPlayingIdx(null);

    try {
      localStorage.setItem("vs_voice_engine", "openai_tts");
    } catch {}

    const voice = String(getLS<string>("vs_voice", "marin")).trim();
    const model = String(
      getLS<string>("vs_voice_model", "gpt-4o-mini-tts"),
    ).trim();
    const speed = Number(getLS<number>("vs_voice_speed", 1.0)) || 1.0;

    const ac = new AbortController();
    ttsAbortRef.current = ac;
    const ttsStartedAt = performance.now();
    let firstAudioAtMs: number | null = null;
    const requestIds: string[] = [];
    const providerRequestIds: string[] = [];

    const metrics = (
      status: VoiceSpeechMetrics["status"],
    ): VoiceSpeechMetrics => ({
      status,
      firstAudioMs:
        firstAudioAtMs == null
          ? null
          : Math.max(0, Math.round(firstAudioAtMs - ttsStartedAt)),
      firstAudioAtMs,
      totalMs: Math.max(0, Math.round(performance.now() - ttsStartedAt)),
      segmentCount: chunks.length,
      model,
      voice,
      requestIds,
      providerRequestIds,
    });

    try {
      const requestChunk = async (text: string, chunkIndex: number) => {
        const response = await authFetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(voiceTurnId ? { [VOICE_TURN_HEADER]: voiceTurnId } : {}),
            "x-vs-tts-segment-index": String(chunkIndex),
            "x-vs-tts-segment-count": String(chunks.length),
          },
          body: JSON.stringify({ text, voice, speed, model }),
          signal: ac.signal,
        });
        if (!response.ok) throw new Error(await response.text());
        if (
          voiceTurnId &&
          response.headers.get(VOICE_TURN_HEADER) !== voiceTurnId
        ) {
          throw new Error("Voice turn correlation was not preserved by TTS.");
        }
        const requestId = String(response.headers.get("x-request-id") || "");
        const providerRequestId = String(
          response.headers.get("x-vs-provider-request-id") || "",
        );
        if (requestId) requestIds.push(requestId.slice(0, 128));
        if (providerRequestId) {
          providerRequestIds.push(providerRequestId.slice(0, 128));
        }
        const audioFormat = response.headers.get("x-vs-audio-format");
        const sampleRate = Number(
          response.headers.get("x-vs-audio-sample-rate") || "",
        );
        if (audioFormat !== "pcm_s16le" || sampleRate !== 24000) {
          await response.body?.cancel().catch(() => {});
          throw new Error("The voice service returned an unsupported format.");
        }
        if (!response.body) {
          throw new Error("The voice service returned no audio stream.");
        }
        return response;
      };

      const playChunk = async (response: Response) => {
        if (ttsEpochRef.current !== epoch) return;
        const context = ensureAudioContext();
        if (!context) throw new Error("Voice playback is unavailable.");
        if (context.state === "suspended") {
          await context.resume().catch(() => {});
        }

        const reader = response.body!.getReader();
        const sampleRate = 24000;
        const minimumScheduleBytes = 4096;
        let pendingBytes = new Uint8Array(0);
        let nextStartAt = 0;
        let lastSource: AudioBufferSourceNode | null = null;
        let streamComplete = false;
        const endedSources = new WeakSet<AudioBufferSourceNode>();

        let settlePlayback: () => void = () => {};
        const playbackFinished = new Promise<void>((resolve) => {
          let settled = false;
          settlePlayback = () => {
            if (settled) return;
            settled = true;
            if (ttsPlaybackResolveRef.current === settlePlayback) {
              ttsPlaybackResolveRef.current = null;
            }
            resolve();
          };
          ttsPlaybackResolveRef.current = settlePlayback;
        });

        const schedulePcm = (bytes: Uint8Array) => {
          if (!bytes.length || ttsEpochRef.current !== epoch) return;
          const samples = new Float32Array(bytes.length / 2);
          for (let offset = 0; offset < bytes.length; offset += 2) {
            let value = bytes[offset] | (bytes[offset + 1] << 8);
            if (value >= 0x8000) value -= 0x10000;
            samples[offset / 2] = value / 0x8000;
          }

          const buffer = context.createBuffer(1, samples.length, sampleRate);
          buffer.copyToChannel(samples, 0);
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          audioNodesRef.current.add(source);
          lastSource = source;

          const now = context.currentTime;
          if (nextStartAt <= now) nextStartAt = now + 0.06;
          const startAt = nextStartAt;
          nextStartAt += buffer.duration;
          source.onended = () => {
            endedSources.add(source);
            audioNodesRef.current.delete(source);
            try {
              source.disconnect();
            } catch {}
            if (streamComplete && source === lastSource) settlePlayback();
          };

          if (firstAudioAtMs == null) {
            firstAudioAtMs =
              performance.now() + Math.max(0, startAt - now) * 1000;
            setTtsLoadingIdx(null);
            setTtsPlayingIdx(idx);
          }
          source.start(startAt);
        };

        try {
          while (true) {
            if (ttsEpochRef.current !== epoch || ac.signal.aborted) {
              await reader.cancel().catch(() => {});
              settlePlayback();
              return;
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (!value?.length) continue;

            const combined = new Uint8Array(pendingBytes.length + value.length);
            combined.set(pendingBytes);
            combined.set(value, pendingBytes.length);
            if (combined.length >= minimumScheduleBytes) {
              const completeLength = combined.length - (combined.length % 2);
              schedulePcm(combined.slice(0, completeLength));
              pendingBytes = combined.slice(completeLength);
            } else {
              pendingBytes = combined;
            }
          }

          if (pendingBytes.length % 2 !== 0) {
            throw new Error("The voice service returned incomplete PCM audio.");
          }
          schedulePcm(pendingBytes);
          streamComplete = true;
          if (!lastSource) {
            settlePlayback();
            throw new Error(
              "The voice service returned an empty audio stream.",
            );
          }
          if (endedSources.has(lastSource)) settlePlayback();
          await playbackFinished;
        } finally {
          await reader.cancel().catch(() => {});
          if (!streamComplete) settlePlayback();
        }
      };

      let pending = requestChunk(chunks[0], 0);
      for (let index = 0; index < chunks.length; index += 1) {
        if (ttsEpochRef.current !== epoch) return metrics("cancelled");
        if (index > 0) setTtsLoadingIdx(idx);
        const response = await pending;
        const following =
          index + 1 < chunks.length
            ? requestChunk(chunks[index + 1], index + 1)
            : null;
        await playChunk(response);
        if (ttsEpochRef.current !== epoch) return metrics("cancelled");
        if (following) pending = following;
      }
      return metrics("completed");
    } catch (e: any) {
      if (e?.name === "AbortError") return metrics("cancelled");
      console.error(e);
      alert(e?.message || String(e));
      stopTTS();
      return metrics("failed");
    } finally {
      if (ttsEpochRef.current === epoch) {
        keepAwakeStop();
        setTtsPlayingIdx(null);
      }
      if (ttsEpochRef.current === epoch) setTtsLoadingIdx(null);
      if (ttsAbortRef.current === ac) ttsAbortRef.current = null;
    }
  }

  // -----------------------------
  // Threads / messages
  // -----------------------------
  async function loadActiveThread(): Promise<string | null> {
    try {
      const active = await fetchJson<{ thread_id: string | null }>(
        "/api/threads/active",
      );
      setThreadId(active.thread_id);
      return active.thread_id;
    } catch {
      setThreadId(null);
      return null;
    }
  }

  function lastAssistantIndex(arr: Msg[]) {
    for (let i = arr.length - 1; i >= 0; i--)
      if (arr[i].role === "assistant") return i;
    return -1;
  }

  function startEditingMessage(m: Msg) {
    const mid = String(m.id || "").trim();
    if (!mid) {
      alert(
        "This message has no saved message id yet. Reload the thread, then edit it.",
      );
      return;
    }
    setEditingMessageId(mid);
    setEditingText(m.content || "");
  }

  async function loadMessages(
    tid: string,
    attach?: {
      inspect: ResponseInspection | null;
      inspect_error: string | null;
    },
  ) {
    setLoading(true);
    try {
      const data = await fetchJson<Msg[]>(
        `/api/threads/${encodeURIComponent(tid)}/messages`,
      );
      const normalized = (Array.isArray(data) ? data : []).map((m) =>
        m.role === "assistant" ? { ...m, v: 1 } : m,
      );

      if (isAdmin && attach && (attach.inspect || attach.inspect_error)) {
        const idx = lastAssistantIndex(normalized);
        if (idx >= 0) {
          normalized[idx] = {
            ...normalized[idx],
            inspect: attach.inspect,
            inspect_error: attach.inspect_error,
          };
        }
      }

      setMsgs(normalized);
      requestAnimationFrame(() => scrollToBottom("auto"));
    } catch {
      // keep UI
    } finally {
      setLoading(false);
    }
  }

  async function ensureThread(): Promise<string> {
    if (threadId) return threadId;

    const r = await authFetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New chat" }),
    });
    if (!r.ok) throw new Error(await r.text());

    const active = await fetchJson<{ thread_id: string | null }>(
      "/api/threads/active",
    );
    if (!active.thread_id)
      throw new Error("New chat created, but no active thread id found.");

    setThreadId(active.thread_id);
    setMsgs([]);
    return active.thread_id;
  }

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const tid = await loadActiveThread();
      if (tid && mounted) await loadMessages(tid);
    })();

    const onSelect = (e: any) => {
      stopTTS();
      const tid = e?.detail?.thread_id || null;
      setThreadId(tid);
      setMsgs([]);
      if (tid) loadMessages(tid);
    };

    window.addEventListener("vs_active_thread", onSelect);
    return () => {
      mounted = false;
      window.removeEventListener("vs_active_thread", onSelect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callChat(
    input: string,
    tid: string,
    regen = false,
    noStore = false,
    voiceTurnId?: string,
  ): Promise<ChatResult> {
    const r = await authFetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(voiceTurnId ? { [VOICE_TURN_HEADER]: voiceTurnId } : {}),
      },
      body: JSON.stringify({ input, thread_id: tid, regen, noStore }),
    });
    const responseText = await r.text();
    if (!r.ok) throw new Error(responseText);
    if (voiceTurnId && r.headers.get(VOICE_TURN_HEADER) !== voiceTurnId) {
      throw new Error("Voice turn correlation was not preserved by chat.");
    }
    return {
      text: responseText,
      answerId: String(r.headers.get("X-VS-Answer-Id") || ""),
      requestId: String(r.headers.get("x-request-id") || ""),
      ...decodeResponseInspectionHeader(
        r.headers.get("X-VS-Inspection"),
        r.headers.get("X-VS-Inspection-Status"),
      ),
    };
  }

  async function truncateThreadFromMessage(
    tid: string,
    messageId: string,
  ): Promise<void> {
    const r = await authFetch(
      `/api/threads/${encodeURIComponent(tid)}/messages/${encodeURIComponent(messageId)}/truncate`,
      { method: "DELETE" },
    );
    if (!r.ok) throw new Error(await r.text());
  }

  async function regenerateLast() {
    stopTTS();
    const lastUser =
      [...msgs]
        .reverse()
        .find((m) => m.role === "user")
        ?.content?.trim() || "";
    if (!lastUser) return;

    let tid = threadId;
    if (!tid) tid = await ensureThread();

    setSending(true);
    try {
      const reply = await callChat(lastUser, tid!, true);

      setMsgs((prev) => {
        const idx = lastAssistantIndex(prev);
        requestAnimationFrame(() => scrollToBottom("smooth"));
        if (idx < 0) {
          return [
            ...prev,
            {
              role: "assistant",
              content: reply.text,
              v: 1,
              inspect: reply.inspect,
              inspect_error: reply.inspect_error,
            },
          ];
        }

        const next = prev.slice();
        const curV = Number(next[idx].v || 1);
        next[idx] = {
          ...next[idx],
          content: reply.text,
          v: curV + 1,
          inspect: reply.inspect,
          inspect_error: reply.inspect_error,
        };
        return next;
      });
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  async function startListening() {
    stopTTS();
    unlockAudioForSafari();
    voiceConversationEpochRef.current += 1;
    const conversationEpoch = voiceConversationEpochRef.current;
    try {
      await governedVoice.start({
        onTranscript: async (transcript, voiceTurn) => {
          await sendMessage(transcript, {
            speakReply: true,
            voiceTurn,
            shouldSpeak: () =>
              voiceConversationEpochRef.current === conversationEpoch,
          });
        },
        onTranscriptionFailure: async (voiceTurn) => {
          await recordVoiceTurnTrace({
            voice_turn_id: voiceTurn.voiceTurnId,
            status: "failed",
            failure_stage: "transcription",
            speech_ms: voiceTurn.speechMs,
            audio_bytes: voiceTurn.audioBytes,
            transcription_ms: voiceTurn.transcriptionMs,
            total_turn_ms: Math.max(
              0,
              Math.round(performance.now() - voiceTurn.turnStartedAtMs),
            ),
            transcription_request_id: voiceTurn.transcriptionRequestId,
            transcription_provider_request_id:
              voiceTurn.transcriptionProviderRequestId,
          });
        },
      });
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  function handleVoiceButton() {
    if (voiceIsActive) {
      void stopListeningAndRespond();
      return;
    }
    if (voiceIsConnecting) return;
    if (!hasAcceptedVoicePrivacyNotice()) {
      setVoicePrivacyError("");
      setVoicePrivacyOpen(true);
      return;
    }
    void startListening();
  }

  async function acceptVoicePrivacyNotice() {
    if (voicePrivacySaving) return;
    setVoicePrivacySaving(true);
    setVoicePrivacyError("");
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          vs_voice_privacy_notice_version: VOICE_PRIVACY_NOTICE_VERSION,
          vs_voice_privacy_notice_acknowledged_at: new Date().toISOString(),
        },
      });
      if (error) throw error;
      storeVoicePrivacyNoticeAcceptance();
      setVoicePrivacyOpen(false);
      await startListening();
    } catch (error: any) {
      setVoicePrivacyError(
        String(error?.message || "Could not save voice privacy choice."),
      );
    } finally {
      setVoicePrivacySaving(false);
    }
  }

  async function stopListeningAndRespond() {
    voiceConversationEpochRef.current += 1;
    governedVoice.stop();
    stopTTS();
  }

  async function sendMessage(
    overrideText?: string,
    options: VoiceSendOptions = {},
  ) {
    stopTTS();
    const msg = String(
      overrideText ?? (editingMessageId ? editingText : text),
    ).trim();
    if (!msg || sending) return;

    const lower = msg.toLowerCase();

    // Only treat regen as a command when the user typed it (not when it came from mic STT)
    if (overrideText == null && (lower === "regenerate" || lower === "regen")) {
      setText("");
      await regenerateLast();
      return;
    }

    const editMessageId = editingMessageId;
    const isEditing = !!editMessageId;

    setSending(true);
    setText("");
    if (editingMessageId) {
      setEditingMessageId(null);
      setEditingText("");
    }

    let tid: string;
    try {
      tid = await ensureThread();

      if (isEditing && editMessageId) {
        await truncateThreadFromMessage(tid, editMessageId);

        setMsgs((prev) => {
          const idx = prev.findIndex((m) => m.id === editMessageId);
          if (idx < 0) return prev;
          return prev.slice(0, idx);
        });
      }
    } catch (e: any) {
      alert(e?.message || String(e));
      setSending(false);
      return;
    }

    setMsgs((prev) => [...prev, { role: "user", content: msg }]);

    const responseStartedAt = performance.now();
    try {
      const reply = await callChat(
        msg,
        tid,
        false,
        false,
        options.voiceTurn?.voiceTurnId,
      );
      const responseMs = Math.max(
        0,
        Math.round(performance.now() - responseStartedAt),
      );

      void (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data?.session?.access_token;
          if (!token) return;

          const r = await fetch(
            `/api/threads/${encodeURIComponent(tid)}/auto-title`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ input: msg }),
            },
          );

          if (r.ok) window.dispatchEvent(new Event("vs_threads_refresh"));
        } catch {
          // Auto-title is non-critical; chat should never fail because naming failed.
        }
      })();

      setMsgs((prev): Msg[] => {
        const next: Msg[] = [
          ...prev,
          {
            role: "assistant",
            content: reply.text,
            v: 1,
            inspect: reply.inspect,
            inspect_error: reply.inspect_error,
          },
        ];
        const idx = next.length - 1;

        return next;
      });

      window.dispatchEvent(new Event("vs_threads_refresh"));
      await loadMessages(tid, {
        inspect: reply.inspect,
        inspect_error: reply.inspect_error,
      });
      let speechMetrics: VoiceSpeechMetrics | null = null;
      if (options.speakReply && (options.shouldSpeak?.() ?? true)) {
        speechMetrics = await speak(
          reply.text,
          Number.MAX_SAFE_INTEGER,
          options.voiceTurn?.voiceTurnId,
        );
      }
      if (options.voiceTurn) {
        const turn = options.voiceTurn;
        const traceStatus = speechMetrics?.status || "cancelled";
        await recordVoiceTurnTrace({
          voice_turn_id: turn.voiceTurnId,
          thread_id: tid,
          answer_id: reply.answerId,
          status: traceStatus,
          failure_stage:
            traceStatus === "failed"
              ? "tts"
              : traceStatus === "completed"
                ? "none"
                : "tts",
          speech_ms: turn.speechMs,
          audio_bytes: turn.audioBytes,
          transcription_ms: turn.transcriptionMs,
          response_ms: responseMs,
          tts_first_audio_ms: speechMetrics?.firstAudioMs,
          speech_to_first_audio_ms:
            speechMetrics?.firstAudioAtMs == null
              ? null
              : Math.max(
                  0,
                  Math.round(
                    speechMetrics.firstAudioAtMs - turn.turnStartedAtMs,
                  ),
                ),
          tts_total_ms: speechMetrics?.totalMs,
          total_turn_ms: Math.max(
            0,
            Math.round(performance.now() - turn.turnStartedAtMs),
          ),
          tts_segment_count: speechMetrics?.segmentCount || 0,
          transcription_provider: turn.transcriptionProvider,
          transcription_model: turn.transcriptionModel,
          transcription_language: turn.transcriptionLanguage,
          transcription_confidence_token_count:
            turn.transcriptionConfidenceTokenCount,
          transcription_confidence_mean_logprob:
            turn.transcriptionConfidenceMeanLogprob,
          transcription_confidence_minimum_logprob:
            turn.transcriptionConfidenceMinimumLogprob,
          transcription_low_confidence_token_count:
            turn.transcriptionLowConfidenceTokenCount,
          transcription_request_id: turn.transcriptionRequestId,
          transcription_provider_request_id:
            turn.transcriptionProviderRequestId,
          response_request_id: reply.requestId,
          tts_model: speechMetrics?.model || "",
          tts_voice: speechMetrics?.voice || "",
          tts_request_ids: speechMetrics?.requestIds || [],
          tts_provider_request_ids: speechMetrics?.providerRequestIds || [],
        });
      }
    } catch (e: any) {
      if (options.voiceTurn) {
        const turn = options.voiceTurn;
        await recordVoiceTurnTrace({
          voice_turn_id: turn.voiceTurnId,
          thread_id: tid,
          status: "failed",
          failure_stage: "response",
          speech_ms: turn.speechMs,
          audio_bytes: turn.audioBytes,
          transcription_ms: turn.transcriptionMs,
          response_ms: Math.max(
            0,
            Math.round(performance.now() - responseStartedAt),
          ),
          total_turn_ms: Math.max(
            0,
            Math.round(performance.now() - turn.turnStartedAtMs),
          ),
          transcription_provider: turn.transcriptionProvider,
          transcription_model: turn.transcriptionModel,
          transcription_language: turn.transcriptionLanguage,
          transcription_confidence_token_count:
            turn.transcriptionConfidenceTokenCount,
          transcription_confidence_mean_logprob:
            turn.transcriptionConfidenceMeanLogprob,
          transcription_confidence_minimum_logprob:
            turn.transcriptionConfidenceMinimumLogprob,
          transcription_low_confidence_token_count:
            turn.transcriptionLowConfidenceTokenCount,
          transcription_request_id: turn.transcriptionRequestId,
          transcription_provider_request_id:
            turn.transcriptionProviderRequestId,
        });
      }
      alert(e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  // Scroll tracking
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const margin = 80;
      const delta = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(delta <= margin);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const margin = 80;
    const delta = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(delta <= margin);
  }, [msgs.length]);

  // If user is already at bottom, keep pinned on new messages (normal chat behavior).
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!atBottom) return;
    requestAnimationFrame(() => {
      const el2 = scrollRef.current;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
    });
  }, [msgs.length, atBottom]);

  // When switching threads (or first load), snap to bottom once after messages render.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Only do the forced snap once per thread id.
    if (!threadId) return;
    if (didAutoScrollForThreadRef.current === threadId) return;

    // Defer until after paint so scrollHeight is correct.
    requestAnimationFrame(() => {
      const el2 = scrollRef.current;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
      didAutoScrollForThreadRef.current = threadId;
    });
  }, [threadId, msgs.length]);

  const lastAIdx = lastAssistantIndex(msgs);

  return (
    <div className="flex h-full flex-col">
      {/* keep-awake video (hidden) */}
      <video
        ref={keepAwakeVideoRef}
        muted
        playsInline
        loop
        preload="auto"
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          opacity: 0,
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
      />

      <div
        ref={scrollRef}
        className="mx-auto w-full max-w-[44rem] min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pt-6 pb-[calc(10.5rem+env(safe-area-inset-bottom))]"
      >
        {!threadId && (
          <div className="mb-6 text-sm text-muted-foreground">
            Start typing to create a new chat.
          </div>
        )}
        {loading && (
          <div className="mb-4 text-xs text-muted-foreground">Loading…</div>
        )}

        <div className="space-y-6">
          {msgs.map((m, idx) => {
            const inspect = m.inspect || null;

            const isTtsLoading = ttsLoadingIdx === idx;
            const isTtsPlaying = ttsPlayingIdx === idx;
            const ttsBusy = ttsLoadingIdx != null || ttsPlayingIdx != null;
            const disableSpeak = ttsBusy && !isTtsLoading && !isTtsPlaying;

            const isCopied = copiedIdx === idx;

            return (
              <div
                key={idx}
                className={m.role === "user" ? "text-left" : "text-left"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "inline-block rounded-2xl bg-muted px-4 py-2 text-sm"
                      : "block max-w-full min-w-0 overflow-hidden text-sm leading-7"
                  }
                >
                  {m.role === "assistant" ? (
                    <MarkdownMessage>{m.content}</MarkdownMessage>
                  ) : (
                    m.content
                  )}
                </div>

                {m.role === "user" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted"
                      onClick={() => startEditingMessage(m)}
                      aria-label="Edit message"
                      title="Edit message"
                    >
                      ✎
                    </button>

                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted"
                      onClick={() => copyText(m.content, idx)}
                      aria-label="Copy message"
                      title="Copy message"
                    >
                      ⧉
                    </button>
                  </div>
                )}

                {m.role === "assistant" && (
                  <>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <button
                        className={[
                          "inline-flex items-center justify-center rounded-md p-3 hover:bg-muted disabled:opacity-50 sm:p-2",
                          isCopied ? "bg-muted" : "",
                        ].join(" ")}
                        onClick={() => copyText(m.content, idx)}
                        aria-label={isCopied ? "Copied" : "Copy"}
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {isCopied ? "Copied" : "Copy"}
                        </span>
                      </button>

                      <button
                        className={[
                          "inline-flex items-center justify-center rounded-md p-3 hover:bg-muted disabled:opacity-50 sm:p-2",
                          isTtsLoading ? "bg-muted" : "",
                        ].join(" ")}
                        onClick={() => speak(m.content, idx)}
                        disabled={disableSpeak}
                        aria-label={
                          isTtsLoading
                            ? "Loading AI-generated voice"
                            : isTtsPlaying
                              ? "Stop AI-generated voice"
                              : "Speak with AI-generated voice"
                        }
                        title="AI-generated voice"
                      >
                        {isTtsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {isTtsLoading
                            ? "Loading AI-generated voice"
                            : isTtsPlaying
                              ? "Stop AI-generated voice"
                              : "Speak with AI-generated voice"}
                        </span>
                      </button>

                      {idx === lastAIdx && (
                        <button
                          className="inline-flex items-center justify-center rounded-md p-3 hover:bg-muted disabled:opacity-50 sm:p-2"
                          onClick={regenerateLast}
                          disabled={sending}
                          aria-label="Regenerate"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="sr-only">Regenerate</span>
                        </button>
                      )}

                      {typeof m.v === "number" && m.v > 1 && (
                        <span className="ml-1 rounded-md border px-1.5 py-0.5 text-[11px]">
                          v{m.v}
                        </span>
                      )}
                    </div>

                    {isAdmin && (m.inspect || m.inspect_error) && (
                      <ResponseTrace
                        inspection={inspect}
                        error={m.inspect_error || null}
                        copied={copiedKey === `inspect:trace:${idx}`}
                        onCopy={() =>
                          copyText(
                            JSON.stringify(inspect, null, 2),
                            undefined,
                            `inspect:trace:${idx}`,
                          )
                        }
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!atBottom && (
        <button
          className="fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-20 rounded-full border bg-background/80 p-3 shadow-lg backdrop-blur"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}

      <div className="sticky bottom-0 z-10 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-[44rem] px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="rounded-3xl border bg-background px-4 py-3">
            <textarea
              className="w-full resize-none bg-transparent text-sm outline-none"
              rows={2}
              placeholder="Send a message…"
              value={editingMessageId ? editingText : text}
              onChange={(e) => {
                if (editingMessageId) {
                  setEditingText(e.target.value);
                } else {
                  setText(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleVoiceButton}
                disabled={voiceIsConnecting}
                className={[
                  "rounded-xl border px-3 py-2 text-xs disabled:opacity-50",
                  voiceIsActive || voiceIsConnecting
                    ? "bg-muted"
                    : "bg-background",
                ].join(" ")}
                aria-label={voiceButtonLabel}
                title={voiceStatusLabel}
              >
                {voiceButtonLabel}
              </button>

              <span className="text-[11px] text-muted-foreground">
                OpenAI transcription · AI-generated reply · {voiceStatusLabel}
                {governedVoice.partialTranscript
                  ? ` · ${governedVoice.partialTranscript}`
                  : ""}
              </span>

              <button
                onClick={() => sendMessage()}
                disabled={sending}
                className="rounded-xl bg-muted px-3 py-2 text-xs disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={voicePrivacyOpen}
        onOpenChange={(open) => {
          if (!voicePrivacySaving) setVoicePrivacyOpen(open);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Before using voice</DialogTitle>
            <DialogDescription>
              Review how a governed voice conversation handles your data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm leading-6">
            <p>
              Your microphone audio is sent to OpenAI for transcription. Verbal
              Sage does not store the raw microphone audio.
            </p>
            <p>
              The transcript and assistant reply are saved to your account chat
              history and follow the same safeguards and governed memory rules
              as typed messages.
            </p>
            <p>
              Operational voice metadata is retained for up to 30 days. The
              reply you hear is AI-generated, not a human voice.
            </p>
          </div>

          {voicePrivacyError && (
            <p role="alert" className="text-sm text-destructive">
              {voicePrivacyError}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm"
              onClick={() => setVoicePrivacyOpen(false)}
              disabled={voicePrivacySaving}
            >
              Not now
            </button>
            <button
              type="button"
              className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
              onClick={() => void acceptVoicePrivacyNotice()}
              disabled={voicePrivacySaving}
            >
              {voicePrivacySaving ? "Saving…" : "Continue with voice"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

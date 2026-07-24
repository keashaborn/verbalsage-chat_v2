"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch, authFetchJson } from "@/lib/authFetch";
import {
  ArrowUp,
  ChevronDown,
  Copy,
  RefreshCw,
  X,
  Volume2,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Check,
  Globe2,
} from "lucide-react";
import { MarkdownMessage } from "@/components/shared/MarkdownMessage";
import {
  useGovernedVoiceConversation,
  type GovernedVoiceTurnContext,
} from "@/hooks/useGovernedVoiceConversation";
import { useRealtimeVoicePreview } from "@/hooks/useRealtimeVoicePreview";
import {
  RealtimeVoiceOverlay,
  type RealtimeVoiceOverlayState,
} from "@/components/voice/RealtimeVoiceOverlay";
import { VOICE_TURN_HEADER } from "@/lib/voiceObservability";
import { VOICE_SESSION_HEADER } from "@/lib/voiceSession";
import {
  cacheVoiceMode,
  DEFAULT_VOICE_MODE,
  normalizeVoiceMode,
  VOICE_MODE_CHANGED_EVENT,
  VOICE_MODE_STORAGE_KEY,
  voiceModeFromUserMetadata,
  type VoiceMode,
} from "@/lib/voiceMode";
import {
  BROWSER_RESPONSE_TIMEOUT_MS,
  RequestDeadlineError,
  TTS_SEGMENT_TIMEOUT_MS,
  withRequestDeadline,
} from "@/lib/requestDeadline";
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
import {
  endOfSpeechToFirstAudioMs,
  pcmS16leToWav,
  splitForSpeech,
} from "@/lib/voiceSpeech";

type TrustedWebSource = {
  url: string;
  title: string;
  authority_type: string;
  evidence_type: string;
  source_id?: string;
};

type ChatResult = {
  text: string;
  inspect: ResponseInspection | null;
  inspect_error: string | null;
  answerId: string;
  requestId: string;
  responseTimings: ResponseStageTimings | null;
  trustedWeb: boolean;
  trustedWebSources: TrustedWebSource[];
};

type ResponseStageTimings = {
  conversation_snapshot_ms?: number;
  signal_classification_ms?: number;
  memory_selection_ms?: number;
  orchestration_ms?: number;
  answer_generation_ms?: number;
  persistence_ms?: number;
  backend_total_ms?: number;
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

type VoicePlaybackState = {
  status: "loading" | "playing" | "paused" | "error";
  label: string;
  messageIndex: number;
  segmentIndex: number;
  segmentCount: number;
  currentTime: number;
  duration: number;
  error?: string;
};

type PreparedSpeechSegment = {
  url: string;
  duration: number;
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
  web_search?: boolean;
  trusted_web_sources?: TrustedWebSource[];
};


function normalizeTrustedWebSources(value: unknown): TrustedWebSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((source): TrustedWebSource | null => {
      if (!source || typeof source !== "object") return null;
      const record = source as Record<string, unknown>;
      const url = String(record.url || "").trim();
      const title = String(record.title || "").trim();
      const authorityType = String(record.authority_type || "").trim();
      const evidenceType = String(record.evidence_type || "").trim();
      const sourceId = String(record.source_id || "").trim();
      if (!url || !title || !authorityType || !evidenceType) return null;
      return {
        url,
        title,
        authority_type: authorityType,
        evidence_type: evidenceType,
        ...(sourceId ? { source_id: sourceId } : {}),
      };
    })
    .filter((source): source is TrustedWebSource => Boolean(source));
}

function stripTrustedWebSourceList(markdown: string): string {
  return String(markdown || "")
    .replace(/\n\s*Sources:\s*\n(?:\s*[-*]\s+\[[^\]]+\]\([^\)]+\)\s*\n?)+\s*$/i, "")
    .trim();
}

function trustedWebAuthorityLabel(source: TrustedWebSource): string {
  if (source.authority_type === "official_public_guidance") return "NIH ODS";
  if (source.authority_type === "pubmed_research") return "PubMed";
  return "Trusted source";
}

function trustedWebEvidenceLabel(source: TrustedWebSource): string {
  const value = source.evidence_type.replace(/_/g, " ").trim();
  return value ? value.replace(/\b\w/g, (char) => char.toUpperCase()) : "Evidence";
}

function trustedWebSourceMeta(source: TrustedWebSource): string {
  const evidence = trustedWebEvidenceLabel(source);
  if (source.source_id?.startsWith("PMID:")) {
    return `${evidence} · ${source.source_id}`;
  }
  return evidence;
}

function trustedWebHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "trusted source";
  }
}

function TrustedWebSourceCards({ sources }: { sources?: TrustedWebSource[] }) {
  const visible = (sources || []).filter((source) => source.url && source.title);
  if (!visible.length) return null;
  return (
    <section className="mt-4 space-y-2" aria-label="Trusted web sources">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Trusted sources
      </div>
      <div className="space-y-2">
        {visible.map((source, index) => (
          <a
            key={`${source.url}:${index}`}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="group block rounded-2xl border bg-muted/20 p-3 text-left no-underline transition hover:bg-muted/40"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium leading-4">
                    {trustedWebAuthorityLabel(source)}
                  </span>
                  <span className="text-[11px] leading-4 text-muted-foreground">
                    {trustedWebSourceMeta(source)}
                  </span>
                </div>
                <div className="line-clamp-2 text-xs font-medium leading-5 text-foreground underline-offset-4 group-hover:underline">
                  {source.title}
                </div>
              </div>
              <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                {trustedWebHostLabel(source.url)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

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

function formatPlaybackTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const whole = Math.floor(value);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
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

function decodeResponseTimingsHeader(
  value: string | null,
): ResponseStageTimings | null {
  if (!value) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const parsed = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)),
      ),
    );
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ResponseStageTimings)
      : null;
  } catch {
    return null;
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
  const [webSearchEnabled, setWebSearchEnabled] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [voicePrivacyOpen, setVoicePrivacyOpen] = React.useState(false);
  const [voicePrivacySaving, setVoicePrivacySaving] = React.useState(false);
  const [voicePrivacyError, setVoicePrivacyError] = React.useState("");
  const [requestError, setRequestError] = React.useState("");
  const [voiceMode, setVoiceMode] = React.useState<VoiceMode>(DEFAULT_VOICE_MODE);
  const governedVoice = useGovernedVoiceConversation();
  const realtimeVoice = useRealtimeVoicePreview();

  const effectiveVoiceMode =
    voiceMode === "realtime_preview" && isAdmin
      ? "realtime_preview"
      : "governed";
  const voiceStatus =
    effectiveVoiceMode === "realtime_preview"
      ? realtimeVoice.status
      : governedVoice.status;
  const voiceIsConnecting =
    voiceStatus === "requesting" || voiceStatus === "connecting";
  const voiceIsActive =
    voiceStatus === "listening" ||
    voiceStatus === "speaking" ||
    voiceStatus === "processing" ||
    voiceStatus === "transcribing" ||
    voiceStatus === "responding";
  const governedVoiceHasError =
    effectiveVoiceMode === "governed" && governedVoice.status === "error";
  const voiceConversationEpochRef = React.useRef(0);

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
                : voiceStatus === "processing"
                  ? "Preparing reply…"
                  : voiceStatus === "error"
                  ? "Voice unavailable"
                  : effectiveVoiceMode === "realtime_preview"
                    ? "Realtime preview ready"
                    : "Voice off";
  const visibleRequestError =
    requestError || (governedVoiceHasError ? governedVoice.lastError : "");
  const didAutoScrollForThreadRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const syncVoiceMode = () => {
      setVoiceMode(normalizeVoiceMode(localStorage.getItem(VOICE_MODE_STORAGE_KEY)));
    };
    syncVoiceMode();
    window.addEventListener("storage", syncVoiceMode);
    window.addEventListener("focus", syncVoiceMode);
    window.addEventListener(VOICE_MODE_CHANGED_EVENT, syncVoiceMode);
    return () => {
      window.removeEventListener("storage", syncVoiceMode);
      window.removeEventListener("focus", syncVoiceMode);
      window.removeEventListener(VOICE_MODE_CHANGED_EVENT, syncVoiceMode);
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    async function refreshAdminFlag() {
      try {
        const { data } = await supabase.auth.getUser();
        const role = (data?.user as any)?.app_metadata?.role;
        const cloudVoiceMode = voiceModeFromUserMetadata(
          (data?.user as any)?.user_metadata,
        );
        const nextIsAdmin =
          role === "owner" || role === "admin" || role === "developer";
        if (!mounted) return;

        setIsAdmin(nextIsAdmin);
        if (cloudVoiceMode) {
          cacheVoiceMode(cloudVoiceMode);
          setVoiceMode(cloudVoiceMode);
        }

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
    window.addEventListener("focus", refreshAdminFlag);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", refreshAdminFlag);
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
  // TTS: single-flight + visible playback controls
  // -----------------------------
  const ttsAbortRef = React.useRef<AbortController | null>(null);
  const ttsPlaybackResolveRef = React.useRef<(() => void) | null>(null);
  const ttsEpochRef = React.useRef<number>(0);
  const ttsJumpRef = React.useRef<{
    segmentIndex: number;
    offsetSeconds: number;
  } | null>(null);
  const ttsSegmentDurationsRef = React.useRef<Map<number, number>>(new Map());
  const ttsObjectUrlsRef = React.useRef<Set<string>>(new Set());
  const nativeAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const nativeAudioUrlRef = React.useRef<string | null>(null);
  const nativeAudioPreparedRef = React.useRef(false);

  const [freeformDebug, setFreeformDebug] = React.useState<{
    transcript: string;
    reply: string;
    ms: number;
    inspect: ResponseInspection | null;
    inspect_error: string | null;
  } | null>(null);

  const wakeLockRef = React.useRef<any>(null);
  const keepAwakeVideoRef = React.useRef<HTMLVideoElement | null>(null);

  const [ttsLoadingIdx, setTtsLoadingIdx] = React.useState<number | null>(null);
  const [ttsPlayingIdx, setTtsPlayingIdx] = React.useState<number | null>(null);
  const [playbackState, setPlaybackState] =
    React.useState<VoicePlaybackState | null>(null);

  function bumpTtsEpoch() {
    ttsEpochRef.current += 1;
    return ttsEpochRef.current;
  }

  function ensureNativeAudioElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!nativeAudioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      (audio as any).playsInline = true;
      nativeAudioRef.current = audio;
    }
    return nativeAudioRef.current;
  }

  function releaseNativeAudioUrl() {
    const currentUrl = nativeAudioUrlRef.current;
    nativeAudioUrlRef.current = null;
    if (currentUrl && !ttsObjectUrlsRef.current.has(currentUrl)) {
      URL.revokeObjectURL(currentUrl);
    }
  }

  function releaseSpeechObjectUrls() {
    for (const url of ttsObjectUrlsRef.current) URL.revokeObjectURL(url);
    ttsObjectUrlsRef.current.clear();
    nativeAudioUrlRef.current = null;
  }

  function unlockAudioForSafari() {
    try {
      if (nativeAudioPreparedRef.current) return;
      const audio = ensureNativeAudioElement();
      if (!audio) return;
      releaseNativeAudioUrl();
      const silentPcm = new Uint8Array(480);
      const silentWav = pcmS16leToWav(silentPcm);
      const url = URL.createObjectURL(
        new Blob([silentWav.buffer as ArrayBuffer], { type: "audio/wav" }),
      );
      nativeAudioUrlRef.current = url;
      audio.src = url;
      audio.volume = 0;
      const preparation = audio.play();
      void preparation
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          nativeAudioPreparedRef.current = true;
          releaseNativeAudioUrl();
        })
        .catch(() => {
          nativeAudioPreparedRef.current = false;
          releaseNativeAudioUrl();
        });
    } catch {}
  }

  async function wakeLockStart() {
    try {
      const wl = (navigator as any)?.wakeLock;
      if (!wl || typeof wl.request !== "function") return;
      if (wakeLockRef.current) return;
      const sentinel = await wl.request("screen");
      wakeLockRef.current = sentinel;
      sentinel?.addEventListener?.("release", () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
      });
    } catch {}
  }

  async function wakeLockStop() {
    try {
      const sentinel = wakeLockRef.current;
      if (sentinel && typeof sentinel.release === "function") {
        await sentinel.release();
      }
    } catch {
    } finally {
      wakeLockRef.current = null;
    }
  }

  function keepAwakeStart() {
    try {
      void wakeLockStart();
      const video = keepAwakeVideoRef.current;
      if (!video) return;
      video.muted = true;
      video.loop = true;
      (video as any).playsInline = true;
      const current = String(video.currentSrc || video.src || "");
      if (!current.includes("/api/media/awake")) video.src = "/api/media/awake";
      const playback = video.play();
      if (playback && typeof playback.catch === "function") {
        playback.catch(() => {});
      }
    } catch {}
  }

  function keepAwakeStop() {
    try {
      void wakeLockStop();
      const video = keepAwakeVideoRef.current;
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch {}
  }

  function clearNativePlayback() {
    const audio = nativeAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.onplaying = null;
      audio.onpause = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    const resolvePlayback = ttsPlaybackResolveRef.current;
    ttsPlaybackResolveRef.current = null;
    resolvePlayback?.();
    releaseSpeechObjectUrls();
  }

  function stopTTS() {
    bumpTtsEpoch();
    keepAwakeStop();
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    ttsJumpRef.current = null;
    ttsSegmentDurationsRef.current.clear();
    clearNativePlayback();
    setTtsLoadingIdx(null);
    setTtsPlayingIdx(null);
    setPlaybackState(null);
  }

  React.useEffect(() => {
    voiceConversationEpochRef.current += 1;
    stopTTS();
    if (effectiveVoiceMode === "realtime_preview") {
      governedVoice.stop();
    } else {
      realtimeVoice.setAssistantSpeaking(false);
      realtimeVoice.stop();
    }
    // Only a saved mode transition should tear down the inactive controller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveVoiceMode]);

  function togglePlaybackPause() {
    const audio = nativeAudioRef.current;
    if (!audio || !playbackState || playbackState.status === "error") return;
    if (audio.paused) {
      void audio.play().catch(() => {
        setPlaybackState((current) =>
          current
            ? {
                ...current,
                status: "error",
                error: "Voice playback could not resume.",
              }
            : current,
        );
      });
    } else {
      audio.pause();
      setPlaybackState((current) =>
        current ? { ...current, status: "paused" } : current,
      );
    }
  }

  function seekPlayback(seconds: number) {
    const audio = nativeAudioRef.current;
    const current = playbackState;
    if (
      !audio ||
      !current ||
      current.status === "error" ||
      !Number.isFinite(audio.currentTime)
    ) {
      return;
    }
    const duration =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : current.duration;
    const target = audio.currentTime + seconds;
    if (target >= 0 && target < duration) {
      audio.currentTime = target;
      setPlaybackState((state) =>
        state ? { ...state, currentTime: target } : state,
      );
      return;
    }

    if (target < 0 && current.segmentIndex > 0) {
      const previousIndex = current.segmentIndex - 1;
      const previousDuration =
        ttsSegmentDurationsRef.current.get(previousIndex) || 0;
      ttsJumpRef.current = {
        segmentIndex: previousIndex,
        offsetSeconds: Math.max(0, previousDuration + target),
      };
      audio.pause();
      ttsPlaybackResolveRef.current?.();
      return;
    }

    if (target >= duration && current.segmentIndex + 1 < current.segmentCount) {
      ttsJumpRef.current = {
        segmentIndex: current.segmentIndex + 1,
        offsetSeconds: Math.max(0, target - duration),
      };
      audio.pause();
      ttsPlaybackResolveRef.current?.();
      return;
    }

    audio.currentTime = Math.max(0, Math.min(duration, target));
  }

  function seekPlaybackTo(seconds: number) {
    const audio = nativeAudioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const duration =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : playbackState?.duration || 0;
    audio.currentTime = Math.max(0, Math.min(duration, seconds));
  }

  React.useEffect(() => {
    return () => {
      bumpTtsEpoch();
      keepAwakeStop();
      ttsAbortRef.current?.abort();
      ttsAbortRef.current = null;
      clearNativePlayback();
      nativeAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function speak(
    textToSpeak: string,
    idx: number,
    voiceTurnId?: string,
    voiceSessionId?: string,
  ): Promise<VoiceSpeechMetrics | null> {
    const text = (textToSpeak || "").trim();
    if (!text) return null;
    const chunks = splitForSpeech(text);
    if (!chunks.length) return null;
    if (ttsLoadingIdx === idx) return null;
    if (ttsPlayingIdx === idx) {
      stopTTS();
      return null;
    }

    stopTTS();
    const epoch = bumpTtsEpoch();
    keepAwakeStart();
    unlockAudioForSafari();
    setTtsLoadingIdx(idx);
    setTtsPlayingIdx(null);
    setPlaybackState({
      status: "loading",
      label: text.slice(0, 120),
      messageIndex: idx,
      segmentIndex: 0,
      segmentCount: chunks.length,
      currentTime: 0,
      duration: 0,
    });

    try {
      localStorage.setItem("vs_voice_engine", "openai_tts");
    } catch {}

    const voice = String(getLS<string>("vs_voice", "marin")).trim();
    const model = String(
      getLS<string>("vs_voice_model", "gpt-4o-mini-tts"),
    ).trim();
    const speed = Number(getLS<number>("vs_voice_speed", 1.0)) || 1.0;
    const abort = new AbortController();
    ttsAbortRef.current = abort;
    const ttsStartedAt = performance.now();
    let firstAudioAtMs: number | null = null;
    let playerError = "";
    const requestIds: string[] = [];
    const providerRequestIds: string[] = [];
    const segmentCache = new Map<number, Promise<PreparedSpeechSegment>>();

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

    const requestSegment = (segmentIndex: number) => {
      const existing = segmentCache.get(segmentIndex);
      if (existing) return existing;
      const request = withRequestDeadline(
        async (signal) => {
          const response = await authFetch("/api/tts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(voiceTurnId ? { [VOICE_TURN_HEADER]: voiceTurnId } : {}),
              ...(voiceSessionId
                ? { [VOICE_SESSION_HEADER]: voiceSessionId }
                : {}),
              "x-vs-tts-segment-index": String(segmentIndex),
              "x-vs-tts-segment-count": String(chunks.length),
            },
            body: JSON.stringify({
              text: chunks[segmentIndex],
              voice,
              speed,
              model,
            }),
            signal,
          });
          if (!response.ok) {
            if (response.status === 504) {
              throw new RequestDeadlineError("Voice playback timed out.");
            }
            throw new Error("Voice playback is temporarily unavailable.");
          }
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
            throw new Error(
              "The voice service returned an unsupported format.",
            );
          }
          const pcm = new Uint8Array(await response.arrayBuffer());
          if (!pcm.length) {
            throw new Error("The voice service returned empty audio.");
          }
          const wav = pcmS16leToWav(pcm);
          const url = URL.createObjectURL(
            new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }),
          );
          ttsObjectUrlsRef.current.add(url);
          const duration = pcm.byteLength / (24_000 * 2);
          ttsSegmentDurationsRef.current.set(segmentIndex, duration);
          return { url, duration };
        },
        TTS_SEGMENT_TIMEOUT_MS,
        abort.signal,
      );
      segmentCache.set(segmentIndex, request);
      void request.catch(() => {});
      return request;
    };

    const playSegment = async (
      segment: PreparedSpeechSegment,
      segmentIndex: number,
      offsetSeconds: number,
    ) => {
      if (ttsEpochRef.current !== epoch) return;
      const audio = ensureNativeAudioElement();
      if (!audio) throw new Error("Voice playback is unavailable.");
      nativeAudioUrlRef.current = segment.url;
      audio.src = segment.url;
      audio.currentTime = Math.max(
        0,
        Math.min(segment.duration, offsetSeconds),
      );
      audio.muted = false;
      audio.volume = 1;

      let settlePlayback: () => void = () => {};
      const playbackFinished = new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (error?: Error) => {
          if (settled) return;
          settled = true;
          audio.onended = null;
          audio.onerror = null;
          audio.ontimeupdate = null;
          audio.onplaying = null;
          audio.onpause = null;
          if (ttsPlaybackResolveRef.current === settlePlayback) {
            ttsPlaybackResolveRef.current = null;
          }
          if (error) reject(error);
          else resolve();
        };
        settlePlayback = () => settle();
        ttsPlaybackResolveRef.current = settlePlayback;
        audio.onended = () => settle();
        audio.onerror = () =>
          settle(new Error("The browser could not play the voice audio."));
        audio.ontimeupdate = () => {
          setPlaybackState((current) =>
            current
              ? {
                  ...current,
                  currentTime: audio.currentTime,
                  duration: segment.duration,
                }
              : current,
          );
        };
        audio.onplaying = () => {
          if (firstAudioAtMs == null) firstAudioAtMs = performance.now();
          setTtsLoadingIdx(null);
          setTtsPlayingIdx(idx);
          setPlaybackState((current) =>
            current
              ? {
                  ...current,
                  status: "playing",
                  segmentIndex,
                  currentTime: audio.currentTime,
                  duration: segment.duration,
                }
              : current,
          );
        };
        audio.onpause = () => {
          if (
            ttsEpochRef.current === epoch &&
            !audio.ended &&
            !ttsJumpRef.current
          ) {
            setPlaybackState((current) =>
              current ? { ...current, status: "paused" } : current,
            );
          }
        };
      });

      await audio.play();
      if (ttsEpochRef.current !== epoch || abort.signal.aborted) {
        audio.pause();
        settlePlayback();
        return;
      }
      await playbackFinished;
    };

    try {
      let segmentIndex = 0;
      let offsetSeconds = 0;
      while (segmentIndex < chunks.length) {
        if (ttsEpochRef.current !== epoch) return metrics("cancelled");
        setTtsLoadingIdx(idx);
        setPlaybackState((current) =>
          current
            ? {
                ...current,
                status: "loading",
                segmentIndex,
                currentTime: offsetSeconds,
                duration: ttsSegmentDurationsRef.current.get(segmentIndex) || 0,
              }
            : current,
        );
        const segment = await requestSegment(segmentIndex);
        if (segmentIndex + 1 < chunks.length) {
          void requestSegment(segmentIndex + 1);
        }
        await playSegment(segment, segmentIndex, offsetSeconds);
        if (ttsEpochRef.current !== epoch) return metrics("cancelled");
        const jump = ttsJumpRef.current;
        ttsJumpRef.current = null;
        if (jump) {
          segmentIndex = jump.segmentIndex;
          offsetSeconds = jump.offsetSeconds;
        } else {
          segmentIndex += 1;
          offsetSeconds = 0;
        }
      }
      return metrics("completed");
    } catch (error: any) {
      if (error?.name === "AbortError") return metrics("cancelled");
      playerError =
        error instanceof RequestDeadlineError
          ? error.message
          : String(
              error?.message ||
                "Voice playback could not be completed. Please try again.",
            );
      return metrics("failed");
    } finally {
      if (ttsEpochRef.current === epoch) {
        keepAwakeStop();
        const audio = nativeAudioRef.current;
        if (audio) {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        }
        const resolvePlayback = ttsPlaybackResolveRef.current;
        ttsPlaybackResolveRef.current = null;
        resolvePlayback?.();
        releaseSpeechObjectUrls();
        ttsSegmentDurationsRef.current.clear();
        setTtsPlayingIdx(null);
        setTtsLoadingIdx(null);
        setPlaybackState((current) =>
          playerError
            ? {
                status: "error",
                label: current?.label || text.slice(0, 120),
                messageIndex: idx,
                segmentIndex: current?.segmentIndex || 0,
                segmentCount: chunks.length,
                currentTime: current?.currentTime || 0,
                duration: current?.duration || 0,
                error: playerError,
              }
            : null,
        );
      }
      if (ttsAbortRef.current === abort) ttsAbortRef.current = null;
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

  function requestAutoTitle(tid: string) {
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) return;

        const response = await fetch(
          `/api/threads/${encodeURIComponent(tid)}/auto-title`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: "{}",
          },
        );

        if (response.ok) window.dispatchEvent(new Event("vs_threads_refresh"));
      } catch {
        // Naming is non-critical and must not fail a conversation turn.
      }
    })();
  }

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const tid = await loadActiveThread();
      if (tid && mounted) await loadMessages(tid);
    })();

    const onSelect = (e: any) => {
      stopTTS();
      governedVoice.stop();
      realtimeVoice.setAssistantSpeaking(false);
      realtimeVoice.stop();
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
    voiceSessionId?: string,
    trustedWeb = false,
  ): Promise<ChatResult> {
    const { response: r, responseText } = await withRequestDeadline(
      async (signal) => {
        const response = await authFetch(
          trustedWeb ? "/api/trusted-web" : "/api/chat",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(!trustedWeb && voiceTurnId
                ? { [VOICE_TURN_HEADER]: voiceTurnId }
                : {}),
              ...(!trustedWeb && voiceSessionId
                ? { [VOICE_SESSION_HEADER]: voiceSessionId }
                : {}),
            },
            body: JSON.stringify(
              trustedWeb
                ? { query: input }
                : { input, thread_id: tid, regen, noStore },
            ),
            signal,
          },
        );
        return {
          response,
          responseText: await response.text(),
        };
      },
      BROWSER_RESPONSE_TIMEOUT_MS,
    );
    if (!r.ok) {
      if (r.status === 504) {
        throw new RequestDeadlineError(
          "The response took too long. Please try again.",
        );
      }
      if (r.status === 401) {
        throw new Error("Your session expired. Please sign in again.");
      }
      if (r.status === 409 && voiceTurnId) {
        throw new Error("Voice moved to another window.");
      }
      if (r.status === 403 && trustedWeb) {
        throw new Error("Trusted web search is not enabled for this account.");
      }
      if (r.status === 429 && trustedWeb) {
        throw new Error(
          "Trusted web search reached its rate limit. Please wait and try again.",
        );
      }
      if (r.status === 503 && trustedWeb) {
        throw new Error("Trusted web search is currently unavailable.");
      }
      throw new Error("The response could not be completed. Please try again.");
    }
    if (voiceTurnId && r.headers.get(VOICE_TURN_HEADER) !== voiceTurnId) {
      throw new Error("Voice turn correlation was not preserved by chat.");
    }
    let trustedWebSources: TrustedWebSource[] = [];
    let responseBodyText = responseText;
    if (trustedWeb) {
      try {
        const trustedPayload = JSON.parse(responseText) as {
          answer?: unknown;
          sources?: unknown;
        };
        responseBodyText = stripTrustedWebSourceList(
          String(trustedPayload.answer || ""),
        );
        trustedWebSources = normalizeTrustedWebSources(trustedPayload.sources);
      } catch {
        responseBodyText = stripTrustedWebSourceList(responseText);
      }
    }
    return {
      text: responseBodyText,
      answerId: String(r.headers.get("X-VS-Answer-Id") || ""),
      requestId: String(r.headers.get("x-request-id") || ""),
      responseTimings: decodeResponseTimingsHeader(
        r.headers.get("X-VS-Response-Timings"),
      ),
      trustedWeb:
        r.headers.get("X-VS-Response-Runtime") === "trusted_web_v1",
      trustedWebSources,
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
    const lastUserMessage = [...msgs]
      .reverse()
      .find((m) => m.role === "user");
    const lastUser = lastUserMessage?.content?.trim() || "";
    if (!lastUser) return;

    let tid = threadId;
    if (!tid) tid = await ensureThread();

    setSending(true);
    try {
      const reply = await callChat(
        lastUser,
        tid!,
        true,
        false,
        undefined,
        undefined,
        lastUserMessage?.web_search === true,
      );

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
              web_search: reply.trustedWeb,
              trusted_web_sources: reply.trustedWebSources,
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
          web_search: reply.trustedWeb,
          trusted_web_sources: reply.trustedWebSources,
        };
        return next;
      });
    } catch (e: any) {
      setRequestError(
        String(e?.message || "The response could not be regenerated."),
      );
    } finally {
      setSending(false);
    }
  }

  async function startGovernedListening() {
    stopTTS();
    setWebSearchEnabled(false);
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
        onLeaseLost: () => {
          voiceConversationEpochRef.current += 1;
          stopTTS();
        },
      });
    } catch (e: any) {
      setRequestError(
        String(e?.message || "Voice could not start. Please try again."),
      );
    }
  }

  async function startRealtimeListening() {
    stopTTS();
    setWebSearchEnabled(false);
    unlockAudioForSafari();
    voiceConversationEpochRef.current += 1;
    const conversationEpoch = voiceConversationEpochRef.current;

    try {
      const tid = await ensureThread();
      await realtimeVoice.start({
        threadId: tid,
        onSpeechStart: () => {
          realtimeVoice.setAssistantSpeaking(false);
          stopTTS();
        },
        onResponse: async (turn) => {
          if (voiceConversationEpochRef.current !== conversationEpoch) return;

          requestAutoTitle(tid);
          window.dispatchEvent(new Event("vs_threads_refresh"));
          void loadMessages(tid);

          realtimeVoice.setAssistantSpeaking(true);
          let speechMetrics: VoiceSpeechMetrics | null = null;
          try {
            speechMetrics = await speak(
              turn.answer,
              Number.MAX_SAFE_INTEGER - turn.sequence,
              turn.voiceTurnId,
              turn.voiceSessionId,
            );
          } finally {
            realtimeVoice.setAssistantSpeaking(false);
          }

          if (voiceConversationEpochRef.current !== conversationEpoch) return;
          await loadMessages(tid);

          const traceStatus = speechMetrics?.status || "cancelled";
          await recordVoiceTurnTrace({
            voice_turn_id: turn.voiceTurnId,
            thread_id: tid,
            answer_id: turn.answerId,
            status: traceStatus,
            failure_stage: traceStatus === "completed" ? "none" : "tts",
            tts_first_audio_ms: speechMetrics?.firstAudioMs,
            tts_total_ms: speechMetrics?.totalMs,
            tts_segment_count: speechMetrics?.segmentCount || 0,
            response_request_id: turn.requestId,
            tts_model: speechMetrics?.model || "",
            tts_voice: speechMetrics?.voice || "",
            tts_request_ids: speechMetrics?.requestIds || [],
            tts_provider_request_ids: speechMetrics?.providerRequestIds || [],
          });
        },
        onLeaseLost: () => {
          voiceConversationEpochRef.current += 1;
          realtimeVoice.setAssistantSpeaking(false);
          stopTTS();
        },
      });
    } catch (e: any) {
      setRequestError(String(e?.message || "Realtime voice could not start."));
    }
  }

  async function startListening() {
    if (effectiveVoiceMode === "realtime_preview") {
      await startRealtimeListening();
      return;
    }
    await startGovernedListening();
  }

  function handleVoiceButton() {
    if (voiceIsActive || voiceIsConnecting) {
      void stopListeningAndRespond();
      return;
    }
    if (!hasAcceptedVoicePrivacyNotice()) {
      setVoicePrivacyError("");
      setVoicePrivacyOpen(true);
      return;
    }
    void startListening();
  }

  async function handleComposerAction() {
    const composerValue = editingMessageId ? editingText : text;
    if (composerValue.trim()) {
      if (voiceIsActive || voiceIsConnecting) {
        await stopListeningAndRespond();
      }
      await sendMessage();
      return;
    }
    handleVoiceButton();
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
    realtimeVoice.setAssistantSpeaking(false);
    realtimeVoice.stop();
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
    const useTrustedWeb =
      webSearchEnabled &&
      overrideText == null &&
      !isEditing &&
      !options.voiceTurn;

    setSending(true);
    setRequestError("");
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
      setRequestError(
        String(e?.message || "The conversation could not be prepared."),
      );
      setSending(false);
      return;
    }

    setMsgs((prev) => [
      ...prev,
      { role: "user", content: msg, web_search: useTrustedWeb },
    ]);

    const responseStartedAt = performance.now();
    try {
      const reply = await callChat(
        msg,
        tid,
        false,
        false,
        options.voiceTurn?.voiceTurnId,
        options.voiceTurn?.voiceSessionId,
        useTrustedWeb,
      );
      const responseMs = Math.max(
        0,
        Math.round(performance.now() - responseStartedAt),
      );

      if (!useTrustedWeb) requestAutoTitle(tid);

      setMsgs((prev): Msg[] => {
        const next: Msg[] = [
          ...prev,
          {
            role: "assistant",
            content: reply.text,
            v: 1,
            inspect: reply.inspect,
            inspect_error: reply.inspect_error,
            web_search: reply.trustedWeb,
            trusted_web_sources: reply.trustedWebSources,
          },
        ];
        const idx = next.length - 1;

        return next;
      });

      if (!useTrustedWeb) {
        window.dispatchEvent(new Event("vs_threads_refresh"));
        await loadMessages(tid, {
          inspect: reply.inspect,
          inspect_error: reply.inspect_error,
        });
      } else {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      }
      setSending(false);
      let speechMetrics: VoiceSpeechMetrics | null = null;
      if (options.speakReply && (options.shouldSpeak?.() ?? true)) {
        speechMetrics = await speak(
          reply.text,
          Number.MAX_SAFE_INTEGER,
          options.voiceTurn?.voiceTurnId,
          options.voiceTurn?.voiceSessionId,
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
          response_backend_total_ms: reply.responseTimings?.backend_total_ms,
          response_conversation_snapshot_ms:
            reply.responseTimings?.conversation_snapshot_ms,
          response_classifier_ms:
            reply.responseTimings?.signal_classification_ms,
          response_memory_ms: reply.responseTimings?.memory_selection_ms,
          response_orchestration_ms: reply.responseTimings?.orchestration_ms,
          response_generation_ms: reply.responseTimings?.answer_generation_ms,
          response_persistence_ms: reply.responseTimings?.persistence_ms,
          tts_first_audio_ms: speechMetrics?.firstAudioMs,
          speech_to_first_audio_ms: endOfSpeechToFirstAudioMs(
            turn.speechEndedAtMs,
            speechMetrics?.firstAudioAtMs ?? null,
          ),
          speech_to_first_audio_basis: "detected_speech_end_v1",
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
      setRequestError(
        e instanceof RequestDeadlineError
          ? e.message
          : String(
              e?.message ||
                "The response could not be completed. Please try again.",
            ),
      );
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

  const composerValue = editingMessageId ? editingText : text;
  const composerHasText = composerValue.trim().length > 0;
  const voiceSessionVisible = voiceIsConnecting || voiceIsActive;
  const realtimeOverlayOpen =
    effectiveVoiceMode === "realtime_preview" &&
    realtimeVoice.status !== "idle";
  const realtimeOverlayState: RealtimeVoiceOverlayState =
    realtimeVoice.status === "requesting" ||
    realtimeVoice.status === "connecting"
      ? "connecting"
      : realtimeVoice.status === "processing"
        ? "processing"
        : realtimeVoice.status === "speaking"
          ? "speaking"
          : realtimeVoice.status === "error"
            ? "error"
            : "listening";
  const voicePresentationState =
    playbackState?.status === "playing"
      ? "assistant-speaking"
      : playbackState?.status === "paused"
        ? "paused"
        : playbackState?.status === "loading"
          ? "processing"
          : voiceStatus;
  const composerActionLabel = sending
    ? "Sending message"
    : composerHasText
      ? "Send message"
      : voiceSessionVisible
        ? "End voice conversation"
        : "Start voice conversation";

  return (
    <div className="relative flex h-full flex-col">
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

      <RealtimeVoiceOverlay
        open={realtimeOverlayOpen}
        state={realtimeOverlayState}
        error={realtimeVoice.lastError}
        onClose={() => void stopListeningAndRespond()}
      />

      {voiceSessionVisible && effectiveVoiceMode === "governed" && (
        <div
          className="vs-voice-stage pointer-events-none absolute inset-x-0 top-10 bottom-40 z-[1] flex items-center justify-center overflow-hidden px-8"
          data-voice-state={voicePresentationState}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex max-w-full flex-col items-center">
            <div className="vs-voice-watermark" aria-hidden="true" />
            <span className="mt-3 max-w-[20rem] truncate rounded-full border bg-background/75 px-3 py-1 text-center text-xs text-muted-foreground shadow-sm backdrop-blur">
              {voiceStatusLabel}
            </span>
          </div>
        </div>
      )}

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
                    <>
                      <MarkdownMessage>{m.content}</MarkdownMessage>
                      {m.web_search && (
                        <TrustedWebSourceCards
                          sources={m.trusted_web_sources}
                        />
                      )}
                    </>
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
          {playbackState && (
            <div
              className="mb-2 rounded-2xl border bg-background px-3 py-3 shadow-lg"
              role="region"
              aria-label="AI-generated voice playback"
            >
              <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium">
                    {playbackState.status === "loading"
                      ? "Preparing voice"
                      : playbackState.status === "paused"
                        ? "Voice paused"
                        : playbackState.status === "error"
                          ? "Voice error"
                          : "Speaking"}
                    {playbackState.segmentCount > 1
                      ? ` · Part ${playbackState.segmentIndex + 1} of ${playbackState.segmentCount}`
                      : ""}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {playbackState.error || playbackState.label}
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md border p-2"
                  onClick={stopTTS}
                  aria-label="Stop and close voice playback"
                  title="Stop and close"
                >
                  <Square className="h-4 w-4" />
                </button>
              </div>

              {playbackState.status !== "error" && (
                <>
                  <input
                    className="mb-2 h-1.5 w-full accent-foreground"
                    type="range"
                    min={0}
                    max={Math.max(playbackState.duration, 0.1)}
                    step={0.1}
                    value={Math.min(
                      playbackState.currentTime,
                      Math.max(playbackState.duration, 0.1),
                    )}
                    onChange={(event) =>
                      seekPlaybackTo(Number(event.currentTarget.value))
                    }
                    aria-label="Voice playback position"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-[5rem] text-[11px] text-muted-foreground tabular-nums">
                      {formatPlaybackTime(playbackState.currentTime)} /{" "}
                      {formatPlaybackTime(playbackState.duration)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md border p-2"
                        onClick={() => seekPlayback(-10)}
                        aria-label="Go back 10 seconds"
                        title="Back 10 seconds"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md border p-2"
                        onClick={togglePlaybackPause}
                        disabled={playbackState.status === "loading"}
                        aria-label={
                          playbackState.status === "paused"
                            ? "Resume voice playback"
                            : "Pause voice playback"
                        }
                        title={
                          playbackState.status === "paused" ? "Resume" : "Pause"
                        }
                      >
                        {playbackState.status === "paused" ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border p-2"
                        onClick={() => seekPlayback(10)}
                        aria-label="Go forward 10 seconds"
                        title="Forward 10 seconds"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="rounded-3xl border bg-background px-4 py-3">
            {visibleRequestError && (
              <div
                className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs"
                role="alert"
              >
                <span>{visibleRequestError}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-md border px-2 py-1"
                  onClick={() => {
                    setRequestError("");
                    if (governedVoiceHasError) governedVoice.stop();
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}
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
                  void handleComposerAction();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  data-trusted-web-toggle
                  aria-pressed={webSearchEnabled}
                  aria-label={
                    webSearchEnabled
                      ? "Turn trusted web search off"
                      : "Turn trusted web search on"
                  }
                  title="Search only approved nutrition, lifting, physique, supplement, and behavior-change sources"
                  disabled={
                    sending ||
                    !!editingMessageId ||
                    voiceIsActive ||
                    voiceIsConnecting
                  }
                  onClick={() => {
                    setRequestError("");
                    setWebSearchEnabled((enabled) => !enabled);
                  }}
                  className={[
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50",
                    webSearchEnabled
                      ? "border-foreground bg-foreground text-background"
                      : "bg-background text-muted-foreground",
                  ].join(" ")}
                >
                  <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {webSearchEnabled ? "Web on" : "Web"}
                </button>
                <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                  {webSearchEnabled
                    ? "Trusted sources · Not saved to memory"
                    : `OpenAI transcription · AI-generated reply · ${voiceStatusLabel}`}
                  {!webSearchEnabled &&
                  effectiveVoiceMode === "governed" &&
                  governedVoice.partialTranscript
                    ? ` · ${governedVoice.partialTranscript}`
                    : ""}
                </span>
              </div>

              <button
                type="button"
                data-contextual-composer-action
                onClick={() => void handleComposerAction()}
                disabled={sending}
                className={[
                  "relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-[background-color,color,transform] active:scale-95 disabled:opacity-50",
                  composerHasText || voiceSessionVisible
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background text-foreground",
                ].join(" ")}
                aria-label={composerActionLabel}
                title={composerActionLabel}
              >
                {sending ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : composerHasText ? (
                  <ArrowUp className="h-5 w-5" aria-hidden="true" />
                ) : voiceSessionVisible ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <span
                    className="vs-voice-action-symbol h-8 w-8"
                    aria-hidden="true"
                  />
                )}
                <span className="sr-only">{composerActionLabel}</span>
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

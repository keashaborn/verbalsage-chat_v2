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
  Check,
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
  conversationStyleTtsInstructions,
  readConversationStyle,
} from "@/lib/conversationStyle";
import {
  readSpeechVoice,
  SPEECH_MODEL,
  SPEECH_SPEED,
  storeSpeechVoice,
} from "@/lib/speechSettings";
import {
  normalizeVoiceLanguage,
  readVoiceLanguage,
  storeVoiceLanguage,
  VOICE_LANGUAGE_HEADER,
  type VoiceLanguage,
} from "@/lib/voiceLanguage";
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
import { safeResponseTraceForCopy } from "@/lib/responseTraceV2";
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
import {
  canApplyForegroundThreadSync,
  decideForegroundThreadSync,
  type ForegroundThreadSyncState,
} from "@/lib/foregroundThreadSync";

type SearchControl = "auto" | "off";

type TrustedWebSource = {
  url: string;
  title: string;
  authority_type: string;
  evidence_type: string;
  source_id?: string;
  publisher?: string;
  published_at?: string;
};

type ChatResult = {
  text: string;
  inspect: ResponseInspection | null;
  inspect_error: string | null;
  answerId: string;
  requestId: string;
  responseTimings: ResponseStageTimings | null;
  trustedWeb: boolean;
  trustedWebFallback: boolean;
  trustedWebSources: TrustedWebSource[];
  trustedWebAdmittedSources: TrustedWebSource[];
};

type RequestRecoveryAction = "none" | "refresh";

const STALE_CLIENT_THREAD_PREP_MESSAGE =
  "The app may have updated. Refresh and try again.";

type PendingActiveThreadSync = {
  threadId: string | null;
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
  trusted_web_fallback?: boolean;
  trusted_web_sources?: TrustedWebSource[];
  trusted_web_admitted_sources?: TrustedWebSource[];
};

function normalizeTrustedWebSources(value: unknown): TrustedWebSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((source): TrustedWebSource | null => {
      if (!source || typeof source !== "object") return null;
      const record = source as Record<string, unknown>;
      const url = String(record.url || "").trim();
      const title = String(record.title || "").trim();
      const sourceType = String(record.source_type || "").trim();
      const authorityType = String(
        record.authority_type || sourceType || "trusted_source",
      ).trim();
      const evidenceType = String(
        record.evidence_type || sourceType || "web_evidence",
      ).trim();
      const sourceId = String(record.source_id || "").trim();
      const publisher = String(record.publisher || "").trim();
      const publishedAt = String(record.published_at || "").trim();
      if (!url || !title) return null;
      return {
        url,
        title,
        authority_type: authorityType,
        evidence_type: evidenceType,
        ...(sourceId ? { source_id: sourceId } : {}),
        ...(publisher ? { publisher } : {}),
        ...(publishedAt ? { published_at: publishedAt } : {}),
      };
    })
    .filter((source): source is TrustedWebSource => Boolean(source));
}

function stripTrustedWebSourceList(markdown: string): string {
  return String(markdown || "")
    .replace(
      /\n\s*Sources:\s*\n(?:\s*[-*]\s+\[[^\]]+\]\([^\)]+\)\s*\n?)+\s*$/i,
      "",
    )
    .trim();
}

function trustedWebAuthorityLabel(source: TrustedWebSource): string {
  const authorityType = String(source.authority_type || "").trim();
  if (authorityType === "official_public_guidance") return "NIH ODS";
  if (authorityType === "pubmed_research") return "PubMed";
  if (authorityType === "official_source") return "Official source";
  if (authorityType === "news_source") return "News source";
  return "Trusted source";
}

function trustedWebEvidenceLabel(source: TrustedWebSource): string {
  const value = String(source.evidence_type || "web_evidence")
    .replace(/_/g, " ")
    .trim();
  return value
    ? value.replace(/\b\w/g, (char) => char.toUpperCase())
    : "Evidence";
}

function trustedWebSourceMeta(source: TrustedWebSource): string {
  const evidence = trustedWebEvidenceLabel(source);
  if (source.source_id?.startsWith("PMID:")) {
    return `${evidence} · ${source.source_id}`;
  }
  if (source.published_at) {
    return `${evidence} · ${source.published_at}`;
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

function trustedWebSourceDisplayTitle(source: TrustedWebSource): string {
  const title = source.title.trim();
  const host = trustedWebHostLabel(source.url);
  const genericTitles = new Set(
    ["source", host, source.publisher || ""]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (title && !genericTitles.has(title.toLowerCase())) return title;
  try {
    const parsed = new URL(source.url);
    const path = decodeURIComponent(parsed.pathname || "/");
    return `${host}${path === "/" ? "" : path}`;
  } catch {
    return title || host;
  }
}

function trustedWebSourceSummary(
  citedSources: TrustedWebSource[],
  admittedSources: TrustedWebSource[],
): string {
  const summarySources = citedSources.length ? citedSources : admittedSources;
  const labels = Array.from(
    new Set(
      summarySources
        .map(
          (source) =>
            String(source.publisher || "").trim() ||
            trustedWebHostLabel(source.url),
        )
        .filter(Boolean),
    ),
  ).slice(0, 3);
  const supportingCount = Math.max(
    0,
    admittedSources.length - citedSources.length,
  );
  const suffix = `${citedSources.length} cited · ${supportingCount} supporting`;
  return labels.length ? `${labels.join(", ")} · ${suffix}` : suffix;
}

function TrustedWebSourceCard({
  source,
  provenance,
}: {
  source: TrustedWebSource;
  provenance: "Cited" | "Supporting";
}) {
  return (
    <div className="rounded-xl border bg-background/40 p-3 text-left">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] leading-4 font-medium">
              {trustedWebAuthorityLabel(source)}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
              {provenance}
            </span>
            <span className="text-[11px] leading-4 text-muted-foreground">
              {trustedWebSourceMeta(source)}
            </span>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 text-xs leading-5 font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {trustedWebSourceDisplayTitle(source)}
          </a>
        </div>
        <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
          {trustedWebHostLabel(source.url)}
        </span>
      </div>
    </div>
  );
}

function TrustedWebSourceCards({
  citedSources,
  admittedSources,
}: {
  citedSources?: TrustedWebSource[];
  admittedSources?: TrustedWebSource[];
}) {
  const cited = (citedSources || []).filter(
    (source) => source.url && source.title,
  );
  const admitted = (admittedSources || []).filter(
    (source) => source.url && source.title,
  );
  const citedUrls = new Set(cited.map((source) => source.url));
  const additionalSupporting = admitted.filter(
    (source) => !citedUrls.has(source.url),
  );
  if (!cited.length && !admitted.length) return null;
  return (
    <details
      className="mt-4 rounded-2xl border bg-muted/10 text-xs"
      aria-label="Web source provenance"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-muted-foreground marker:hidden">
        <span className="min-w-0 truncate">
          Sources: {trustedWebSourceSummary(cited, admitted)}
        </span>
        <span className="shrink-0 text-[11px]">Details</span>
      </summary>
      <div className="space-y-2 border-t px-3 py-3">
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Cited in this answer
        </div>
        {cited.map((source) => (
          <TrustedWebSourceCard
            key={`cited:${source.url}`}
            source={source}
            provenance="Cited"
          />
        ))}
        {additionalSupporting.length > 0 && (
          <details className="rounded-xl border bg-background/20">
            <summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground">
              Additional supporting sources ({additionalSupporting.length})
            </summary>
            <div className="space-y-2 border-t p-2">
              {additionalSupporting.map((source) => (
                <TrustedWebSourceCard
                  key={`supporting:${source.url}`}
                  source={source}
                  provenance="Supporting"
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return authFetchJson<T>(url, init);
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
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [voicePrivacyOpen, setVoicePrivacyOpen] = React.useState(false);
  const [voicePrivacySaving, setVoicePrivacySaving] = React.useState(false);
  const [voicePrivacyError, setVoicePrivacyError] = React.useState("");
  const [requestError, setRequestError] = React.useState("");
  const [requestRecoveryAction, setRequestRecoveryAction] =
    React.useState<RequestRecoveryAction>("none");
  const [pendingActiveThreadSync, setPendingActiveThreadSync] =
    React.useState<PendingActiveThreadSync | null>(null);
  const [effectiveVoiceMode] = React.useState<"realtime_preview" | "governed">(
    "realtime_preview",
  );
  const governedVoice = useGovernedVoiceConversation();
  const realtimeVoice = useRealtimeVoicePreview();
  const [realtimeCaptionsEnabled, setRealtimeCaptionsEnabled] =
    React.useState(false);
  const [realtimeCaption, setRealtimeCaption] = React.useState<{
    speaker: "You" | "RESSE";
    text: string;
  } | null>(null);
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
                      ? "Live voice ready"
                      : "Voice off";
  const visibleRequestError =
    requestError || (governedVoiceHasError ? governedVoice.lastError : "");
  const liveComposerStatus =
    effectiveVoiceMode === "governed" && governedVoice.partialTranscript
      ? `${voiceStatusLabel} · ${governedVoice.partialTranscript}`
      : voiceIsConnecting || voiceIsActive
        ? voiceStatusLabel
        : "";
  const didAutoScrollForThreadRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    try {
      setRealtimeCaptionsEnabled(
        localStorage.getItem("vs_voice_captions") === "1",
      );
    } catch {}
  }, []);

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
    let cancelled = false;
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        const metadata = (data?.user?.user_metadata || {}) as Record<
          string,
          unknown
        >;
        if (Object.prototype.hasOwnProperty.call(metadata, "vs_voice")) {
          storeSpeechVoice(metadata.vs_voice);
        }
        if (
          Object.prototype.hasOwnProperty.call(metadata, "vs_voice_language")
        ) {
          storeVoiceLanguage(metadata.vs_voice_language);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
  const foregroundThreadSyncInFlightRef = React.useRef(false);
  const lastForegroundThreadSyncAtRef = React.useRef(0);
  const foregroundThreadSyncStateRef = React.useRef<{
    threadId: string | null;
    state: ForegroundThreadSyncState;
  }>({
    threadId: null,
    state: {
      loading: false,
      sending: false,
      hasDraft: false,
      editing: false,
      voiceBusy: false,
      playbackBusy: false,
      privacyDialogOpen: false,
    },
  });

  React.useLayoutEffect(() => {
    foregroundThreadSyncStateRef.current = {
      threadId,
      state: {
        loading,
        sending,
        hasDraft: Boolean(text.trim() || editingText.trim()),
        editing: Boolean(editingMessageId),
        voiceBusy: voiceIsActive || voiceIsConnecting,
        playbackBusy: Boolean(playbackState),
        privacyDialogOpen: voicePrivacyOpen,
      },
    };
  }, [
    editingMessageId,
    editingText,
    loading,
    playbackState,
    sending,
    text,
    threadId,
    voiceIsActive,
    voiceIsConnecting,
    voicePrivacyOpen,
  ]);

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

    const voice = readSpeechVoice();
    const model = SPEECH_MODEL;
    const speed = SPEECH_SPEED;
    const instructions = conversationStyleTtsInstructions(
      readConversationStyle(),
    );
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
              instructions,
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
      trusted_web_fallback?: boolean;
    },
    shouldCommit?: () => boolean,
  ) {
    setLoading(true);
    try {
      const data = await fetchJson<Msg[]>(
        `/api/threads/${encodeURIComponent(tid)}/messages`,
      );
      const normalized = (Array.isArray(data) ? data : []).map((m) =>
        m.role === "assistant"
          ? {
              ...m,
              v: 1,
              trusted_web_sources: normalizeTrustedWebSources(
                m.trusted_web_sources,
              ),
              trusted_web_admitted_sources: normalizeTrustedWebSources(
                m.trusted_web_admitted_sources,
              ),
            }
          : m,
      );

      if (isAdmin && attach && (attach.inspect || attach.inspect_error)) {
        const idx = lastAssistantIndex(normalized);
        if (idx >= 0) {
          normalized[idx] = {
            ...normalized[idx],
            inspect: attach.inspect,
            inspect_error: attach.inspect_error,
            trusted_web_fallback: attach.trusted_web_fallback === true,
          };
        }
      }

      if (shouldCommit && !shouldCommit()) return;
      setMsgs(normalized);
      requestAnimationFrame(() => scrollToBottom("auto"));
    } catch {
      // keep UI
    } finally {
      setLoading(false);
    }
  }

  async function applyServerActiveThread(nextThreadId: string | null) {
    stopTTS();
    setPendingActiveThreadSync(null);
    setThreadId(nextThreadId);
    setMsgs([]);
    foregroundThreadSyncStateRef.current = {
      ...foregroundThreadSyncStateRef.current,
      threadId: nextThreadId,
    };

    if (nextThreadId) {
      await loadMessages(nextThreadId, undefined, () => {
        const current = foregroundThreadSyncStateRef.current;
        return current.threadId === nextThreadId && !current.state.sending;
      });
    }

    window.dispatchEvent(new Event("vs_threads_refresh"));
  }

  async function synchronizeActiveThreadFromServer(force = false) {
    const now = Date.now();
    if (!force && now - lastForegroundThreadSyncAtRef.current < 1_000) return;
    if (foregroundThreadSyncInFlightRef.current) return;

    lastForegroundThreadSyncAtRef.current = now;
    foregroundThreadSyncInFlightRef.current = true;
    try {
      const active = await authFetchJson<{ thread_id: string | null }>(
        "/api/threads/active",
        { cache: "no-store" },
      );
      const serverThreadId = String(active?.thread_id || "").trim() || null;
      const current = foregroundThreadSyncStateRef.current;
      const decision = decideForegroundThreadSync(
        current.threadId,
        serverThreadId,
        current.state,
      );

      if (decision === "defer") {
        setPendingActiveThreadSync({ threadId: serverThreadId });
        return;
      }

      if (decision === "switch_now") {
        await applyServerActiveThread(serverThreadId);
        return;
      }

      if (decision === "refresh_current" && serverThreadId) {
        setPendingActiveThreadSync(null);
        await loadMessages(serverThreadId, undefined, () => {
          const latest = foregroundThreadSyncStateRef.current;
          return latest.threadId === serverThreadId && !latest.state.sending;
        });
        window.dispatchEvent(new Event("vs_threads_refresh"));
        return;
      }

      setPendingActiveThreadSync(null);
    } catch {
      // Foreground synchronization is best-effort; keep the current chat intact.
    } finally {
      foregroundThreadSyncInFlightRef.current = false;
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
      setPendingActiveThreadSync(null);
      setThreadId(tid);
      setMsgs([]);
      if (tid) loadMessages(tid);
    };

    const onForeground = () => {
      void synchronizeActiveThreadFromServer();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onForeground();
    };

    window.addEventListener("vs_active_thread", onSelect);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      mounted = false;
      window.removeEventListener("vs_active_thread", onSelect);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("pageshow", onForeground);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
    searchControl: SearchControl = "auto",
    responseLanguage?: VoiceLanguage,
  ): Promise<ChatResult> {
    const { response: r, responseText } = await withRequestDeadline(
      async (signal) => {
        const response = await authFetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(voiceTurnId ? { [VOICE_TURN_HEADER]: voiceTurnId } : {}),
            ...(voiceSessionId
              ? { [VOICE_SESSION_HEADER]: voiceSessionId }
              : {}),
            ...(voiceTurnId && responseLanguage
              ? { [VOICE_LANGUAGE_HEADER]: responseLanguage }
              : {}),
          },
          body: JSON.stringify({
            input,
            thread_id: tid,
            regen,
            noStore,
            ...(searchControl === "off" ? { search_override: "off" } : {}),
          }),
          signal,
        });
        return {
          response,
          responseText: await response.text(),
        };
      },
      BROWSER_RESPONSE_TIMEOUT_MS,
    );
    const routedSearchRoute = r.headers.get("X-VS-Search-Route");
    const trustedWeb = routedSearchRoute === "trusted_health";
    const currentNews = routedSearchRoute === "current_news";
    const externalWeb = trustedWeb || currentNews;
    if (trustedWeb && r.headers.get("X-VS-Trusted-Web-Fallback") === "chat") {
      const fallbackReply = await callChat(
        input,
        tid,
        regen,
        noStore,
        voiceTurnId,
        voiceSessionId,
        "off",
        responseLanguage,
      );
      return { ...fallbackReply, trustedWebFallback: true };
    }
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
      if (r.status === 403 && externalWeb) {
        throw new Error("Web search is not enabled for this account.");
      }
      if (r.status === 429 && externalWeb) {
        throw new Error(
          currentNews
            ? "Current news lookup reached its rate limit. Please wait and try again."
            : "Trusted web search reached its rate limit. Please wait and try again.",
        );
      }
      if (r.status === 503 && externalWeb) {
        throw new Error(
          currentNews
            ? "Current news lookup is currently unavailable."
            : "Trusted web search is currently unavailable.",
        );
      }
      throw new Error("The response could not be completed. Please try again.");
    }
    if (voiceTurnId && r.headers.get(VOICE_TURN_HEADER) !== voiceTurnId) {
      throw new Error("Voice turn correlation was not preserved by chat.");
    }
    let trustedWebSources: TrustedWebSource[] = [];
    let trustedWebAdmittedSources: TrustedWebSource[] = [];
    let responseBodyText = responseText;
    if (externalWeb) {
      try {
        const trustedPayload = JSON.parse(responseText) as {
          answer?: unknown;
          sources?: unknown;
          cited_sources?: unknown;
          admitted_sources?: unknown;
        };
        responseBodyText = stripTrustedWebSourceList(
          String(trustedPayload.answer || ""),
        );
        trustedWebSources = normalizeTrustedWebSources(
          trustedPayload.cited_sources ?? trustedPayload.sources,
        );
        trustedWebAdmittedSources = normalizeTrustedWebSources(
          trustedPayload.admitted_sources ?? trustedPayload.sources,
        );
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
        r.headers.get("X-VS-Response-Runtime") === "trusted_web_v1" ||
        r.headers.get("X-VS-Response-Runtime") === "current_news_v1",
      trustedWebFallback: false,
      trustedWebSources,
      trustedWebAdmittedSources,
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
    const lastUserMessage = [...msgs].reverse().find((m) => m.role === "user");
    const lastUser = lastUserMessage?.content?.trim() || "";
    if (!lastUser) return;

    let tid = threadId;
    if (!tid) tid = await ensureThread();

    setSending(true);
    try {
      const reply = await callChat(lastUser, tid!, true, false);

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
              trusted_web_fallback: reply.trustedWebFallback,
              trusted_web_sources: reply.trustedWebSources,
              trusted_web_admitted_sources: reply.trustedWebAdmittedSources,
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
          trusted_web_fallback: reply.trustedWebFallback,
          trusted_web_sources: reply.trustedWebSources,
          trusted_web_admitted_sources: reply.trustedWebAdmittedSources,
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
    unlockAudioForSafari();
    voiceConversationEpochRef.current += 1;
    const conversationEpoch = voiceConversationEpochRef.current;
    try {
      await governedVoice.start({
        language: readVoiceLanguage(),
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
    unlockAudioForSafari();
    voiceConversationEpochRef.current += 1;
    const conversationEpoch = voiceConversationEpochRef.current;

    try {
      const tid = await ensureThread();
      await realtimeVoice.start({
        threadId: tid,
        language: readVoiceLanguage(),
        onSpeechStart: () => {
          realtimeVoice.setAssistantSpeaking(false);
          setRealtimeCaption(null);
          stopTTS();
        },
        onTranscript: (transcript) => {
          setRealtimeCaption({ speaker: "You", text: transcript });
        },
        onResponse: async (turn) => {
          if (voiceConversationEpochRef.current !== conversationEpoch) return;

          requestAutoTitle(tid);
          window.dispatchEvent(new Event("vs_threads_refresh"));
          void loadMessages(tid);

          realtimeVoice.setAssistantSpeaking(true);
          setRealtimeCaption({ speaker: "RESSE", text: turn.answer });
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
    setSending(true);
    setRequestError("");
    setRequestRecoveryAction("none");
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
      if (overrideText == null && !options.voiceTurn) {
        if (isEditing && editMessageId) {
          setEditingMessageId(editMessageId);
          setEditingText(msg);
        } else {
          setText(msg);
        }
        setRequestRecoveryAction("refresh");
        setRequestError(STALE_CLIENT_THREAD_PREP_MESSAGE);
      } else {
        setRequestRecoveryAction("none");
        setRequestError(
          String(e?.message || "The conversation could not be prepared."),
        );
      }
      setSending(false);
      return;
    }

    setMsgs((prev) => [
      ...prev,
      { role: "user", content: msg, web_search: false },
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
        "auto",
        options.voiceTurn
          ? normalizeVoiceLanguage(options.voiceTurn.transcriptionLanguage)
          : undefined,
      );
      const responseMs = Math.max(
        0,
        Math.round(performance.now() - responseStartedAt),
      );

      if (!reply.trustedWeb) requestAutoTitle(tid);

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
            trusted_web_fallback: reply.trustedWebFallback,
            trusted_web_sources: reply.trustedWebSources,
            trusted_web_admitted_sources: reply.trustedWebAdmittedSources,
          },
        ];
        const idx = next.length - 1;

        return next;
      });

      if (!reply.trustedWeb) {
        window.dispatchEvent(new Event("vs_threads_refresh"));
        if (reply.trustedWebFallback) {
          requestAnimationFrame(() => scrollToBottom("smooth"));
          void loadMessages(tid, {
            inspect: reply.inspect,
            inspect_error: reply.inspect_error,
            trusted_web_fallback: true,
          });
        } else {
          await loadMessages(tid, {
            inspect: reply.inspect,
            inspect_error: reply.inspect_error,
          });
        }
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
  const foregroundThreadSyncSafe = canApplyForegroundThreadSync(
    foregroundThreadSyncStateRef.current.state,
  );
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
        captionsEnabled={realtimeCaptionsEnabled}
        caption={realtimeCaption}
        onToggleCaptions={() => {
          setRealtimeCaptionsEnabled((current) => {
            const next = !current;
            try {
              localStorage.setItem("vs_voice_captions", next ? "1" : "0");
            } catch {}
            return next;
          });
        }}
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
              <div key={idx} className="text-left">
                <div
                  className={
                    m.role === "user"
                      ? "ml-auto block w-fit max-w-[84%] rounded-xl bg-muted px-4 py-2 text-sm sm:max-w-[72%]"
                      : "block max-w-full min-w-0 overflow-hidden text-sm leading-7"
                  }
                >
                  {m.role === "assistant" ? (
                    <>
                      <MarkdownMessage
                        allowedLinkUrls={
                          m.web_search
                            ? (m.trusted_web_sources ?? []).map(
                                (source) => source.url,
                              )
                            : undefined
                        }
                      >
                        {m.content}
                      </MarkdownMessage>
                      {m.web_search && (
                        <TrustedWebSourceCards
                          citedSources={m.trusted_web_sources}
                          admittedSources={m.trusted_web_admitted_sources}
                        />
                      )}
                      {m.trusted_web_fallback && (
                        <div className="mt-4 text-xs text-muted-foreground">
                          Web search was not used because this question was
                          outside trusted-source scope.
                        </div>
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>

                {m.role === "user" && (
                  <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
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
                            JSON.stringify(
                              inspect
                                ? safeResponseTraceForCopy(inspect)
                                : null,
                              null,
                              2,
                            ),
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
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 rounded-full border bg-background/80 p-2.5 shadow-lg backdrop-blur"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}

      <div className="sticky bottom-0 z-10 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-[44rem] px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {playbackState && (
            <div
              className="mb-2 flex min-h-12 items-center gap-3 rounded-full border bg-background px-3 py-2 shadow-lg"
              role="region"
              aria-label="AI-generated voice playback"
            >
              {playbackState.status === "error" ? (
                <span className="min-w-0 flex-1 truncate text-xs text-destructive">
                  {playbackState.error || "Voice playback is unavailable."}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border"
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
                    {playbackState.status === "loading" ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : playbackState.status === "paused" ? (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Pause className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <input
                    className="h-1.5 min-w-0 flex-1 accent-foreground"
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
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatPlaybackTime(playbackState.currentTime)} /{" "}
                    {formatPlaybackTime(playbackState.duration)}
                  </span>
                </>
              )}
            <button
                type="button"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border"
                onClick={stopTTS}
                aria-label="Stop and close voice playback"
                title="Stop and close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
            </div>
          )}
          <div className="relative rounded-xl border bg-background px-3 py-2 pr-12">
            {pendingActiveThreadSync && (
              <div
                className="mb-2 flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2 text-xs"
                role="status"
                aria-live="polite"
              >
                <span>Conversation changed on another device.</span>
                <button
                  type="button"
                  className="shrink-0 rounded-md border px-2 py-1 disabled:opacity-50"
                  disabled={!foregroundThreadSyncSafe}
                  onClick={() => void synchronizeActiveThreadFromServer(true)}
                >
                  Open
                </button>
              </div>
            )}
            {visibleRequestError && (
              <div
                className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs"
                role="alert"
              >
                <span>{visibleRequestError}</span>
                {requestRecoveryAction === "refresh" && (
                  <button
                    type="button"
                    className="shrink-0 rounded-md border px-2 py-1"
                    onClick={() => window.location.reload()}
                  >
                    Refresh app
                  </button>
                )}
                <button
                  type="button"
                  className="shrink-0 rounded-md border px-2 py-1"
                  onClick={() => {
                    setRequestError("");
                    setRequestRecoveryAction("none");
                    if (governedVoiceHasError) governedVoice.stop();
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}
            <textarea
              className="field-sizing-content min-h-9 max-h-32 w-full resize-none bg-transparent py-2 text-sm outline-none"
              rows={1}
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
            {liveComposerStatus && (
              <div
                className="truncate pb-1 text-[11px] text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {liveComposerStatus}
              </div>
            )}
              <button
                type="button"
                data-contextual-composer-action
                onClick={() => void handleComposerAction()}
                disabled={sending}
                className={[
                  "absolute right-2 bottom-2 inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-[background-color,color,transform] active:scale-95 disabled:opacity-50",
                  composerHasText || voiceSessionVisible
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background text-foreground",
                ].join(" ")}
                aria-label={composerActionLabel}
                title={composerActionLabel}
              >
                {sending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : composerHasText ? (
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                ) : voiceSessionVisible ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span
                    className="vs-voice-action-symbol h-6 w-6"
                    aria-hidden="true"
                  />
                )}
                <span className="sr-only">{composerActionLabel}</span>
              </button>
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

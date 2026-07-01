"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch, authFetchJson } from "@/lib/authFetch";
import { ChevronDown, Copy, RefreshCw, Volume2, Loader2, Square, Check } from "lucide-react";
import { MarkdownMessage } from "@/components/shared/MarkdownMessage";
import { useOpenAIRealtimeVoice } from "@/hooks/useOpenAIRealtimeVoice";

type InspectResult = {
  answer?: string;
  meta_explanation?: any;
  memory_used?: any[];
  system_prompt?: string;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  v?: number;
  inspect?: InspectResult | null;
  inspect_error?: string | null;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function hasInspectorCookie(): boolean {
  const v = readCookie("vs_debug_token");
  return !!(v && v.trim().length > 0);
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
      if (typeof fallback === "number") return (Number(raw) as any);
      if (typeof fallback === "boolean") return ((raw === "true") as any);
      return fallback;
    }
  } catch {
    return fallback;
  }
}


async function callInspect(input: string, tid: string, regen: boolean): Promise<InspectResult> {
  const r = await authFetch("/api/chat/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ input, thread_id: tid, regen }),
  });

  const t = await r.text().catch(() => "");
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);

  try {
    return JSON.parse(t) as InspectResult;
  } catch {
    throw new Error("inspect: invalid JSON");
  }
}

async function maybeInspect(
  input: string,
  tid: string,
  regen: boolean,
  isAdmin: boolean
): Promise<{ inspect: InspectResult | null; inspect_error: string | null }> {
  if (!isAdmin || !hasInspectorCookie()) return { inspect: null, inspect_error: null };
  try {
    const data = await callInspect(input, tid, regen);
    return { inspect: data, inspect_error: null };
  } catch (e: any) {
    return { inspect: null, inspect_error: e?.message || String(e) };
  }
}

export function BrainsChatPane() {
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const realtimeVoice = useOpenAIRealtimeVoice();

  const voiceStatus = realtimeVoice.status;
  const voiceIsConnecting = voiceStatus === "connecting";
  const voiceIsActive = voiceStatus === "active";
  const voiceHasError = voiceStatus === "error";

  const voiceButtonLabel = voiceIsConnecting
    ? "Connecting…"
    : voiceIsActive || listening
      ? "Stop voice"
      : "Talk";

  const voiceStatusLabel = voiceIsConnecting
    ? "Connecting voice…"
    : voiceIsActive || listening
      ? "Voice active"
      : voiceHasError
        ? "Voice error"
        : "Voice off";

  const micStreamRef = React.useRef<MediaStream | null>(null);
  const micCtxRef = React.useRef<AudioContext | null>(null);
  const micSrcRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const micProcRef = React.useRef<ScriptProcessorNode | null>(null);
  const micBufRef = React.useRef<Float32Array[]>([]);
  const vadRef = React.useRef<{ speech: boolean; silenceMs: number; stopScheduled: boolean }>({
    speech: false,
    silenceMs: 0,
    stopScheduled: false,
  });
  const stopVoiceInFlightRef = React.useRef(false);
  const didAutoScrollForThreadRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function refreshAdminFlag() {
      try {
        const { data } = await supabase.auth.getUser();
        const role = (data?.user as any)?.app_metadata?.role;
        const nextIsAdmin = role === "admin";
        if (!mounted) return;

        setIsAdmin(nextIsAdmin);

        // Clear stale Inspector payloads when switching from an admin account
        // to a non-admin account in the same browser session.
        if (!nextIsAdmin) {
          setMsgs((prev) =>
            prev.map((m) =>
              m.inspect || m.inspect_error ? { ...m, inspect: null, inspect_error: null } : m
            )
          );
        }
      } catch {
        if (mounted) {
          setIsAdmin(false);
          setMsgs((prev) =>
            prev.map((m) =>
              m.inspect || m.inspect_error ? { ...m, inspect: null, inspect_error: null } : m
            )
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

  // Tune later if needed
  const VAD_START_RMS = 0.02;       // speech start threshold
  const VAD_END_RMS = 0.015;        // silence threshold (hysteresis)
  const VAD_END_SILENCE_MS = 900;   // ms of silence to end utterance



  const micSrcRateRef = React.useRef<number>(48000);
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
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    };
  }, []);

  async function copyText(t: string, idx?: number, key?: string) {
    try {
      await navigator.clipboard.writeText(t);

      // clear timers
      if (copiedTimerRef.current != null) window.clearTimeout(copiedTimerRef.current);
      if (copiedKeyTimerRef.current != null) window.clearTimeout(copiedKeyTimerRef.current);

      if (typeof idx === "number") {
        setCopiedIdx(idx);
        copiedTimerRef.current = window.setTimeout(() => setCopiedIdx(null), 900);
      } else if (key) {
        setCopiedKey(key);
        copiedKeyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 900);
      }
    } catch {
      // ignore
    }
  }

  // -----------------------------
  // TTS: single-flight + UI state
  // -----------------------------
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);
  const ttsAbortRef = React.useRef<AbortController | null>(null);
  const ttsEpochRef = React.useRef<number>(0);

  // WebAudio fallback (Safari can block HTMLAudioElement.play() after async fetch)
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  const [freeformDebug, setFreeformDebug] = React.useState<{
    transcript: string;
    reply: string;
    ms: number;
    inspect: InspectResult | null;
    inspect_error: string | null;
  } | null>(null);

  // Legacy non-OpenAI realtime voice is disabled. OpenAI Realtime is staged separately.

  const audioNodeRef = React.useRef<AudioBufferSourceNode | null>(null);


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

  function cleanupAudioUrl(url?: string) {
    const u = url ?? audioUrlRef.current;
    if (!u) return;
    try {
      URL.revokeObjectURL(u);
    } catch { }
    if (audioUrlRef.current === u) audioUrlRef.current = null;
  }

  function ensureAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    return audioCtxRef.current;
  }

  function unlockAudioForSafari() {
    try {
      const ctx = ensureAudioContext();
      if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => { });
    } catch { }
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
      if (p && typeof (p as any).catch === "function") (p as Promise<void>).catch(() => { });
    } catch { }
  }

  function keepAwakeStop() {
    try {
      void wakeLockStop();
      const v = keepAwakeVideoRef.current;
      if (!v) return;
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch { }
  }

  function stopTTS() {
    bumpTtsEpoch();
    keepAwakeStop();

    if (ttsAbortRef.current) {
      try {
        ttsAbortRef.current.abort();
      } catch { }
      ttsAbortRef.current = null;
    }

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch { }
      audioRef.current = null;
    }

    if (audioNodeRef.current) {
      try {
        audioNodeRef.current.stop();
      } catch { }
      try {
        audioNodeRef.current.disconnect();
      } catch { }
      audioNodeRef.current = null;
    }

    cleanupAudioUrl();
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
        } catch { }
        ttsAbortRef.current = null;
      }

      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch { }
        audioRef.current = null;
      }

      if (audioNodeRef.current) {
        try {
          audioNodeRef.current.stop();
        } catch { }
        try {
          audioNodeRef.current.disconnect();
        } catch { }
        audioNodeRef.current = null;
      }

      cleanupAudioUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function speak(textToSpeak: string, idx: number) {
    const t = (textToSpeak || "").trim();
    if (!t) return;

    // ignore repeated taps while loading (prevents spam)
    if (ttsLoadingIdx === idx) return;

    // tap again while playing stops
    if (ttsPlayingIdx === idx) {
      stopTTS();
      return;
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
    } catch { }

    const voice = String(getLS<string>("vs_voice", "sage")).trim();
    const model = String(getLS<string>("vs_voice_model", "gpt-4o-mini-tts")).trim();
    const speed = Number(getLS<number>("vs_voice_speed", 1.0)) || 1.0;

    const ac = new AbortController();
    ttsAbortRef.current = ac;

    try {
      const r = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, voice, speed, model }),
        signal: ac.signal,
      });

      if (ttsEpochRef.current !== epoch) return;
      if (!r.ok) throw new Error(await r.text());

      const blob = await r.blob();
      if (ttsEpochRef.current !== epoch) return;

      // HTMLAudioElement fast path
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const a = new Audio(url);
      audioRef.current = a;

      const done = () => {
        if (ttsEpochRef.current !== epoch) return;
        if (audioRef.current === a) audioRef.current = null;
        cleanupAudioUrl(url);
        keepAwakeStop();
        setTtsPlayingIdx(null);
      };

      a.addEventListener("ended", done);
      a.addEventListener("error", done);

      try {
        await a.play(); // may throw NotAllowedError
        if (ttsEpochRef.current !== epoch) return;
        setTtsLoadingIdx(null);
        setTtsPlayingIdx(idx);
        return;
      } catch (err: any) {
        // Safari policy block -> WebAudio fallback
        const name = String(err?.name || "");
        const msg = String(err?.message || err || "");
        const looksBlocked = name === "NotAllowedError" || /not allowed|denied permission/i.test(msg);
        if (!looksBlocked) throw err;

        try {
          a.pause();
        } catch { }
        audioRef.current = null;
        cleanupAudioUrl(url);

        const ctx = ensureAudioContext();
        if (!ctx) throw err;

        if (ctx.state === "suspended") await ctx.resume().catch(() => { });

        const ab = await blob.arrayBuffer();
        if (ttsEpochRef.current !== epoch) return;

        const decoded = await ctx.decodeAudioData(ab.slice(0));
        if (ttsEpochRef.current !== epoch) return;

        const src = ctx.createBufferSource();
        src.buffer = decoded;
        src.connect(ctx.destination);
        audioNodeRef.current = src;

        src.onended = () => {
          if (ttsEpochRef.current !== epoch) return;
          if (audioNodeRef.current === src) audioNodeRef.current = null;
          keepAwakeStop();
          setTtsPlayingIdx(null);
        };

        src.start(0);
        setTtsLoadingIdx(null);
        setTtsPlayingIdx(idx);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error(e);
      alert(e?.message || String(e));
      stopTTS();
    } finally {
      if (ttsEpochRef.current === epoch) setTtsLoadingIdx(null);
      if (ttsAbortRef.current === ac) ttsAbortRef.current = null;
    }
  }

  // -----------------------------
  // Threads / messages
  // -----------------------------
  async function loadActiveThread(): Promise<string | null> {
    try {
      const active = await fetchJson<{ thread_id: string | null }>("/api/threads/active");
      setThreadId(active.thread_id);
      return active.thread_id;
    } catch {
      setThreadId(null);
      return null;
    }
  }

  function lastAssistantIndex(arr: Msg[]) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].role === "assistant") return i;
    return -1;
  }

  async function loadMessages(
    tid: string,
    attach?: { inspect: InspectResult | null; inspect_error: string | null }
  ) {
    setLoading(true);
    try {
      const data = await fetchJson<Msg[]>(`/api/threads/${encodeURIComponent(tid)}/messages`);
      const normalized = (Array.isArray(data) ? data : []).map((m) => (m.role === "assistant" ? { ...m, v: 1 } : m));

      if (isAdmin && attach && (attach.inspect || attach.inspect_error)) {
        const idx = lastAssistantIndex(normalized);
        if (idx >= 0) {
          normalized[idx] = { ...normalized[idx], inspect: attach.inspect, inspect_error: attach.inspect_error };
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

    const active = await fetchJson<{ thread_id: string | null }>("/api/threads/active");
    if (!active.thread_id) throw new Error("New chat created, but no active thread id found.");

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

  async function callChat(input: string, tid: string, regen = false, noStore = false): Promise<string> {
    const r = await authFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, thread_id: tid, regen, noStore }),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.text();
  }

  async function regenerateLast() {
    stopTTS();
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content?.trim() || "";
    if (!lastUser) return;

    let tid = threadId;
    if (!tid) tid = await ensureThread();

    setSending(true);
    try {
      const replyText = await callChat(lastUser, tid!, true);
      const { inspect, inspect_error } = await maybeInspect(lastUser, tid!, true, isAdmin);

      setMsgs((prev) => {
        const idx = lastAssistantIndex(prev);
        requestAnimationFrame(() => scrollToBottom("smooth"));
        if (idx < 0) return [...prev, { role: "assistant", content: replyText, v: 1, inspect, inspect_error }];

        const next = prev.slice();
        const curV = Number(next[idx].v || 1);
        next[idx] = { ...next[idx], content: replyText, v: curV + 1, inspect, inspect_error };
        return next;
      });
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  function f32Concat(chunks: Float32Array[]): Float32Array {
    const n = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Float32Array(n);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }

  function resampleLinear(input: Float32Array, srcRate: number, dstRate: number): Float32Array {
    if (srcRate === dstRate) return input;
    const ratio = dstRate / srcRate;
    const outLen = Math.max(1, Math.floor(input.length * ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const t = i / ratio;
      const i0 = Math.floor(t);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = t - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }

  function f32ToPcm16leBytes(input: Float32Array): Uint8Array {
    const out = new Uint8Array(input.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < input.length; i++) {
      let s = input[i];
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      const v = Math.round(s * 32767);
      view.setInt16(i * 2, v, true);
    }
    return out;
  }

  function u8ToB64(u8: Uint8Array): string {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode(...u8.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  async function startListening() {
    stopTTS();

    try {
      await realtimeVoice.start({
        voice: String(getLS<string>("vs_voice", "marin")).trim() || "marin",
        model: String(getLS<string>("vs_realtime_model", "gpt-realtime-2")).trim() || "gpt-realtime-2",
        instructions: [
          "You are Verbal Sage in live voice mode.",
          "Use a calm, concise, conversational style.",
          "Answer the user's spoken question directly.",
          "Do not drift into math, geometry, tutoring, or unrelated explanations unless the user explicitly asks for that.",
          "If interrupted, stop the current answer and respond to the user's new direction.",
          "Do not claim to write into the text chat unless transcript capture is explicitly enabled.",
          "Keep most spoken answers short unless the user asks for more detail.",
        ].join(" "),
      });
      setListening(true);
    } catch (e: any) {
      setListening(false);
      alert(e?.message || String(e));
    }
  }

  async function stopListeningAndRespond() {
    realtimeVoice.stop();
    setListening(false);
    stopVoiceInFlightRef.current = false;
  }

  async function sendMessage(overrideText?: string) {
    stopTTS();
    const msg = String(overrideText ?? text).trim();
    if (!msg || sending) return;

    const lower = msg.toLowerCase();

    // Only treat regen as a command when the user typed it (not when it came from mic STT)
    if (overrideText == null && (lower === "regenerate" || lower === "regen")) {
      setText("");
      await regenerateLast();
      return;
    }

    setSending(true);
    setText("");

    let tid: string;
    try {
      tid = await ensureThread();
    } catch (e: any) {
      alert(e?.message || String(e));
      setSending(false);
      return;
    }

    setMsgs((prev) => [...prev, { role: "user", content: msg }]);

    try {
      const replyText = await callChat(msg, tid, false);

      void (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data?.session?.access_token;
          if (!token) return;

          const r = await fetch(`/api/threads/${encodeURIComponent(tid)}/auto-title`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ input: msg }),
          });

          if (r.ok) window.dispatchEvent(new Event("vs_threads_refresh"));
        } catch {
          // Auto-title is non-critical; chat should never fail because naming failed.
        }
      })();

      const { inspect, inspect_error } = await maybeInspect(msg, tid, false, isAdmin);

      setMsgs((prev): Msg[] => {
        const next: Msg[] = [...prev, { role: "assistant", content: replyText, v: 1, inspect, inspect_error }];
        const idx = next.length - 1;

        return next;
      });

      window.dispatchEvent(new Event("vs_threads_refresh"));
      await loadMessages(tid, { inspect, inspect_error });
    } catch (e: any) {
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
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, left: 0, top: 0, pointerEvents: "none" }}
      />

      <div
        ref={scrollRef}
        className="mx-auto w-full max-w-[44rem] flex-1 overflow-y-auto px-5 pt-6 pb-[calc(10.5rem+env(safe-area-inset-bottom))]"
      >
        {!threadId && <div className="mb-6 text-sm text-muted-foreground">Start typing to create a new chat.</div>}
        {loading && <div className="mb-4 text-xs text-muted-foreground">Loading…</div>}

        <div className="space-y-6">
          {msgs.map((m, idx) => {
            const counts = (m.inspect as any)?.meta_explanation?.vantage?.counts || null;
            const kMem = counts?.k_memory ?? null;
            const kCor = counts?.k_corpus ?? null;

            const isTtsLoading = ttsLoadingIdx === idx;
            const isTtsPlaying = ttsPlayingIdx === idx;
            const ttsBusy = ttsLoadingIdx != null || ttsPlayingIdx != null;
            const disableSpeak = ttsBusy && !isTtsLoading && !isTtsPlaying;

            const isCopied = copiedIdx === idx;

            return (
              <div key={idx} className={m.role === "user" ? "text-left" : "text-left"}>
                <div
                  className={
                    m.role === "user"
                      ? "inline-block rounded-2xl bg-muted px-4 py-2 text-sm"
                      : "inline-block max-w-[42rem] text-sm leading-7"
                  }
                >
                  {m.role === "assistant" ? <MarkdownMessage>{m.content}</MarkdownMessage> : m.content}
                </div>

                {m.role === "assistant" && (
                  <>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <button
                        className={[
                          "inline-flex items-center justify-center rounded-md p-3 sm:p-2 hover:bg-muted disabled:opacity-50",
                          isCopied ? "bg-muted" : "",
                        ].join(" ")}
                        onClick={() => copyText(m.content, idx)}
                        aria-label={isCopied ? "Copied" : "Copy"}
                      >
                        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span className="sr-only">{isCopied ? "Copied" : "Copy"}</span>
                      </button>

                      <button
                        className={[
                          "inline-flex items-center justify-center rounded-md p-3 sm:p-2 hover:bg-muted disabled:opacity-50",
                          isTtsLoading ? "bg-muted" : "",
                        ].join(" ")}
                        onClick={() => speak(m.content, idx)}
                        disabled={disableSpeak}
                        aria-label={isTtsLoading ? "Loading" : isTtsPlaying ? "Stop" : "Speak"}
                      >
                        {isTtsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">{isTtsLoading ? "Loading" : isTtsPlaying ? "Stop" : "Speak"}</span>
                      </button>

                      {idx === lastAIdx && (
                        <button
                          className="inline-flex items-center justify-center rounded-md p-3 sm:p-2 hover:bg-muted disabled:opacity-50"
                          onClick={regenerateLast}
                          disabled={sending}
                          aria-label="Regenerate"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="sr-only">Regenerate</span>
                        </button>
                      )}

                      {typeof m.v === "number" && m.v > 1 && (
                        <span className="ml-1 rounded-md border px-1.5 py-0.5 text-[11px]">v{m.v}</span>
                      )}
                    </div>

                    {isAdmin && (m.inspect || m.inspect_error) && (
                      <details className="mt-2 max-w-[42rem] rounded-xl border bg-background/30 p-3 text-xs">
                        <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Inspector
                          {kMem != null || kCor != null ? ` (mem ${Number(kMem ?? 0)}, corpus ${Number(kCor ?? 0)})` : ""}
                        </summary>

                        {m.inspect_error && (
                          <div className="mt-2 rounded-md border bg-muted/30 p-2">
                            <div className="font-semibold">inspect_error</div>
                            <div className="mt-1 whitespace-pre-wrap break-words">{m.inspect_error}</div>
                          </div>
                        )}

                        {m.inspect && (
                          <div className="mt-3 space-y-3">
                            <div className="rounded-md border bg-muted/30 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">system_prompt</div>
                                <button
                                  className={[
                                    "rounded-md border bg-background px-2 py-1 text-[11px]",
                                    copiedKey === `inspect:system_prompt:${idx}` ? "ring-1 ring-ring" : "",
                                  ].join(" ")}
                                  onClick={() => copyText(String(m.inspect?.system_prompt || ""), undefined, `inspect:system_prompt:${idx}`)}
                                >
                                  {copiedKey === `inspect:system_prompt:${idx}` ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <pre className="mt-2 whitespace-pre-wrap break-words">{String(m.inspect.system_prompt || "")}</pre>
                            </div>

                            <div className="rounded-md border bg-muted/30 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">
                                  memory_used ({Array.isArray(m.inspect.memory_used) ? m.inspect.memory_used.length : 0})
                                </div>
                                <button
                                  className={[
                                    "rounded-md border bg-background px-2 py-1 text-[11px]",
                                    copiedKey === `inspect:memory_used:${idx}` ? "ring-1 ring-ring" : "",
                                  ].join(" ")}
                                  onClick={() =>
                                    copyText(JSON.stringify(m.inspect?.memory_used || [], null, 2), undefined, `inspect:memory_used:${idx}`)
                                  }
                                >
                                  {copiedKey === `inspect:memory_used:${idx}` ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <pre className="mt-2 whitespace-pre-wrap break-words">
                                {JSON.stringify(m.inspect.memory_used || [], null, 2)}
                              </pre>
                            </div>

                            <div className="rounded-md border bg-muted/30 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">meta_explanation</div>
                                <button
                                  className={[
                                    "rounded-md border bg-background px-2 py-1 text-[11px]",
                                    copiedKey === `inspect:meta_explanation:${idx}` ? "ring-1 ring-ring" : "",
                                  ].join(" ")}
                                  onClick={() =>
                                    copyText(JSON.stringify(m.inspect?.meta_explanation || {}, null, 2), undefined, `inspect:meta_explanation:${idx}`)
                                  }
                                >
                                  {copiedKey === `inspect:meta_explanation:${idx}` ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <pre className="mt-2 whitespace-pre-wrap break-words">
                                {JSON.stringify(m.inspect.meta_explanation || {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </details>
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
          className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-20 rounded-full border bg-background/80 p-3 shadow-lg backdrop-blur"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}

      <div className="sticky bottom-0 z-10 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-[44rem] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
          <div className="rounded-3xl border bg-background px-4 py-3">
            <textarea
              className="w-full resize-none bg-transparent text-sm outline-none"
              rows={2}
              placeholder="Send a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
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
                onClick={() => {
                  if (voiceIsActive || voiceIsConnecting || listening) {
                    stopListeningAndRespond().catch((e) => alert(String((e as any)?.message ?? e)));
                  } else {
                    startListening().catch((e) => alert(String((e as any)?.message ?? e)));
                  }
                }}
                disabled={sending}
                className={[
                  "rounded-xl border px-3 py-2 text-xs disabled:opacity-50",
                  voiceIsActive || voiceIsConnecting || listening ? "bg-muted" : "bg-background",
                ].join(" ")}
                aria-label={voiceButtonLabel}
                title={voiceStatusLabel}
              >
                {voiceButtonLabel}
              </button>

              <span className="text-[11px] text-muted-foreground">
                {voiceStatusLabel}
              </span>

              <button onClick={() => sendMessage()} disabled={sending} className="rounded-xl bg-muted px-3 py-2 text-xs disabled:opacity-50">
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

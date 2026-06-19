"use client";

import { authFetch } from "@/lib/authFetch";
import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useGrokVoice, type GrokVoice } from "../../hooks/useGrokVoice";

const VOICES: GrokVoice[] = ["Ara", "Rex", "Sal", "Eve", "Leo"];
function isValidVoice(v: any): v is GrokVoice {
  return VOICES.includes(v as GrokVoice);
}

function getLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;

    // Prefer JSON, but allow legacy raw strings
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  } catch {
    return fallback;
  }
}

function setLS(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { }
}

type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export default function GrokVoiceRealtimePanel() {
  const [voice, setVoice] = React.useState<GrokVoice>("Ara");
  const [instructions, setInstructions] = React.useState<string>("You are a helpful assistant.");
  const [text, setText] = React.useState<string>("Reply with exactly: OK");
  const [transcript, setTranscript] = React.useState<string>("");
  const [volume, setVolumeState] = React.useState<number>(1);
  const [tokenState, setTokenState] = React.useState<TokenState>({ status: "loading" });
  const [mode, setMode] = React.useState<"verbatim" | "freeform">("verbatim");

  const prefsLoadedRef = React.useRef(false);
  const canPersistRef = React.useRef(false);
  const lastSavedVoiceRef = React.useRef<GrokVoice | null>(null);
  const [listening, setListening] = React.useState(false);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const micCtxRef = React.useRef<AudioContext | null>(null);
  const micSrcRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const micProcRef = React.useRef<ScriptProcessorNode | null>(null);
  const micBufRef = React.useRef<Float32Array[]>([]);
  const micSrcRateRef = React.useRef<number>(48000);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // local fallback (also used for one-time migration)
      const lsVoiceRaw = getLS("vs_grok_voice", "Ara");
      const lsVoice: GrokVoice = isValidVoice(lsVoiceRaw) ? (lsVoiceRaw as GrokVoice) : "Ara";

      const lsInstr = getLS("vs_grok_voice_instructions", "You are a helpful assistant.");
      const lsVol = Number(getLS<any>("vs_grok_voice_volume", 1)) || 1;

      if (!cancelled) {
        setInstructions(lsInstr);
        setVolumeState(lsVol);
        setMode(getLS<any>("vs_grok_voice_mode", "verbatim") === "freeform" ? "freeform" : "verbatim");
      }

      let nextVoice: GrokVoice = lsVoice;

      // Prefer per-user Supabase metadata when available
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user || null;
        canPersistRef.current = !!u;

        const md = (u as any)?.user_metadata || {};
        const mdVoice = md?.vs_grok_voice;

        if (isValidVoice(mdVoice)) {
          nextVoice = mdVoice as GrokVoice;
          lastSavedVoiceRef.current = nextVoice; // already stored remotely
        }
      } catch {
        // ignore and keep local fallback
        canPersistRef.current = false;
      }

      if (cancelled) return;

      setVoice(nextVoice);
      prefsLoadedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Voice: localStorage + per-user Supabase metadata
  React.useEffect(() => {
    setLS("vs_grok_voice", voice);

    if (!prefsLoadedRef.current) return;
    if (!canPersistRef.current) return;

    if (lastSavedVoiceRef.current === voice) return;
    lastSavedVoiceRef.current = voice;

    void supabase.auth.updateUser({ data: { vs_grok_voice: voice } });
  }, [voice]);

  // Keep these local-only for now (we'll persist later with a debounce / onBlur)
  React.useEffect(() => setLS("vs_grok_voice_instructions", instructions), [instructions]);
  React.useEffect(() => setLS("vs_grok_voice_volume", volume), [volume]);
  React.useEffect(() => setLS("vs_grok_voice_mode", mode), [mode]);

  // Fetch WS token from server (admin-only)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch("/api/voice/ws-token", { method: "GET" });
        const j = await r.json().catch(() => ({} as any));
        if (cancelled) return;

        if (r.status === 403 || j?.error === "forbidden") {
          setTokenState({ status: "forbidden" });
          return;
        }
        if (!r.ok || !j?.token) {
          setTokenState({ status: "error", message: j?.error || `HTTP ${r.status}` });
          return;
        }
        setTokenState({ status: "ready", token: String(j.token) });
      } catch (e: any) {
        if (cancelled) return;
        setTokenState({ status: "error", message: String(e?.message ?? e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const token = tokenState.status === "ready" ? tokenState.token : "";

  const api = useGrokVoice({
    voice,
    token,
    instructions,
    turn: "none",
    volume,
    onTranscriptDelta: (d) => setTranscript((t) => t + d),
    onEvent: (ev) => {
      if (ev?.type === "response.output_audio.delta") {
        // eslint-disable-next-line no-console
        console.log("audio_delta_b64_len", String(ev?.delta ?? "").length);
      }
    },
  });

  const onConnect = async () => {
    setTranscript("");
    if (tokenState.status !== "ready") return;
    await api.connect();
  };

  const onSpeak = () => {
    api.speakText(text);
  };

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
    if (tokenState.status !== "ready") {
      alert("Voice not available.");
      return;
    }
    // ensure WS + audio output is ready (also unlocks audio on Safari)
    await api.connect();

    // request mic
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;

    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    micCtxRef.current = ctx;

    const src = ctx.createMediaStreamSource(stream);
    micSrcRef.current = src;
    micSrcRateRef.current = ctx.sampleRate || 48000;

    // ScriptProcessor is deprecated but simplest; good enough for prototype
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    micProcRef.current = proc;

    micBufRef.current = [];

    proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      micBufRef.current.push(new Float32Array(input)); // copy
    };

    src.connect(proc);
    proc.connect(ctx.destination); // required in some browsers to run processor

    setListening(true);
  }

  async function stopListeningAndRespond() {
    setListening(false);

    // teardown capture
    try { micProcRef.current?.disconnect(); } catch { }
    try { micSrcRef.current?.disconnect(); } catch { }
    try { micCtxRef.current?.close(); } catch { }

    micProcRef.current = null;
    micSrcRef.current = null;
    micCtxRef.current = null;

    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch { }
    micStreamRef.current = null;

    const chunks = micBufRef.current;
    micBufRef.current = [];

    if (!chunks.length) return;

    const srcRate = micSrcRateRef.current || 48000;
    const f32 = f32Concat(chunks);
    const f32_24k = resampleLinear(f32, srcRate, 24000);
    const pcm16 = f32ToPcm16leBytes(f32_24k);

    // stream to Grok as base64 chunks
    const CHUNK = 24000 * 2; // ~1s of PCM16 at 24k
    for (let i = 0; i < pcm16.length; i += CHUNK) {
      const part = pcm16.subarray(i, i + CHUNK);
      api.sendEvent({
        type: "input_audio_buffer.append",
        audio: u8ToB64(part),
      });
    }

    api.sendEvent({ type: "input_audio_buffer.commit" });

    api.sendEvent({
      type: "response.create",
      response: { modalities: ["audio", "text"] },
    });
  }

  return (
    <div className="w-full space-y-3">
      {/* Token status */}
      {tokenState.status === "loading" && (
        <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
          Loading voice session…
        </div>
      )}
      {tokenState.status === "forbidden" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          Admin access required to use realtime voice.
        </div>
      )}
      {tokenState.status === "error" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          Voice token error: <span className="font-mono">{tokenState.message}</span>
        </div>
      )}

      {/* Voice + status */}
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Voice</div>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value as GrokVoice)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {VOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="h-9 w-full rounded-md border bg-muted/30 px-2 py-2 font-mono text-xs">
            {api.status}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Speak mode</div>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          <option value="verbatim">Read verbatim (TTS)</option>
          <option value="freeform">Freeform (ad-lib)</option>
        </select>
      </div>


      {/* Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => { try { api.connect(); } catch { } }}
          disabled={tokenState.status !== "ready"}
          className="h-9 rounded-md border bg-background text-sm hover:bg-muted/60 disabled:opacity-50"
        >
          Unlock Audio
        </button>

        <button
          type="button"
          onClick={onConnect}
          disabled={tokenState.status !== "ready" || api.status === "connecting"}
          className="h-9 rounded-md border bg-background text-sm hover:bg-muted/60 disabled:opacity-50"
        >
          Connect
        </button>

        <button
          type="button"
          onClick={api.disconnect}
          className="h-9 rounded-md border bg-background text-sm hover:bg-muted/60"
        >
          Disconnect
        </button>
      </div>

      {/* Instructions */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Instructions (session.update)</div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-md border bg-background p-2 text-sm"
        />
      </div>

      {/* Speak + volume */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Text to speak</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSpeak}
            disabled={!api.isConnected}
            className="h-9 rounded-md border bg-background text-sm hover:bg-muted/60 disabled:opacity-50"
          >
            Speak
          </button>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Volume</div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolumeState(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!listening ? (
          <button
            type="button"
            onClick={() => startListening().catch((e) => alert(String(e?.message ?? e)))}
            disabled={tokenState.status !== "ready"}
            className="h-9 rounded-md border bg-background text-sm hover:bg-muted/60 disabled:opacity-50"
          >
            Start talking
          </button>
        ) : (
          <button
            type="button"
            onClick={() => stopListeningAndRespond().catch((e) => alert(String(e?.message ?? e)))}
            className="h-9 rounded-md border bg-background text-sm hover:bg-muted/60"
          >
            Stop & respond
          </button>
        )}

        <div className="h-9 rounded-md border bg-muted/30 px-2 py-2 text-xs text-muted-foreground">
          Mic: {listening ? "ON" : "OFF"}
        </div>
      </div>

      {/* Error */}
      {api.lastError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <div className="font-mono">{api.lastError}</div>
        </div>
      ) : null}

      {/* Transcript */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Transcript (streaming)</div>
        <pre className="min-h-[72px] w-full whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs">
          {transcript}
        </pre>
      </div>
    </div>
  );
}

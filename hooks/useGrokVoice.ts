import { useCallback, useEffect, useRef, useState } from "react";

export type GrokVoice = "Ara" | "Rex" | "Sal" | "Eve" | "Leo";
export type GrokVoiceStatus = "idle" | "connecting" | "ready" | "closed" | "error";

type AnyJson = Record<string, any>;

type UseGrokVoiceOpts = {
  voice: GrokVoice;
  token: string;                // required: your VOICE_WS_TOKEN (client must have it to connect)
  instructions?: string;        // optional: sent via query string to seebx relay
  turn?: "none" | "server_vad"; // server_vad enables VAD on the xAI side (when you add mic later)
  wsPath?: string;              // default: "/ws/voice"
  inputRate?: number;           // default: 24000
  outputRate?: number;          // default: 24000
  volume?: number;              // 0..1, default 1
  onTranscriptDelta?: (delta: string) => void;
  onEvent?: (ev: AnyJson) => void; // debug tap
};

type UseGrokVoiceApi = {
  status: GrokVoiceStatus;
  lastError: string | null;
  connect: () => Promise<void>;
  sendEvent: (ev: AnyJson) => void;
  disconnect: () => void;
  speakText: (text: string) => void;
  setVolume: (v: number) => void;
  isConnected: boolean;
};

const WS_CONNECTING = 0;
const WS_OPEN = 1;
function rs(ws: WebSocket): number {
  return ws.readyState as unknown as number;
}

function waitForWsOpen(ws: WebSocket, timeoutMs = 10000): Promise<void> {
  if (rs(ws) === WS_OPEN) return Promise.resolve();
  if (rs(ws) !== WS_CONNECTING) {
    return Promise.reject(new Error("ws not connecting"));
  }

  return new Promise((resolve, reject) => {
    let done = false;

    const timer = globalThis.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("voice ws connect timeout"));
    }, timeoutMs);

    const ok = () => {
      if (done) return;
      done = true;
      globalThis.clearTimeout(timer);
      resolve();
    };

    const fail = (msg: string) => {
      if (done) return;
      done = true;
      globalThis.clearTimeout(timer);
      reject(new Error(msg));
    };

    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", () => fail("voice ws connect error"), { once: true });
    ws.addEventListener("close", () => fail("voice ws closed before open"), { once: true });
  });
}

function b64ToU8(b64: string): Uint8Array {
  // browser-only
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
    out[i] = s / 32768;
  }
  return out;
}

function applyEdgeFade(samples: Float32Array, fadeSamples = 64) {
  const n = samples.length;
  const k = Math.min(fadeSamples, Math.floor(n / 2));
  if (k <= 0) return;
  for (let i = 0; i < k; i++) {
    const g = i / k;
    samples[i] *= g;
    samples[n - 1 - i] *= g;
  }
}

function buildWsUrl(opts: UseGrokVoiceOpts): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const path = opts.wsPath ?? "/ws/voice";

  const q = new URLSearchParams();
  q.set("voice", opts.voice);
  q.set("token", opts.token);
  q.set("turn", opts.turn ?? "none");
  q.set("in_rate", String(opts.inputRate ?? 24000));
  q.set("out_rate", String(opts.outputRate ?? 24000));
  if (opts.instructions) q.set("instructions", opts.instructions);

  return `${proto}//${host}${path}?${q.toString()}`;
}

export function useGrokVoice(opts: UseGrokVoiceOpts): UseGrokVoiceApi {
  const [status, setStatus] = useState<GrokVoiceStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const setVolume = useCallback((v: number) => {
    const g = gainRef.current;
    if (g) g.gain.value = Math.max(0, Math.min(1, v));
  }, []);

  const ensureAudio = useCallback(() => {
    if (audioCtxRef.current) return;

    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctor({ latencyHint: "interactive" });
    const gain = ctx.createGain();

    gain.gain.value = opts.volume ?? 1;
    gain.connect(ctx.destination);

    audioCtxRef.current = ctx;
    gainRef.current = gain;
    nextPlayTimeRef.current = ctx.currentTime + 0.05;

    // Safari: must be sync inside click
    if (ctx.state !== "running") {
      void ctx.resume();
    }
  }, [opts.volume]);

  const enqueuePcm = useCallback((pcm16: Uint8Array, sampleRate = 24000) => {
    const ctx = audioCtxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;

    const f32 = pcm16leToF32(pcm16);
    applyEdgeFade(f32, 64);

    const buf = ctx.createBuffer(1, f32.length, sampleRate);
    const ch = buf.getChannelData(0);
    ch.set(f32);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);

    const now = ctx.currentTime;
    let t = nextPlayTimeRef.current;
    if (t < now + 0.02) t = now + 0.02; // catch up if we fell behind

    src.start(t);
    nextPlayTimeRef.current = t + buf.duration;
  }, []);

  const sendEvent = useCallback((ev: AnyJson) => {
    const ws = wsRef.current;
    if (!ws || rs(ws) !== WS_OPEN) throw new Error("not connected");
    ws.send(JSON.stringify(ev));
  }, []);

  const disconnect = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch { }
    wsRef.current = null;
    setStatus("closed");
  }, []);

  const connect = useCallback(async () => {
    const existing = wsRef.current;

    // already open
    if (existing && rs(existing) === WS_OPEN) {
      setStatus("ready");
      return;
    }

    // someone else already started connecting: await it
    if (connectPromiseRef.current) {
      await connectPromiseRef.current;
      return;
    }

    // existing socket is CONNECTING: wait for OPEN (DO NOT return early)
    if (existing && rs(existing) === WS_CONNECTING) {
      setLastError(null);
      setStatus("connecting");

      const p = waitForWsOpen(existing);
      connectPromiseRef.current = p;
      try {
        await p;
        if (wsRef.current === existing && rs(existing) === WS_OPEN) {
          setStatus("ready");
        }
      } finally {
        if (connectPromiseRef.current === p) connectPromiseRef.current = null;
      }
      return;
    }

    setLastError(null);
    setStatus("connecting");
    await ensureAudio();

    const url = buildWsUrl(opts);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    // Install handlers immediately (avoid missing early events / close)
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(String(e.data)) as AnyJson;
        opts.onEvent?.(ev);

        const t = ev?.type;
        if (t === "response.output_audio.delta") {
          const b64 = String(ev.delta ?? "");
          if (b64) enqueuePcm(b64ToU8(b64), opts.outputRate ?? 24000);
          return;
        }
        if (t === "response.output_audio_transcript.delta") {
          const d = String(ev.delta ?? "");
          if (d) opts.onTranscriptDelta?.(d);
          return;
        }
        if (t === "error") {
          const msg = typeof ev.error === "string" ? ev.error : JSON.stringify(ev);
          setLastError(msg);
          if (wsRef.current === ws) setStatus("error");
          return;
        }
      } catch (err: any) {
        setLastError(String(err?.message ?? err));
        if (wsRef.current === ws) setStatus("error");
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        setStatus("closed");
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws) {
        setLastError("websocket error");
        setStatus("error");
      }
    };

    const p = waitForWsOpen(ws);
    connectPromiseRef.current = p;
    try {
      await p;
      if (wsRef.current === ws && rs(ws) === WS_OPEN) {
        setStatus("ready");
      }
    } finally {
      if (connectPromiseRef.current === p) connectPromiseRef.current = null;
    }
  }, [ensureAudio, enqueuePcm, opts]);

  const speakText = useCallback((text: string) => {
    // unlock audio on user gesture
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "running") {
      void ctx.resume();
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("not connected");
    }

    const trimmed = (text ?? "").trim();
    if (!trimmed) return;

    let mode: "verbatim" | "freeform" = "verbatim";
    try {
      const raw = localStorage.getItem("vs_grok_voice_mode");
      if (raw) {
        const v = JSON.parse(raw);
        if (v === "freeform") mode = "freeform";
      }
    } catch { }

    const plain = trimmed;

    const VERBATIM = [
      "Read the following text VERBATIM.",
      "Rules: do not paraphrase, do not add any words, do not omit anything.",
      "Do not add acknowledgements like 'Sure' or 'Okay'.",
      "",
      "BEGIN_VERBATIM",
      plain,
      "END_VERBATIM",
    ].join("\n");

    const inputText = mode === "verbatim" ? VERBATIM : plain;

    ws.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: inputText }],
      }
    }));

    ws.send(JSON.stringify({
      type: "response.create",
      response: { modalities: mode === "verbatim" ? ["audio"] : ["audio", "text"] }
    }));
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try { wsRef.current?.close(); } catch { }
      wsRef.current = null;

      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      gainRef.current = null;
      if (ctx) {
        try { ctx.close(); } catch { }
      }
    };
  }, []);

  return {
    status,
    lastError,
    connect,
    disconnect,
    speakText,
    sendEvent,
    setVolume,
    isConnected: status === "ready",
  };
}

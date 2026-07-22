"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";

let activeRealtimeOwner: symbol | null = null;
let activeRealtimeStop: (() => void) | null = null;

export type OpenAIRealtimeVoiceStatus =
  | "idle"
  | "connecting"
  | "active"
  | "error";

type StartOptions = {
  model?: string;
  voice?: string;
  instructions?: string;
};

function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };

    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };

    const timer = window.setTimeout(finish, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function makeCancelledError() {
  const err = new Error("Realtime voice start cancelled.");
  (err as any).name = "AbortError";
  return err;
}

export function useOpenAIRealtimeVoice() {
  const ownerRef = useRef(Symbol("openai-realtime-voice"));
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // Incrementing this invalidates any in-flight async start().
  const generationRef = useRef(0);
  const startingRef = useRef(false);

  const [status, setStatus] = useState<OpenAIRealtimeVoiceStatus>("idle");
  const [lastError, setLastError] = useState<string>("");

  const stop = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;

    setStatus("idle");
    setLastError("");

    const dc = dataChannelRef.current;
    dataChannelRef.current = null;
    try {
      dc?.close();
    } catch {}

    const pc = pcRef.current;
    pcRef.current = null;

    try {
      pc?.getSenders().forEach((sender) => {
        try {
          sender.track?.stop();
        } catch {}
      });
    } catch {}

    try {
      pc?.close();
    } catch {}

    const stream = streamRef.current;
    streamRef.current = null;

    try {
      stream?.getTracks().forEach((track) => track.stop());
    } catch {}

    const audio = audioRef.current;
    audioRef.current = null;

    try {
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audio.removeAttribute("src");
        audio.load();
      }
    } catch {}

    if (activeRealtimeOwner === ownerRef.current) {
      activeRealtimeOwner = null;
      activeRealtimeStop = null;
    }
  }, []);

  const start = useCallback(async (opts: StartOptions = {}) => {
    if (startingRef.current) return;

    if (activeRealtimeOwner !== ownerRef.current) {
      activeRealtimeStop?.();
    }
    stop();
    activeRealtimeOwner = ownerRef.current;
    activeRealtimeStop = stop;

    const generation = generationRef.current;
    startingRef.current = true;

    const assertCurrent = () => {
      if (generationRef.current !== generation) {
        throw makeCancelledError();
      }
    };

    setStatus("connecting");
    setLastError("");

    try {
      if (typeof window === "undefined") {
        throw new Error("Realtime voice is only available in the browser.");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      assertCurrent();
      streamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      assertCurrent();
      pcRef.current = pc;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "true");
      audioRef.current = remoteAudio;

      pc.ontrack = (event) => {
        if (generationRef.current !== generation) return;
        const [remoteStream] = event.streams;
        if (remoteStream) {
          remoteAudio.srcObject = remoteStream;
          remoteAudio.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (generationRef.current !== generation) return;

        if (pc.connectionState === "connected") {
          setStatus("active");
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected"
        ) {
          setStatus("idle");
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onmessage = (event) => {
        if (generationRef.current !== generation) return;

        try {
          const payload = JSON.parse(String(event.data || "{}"));
          const type = String(payload?.type || "");
          if (type === "error") {
            const msg = String(payload?.error?.message || payload?.message || "Realtime voice error");
            setLastError(msg);
            console.error("OpenAI realtime voice event error:", payload);
          }
        } catch {}
      };

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      assertCurrent();

      await pc.setLocalDescription(offer);
      assertCurrent();

      await waitForIceGatheringComplete(pc);
      assertCurrent();

      const finalOffer = pc.localDescription;
      if (!finalOffer?.sdp) {
        throw new Error("Failed to create local SDP offer.");
      }

      const qs = new URLSearchParams();
      if (opts.model) qs.set("model", opts.model);
      if (opts.voice) qs.set("voice", opts.voice);
      if (opts.instructions) qs.set("instructions", opts.instructions);

      const url = `/api/voice/openai/webrtc-offer${qs.toString() ? `?${qs.toString()}` : ""}`;

      const r = await authFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: finalOffer.sdp,
      });
      assertCurrent();

      const answerText = await r.text();
      assertCurrent();

      if (!r.ok) {
        throw new Error(answerText || `Realtime WebRTC offer failed: HTTP ${r.status}`);
      }

      const answerForValidation = answerText.trimStart();
      if (!answerForValidation || !answerForValidation.startsWith("v=")) {
        throw new Error(`Invalid SDP answer from backend: ${answerForValidation.slice(0, 180)}`);
      }

      const answerSdp = answerText
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "a=extmap-allow-mixed")
        .join("\r\n");

      const normalizedAnswerSdp = answerSdp.endsWith("\r\n") ? answerSdp : `${answerSdp}\r\n`;

      await pc.setRemoteDescription({
        type: "answer",
        sdp: normalizedAnswerSdp,
      });
      assertCurrent();

      startingRef.current = false;
      setStatus("active");
    } catch (e: any) {
      startingRef.current = false;

      if (e?.name === "AbortError") {
        setStatus("idle");
        return;
      }

      const msg = String(e?.message || e || "Realtime voice failed.");
      setLastError(msg);
      setStatus("error");
      stop();
      throw new Error(msg);
    }
  }, [stop]);

  const toggle = useCallback(async (opts: StartOptions = {}) => {
    if (status === "active" || status === "connecting" || startingRef.current) {
      stop();
      return;
    }

    await start(opts);
  }, [start, status, stop]);

  useEffect(() => {
    const stopOnPageHide = () => stop();
    window.addEventListener("pagehide", stopOnPageHide);

    return () => {
      window.removeEventListener("pagehide", stopOnPageHide);
      stop();
    };
  }, [stop]);

  return {
    status,
    lastError,
    isActive: status === "active" || status === "connecting",
    start,
    stop,
    toggle,
  };
}

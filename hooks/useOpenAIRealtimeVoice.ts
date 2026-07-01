"use client";

import { useCallback, useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";

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

export function useOpenAIRealtimeVoice() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const [status, setStatus] = useState<OpenAIRealtimeVoiceStatus>("idle");
  const [lastError, setLastError] = useState<string>("");

  const stop = useCallback(() => {
    setStatus("idle");
    setLastError("");

    try {
      dataChannelRef.current?.close();
    } catch {}
    dataChannelRef.current = null;

    try {
      pcRef.current?.getSenders().forEach((sender) => {
        try {
          sender.track?.stop();
        } catch {}
      });
    } catch {}

    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    } catch {}
    streamRef.current = null;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
      }
    } catch {}
    audioRef.current = null;
  }, []);

  const start = useCallback(async (opts: StartOptions = {}) => {
    stop();
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
      streamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "true");
      audioRef.current = remoteAudio;

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          remoteAudio.srcObject = remoteStream;
          remoteAudio.play().catch(() => {
            // Browser may require a user gesture; start() is triggered by a click.
          });
        }
      };

      pc.onconnectionstatechange = () => {
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
        try {
          const payload = JSON.parse(String(event.data || "{}"));
          const type = String(payload?.type || "");
          if (type === "error") {
            const msg = String(payload?.error?.message || payload?.message || "Realtime voice error");
            setLastError(msg);
            console.error("OpenAI realtime voice event error:", payload);
          }
        } catch {
          // Non-JSON events are ignored for phase 1.
        }
      };

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });

      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

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

      const answerText = await r.text();

      if (!r.ok) {
        throw new Error(answerText || `Realtime WebRTC offer failed: HTTP ${r.status}`);
      }

      const answerForValidation = answerText.trimStart();
      if (!answerForValidation || !answerForValidation.startsWith("v=")) {
        throw new Error(`Invalid SDP answer from backend: ${answerForValidation.slice(0, 180)}`);
      }

      // Safari/WebKit compatibility shim.
      // Some Safari builds reject the session-level extmap-allow-mixed SDP attribute.
      // Preserve CRLF SDP formatting and only remove that known compatibility line.
      const answerSdp = answerText
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "a=extmap-allow-mixed")
        .join("\r\n");

      const normalizedAnswerSdp = answerSdp.endsWith("\r\n") ? answerSdp : `${answerSdp}\r\n`;

      await pc.setRemoteDescription({
        type: "answer",
        sdp: normalizedAnswerSdp,
      });

      setStatus("active");
    } catch (e: any) {
      const msg = String(e?.message || e || "Realtime voice failed.");
      setLastError(msg);
      setStatus("error");
      stop();
      throw new Error(msg);
    }
  }, [stop]);

  const toggle = useCallback(async (opts: StartOptions = {}) => {
    if (status === "active" || status === "connecting") {
      stop();
      return;
    }

    await start(opts);
  }, [start, status, stop]);

  return {
    status,
    lastError,
    isActive: status === "active" || status === "connecting",
    start,
    stop,
    toggle,
  };
}

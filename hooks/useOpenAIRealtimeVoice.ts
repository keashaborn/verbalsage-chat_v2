import { useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";

type Status = "idle" | "active" | "error";

export function useOpenAIRealtimeVoice() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [status, setStatus] = useState<Status>("idle");

  async function start() {
    try {
      stop();

      setStatus("active");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pcRef.current = pc;

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;

      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const r = await authFetch("/api/voice/openai/webrtc-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: offer.sdp,
        }),
      });

      if (!r.ok) {
        throw new Error(await r.text());
      }

      const data = await r.json();
      const answer =
        data?.sdp ||
        data?.answer ||
        data?.data?.sdp;

      if (!answer) {
        throw new Error("Missing SDP answer from backend");
      }

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answer,
      });

      setStatus("active");
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  function stop() {
    setStatus("idle");

    try {
      pcRef.current?.close();
    } catch {}

    pcRef.current = null;

    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}

    streamRef.current = null;

    try {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    } catch {}

    audioRef.current = null;
  }

  function toggle() {
    if (status === "active") stop();
    else start();
  }

  return {
    status,
    start,
    stop,
    toggle,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";

export type GovernedRealtimeVoiceStatus =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "speaking"
  | "transcribing"
  | "responding"
  | "error";

type StartOptions = {
  onTranscript: (transcript: string) => Promise<void>;
};

const SPEECH_START_RMS = 0.025;
const SPEECH_END_RMS = 0.018;
const END_SILENCE_MS = 900;
const MIN_SPEECH_MS = 250;
const MAX_TURN_MS = 90_000;

let activeOwner: symbol | null = null;
let activeStop: (() => void) | null = null;

function cancelledError() {
  const error = new Error("Voice session cancelled.");
  (error as any).name = "AbortError";
  return error;
}

function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 4_000,
): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function waitForDataChannelOpen(
  channel: RTCDataChannel,
  timeoutMs = 10_000,
): Promise<void> {
  if (channel.readyState === "open") return Promise.resolve();

  return new Promise((resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      channel.removeEventListener("open", onOpen);
      channel.removeEventListener("close", onClose);
      channel.removeEventListener("error", onError);
    };
    const succeed = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve();
    };
    const fail = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("Realtime transcription connection failed."));
    };
    const onOpen = () => succeed();
    const onClose = () => fail();
    const onError = () => fail();
    const timer = window.setTimeout(fail, timeoutMs);
    channel.addEventListener("open", onOpen);
    channel.addEventListener("close", onClose);
    channel.addEventListener("error", onError);
  });
}

function normalizedSdp(raw: string): string {
  const filtered = raw
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "a=extmap-allow-mixed")
    .join("\r\n");
  return filtered.endsWith("\r\n") ? filtered : `${filtered}\r\n`;
}

export function useGovernedRealtimeVoice() {
  const ownerRef = useRef(Symbol("governed-realtime-voice"));
  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const transcriptTimeoutRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const speechStartedAtRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const onTranscriptRef = useRef<StartOptions["onTranscript"] | null>(null);

  const [status, setStatus] = useState<GovernedRealtimeVoiceStatus>("idle");
  const [lastError, setLastError] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");

  const setInputEnabled = useCallback((enabled: boolean) => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;
    processingRef.current = false;
    speechStartedAtRef.current = null;
    lastSpeechAtRef.current = null;
    onTranscriptRef.current = null;

    if (animationRef.current != null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (transcriptTimeoutRef.current != null) {
      window.clearTimeout(transcriptTimeoutRef.current);
      transcriptTimeoutRef.current = null;
    }

    const channel = channelRef.current;
    channelRef.current = null;
    try {
      channel?.close();
    } catch {}

    const peer = peerRef.current;
    peerRef.current = null;
    try {
      peer?.close();
    } catch {}

    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    analyserRef.current = null;
    void audioContext?.close().catch(() => {});

    setPartialTranscript("");
    setLastError("");
    setStatus("idle");

    if (activeOwner === ownerRef.current) {
      activeOwner = null;
      activeStop = null;
    }
  }, []);

  const start = useCallback(
    async ({ onTranscript }: StartOptions) => {
      if (startingRef.current || (status !== "idle" && status !== "error"))
        return;
      if (activeOwner !== ownerRef.current) activeStop?.();
      stop();

      activeOwner = ownerRef.current;
      activeStop = stop;
      const generation = generationRef.current;
      startingRef.current = true;
      onTranscriptRef.current = onTranscript;
      setLastError("");
      setStatus("requesting");

      const assertCurrent = () => {
        if (generationRef.current !== generation) throw cancelledError();
      };

      const failSession = (message: string) => {
        if (generationRef.current !== generation) return;
        stop();
        setLastError(message);
        setStatus("error");
      };

      const resumeListening = () => {
        if (generationRef.current !== generation) return;
        processingRef.current = false;
        speechStartedAtRef.current = null;
        lastSpeechAtRef.current = null;
        setPartialTranscript("");
        setInputEnabled(true);
        setStatus("listening");
      };

      try {
        if (
          typeof window === "undefined" ||
          !navigator.mediaDevices?.getUserMedia ||
          typeof RTCPeerConnection === "undefined"
        ) {
          throw new Error("Continuous voice is not available in this browser.");
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

        const AudioContextConstructor =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextConstructor) {
          throw new Error("Audio analysis is not available in this browser.");
        }
        const audioContext: AudioContext = new AudioContextConstructor();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;

        setStatus("connecting");
        const peer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerRef.current = peer;
        const channel = peer.createDataChannel("oai-events");
        channelRef.current = channel;

        peer.ontrack = (event) => {
          event.track.stop();
          failSession(
            "The transcription-only session unexpectedly produced audio.",
          );
        };
        peer.onconnectionstatechange = () => {
          if (generationRef.current !== generation) return;
          if (
            peer.connectionState === "failed" ||
            peer.connectionState === "closed"
          ) {
            failSession("Realtime transcription connection closed.");
          }
        };

        channel.addEventListener("message", (event) => {
          if (generationRef.current !== generation) return;
          try {
            const payload = JSON.parse(String(event.data || "{}"));
            const type = String(payload?.type || "");

            if (type === "session.created") {
              if (String(payload?.session?.type || "") !== "transcription") {
                failSession(
                  "OpenAI did not create a transcription-only session.",
                );
              }
              return;
            }

            if (type.startsWith("response.")) {
              failSession(
                "The transcription session attempted to generate a response.",
              );
              return;
            }

            if (type === "error") {
              const message = String(
                payload?.error?.message ||
                  payload?.message ||
                  "Realtime transcription error.",
              );
              failSession(message);
              return;
            }

            if (type === "conversation.item.input_audio_transcription.delta") {
              setPartialTranscript(
                (current) => `${current}${String(payload?.delta || "")}`,
              );
              return;
            }

            if (
              type === "conversation.item.input_audio_transcription.completed"
            ) {
              if (transcriptTimeoutRef.current != null) {
                window.clearTimeout(transcriptTimeoutRef.current);
                transcriptTimeoutRef.current = null;
              }
              const transcript = String(payload?.transcript || "").trim();
              setPartialTranscript("");
              if (!transcript) {
                resumeListening();
                return;
              }

              setStatus("responding");
              void Promise.resolve(onTranscriptRef.current?.(transcript))
                .catch((error: any) => {
                  if (generationRef.current !== generation) return;
                  setLastError(
                    String(error?.message || error || "Voice response failed."),
                  );
                })
                .finally(() => resumeListening());
            }
          } catch {
            // Ignore unknown non-JSON events; recognized errors fail closed.
          }
        });

        const [track] = stream.getAudioTracks();
        if (!track) throw new Error("No microphone audio track was available.");
        peer.addTransceiver(track, {
          direction: "sendonly",
          streams: [stream],
        });

        const offer = await peer.createOffer();
        assertCurrent();
        await peer.setLocalDescription(offer);
        await waitForIceGatheringComplete(peer);
        assertCurrent();

        const localSdp = peer.localDescription?.sdp;
        if (!localSdp)
          throw new Error("Failed to create the voice connection.");

        const response = await authFetch(
          "/api/voice/openai/transcription-webrtc-offer",
          {
            method: "POST",
            headers: { "Content-Type": "application/sdp" },
            body: localSdp,
          },
        );
        const answerText = await response.text();
        assertCurrent();
        if (!response.ok) {
          throw new Error(
            answerText ||
              `Realtime transcription failed: HTTP ${response.status}`,
          );
        }
        if (!answerText.trimStart().startsWith("v=")) {
          throw new Error("The voice service returned an invalid connection.");
        }

        await peer.setRemoteDescription({
          type: "answer",
          sdp: normalizedSdp(answerText),
        });
        await waitForDataChannelOpen(channel);
        assertCurrent();

        startingRef.current = false;
        setStatus("listening");

        const samples = new Uint8Array(analyser.fftSize);
        const runVad = () => {
          if (generationRef.current !== generation) return;
          animationRef.current = window.requestAnimationFrame(runVad);
          if (processingRef.current || channel.readyState !== "open") return;

          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const value = (samples[index] - 128) / 128;
            sumSquares += value * value;
          }
          const rms = Math.sqrt(sumSquares / samples.length);
          const now = performance.now();

          if (speechStartedAtRef.current == null) {
            if (rms >= SPEECH_START_RMS) {
              speechStartedAtRef.current = now;
              lastSpeechAtRef.current = now;
              setStatus("speaking");
            }
            return;
          }

          if (rms >= SPEECH_END_RMS) lastSpeechAtRef.current = now;
          const speechMs = now - speechStartedAtRef.current;
          const silenceMs = now - (lastSpeechAtRef.current || now);
          if (
            speechMs < MAX_TURN_MS &&
            (speechMs < MIN_SPEECH_MS || silenceMs < END_SILENCE_MS)
          ) {
            return;
          }

          processingRef.current = true;
          setInputEnabled(false);
          setStatus("transcribing");
          channel.send(
            JSON.stringify({
              event_id: `voice_commit_${Date.now()}`,
              type: "input_audio_buffer.commit",
            }),
          );
          transcriptTimeoutRef.current = window.setTimeout(() => {
            failSession("Realtime transcription timed out.");
          }, 30_000);
        };
        runVad();
      } catch (error: any) {
        startingRef.current = false;
        if (error?.name === "AbortError") return;
        const message = String(
          error?.message || error || "Continuous voice failed.",
        );
        stop();
        setLastError(message);
        setStatus("error");
        throw new Error(message);
      }
    },
    [setInputEnabled, status, stop],
  );

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
    partialTranscript,
    start,
    stop,
  };
}

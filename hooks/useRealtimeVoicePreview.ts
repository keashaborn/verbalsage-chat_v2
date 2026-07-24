"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { authFetch } from "@/lib/authFetch";
import { VOICE_SESSION_HEADER } from "@/lib/voiceSession";
import { voiceErrorMessage } from "@/lib/voiceError";

export type RealtimeVoicePreviewStatus =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export type RealtimeVoicePreviewTurn = {
  transcript: string;
  answer: string;
  answerId: string;
  voiceTurnId: string;
  requestId: string;
  sequence: number;
};

type StartOptions = {
  threadId: string;
  onResponse: (turn: RealtimeVoicePreviewTurn) => void | Promise<void>;
  onLeaseLost?: () => void;
};

type PreviewEvent = {
  cursor?: unknown;
  type?: unknown;
  transcript?: unknown;
  answer?: unknown;
  answer_id?: unknown;
  voice_turn_id?: unknown;
  request_id?: unknown;
  sequence?: unknown;
  error?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SPEECH_START_RMS = 0.025;
const SPEECH_END_RMS = 0.018;
const END_SILENCE_MS = 700;
const MIN_SPEECH_MS = 250;
const MAX_TURN_MS = 90_000;
const VOICE_LEASE_HEARTBEAT_MS = 2_000;
const EVENT_POLL_MS = 300;
const VOICE_SESSION_OWNER_KEY = "vs_active_voice_session_v1";

function cancelledError() {
  const error = new Error("Realtime voice preview cancelled.");
  (error as any).name = "AbortError";
  return error;
}

function responseError(payload: any, fallback: string): string {
  return String(
    payload?.detail?.error || payload?.detail || payload?.error || fallback,
  );
}

export function useRealtimeVoicePreview() {
  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const leaseHeartbeatRef = useRef<number | null>(null);
  const previewSessionIdRef = useRef("");
  const voiceSessionIdRef = useRef("");
  const crossTabOwnerRef = useRef("");
  const speechStartedAtRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const commitInFlightRef = useRef(false);
  const eventCursorRef = useRef(0);
  const onResponseRef = useRef<StartOptions["onResponse"] | null>(null);
  const onLeaseLostRef = useRef<StartOptions["onLeaseLost"] | null>(null);

  const [status, setStatus] = useState<RealtimeVoicePreviewStatus>("idle");
  const [lastError, setLastError] = useState("");

  const stop = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;
    commitInFlightRef.current = false;
    speechStartedAtRef.current = null;
    lastSpeechAtRef.current = null;
    onResponseRef.current = null;
    onLeaseLostRef.current = null;

    if (animationRef.current != null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    if (leaseHeartbeatRef.current != null) {
      window.clearInterval(leaseHeartbeatRef.current);
      leaseHeartbeatRef.current = null;
    }

    const previewSessionId = previewSessionIdRef.current;
    const voiceSessionId = voiceSessionIdRef.current;
    previewSessionIdRef.current = "";
    voiceSessionIdRef.current = "";
    if (previewSessionId || voiceSessionId) {
      void (async () => {
        if (previewSessionId && voiceSessionId) {
          await authFetch(
            `/api/voice/realtime-preview/session/${encodeURIComponent(
              previewSessionId,
            )}`,
            {
              method: "DELETE",
              headers: { [VOICE_SESSION_HEADER]: voiceSessionId },
              keepalive: true,
            },
          ).catch(() => {});
        }
        if (voiceSessionId) {
          await authFetch("/api/voice/session/release", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: voiceSessionId }),
            keepalive: true,
          }).catch(() => {});
        }
      })();
    }

    try {
      if (
        crossTabOwnerRef.current &&
        localStorage.getItem(VOICE_SESSION_OWNER_KEY) ===
          crossTabOwnerRef.current
      ) {
        localStorage.removeItem(VOICE_SESSION_OWNER_KEY);
      }
    } catch {}

    const channel = dataChannelRef.current;
    dataChannelRef.current = null;
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

    eventCursorRef.current = 0;
    setLastError("");
    setStatus("idle");
  }, []);

  const fail = useCallback(
    (message: string) => {
      stop();
      setLastError(message);
      setStatus("error");
    },
    [stop],
  );

  const start = useCallback(
    async ({ threadId, onResponse, onLeaseLost }: StartOptions) => {
      if (startingRef.current || (status !== "idle" && status !== "error")) {
        return;
      }
      if (!UUID_RE.test(threadId)) {
        throw new Error("A valid chat is required for Realtime voice.");
      }
      stop();
      const generation = generationRef.current;
      const voiceSessionId = crypto.randomUUID();
      startingRef.current = true;
      onResponseRef.current = onResponse;
      onLeaseLostRef.current = onLeaseLost || null;
      setLastError("");
      setStatus("requesting");
      try {
        crossTabOwnerRef.current = crypto.randomUUID();
        localStorage.setItem(VOICE_SESSION_OWNER_KEY, crossTabOwnerRef.current);
      } catch {}

      const assertCurrent = () => {
        if (generationRef.current !== generation) throw cancelledError();
      };
      const loseLease = () => {
        if (generationRef.current !== generation) return;
        const callback = onLeaseLostRef.current;
        stop();
        callback?.();
      };

      try {
        if (
          typeof window === "undefined" ||
          !navigator.mediaDevices?.getUserMedia ||
          typeof RTCPeerConnection === "undefined"
        ) {
          throw new Error("Realtime voice is not available in this browser.");
        }

        voiceSessionIdRef.current = voiceSessionId;
        const leaseResponse = await authFetch("/api/voice/session/acquire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: voiceSessionId }),
        });
        assertCurrent();
        if (!leaseResponse.ok) {
          throw new Error(
            leaseResponse.status === 401
              ? "Your session expired. Please sign in again."
              : "Voice is temporarily unavailable.",
          );
        }

        leaseHeartbeatRef.current = window.setInterval(() => {
          void authFetch("/api/voice/session/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: voiceSessionId }),
          })
            .then((response) => {
              if (generationRef.current !== generation) return;
              if (response.status === 409) {
                loseLease();
              } else if (!response.ok) {
                fail("The voice connection was lost.");
              }
            })
            .catch(() => {
              if (generationRef.current === generation) {
                fail("The voice connection was lost.");
              }
            });
        }, VOICE_LEASE_HEARTBEAT_MS);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        assertCurrent();
        streamRef.current = stream;

        setStatus("connecting");
        const peer = new RTCPeerConnection();
        peerRef.current = peer;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const dataChannel = peer.createDataChannel("oai-events");
        dataChannelRef.current = dataChannel;
        dataChannel.addEventListener("message", () => {
          // The browser never accepts answers or control events from OpenAI.
          // Canonical events are delivered by the authenticated Brains BFF.
        });
        peer.addEventListener("connectionstatechange", () => {
          if (
            generationRef.current === generation &&
            ["failed", "closed"].includes(peer.connectionState)
          ) {
            fail("The Realtime voice connection closed.");
          }
        });

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        assertCurrent();
        const offerSdp = peer.localDescription?.sdp || "";
        if (!offerSdp.startsWith("v=0")) {
          throw new Error("The browser could not create a voice session.");
        }
        const callResponse = await authFetch(
          "/api/voice/realtime-preview/call",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/sdp",
              "x-vs-thread-id": threadId,
              [VOICE_SESSION_HEADER]: voiceSessionId,
            },
            body: offerSdp,
          },
        );
        const answerSdp = await callResponse.text();
        assertCurrent();
        if (!callResponse.ok) {
          let payload: any = {};
          try {
            payload = JSON.parse(answerSdp);
          } catch {}
          throw new Error(
            responseError(payload, "Realtime voice could not connect."),
          );
        }
        const previewSessionId = String(
          callResponse.headers.get("x-vs-realtime-preview-session-id") || "",
        )
          .trim()
          .toLowerCase();
        if (!UUID_RE.test(previewSessionId)) {
          throw new Error("Realtime voice session binding was not returned.");
        }
        previewSessionIdRef.current = previewSessionId;
        await peer.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });
        assertCurrent();

        const AudioContextConstructor =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextConstructor) {
          throw new Error("Audio analysis is not available in this browser.");
        }
        const audioContext: AudioContext = new AudioContextConstructor();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") await audioContext.resume();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;

        const processEvents = async (events: PreviewEvent[]) => {
          for (const event of events) {
            const type = String(event?.type || "");
            if (type === "session.connected") {
              setStatus("listening");
            } else if (type === "transcript.completed") {
              setStatus("processing");
            } else if (type === "response.completed") {
              const turn: RealtimeVoicePreviewTurn = {
                transcript: String(event.transcript || "").trim(),
                answer: String(event.answer || "").trim(),
                answerId: String(event.answer_id || ""),
                voiceTurnId: String(event.voice_turn_id || ""),
                requestId: String(event.request_id || ""),
                sequence: Number(event.sequence || 0),
              };
              if (
                !turn.transcript ||
                !turn.answer ||
                !UUID_RE.test(turn.answerId) ||
                !UUID_RE.test(turn.voiceTurnId) ||
                !Number.isSafeInteger(turn.sequence) ||
                turn.sequence < 1
              ) {
                throw new Error(
                  "Realtime voice returned an invalid governed turn.",
                );
              }
              setStatus("speaking");
              await onResponseRef.current?.(turn);
              if (generationRef.current === generation) {
                setStatus("listening");
              }
            } else if (type === "session.failed" || type === "turn.failed") {
              throw new Error(String(event.error || "Realtime voice failed."));
            }
          }
        };

        const poll = async () => {
          if (generationRef.current !== generation) return;
          const pollAbort = new AbortController();
          pollAbortRef.current = pollAbort;
          try {
            const response = await authFetch(
              `/api/voice/realtime-preview/session/${encodeURIComponent(
                previewSessionId,
              )}?after=${eventCursorRef.current}&limit=50`,
              {
                method: "GET",
                headers: { [VOICE_SESSION_HEADER]: voiceSessionId },
                signal: pollAbort.signal,
              },
            );
            const payload = await response.json().catch(() => ({}));
            assertCurrent();
            if (!response.ok) {
              throw new Error(
                responseError(
                  payload,
                  "Realtime voice events were unavailable.",
                ),
              );
            }
            const events = Array.isArray(payload?.events)
              ? (payload.events as PreviewEvent[])
              : [];
            const nextCursor = Number(payload?.next_cursor);
            if (
              !Number.isSafeInteger(nextCursor) ||
              nextCursor < eventCursorRef.current
            ) {
              throw new Error("Realtime voice event cursor was invalid.");
            }
            await processEvents(events);
            eventCursorRef.current = nextCursor;
          } catch (error: any) {
            if (error?.name === "AbortError") return;
            fail(voiceErrorMessage(error, "Realtime voice events failed."));
            return;
          } finally {
            if (pollAbortRef.current === pollAbort) {
              pollAbortRef.current = null;
            }
          }
          if (generationRef.current === generation) {
            pollTimerRef.current = window.setTimeout(
              () => void poll(),
              EVENT_POLL_MS,
            );
          }
        };

        const commitTurn = async () => {
          if (
            commitInFlightRef.current ||
            generationRef.current !== generation
          ) {
            return;
          }
          commitInFlightRef.current = true;
          speechStartedAtRef.current = null;
          lastSpeechAtRef.current = null;
          try {
            const response = await authFetch(
              `/api/voice/realtime-preview/session/${encodeURIComponent(
                previewSessionId,
              )}/commit`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  [VOICE_SESSION_HEADER]: voiceSessionId,
                },
                body: "{}",
              },
            );
            const payload = await response.json().catch(() => ({}));
            assertCurrent();
            if (!response.ok) {
              throw new Error(
                responseError(payload, "Realtime voice commit failed."),
              );
            }
            setStatus("processing");
          } catch (error: any) {
            if (error?.name !== "AbortError") {
              fail(voiceErrorMessage(error, "Realtime voice commit failed."));
            }
          } finally {
            commitInFlightRef.current = false;
          }
        };

        const samples = new Uint8Array(analyser.fftSize);
        const runVad = () => {
          if (generationRef.current !== generation) return;
          animationRef.current = window.requestAnimationFrame(runVad);
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
              setStatus("listening");
            }
            return;
          }
          if (rms >= SPEECH_END_RMS) lastSpeechAtRef.current = now;
          const speechMs = now - speechStartedAtRef.current;
          const silenceMs = now - (lastSpeechAtRef.current || now);
          if (
            speechMs >= MAX_TURN_MS ||
            (speechMs >= MIN_SPEECH_MS && silenceMs >= END_SILENCE_MS)
          ) {
            void commitTurn();
          }
        };

        startingRef.current = false;
        setStatus("listening");
        void poll();
        runVad();
      } catch (error: any) {
        startingRef.current = false;
        if (error?.name === "AbortError") return;
        const message = voiceErrorMessage(
          error,
          "Realtime voice could not start.",
        );
        fail(message);
        throw new Error(message);
      }
    },
    [fail, status, stop],
  );

  useEffect(() => {
    const stopOnPageHide = () => stop();
    const stopForOtherWindow = (event: StorageEvent) => {
      if (
        event.key === VOICE_SESSION_OWNER_KEY &&
        event.newValue &&
        event.newValue !== crossTabOwnerRef.current
      ) {
        const callback = onLeaseLostRef.current;
        stop();
        callback?.();
      }
    };
    window.addEventListener("pagehide", stopOnPageHide);
    window.addEventListener("storage", stopForOtherWindow);
    return () => {
      window.removeEventListener("pagehide", stopOnPageHide);
      window.removeEventListener("storage", stopForOtherWindow);
      stop();
    };
  }, [stop]);

  return {
    status,
    lastError,
    start,
    stop,
  };
}

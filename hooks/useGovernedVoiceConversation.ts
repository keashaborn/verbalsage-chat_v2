"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { VOICE_TURN_HEADER } from "@/lib/voiceObservability";
import { VOICE_SESSION_HEADER } from "@/lib/voiceSession";
import {
  BROWSER_TRANSCRIPTION_TIMEOUT_MS,
  withRequestDeadline,
} from "@/lib/requestDeadline";
import { voiceErrorMessage } from "@/lib/voiceError";
import {
  VOICE_LANGUAGE_HEADER,
  type VoiceLanguage,
} from "@/lib/voiceLanguage";

export type GovernedVoiceConversationStatus =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "speaking"
  | "transcribing"
  | "responding"
  | "error";

export type GovernedVoiceTurnContext = {
  voiceTurnId: string;
  voiceSessionId: string;
  speechMs: number;
  audioBytes: number;
  transcriptionMs: number;
  transcriptionModel: string;
  transcriptionProvider: string;
  transcriptionLanguage: string;
  transcriptionConfidenceTokenCount: number | null;
  transcriptionConfidenceMeanLogprob: number | null;
  transcriptionConfidenceMinimumLogprob: number | null;
  transcriptionLowConfidenceTokenCount: number | null;
  transcriptionRequestId: string;
  transcriptionProviderRequestId: string;
  turnStartedAtMs: number;
  speechEndedAtMs: number;
};

export type GovernedVoiceTurnFailureContext = {
  voiceTurnId: string;
  voiceSessionId: string;
  speechMs: number;
  audioBytes: number;
  transcriptionMs: number | null;
  transcriptionRequestId: string;
  transcriptionProviderRequestId: string;
  turnStartedAtMs: number;
};

type StartOptions = {
  language: VoiceLanguage;
  onTranscript: (
    transcript: string,
    context: GovernedVoiceTurnContext,
  ) => Promise<void>;
  onTranscriptionFailure?: (
    context: GovernedVoiceTurnFailureContext,
  ) => Promise<void>;
  onLeaseLost?: () => void;
};

const MIME_TYPE_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
const SPEECH_START_RMS = 0.025;
const SPEECH_END_RMS = 0.018;
const END_SILENCE_MS = 900;
const MIN_SPEECH_MS = 250;
const MAX_TURN_MS = 90_000;
const VOICE_SESSION_OWNER_KEY = "vs_active_voice_session_v1";
const VOICE_LEASE_HEARTBEAT_MS = 2_000;

let activeOwner: symbol | null = null;
let activeStop: (() => void) | null = null;

function cancelledError() {
  const error = new Error("Voice session cancelled.");
  (error as any).name = "AbortError";
  return error;
}

function preferredMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    MIME_TYPE_PREFERENCES.find((value) =>
      MediaRecorder.isTypeSupported(value),
    ) || ""
  );
}

function transcriptionError(payload: any): string {
  return String(
    payload?.detail?.error ||
      payload?.detail ||
      payload?.error ||
      "Transcription failed.",
  );
}

function optionalFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function useGovernedVoiceConversation() {
  const ownerRef = useRef(Symbol("governed-continuous-voice"));
  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const processingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const onTranscriptRef = useRef<StartOptions["onTranscript"] | null>(null);
  const onTranscriptionFailureRef = useRef<
    StartOptions["onTranscriptionFailure"] | null
  >(null);
  const onLeaseLostRef = useRef<StartOptions["onLeaseLost"] | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const crossTabOwnerRef = useRef("");
  const voiceSessionIdRef = useRef("");
  const leaseHeartbeatRef = useRef<number | null>(null);

  const [status, setStatus] = useState<GovernedVoiceConversationStatus>("idle");
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
    onTranscriptionFailureRef.current = null;
    onLeaseLostRef.current = null;
    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = null;

    if (leaseHeartbeatRef.current != null) {
      window.clearInterval(leaseHeartbeatRef.current);
      leaseHeartbeatRef.current = null;
    }
    const voiceSessionId = voiceSessionIdRef.current;
    voiceSessionIdRef.current = "";
    if (voiceSessionId) {
      void authFetch("/api/voice/session/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: voiceSessionId }),
        keepalive: true,
      }).catch(() => {});
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

    if (animationRef.current != null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const recorder = recorderRef.current;
    recorderRef.current = null;
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {}
    chunksRef.current = [];

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

  const stopForOwnershipLoss = useCallback(() => {
    const callback = onLeaseLostRef.current;
    stop();
    callback?.();
  }, [stop]);

  const start = useCallback(
    async ({
      language,
      onTranscript,
      onTranscriptionFailure,
      onLeaseLost,
    }: StartOptions) => {
      if (startingRef.current || (status !== "idle" && status !== "error"))
        return;
      if (activeOwner !== ownerRef.current) activeStop?.();
      stop();

      activeOwner = ownerRef.current;
      activeStop = stop;
      try {
        crossTabOwnerRef.current ||= crypto.randomUUID();
        localStorage.setItem(VOICE_SESSION_OWNER_KEY, crossTabOwnerRef.current);
      } catch {}
      const generation = generationRef.current;
      const voiceSessionId = crypto.randomUUID();
      startingRef.current = true;
      onTranscriptRef.current = onTranscript;
      onTranscriptionFailureRef.current = onTranscriptionFailure || null;
      onLeaseLostRef.current = onLeaseLost || null;
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

      const loseLease = () => {
        if (generationRef.current !== generation) return;
        stopForOwnershipLoss();
      };

      const failLeaseConnection = () => {
        if (generationRef.current !== generation) return;
        stopForOwnershipLoss();
        setLastError("The voice connection was lost.");
        setStatus("error");
      };

      const createRecorder = (stream: MediaStream): MediaRecorder => {
        chunksRef.current = [];
        const mimeType = preferredMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        });
        recorder.addEventListener("error", () => {
          failSession("The browser could not record microphone audio.");
        });
        recorder.start(250);
        return recorder;
      };

      const resumeListening = () => {
        if (generationRef.current !== generation) return;
        const stream = streamRef.current;
        if (!stream) {
          failSession("The microphone stream closed.");
          return;
        }
        processingRef.current = false;
        speechStartedAtRef.current = null;
        lastSpeechAtRef.current = null;
        setPartialTranscript("");
        setInputEnabled(true);
        try {
          createRecorder(stream);
          setStatus("listening");
        } catch (error: any) {
          failSession(
            String(error?.message || error || "Unable to resume recording."),
          );
        }
      };

      const finishTurn = async () => {
        if (processingRef.current || generationRef.current !== generation)
          return;
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === "inactive") {
          failSession("No active microphone recording was available.");
          return;
        }

        const speechStartedAt = speechStartedAtRef.current || performance.now();
        const speechEndedAt = performance.now();
        const detectedSpeechEndedAt = lastSpeechAtRef.current || speechEndedAt;
        const voiceTurnId = crypto.randomUUID();
        processingRef.current = true;
        setInputEnabled(false);
        setStatus("transcribing");
        let audioBytes = 0;
        let transcriptionStartedAt: number | null = null;
        let transcriptionRequestId = "";
        let transcriptionProviderRequestId = "";

        try {
          await new Promise<void>((resolve, reject) => {
            recorder.addEventListener("stop", () => resolve(), { once: true });
            recorder.addEventListener(
              "error",
              () =>
                reject(
                  new Error("The browser could not finish the recording."),
                ),
              { once: true },
            );
            recorder.stop();
          });
          assertCurrent();
          recorderRef.current = null;

          const contentType =
            recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
          const audio = new Blob(chunksRef.current, { type: contentType });
          chunksRef.current = [];
          audioBytes = audio.size;
          if (!audio.size) {
            resumeListening();
            return;
          }

          transcriptionStartedAt = performance.now();
          const transcriptionAbort = new AbortController();
          transcriptionAbortRef.current = transcriptionAbort;
          const { response, payload } = await withRequestDeadline(
            async (signal) => {
              const result = await authFetch("/api/voice/openai/transcribe", {
                method: "POST",
                headers: {
                  "Content-Type": contentType,
                  [VOICE_TURN_HEADER]: voiceTurnId,
                  [VOICE_SESSION_HEADER]: voiceSessionId,
                  [VOICE_LANGUAGE_HEADER]: language,
                },
                body: audio,
                signal,
              });
              return {
                response: result,
                payload: await result.json().catch(() => ({})),
              };
            },
            BROWSER_TRANSCRIPTION_TIMEOUT_MS,
            transcriptionAbort.signal,
          ).finally(() => {
            if (transcriptionAbortRef.current === transcriptionAbort) {
              transcriptionAbortRef.current = null;
            }
          });
          const transcriptionCompletedAt = performance.now();
          transcriptionRequestId = String(
            response.headers.get("x-request-id") || "",
          ).slice(0, 128);
          transcriptionProviderRequestId = String(
            payload?.provider_request_id ||
              payload?.detail?.provider_request_id ||
              "",
          ).slice(0, 128);
          assertCurrent();
          if (!response.ok) throw new Error(transcriptionError(payload));
          if (response.headers.get(VOICE_TURN_HEADER) !== voiceTurnId) {
            throw new Error(
              "Voice turn correlation was not preserved by transcription.",
            );
          }

          const transcript = String(payload?.transcript || "").trim();
          setPartialTranscript("");
          if (!transcript) {
            resumeListening();
            return;
          }

          setPartialTranscript(transcript);
          setStatus("responding");
          await onTranscriptRef.current?.(transcript, {
            voiceTurnId,
            voiceSessionId,
            speechMs: Math.max(0, Math.round(speechEndedAt - speechStartedAt)),
            audioBytes,
            transcriptionMs: Math.max(
              0,
              Math.round(transcriptionCompletedAt - transcriptionStartedAt),
            ),
            transcriptionModel: String(payload?.model || "").slice(0, 80),
            transcriptionProvider: String(payload?.provider || "").slice(0, 40),
            transcriptionLanguage: String(payload?.language || "").slice(0, 16),
            transcriptionConfidenceTokenCount: optionalFiniteNumber(
              payload?.confidence?.token_count,
            ),
            transcriptionConfidenceMeanLogprob: optionalFiniteNumber(
              payload?.confidence?.mean_logprob,
            ),
            transcriptionConfidenceMinimumLogprob: optionalFiniteNumber(
              payload?.confidence?.minimum_logprob,
            ),
            transcriptionLowConfidenceTokenCount: optionalFiniteNumber(
              payload?.confidence?.low_confidence_token_count,
            ),
            transcriptionRequestId,
            transcriptionProviderRequestId,
            turnStartedAtMs: speechStartedAt,
            speechEndedAtMs: detectedSpeechEndedAt,
          });
          assertCurrent();
          resumeListening();
        } catch (error: any) {
          if (error?.name === "AbortError") return;
          try {
            await onTranscriptionFailureRef.current?.({
              voiceTurnId,
              voiceSessionId,
              speechMs: Math.max(
                0,
                Math.round(speechEndedAt - speechStartedAt),
              ),
              audioBytes,
              transcriptionMs:
                transcriptionStartedAt == null
                  ? null
                  : Math.max(
                      0,
                      Math.round(performance.now() - transcriptionStartedAt),
                    ),
              transcriptionRequestId,
              transcriptionProviderRequestId,
              turnStartedAtMs: speechStartedAt,
            });
          } catch {
            // Operational telemetry must not replace the voice error.
          }
          failSession(voiceErrorMessage(error, "Continuous voice failed."));
        }
      };

      try {
        if (
          typeof window === "undefined" ||
          !navigator.mediaDevices?.getUserMedia ||
          typeof MediaRecorder === "undefined"
        ) {
          throw new Error("Continuous voice is not available in this browser.");
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
                return;
              }
              if (!response.ok) {
                failLeaseConnection();
              }
            })
            .catch(() => {
              if (generationRef.current === generation) {
                failLeaseConnection();
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

        createRecorder(stream);
        startingRef.current = false;
        setStatus("listening");

        const samples = new Uint8Array(analyser.fftSize);
        const runVad = () => {
          if (generationRef.current !== generation) return;
          animationRef.current = window.requestAnimationFrame(runVad);
          if (processingRef.current) return;

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

          void finishTurn();
        };
        runVad();
      } catch (error: any) {
        startingRef.current = false;
        if (error?.name === "AbortError") return;
        const message = voiceErrorMessage(error, "Continuous voice failed.");
        stop();
        setLastError(message);
        setStatus("error");
        throw new Error(message);
      }
    },
    [setInputEnabled, status, stop, stopForOwnershipLoss],
  );

  useEffect(() => {
    const stopOnPageHide = () => stop();
    const stopForOtherTab = (event: StorageEvent) => {
      if (
        event.key === VOICE_SESSION_OWNER_KEY &&
        event.newValue &&
        event.newValue !== crossTabOwnerRef.current
      ) {
        stopForOwnershipLoss();
      }
    };
    window.addEventListener("pagehide", stopOnPageHide);
    window.addEventListener("storage", stopForOtherTab);
    return () => {
      window.removeEventListener("pagehide", stopOnPageHide);
      window.removeEventListener("storage", stopForOtherTab);
      stop();
    };
  }, [stop, stopForOwnershipLoss]);

  return {
    status,
    lastError,
    partialTranscript,
    start,
    stop,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { VOICE_TURN_HEADER } from "@/lib/voiceObservability";

export type GovernedRealtimeVoiceStatus =
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
  speechMs: number;
  audioBytes: number;
  transcriptionMs: number;
  transcriptionModel: string;
  transcriptionProvider: string;
  transcriptionRequestId: string;
  transcriptionProviderRequestId: string;
  turnStartedAtMs: number;
};

type StartOptions = {
  onTranscript: (
    transcript: string,
    context: GovernedVoiceTurnContext,
  ) => Promise<void>;
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

export function useGovernedRealtimeVoice() {
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
        const voiceTurnId = crypto.randomUUID();
        processingRef.current = true;
        setInputEnabled(false);
        setStatus("transcribing");

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
          if (!audio.size) {
            resumeListening();
            return;
          }

          const transcriptionStartedAt = performance.now();
          const response = await authFetch("/api/voice/openai/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": contentType,
              [VOICE_TURN_HEADER]: voiceTurnId,
            },
            body: audio,
          });
          const payload = await response.json().catch(() => ({}));
          const transcriptionCompletedAt = performance.now();
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
            speechMs: Math.max(0, Math.round(speechEndedAt - speechStartedAt)),
            audioBytes: audio.size,
            transcriptionMs: Math.max(
              0,
              Math.round(transcriptionCompletedAt - transcriptionStartedAt),
            ),
            transcriptionModel: String(payload?.model || "").slice(0, 80),
            transcriptionProvider: String(payload?.provider || "").slice(0, 40),
            transcriptionRequestId: String(
              response.headers.get("x-request-id") || "",
            ).slice(0, 128),
            transcriptionProviderRequestId: String(
              payload?.provider_request_id || "",
            ).slice(0, 128),
            turnStartedAtMs: speechStartedAt,
          });
          assertCurrent();
          resumeListening();
        } catch (error: any) {
          if (error?.name === "AbortError") return;
          failSession(
            String(error?.message || error || "Continuous voice failed."),
          );
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";

export type GovernedVoiceStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "error";

const MIME_TYPE_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

let activeRecorderOwner: symbol | null = null;
let activeRecorderStop: (() => void) | null = null;

function preferredMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    MIME_TYPE_PREFERENCES.find((value) =>
      MediaRecorder.isTypeSupported(value),
    ) || ""
  );
}

export function useGovernedVoiceTurn() {
  const ownerRef = useRef(Symbol("governed-voice-turn"));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [status, setStatus] = useState<GovernedVoiceStatus>("idle");
  const [lastError, setLastError] = useState("");

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {}
    chunksRef.current = [];
    releaseStream();
    setStatus("idle");
    setLastError("");
    if (activeRecorderOwner === ownerRef.current) {
      activeRecorderOwner = null;
      activeRecorderStop = null;
    }
  }, [releaseStream]);

  const start = useCallback(async () => {
    if (
      status === "requesting" ||
      status === "recording" ||
      status === "transcribing"
    )
      return;
    activeRecorderStop?.();
    cancel();
    activeRecorderOwner = ownerRef.current;
    activeRecorderStop = cancel;
    setStatus("requesting");

    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        throw new Error(
          "Microphone recording is not available in this browser.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = preferredMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.start(250);
      setLastError("");
      setStatus("recording");
    } catch (error: any) {
      cancel();
      const message = String(
        error?.message || error || "Unable to start microphone recording.",
      );
      setLastError(message);
      setStatus("error");
      throw new Error(message);
    }
  }, [cancel, status]);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      throw new Error("No active voice recording.");
    }

    setStatus("transcribing");
    try {
      await new Promise<void>((resolve, reject) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.addEventListener(
          "error",
          () =>
            reject(new Error("The browser could not finish the recording.")),
          { once: true },
        );
        recorder.stop();
      });

      recorderRef.current = null;
      releaseStream();
      const contentType =
        recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
      const audio = new Blob(chunksRef.current, { type: contentType });
      chunksRef.current = [];
      if (!audio.size) throw new Error("No speech was recorded.");

      const response = await authFetch("/api/voice/openai/transcribe", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: audio,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          String(
            payload?.detail?.error ||
              payload?.detail ||
              payload?.error ||
              "Transcription failed.",
          ),
        );
      }

      const transcript = String(payload?.transcript || "").trim();
      if (!transcript) throw new Error("No speech was recognized.");
      setLastError("");
      setStatus("idle");
      if (activeRecorderOwner === ownerRef.current) {
        activeRecorderOwner = null;
        activeRecorderStop = null;
      }
      return transcript;
    } catch (error: any) {
      recorderRef.current = null;
      chunksRef.current = [];
      releaseStream();
      if (activeRecorderOwner === ownerRef.current) {
        activeRecorderOwner = null;
        activeRecorderStop = null;
      }
      const message = String(
        error?.message || error || "Transcription failed.",
      );
      setLastError(message);
      setStatus("error");
      throw new Error(message);
    }
  }, [releaseStream]);

  useEffect(() => {
    const stopOnPageHide = () => cancel();
    window.addEventListener("pagehide", stopOnPageHide);
    return () => {
      window.removeEventListener("pagehide", stopOnPageHide);
      cancel();
    };
  }, [cancel]);

  return { status, lastError, start, stopAndTranscribe, cancel };
}

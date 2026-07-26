"use client";

import * as React from "react";

import { authFetch } from "@/lib/authFetch";
import {
  conversationStyleTtsInstructions,
  readConversationStyle,
} from "@/lib/conversationStyle";
import {
  normalizeSpeechVoice,
  SPEECH_MODEL,
  SPEECH_VOICES,
  storeSpeechVoice,
  type SpeechVoice,
} from "@/lib/speechSettings";
import { supabase } from "@/lib/supabaseClient";
import { speechResponseToWavBlob } from "@/lib/voiceSpeech";

const PREVIEW_TEXT =
  "Hi, I’m RESSE. This is how I’ll sound during your conversations.";

type VoiceCapabilities = {
  tts?: {
    models?: Array<{
      id: string;
      voices: string[];
    }>;
  };
};

function voiceLabel(voice: SpeechVoice): string {
  return `${voice.charAt(0).toUpperCase()}${voice.slice(1)} — Recommended`;
}

export function VoicePanel() {
  const [voice, setVoice] = React.useState<SpeechVoice>("marin");
  const [availableVoices, setAvailableVoices] = React.useState<SpeechVoice[]>(
    [],
  );
  const [busy, setBusy] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef("");

  const releaseAudio = React.useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }
    setPlaying(false);
  }, []);

  const persistVoice = React.useCallback((value: unknown) => {
    const nextVoice = storeSpeechVoice(value);
    setVoice(nextVoice);
    void supabase.auth.updateUser({
      data: {
        vs_voice: nextVoice,
      },
    });
    return nextVoice;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let localVoice: SpeechVoice = "marin";
    try {
      const raw = localStorage.getItem("vs_voice");
      localVoice = normalizeSpeechVoice(raw == null ? null : JSON.parse(raw));
    } catch {}
    setVoice(localVoice);
    storeSpeechVoice(localVoice);

    void (async () => {
      const [{ data }, capabilitiesResponse] = await Promise.all([
        supabase.auth.getUser(),
        authFetch("/api/voice/capabilities", { cache: "no-store" }),
      ]);
      if (cancelled) return;

      const cloudVoice = normalizeSpeechVoice(
        (data?.user?.user_metadata as any)?.vs_voice ?? localVoice,
      );
      setVoice(cloudVoice);
      storeSpeechVoice(cloudVoice);

      if (!capabilitiesResponse.ok) {
        setStatus("Voice options are temporarily unavailable.");
        return;
      }
      const payload = (await capabilitiesResponse.json()) as VoiceCapabilities;
      const supported =
        payload.tts?.models?.find((item) => item.id === SPEECH_MODEL)?.voices ??
        [];
      const visible = SPEECH_VOICES.filter((item) => supported.includes(item));
      if (!visible.length) {
        setStatus("Voice options are temporarily unavailable.");
        return;
      }
      setAvailableVoices([...visible]);
      if (!visible.includes(cloudVoice)) persistVoice(visible[0]);
    })().catch(() => {
      if (!cancelled) setStatus("Voice options are temporarily unavailable.");
    });

    return () => {
      cancelled = true;
      releaseAudio();
    };
  }, [persistVoice, releaseAudio]);

  async function previewVoice() {
    if (playing) {
      releaseAudio();
      setStatus("");
      return;
    }

    setBusy(true);
    setStatus("Preparing preview…");
    releaseAudio();
    try {
      const response = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          voice,
          instructions: conversationStyleTtsInstructions(
            readConversationStyle(),
          ),
        }),
      });
      if (!response.ok) {
        throw new Error("Voice preview is temporarily unavailable.");
      }

      const wav = await speechResponseToWavBlob(response);
      const url = URL.createObjectURL(wav);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onended = () => {
        releaseAudio();
        setStatus("");
      };
      setPlaying(true);
      setStatus("Playing preview.");
      await audio.play();
    } catch (error: any) {
      releaseAudio();
      setStatus(
        String(error?.message || "Voice preview is temporarily unavailable."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2" aria-labelledby="personalization-voice">
      <div
        id="personalization-voice"
        className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Voice
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <label htmlFor="personalization-voice-select" className="text-sm">
            Spoken voice
          </label>
          <select
            id="personalization-voice-select"
            className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
            value={voice}
            disabled={!availableVoices.length}
            onChange={(event) => {
              releaseAudio();
              persistVoice(event.target.value);
              setStatus("");
            }}
          >
            {(availableVoices.length ? availableVoices : SPEECH_VOICES).map(
              (item) => (
                <option key={item} value={item}>
                  {voiceLabel(item)}
                </option>
              ),
            )}
          </select>
        </div>
        <button
          type="button"
          className="w-full border-t px-3 py-3 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || !availableVoices.length}
          onClick={() => void previewVoice()}
        >
          {busy
            ? "Preparing preview…"
            : playing
              ? "Stop preview"
              : "Preview voice"}
        </button>
      </div>
      <div className="space-y-1 px-1 text-xs text-muted-foreground">
        <div>{PREVIEW_TEXT}</div>
        <div>AI-generated voice. Your selection saves automatically.</div>
        {status ? <div role="status">{status}</div> : null}
      </div>
    </section>
  );
}

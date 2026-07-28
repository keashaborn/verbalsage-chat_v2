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

const VOICE_COPY: Record<SpeechVoice, { label: string }> = {
  marin: { label: "Marin" },
  cedar: { label: "Cedar" },
  alloy: { label: "Alloy" },
  ash: { label: "Ash" },
  ballad: { label: "Ballad" },
  coral: { label: "Coral" },
  echo: { label: "Echo" },
  fable: { label: "Fable" },
  nova: { label: "Nova" },
  onyx: { label: "Onyx" },
  sage: { label: "Sage" },
  shimmer: { label: "Shimmer" },
  verse: { label: "Verse" },
};

type VoiceCapabilities = {
  tts?: {
    models?: Array<{
      id: string;
      voices: string[];
      recommended_voices?: string[];
    }>;
  };
};

export function VoicePanel() {
  const [voice, setVoice] = React.useState<SpeechVoice>("marin");
  const [availableVoices, setAvailableVoices] = React.useState<SpeechVoice[]>(
    [],
  );
  const [recommendedVoices, setRecommendedVoices] = React.useState<
    SpeechVoice[]
  >(["marin", "cedar"]);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef("");
  const previewAbortRef = React.useRef<AbortController | null>(null);
  const accountSyncRef = React.useRef(Promise.resolve());
  const accountSyncSequenceRef = React.useRef(0);

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
  }, []);

  const persistVoice = React.useCallback((value: unknown, announce = true) => {
    const nextVoice = storeSpeechVoice(value);
    const sequence = ++accountSyncSequenceRef.current;
    setVoice(nextVoice);
    accountSyncRef.current = accountSyncRef.current.then(async () => {
      try {
        const { error } = await supabase.auth.updateUser({
          data: {
            vs_voice: nextVoice,
          },
        });
        if (!announce || sequence !== accountSyncSequenceRef.current) return;
        setStatus(
          error
            ? "Saved in this browser. Account sync is temporarily unavailable."
            : `${VOICE_COPY[nextVoice].label} saved to your account.`,
        );
      } catch {
        if (announce && sequence === accountSyncSequenceRef.current) {
          setStatus(
            "Saved in this browser. Account sync is temporarily unavailable.",
          );
        }
      }
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
      const model = payload.tts?.models?.find(
        (item) => item.id === SPEECH_MODEL,
      );
      const supported = model?.voices ?? [];
      const visible = SPEECH_VOICES.filter((item) => supported.includes(item));
      if (!visible.length) {
        setStatus("Voice options are temporarily unavailable.");
        return;
      }
      setAvailableVoices([...visible]);
      setRecommendedVoices(
        SPEECH_VOICES.filter(
          (item) =>
            visible.includes(item) &&
            (model?.recommended_voices ?? []).includes(item),
        ),
      );
      if (!visible.includes(cloudVoice)) persistVoice(visible[0], false);
    })().catch(() => {
      if (!cancelled) setStatus("Voice options are temporarily unavailable.");
    });

    return () => {
      cancelled = true;
      previewAbortRef.current?.abort();
      previewAbortRef.current = null;
      releaseAudio();
    };
  }, [persistVoice, releaseAudio]);

  async function previewVoice(nextVoice: SpeechVoice) {
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setBusy(true);
    setStatus(`Preparing ${VOICE_COPY[nextVoice].label}…`);
    releaseAudio();
    try {
      const response = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          voice: nextVoice,
          instructions: conversationStyleTtsInstructions(
            readConversationStyle(),
          ),
        }),
      });
      if (!response.ok) {
        throw new Error("Voice preview is temporarily unavailable.");
      }

      const wav = await speechResponseToWavBlob(response);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(wav);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onended = () => {
        releaseAudio();
        setStatus("");
      };
      setStatus(`Playing ${VOICE_COPY[nextVoice].label}.`);
      await audio.play();
    } catch (error: any) {
      if (controller.signal.aborted) return;
      releaseAudio();
      setStatus(
        String(error?.message || "Voice preview is temporarily unavailable."),
      );
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
        setBusy(false);
      }
    }
  }

  const visibleVoices = availableVoices.length
    ? availableVoices
    : SPEECH_VOICES;
  const selected = VOICE_COPY[voice];
  const selectedRecommended = recommendedVoices.includes(voice);

  return (
    <section
      className="space-y-5"
      aria-busy={busy}
      aria-labelledby="voice-settings-title"
    >
      <div className="space-y-1">
        <h2 id="voice-settings-title" className="text-base font-semibold">
          Voice identity
        </h2>
        <p className="text-sm text-muted-foreground">
          Select any voice to hear a short preview. Your choice saves
          automatically across your signed-in devices.
        </p>
      </div>

      <div className="rounded-2xl border bg-muted/10 p-4 sm:p-5">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-full border bg-background shadow-sm">
            <img
              src="/brand/lifeswitch/voice-symbol-dark-1024.png"
              alt=""
              className="h-24 w-24 object-contain opacity-80 dark:invert"
            />
          </div>
          <div className="mt-4 text-2xl font-semibold">{selected.label}</div>
          {selectedRecommended ? (
            <div className="mt-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase">
              Recommended
            </div>
          ) : null}
        </div>

        <div
          className="mt-6 flex snap-x gap-3 overflow-x-auto pb-2"
          role="listbox"
          aria-label="Available voices"
        >
          {visibleVoices.map((item) => {
            const itemCopy = VOICE_COPY[item];
            const selectedItem = item === voice;
            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={selectedItem}
                className={`min-w-[142px] snap-center rounded-xl border px-3 py-3 text-left transition ${
                  selectedItem
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background hover:bg-muted/60"
                }`}
                onClick={() => {
                  const nextVoice = persistVoice(item);
                  void previewVoice(nextVoice);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{itemCopy.label}</span>
                  {selectedItem ? <span aria-hidden="true">✓</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="text-sm font-semibold">Language</div>
          <div className="text-sm text-muted-foreground">English</div>
        </div>
      </div>

      <div className="space-y-1 px-1 text-xs text-muted-foreground">
        <div>AI-generated voice. Raw microphone audio is not stored.</div>
        {status ? <div role="status">{status}</div> : null}
      </div>
    </section>
  );
}

"use client";

import * as React from "react";

import { authFetch } from "@/lib/authFetch";
import { readConversationStyle } from "@/lib/conversationStyle";
import {
  normalizeSpeechVoice,
  SPEECH_MODEL,
  SPEECH_VOICES,
  storeSpeechVoice,
  type SpeechVoice,
} from "@/lib/speechSettings";
import { supabase } from "@/lib/supabaseClient";
import { speechResponseToWavBlob } from "@/lib/voiceSpeech";
import {
  normalizeVoiceLanguage,
  storeVoiceLanguage,
  VOICE_LANGUAGE_IDS,
  type VoiceLanguage,
  type VoiceLanguageOption,
} from "@/lib/voiceLanguage";

const PREVIEW_TEXT = "Hello. This is how I’ll sound during your conversations.";

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
  language?: {
    default?: string;
    auto_detect?: boolean;
    options?: Array<{ id: string; label: string }>;
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
  const [language, setLanguage] = React.useState<VoiceLanguage>("en");
  const [languageOptions, setLanguageOptions] = React.useState<
    VoiceLanguageOption[]
  >([{ id: "en", label: "English" }]);
  const [languageOpen, setLanguageOpen] = React.useState(false);
  const [languageQuery, setLanguageQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef("");
  const previewAbortRef = React.useRef<AbortController | null>(null);
  const accountSyncRef = React.useRef(Promise.resolve());
  const accountSyncSequenceRef = React.useRef(0);
  const swipeStartRef = React.useRef<{ x: number; y: number } | null>(null);

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

  const persistLanguage = React.useCallback(
    (value: unknown, announce = true) => {
      const nextLanguage = storeVoiceLanguage(value);
      const sequence = ++accountSyncSequenceRef.current;
      setLanguage(nextLanguage);
      accountSyncRef.current = accountSyncRef.current.then(async () => {
        try {
          const { error } = await supabase.auth.updateUser({
            data: {
              vs_voice_language: nextLanguage,
            },
          });
          if (!announce || sequence !== accountSyncSequenceRef.current) return;
          setStatus(
            error
              ? "Saved in this browser. Account sync is temporarily unavailable."
              : "Language saved to your account.",
          );
        } catch {
          if (announce && sequence === accountSyncSequenceRef.current) {
            setStatus(
              "Saved in this browser. Account sync is temporarily unavailable.",
            );
          }
        }
      });
      return nextLanguage;
    },
    [],
  );

  React.useEffect(() => {
    let cancelled = false;
    let localVoice: SpeechVoice = "marin";
    let localLanguage: VoiceLanguage = "en";
    try {
      const raw = localStorage.getItem("vs_voice");
      localVoice = normalizeSpeechVoice(raw == null ? null : JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem("vs_voice_language");
      localLanguage = normalizeVoiceLanguage(
        raw == null ? null : JSON.parse(raw),
      );
    } catch {}
    setVoice(localVoice);
    storeSpeechVoice(localVoice);
    setLanguage(localLanguage);
    storeVoiceLanguage(localLanguage);

    void (async () => {
      const [{ data }, capabilitiesResponse] = await Promise.all([
        supabase.auth.getUser(),
        authFetch("/api/voice/capabilities", { cache: "no-store" }),
      ]);
      if (cancelled) return;

      const cloudVoice = normalizeSpeechVoice(
        (data?.user?.user_metadata as any)?.vs_voice ?? localVoice,
      );
      const cloudLanguage = normalizeVoiceLanguage(
        (data?.user?.user_metadata as any)?.vs_voice_language ?? localLanguage,
      );
      setVoice(cloudVoice);
      storeSpeechVoice(cloudVoice);
      setLanguage(cloudLanguage);
      storeVoiceLanguage(cloudLanguage);

      if (!capabilitiesResponse.ok) {
        setStatus("Voice options are temporarily unavailable.");
        return;
      }
      const payload = (await capabilitiesResponse.json()) as VoiceCapabilities;
      const supportedLanguages = (payload.language?.options ?? [])
        .filter((item): item is VoiceLanguageOption =>
          Boolean(
            item &&
            VOICE_LANGUAGE_IDS.includes(item.id as VoiceLanguage) &&
            String(item.label || "").trim(),
          ),
        )
        .map((item) => ({
          id: normalizeVoiceLanguage(item.id),
          label: String(item.label).trim(),
        }));
      if (supportedLanguages.length) {
        setLanguageOptions(supportedLanguages);
        if (!supportedLanguages.some((item) => item.id === cloudLanguage)) {
          persistLanguage(payload.language?.default ?? "en", false);
        }
      }
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
  }, [persistLanguage, persistVoice, releaseAudio]);

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
          conversation_style: readConversationStyle(),
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
  const selectedIndex = Math.max(0, visibleVoices.indexOf(voice));
  const selectedRecommended = recommendedVoices.includes(voice);
  const selectedLanguage =
    languageOptions.find((item) => item.id === language) ||
    languageOptions.find((item) => item.id === "en") ||
    languageOptions[0];
  const normalizedLanguageQuery = languageQuery.trim().toLocaleLowerCase();
  const filteredLanguages = languageOptions.filter((item) =>
    `${item.label} ${item.id}`
      .toLocaleLowerCase()
      .includes(normalizedLanguageQuery),
  );

  function selectAndPreview(nextVoice: SpeechVoice) {
    const persistedVoice = persistVoice(nextVoice);
    void previewVoice(persistedVoice);
  }

  function moveVoice(direction: -1 | 1) {
    if (visibleVoices.length < 2) return;
    const nextIndex =
      (selectedIndex + direction + visibleVoices.length) % visibleVoices.length;
    selectAndPreview(visibleVoices[nextIndex]);
  }

  function finishSwipe(event: React.PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (
      Math.abs(horizontalDistance) < 40 ||
      Math.abs(horizontalDistance) <= Math.abs(verticalDistance)
    ) {
      return;
    }
    moveVoice(horizontalDistance < 0 ? 1 : -1);
  }

  return (
    <section className="space-y-5" aria-busy={busy} aria-label="Voice settings">
      <div className="rounded-2xl border bg-muted/10 p-4 sm:p-5">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div
            className="relative grid h-28 w-28 cursor-grab touch-pan-y place-items-center overflow-hidden rounded-full border bg-background shadow-sm transition outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing"
            role="group"
            aria-label="Voice picker"
            aria-roledescription="carousel"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveVoice(-1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                moveVoice(1);
              }
            }}
            onPointerDown={(event) => {
              swipeStartRef.current = {
                x: event.clientX,
                y: event.clientY,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={finishSwipe}
            onPointerCancel={() => {
              swipeStartRef.current = null;
            }}
          >
            <img
              key={voice}
              src="/brand/lifeswitch/voice-symbol-dark-1024.png"
              alt=""
              draggable={false}
              className="pointer-events-none h-24 w-24 object-contain opacity-80 select-none dark:invert"
            />
          </div>

          <div className="mt-4 grid w-full grid-cols-[44px_1fr_44px] items-center gap-2">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full text-3xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Previous voice"
              disabled={visibleVoices.length < 2}
              onClick={() => moveVoice(-1)}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div
              className="text-2xl font-semibold"
              aria-live="polite"
              aria-atomic="true"
            >
              {selected.label}
            </div>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full text-3xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Next voice"
              disabled={visibleVoices.length < 2}
              onClick={() => moveVoice(1)}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          {selectedRecommended ? (
            <div className="mt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Recommended
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {visibleVoices.map((item, index) => (
              <button
                key={item}
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label={`Select ${VOICE_COPY[item].label}`}
                aria-current={index === selectedIndex ? "true" : undefined}
                onClick={() => selectAndPreview(item)}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    index === selectedIndex
                      ? "bg-foreground"
                      : "bg-muted-foreground/25"
                  }`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-y border-muted/20">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-expanded={languageOpen}
          onClick={() => setLanguageOpen((value) => !value)}
        >
          <div className="text-sm font-semibold">Language</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{selectedLanguage?.label || "English"}</span>
            <span aria-hidden="true">›</span>
          </div>
        </button>
        {languageOpen ? (
          <div className="border-t border-muted/20 py-3">
            <label className="sr-only" htmlFor="voice-language-search">
              Search languages
            </label>
            <input
              id="voice-language-search"
              type="search"
              value={languageQuery}
              onChange={(event) => setLanguageQuery(event.target.value)}
              placeholder="Search languages"
              autoFocus
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div
              className="mt-2 max-h-72 overflow-y-auto border-y border-muted/20"
              role="listbox"
              aria-label="Voice language"
            >
              {filteredLanguages.length ? (
                filteredLanguages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={item.id === language}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted/50 ${
                      item.id === language ? "bg-muted/60 font-semibold" : ""
                    }`}
                    onClick={() => {
                      persistLanguage(item.id);
                      setLanguageOpen(false);
                      setLanguageQuery("");
                    }}
                  >
                    <span>{item.label}</span>
                    {item.id === language ? (
                      <span aria-hidden="true">✓</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No matching languages.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-9 space-y-1 px-1 text-xs text-muted-foreground">
        <div>AI-generated voice. Raw microphone audio is not stored.</div>
        {status ? <div role="status">{status}</div> : null}
      </div>
    </section>
  );
}

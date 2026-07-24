"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import {
  cacheVoiceMode,
  DEFAULT_VOICE_MODE,
  normalizeVoiceMode,
  VOICE_MODE_OPTIONS,
  VOICE_MODE_STORAGE_KEY,
  voiceModeFromUserMetadata,
  type VoiceMode,
} from "@/lib/voiceMode";

type TTSModelCapability = {
  id: string;
  label: string;
  description: string;
  legacy: boolean;
  supports_instructions: boolean;
  default_voice: string;
  recommended_voices: string[];
  voices: string[];
};

type VoiceCapabilities = {
  version: string;
  tts: {
    default_model: string;
    default_voice: string;
    maximum_input_characters: number;
    models: TTSModelCapability[];
  };
};

function getLS<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
function setLS(k: string, v: any) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch { }
}

function normalizeVoiceSettings(raw: any) {
  const voice = String(raw?.vs_voice || raw?.voice || "marin").trim() || "marin";
  const model = String(raw?.vs_voice_model || raw?.model || "gpt-4o-mini-tts").trim() || "gpt-4o-mini-tts";
  const speedRaw = Number(raw?.vs_voice_speed ?? raw?.speed ?? 1.0);
  const speed = Number.isFinite(speedRaw) ? Math.max(0.6, Math.min(1.4, speedRaw)) : 1.0;
  return { voice, model, speed };
}

function saveVoiceSettingsLocal(nextVoice: string, nextSpeed: number, nextModel: string) {
  setLS("vs_voice", nextVoice);
  setLS("vs_voice_speed", nextSpeed);
  setLS("vs_voice_model", nextModel);
}

async function saveVoiceSettingsCloud(nextVoice: string, nextSpeed: number, nextModel: string) {
  const { error } = await supabase.auth.updateUser({
    data: {
      vs_voice: nextVoice,
      vs_voice_speed: nextSpeed,
      vs_voice_model: nextModel,
    },
  });
  return error;
}

function voiceLabel(voice: string, recommended: string[]) {
  const display = voice.charAt(0).toUpperCase() + voice.slice(1);
  return recommended.includes(voice) ? `${display} — Recommended` : display;
}

function Group({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="overflow-hidden rounded-xl border">
        <div className="divide-y">{children}</div>
      </div>
      {footer != null && <div className="px-1 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

function Row({
  left,
  right,
  children,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{left}</div>
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
      {children != null && <div className="mt-2">{children}</div>}
    </div>
  );
}

function ActionRow({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function SliderRow({
  title,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Row left={title} right={<span className="text-xs tabular-nums text-muted-foreground">{format(value)}</span>}>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Row>
  );
}

export function VoicePanel() {
  const [voiceMode, setVoiceMode] = React.useState<VoiceMode>(DEFAULT_VOICE_MODE);
  const [voice, setVoice] = React.useState<string>("marin");
  const [speed, setSpeed] = React.useState<number>(1.0);
  const [model, setModel] = React.useState<string>("gpt-4o-mini-tts");
  const [testText, setTestText] = React.useState<string>("Hello, this is Sage inside LifeSwitch.");
  const [busy, setBusy] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("");
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [capabilities, setCapabilities] = React.useState<VoiceCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = React.useState<string>("");

  const selectedModel = React.useMemo(
    () => capabilities?.tts.models.find((item) => item.id === model) ?? null,
    [capabilities, model],
  );
  const voices = selectedModel?.voices ?? [];
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  function saveVoiceSettings(nextVoice: string, nextSpeed: number, nextModel: string) {
    saveVoiceSettingsLocal(nextVoice, nextSpeed, nextModel);
    void saveVoiceSettingsCloud(nextVoice, nextSpeed, nextModel).then((error) => {
      if (error) setStatus("Saved on this device, but account sync failed.");
    });
  }

  function saveVoiceMode(nextMode: VoiceMode) {
    cacheVoiceMode(nextMode);
    setVoiceMode(nextMode);
    setStatus("Conversation mode saved. Syncing to your account…");
    void supabase.auth
      .updateUser({ data: { vs_voice_mode: nextMode } })
      .then(({ error }) => {
        setStatus(
          error
            ? "Saved on this device, but account sync failed."
            : "Conversation mode synced to your account.",
        );
      });
  }

  React.useEffect(() => {
    let cancelled = false;
    setVoiceMode(normalizeVoiceMode(localStorage.getItem(VOICE_MODE_STORAGE_KEY)));

    const local = normalizeVoiceSettings({
      vs_voice: getLS<string>("vs_voice", "marin"),
      vs_voice_speed: getLS<number>("vs_voice_speed", 1.0),
      vs_voice_model: getLS<string>("vs_voice_model", "gpt-4o-mini-tts"),
    });

    setVoice(local.voice);
    setSpeed(local.speed);
    setModel(local.model);
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const md: any = data?.user?.user_metadata || {};
      const cloudVoiceMode = voiceModeFromUserMetadata(md);
      if (cloudVoiceMode && !cancelled) {
        cacheVoiceMode(cloudVoiceMode);
        setVoiceMode(cloudVoiceMode);
      }
      const hasCloud =
        md.vs_voice != null ||
        md.vs_voice_speed != null ||
        md.vs_voice_model != null;

      if (!hasCloud || cancelled) return;

      const cloud = normalizeVoiceSettings(md);
      saveVoiceSettingsLocal(cloud.voice, cloud.speed, cloud.model);
      setVoice(cloud.voice);
      setSpeed(cloud.speed);
      setModel(cloud.model);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await authFetch("/api/voice/capabilities", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = (await response.json()) as VoiceCapabilities;
        if (
          !payload?.tts?.default_model ||
          !Array.isArray(payload?.tts?.models)
        ) {
          throw new Error("Invalid capabilities response");
        }

        if (!cancelled) {
          setCapabilities(payload);
          setCapabilitiesError("");
        }
      } catch {
        if (!cancelled) {
          setCapabilities(null);
          setCapabilitiesError("Voice options are temporarily unavailable.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!capabilities) return;

    const nextModel =
      capabilities.tts.models.find((item) => item.id === model) ??
      capabilities.tts.models.find((item) => item.id === capabilities.tts.default_model);
    if (!nextModel) return;

    const nextVoice = nextModel.voices.includes(voice) ? voice : nextModel.default_voice;
    if (nextModel.id !== model || nextVoice !== voice) {
      setModel(nextModel.id);
      setVoice(nextVoice);
      saveVoiceSettings(nextVoice, speed, nextModel.id);
      setStatus(
        nextModel.id !== model
          ? `Speech model changed to ${nextModel.label} because the saved model is unavailable.`
          : `Voice changed to ${voiceLabel(nextVoice, nextModel.recommended_voices)} because ${voice} is unavailable for ${nextModel.label}.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities, model, voice]);

  async function playTTS(text: string) {
    const msg = String(text || "").trim();
    if (!msg) {
      setStatus("Missing test phrase.");
      return;
    }

    setStatus("Requesting audio…");
    setBusy(true);

    try {
      // stop any existing audio
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { }
        audioRef.current = null;
      }

      const r = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg, voice, speed, model }),
      });

      if (!r.ok) {
        const err = await r.text().catch(() => "");
        setStatus(`TTS error: HTTP ${r.status}${err ? ` — ${err.slice(0, 160)}` : ""}`);
        return;
      }

      setStatus("Playing…");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a;
      setIsPlaying(true);

      a.addEventListener("ended", () => {
        try { URL.revokeObjectURL(url); } catch { }
        audioRef.current = null;
        setIsPlaying(false);
        setStatus("Done.");
      });

      await a.play();
    } catch (e: any) {
      setStatus(`TTS error: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { }
      audioRef.current = null;
    }
    setIsPlaying(false);
    setStatus("Stopped.");
  }

  return (
    <div className="space-y-4">
      <Group
        title="Conversation mode"
        footer="Governed voice remains the default. Realtime preview is limited to authorized preview accounts and saves turns through the same governed chat path."
      >
        <Row
          left="Voice experience"
          right={
            <select
              className="w-[260px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={voiceMode}
              aria-label="Voice conversation mode"
              onChange={(event) => {
                const nextMode = normalizeVoiceMode(event.target.value);
                saveVoiceMode(nextMode);
              }}
            >
              {VOICE_MODE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={!option.enabled}
                >
                  {option.label}
                </option>
              ))}
            </select>
          }
        >
          <div className="text-xs text-muted-foreground">
            {VOICE_MODE_OPTIONS.find((option) => option.value === voiceMode)
              ?.description || VOICE_MODE_OPTIONS[0].description}
          </div>
        </Row>
      </Group>

      <Group
        title="Spoken replies"
        footer={
          <div className="space-y-1">
            <div>Used for message playback and governed Talk replies.</div>
            <div>
              Talk audio is transcribed by OpenAI, then the transcript follows the same safeguarded chat path as typed messages.
            </div>
            <div>Changes save automatically to your account and this browser.</div>
            <div className="font-medium text-foreground">
              Disclosure: the voice you hear is AI-generated, not a human voice.
            </div>
          </div>
        }
      >
        <Row
          left="Speech model"
          right={
            <select
              className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={model}
              disabled={!capabilities}
              onChange={(e) => {
                const nextModel = capabilities?.tts.models.find((item) => item.id === e.target.value);
                if (!nextModel) return;

                const nextVoice = nextModel.voices.includes(voice) ? voice : nextModel.default_voice;
                setModel(nextModel.id);
                setVoice(nextVoice);
                saveVoiceSettings(nextVoice, speed, nextModel.id);

                if (nextVoice !== voice) {
                  setStatus(
                    `Voice changed to ${voiceLabel(nextVoice, nextModel.recommended_voices)} because ${voice} is unavailable for ${nextModel.label}.`,
                  );
                } else {
                  setStatus("");
                }
              }}
            >
              <optgroup label="Recommended">
                {capabilities?.tts.models
                  .filter((item) => !item.legacy)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Advanced · Legacy">
                {capabilities?.tts.models
                  .filter((item) => item.legacy)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          }
        >
          {selectedModel ? (
            <div className="text-xs text-muted-foreground">{selectedModel.description}</div>
          ) : null}
        </Row>

        <Row
          left="Voice"
          right={
            <select
              className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={voice}
              disabled={!selectedModel}
              onChange={(e) => {
                const nextVoice = e.target.value;
                setVoice(nextVoice);
                saveVoiceSettings(nextVoice, speed, model);
                setStatus("");
              }}
            >
              {voices.map((item) => (
                <option key={item} value={item}>
                  {voiceLabel(item, selectedModel?.recommended_voices ?? [])}
                </option>
              ))}
            </select>
          }
        />

        <SliderRow
          title="Speed"
          value={speed}
          min={0.6}
          max={1.4}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(nextSpeed) => {
            setSpeed(nextSpeed);
            saveVoiceSettings(voice, nextSpeed, model);
          }}
        />

        <Row left="Test phrase">
          <input
            className="w-full rounded-lg border bg-background px-2 py-2 text-sm"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
          />
        </Row>

        <ActionRow
          label={busy ? "Working…" : isPlaying ? "Playing…" : "Play test phrase"}
          disabled={busy || isPlaying || !selectedModel}
          onClick={() => playTTS(testText)}
        />

        {isPlaying ? <ActionRow label="Stop" disabled={busy} onClick={stopAudio} /> : null}

        {capabilitiesError ? (
          <Row left={<span className="text-xs text-destructive">{capabilitiesError}</span>} />
        ) : null}

        {status ? <Row left={<span className="text-xs text-muted-foreground">{status}</span>} /> : null}
      </Group>
    </div>
  );
}

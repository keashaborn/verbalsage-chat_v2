"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Send, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/authFetch";
import { MarkdownMessage } from "@/components/shared/MarkdownMessage";

type LifeSwitchDomain = "plan" | "nutrition" | "training" | "measurements" | "unknown";
type LifeSwitchMode =
  | "plan"
  | "log"
  | "capture"
  | "design"
  | "analyze"
  | "library"
  | "session"
  | "calendar"
  | "unknown";

type HelperMessage = {
  role: "user" | "assistant";
  text: string;
};

const ACTIVE_DOMAINS = new Set(["nutrition", "training", "measurements"]);

function classifyDomain(pathname: string): LifeSwitchDomain {
  if (/^\/lifeswitch\/plan(?:\/|$)/.test(pathname)) return "plan";

  const match = pathname.match(/^\/lifeswitch\/([^\/?#]+)/);
  const raw = String(match?.[1] || "").toLowerCase();

  if (ACTIVE_DOMAINS.has(raw)) return raw as LifeSwitchDomain;
  return "unknown";
}

function classifyMode(pathname: string): LifeSwitchMode {
  if (/^\/lifeswitch\/plan(?:\/|$)/.test(pathname)) return "plan";

  const parts = pathname.split("/").filter(Boolean);
  const domain = parts[1] || "";
  const mode = parts[2] || "";

  if (!ACTIVE_DOMAINS.has(domain)) return "unknown";

  if (mode === "plan") return "plan";
  if (mode === "log") return "log";
  if (mode === "capture") return "capture";
  if (mode === "design") return "design";
  if (mode === "analyze") return "analyze";
  if (mode === "foods" || mode === "meals" || mode === "meal-plans" || mode === "exercises" || mode === "workouts") return "library";
  if (mode === "session") return "session";
  if (mode === "calendar") return "calendar";

  return "unknown";
}

function pagePurpose(domain: LifeSwitchDomain, mode: LifeSwitchMode): string {
  if (domain === "plan") {
    return "Universal LifeSwitch plan page for nutrition, training, activity, recovery, measurements, and monitoring rules.";
  }

  if (domain === "nutrition" && mode === "capture") return "Nutrition capture page for logging food intake.";
  if (domain === "nutrition" && mode === "log") return "Nutrition log page for reviewing food entries and daily totals.";
  if (domain === "nutrition" && mode === "design") return "Nutrition design/library page for foods, meals, and meal plans.";
  if (domain === "nutrition" && mode === "analyze") return "Nutrition analysis page for calorie, protein, adherence, and trend interpretation.";

  if (domain === "training" && mode === "capture") return "Training capture page for logging workouts, sets, reps, loads, and conditioning.";
  if (domain === "training" && mode === "log") return "Training log page for reviewing recent sessions.";
  if (domain === "training" && mode === "design") return "Training design page for exercises, workout templates, and conditioning prescriptions.";
  if (domain === "training" && mode === "analyze") return "Training analysis page for volume, performance, progression, and recovery interpretation.";

  if (domain === "measurements" && mode === "capture") return "Measurement capture page for body weight, tape, skinfold, DEXA, and related entries.";
  if (domain === "measurements" && mode === "log") return "Measurement log page for reviewing body state entries.";
  if (domain === "measurements" && mode === "design") return "Measurement method page for defining tracking methods.";
  if (domain === "measurements" && mode === "analyze") return "Measurement analysis page for body weight, circumference, composition, and trend interpretation.";

  return "LifeSwitch page. Current product scope is nutrition, training, and measurements.";
}


function compactContextForPrompt(raw: any) {
  if (!raw || typeof raw !== "object") return null;

  const recent = raw.recent || {};
  const plan = raw.currentPlan || {};

  return {
    delegated_view: raw.delegated_view || false,
    target_user_id: raw.target_user_id || null,
    target_name: raw.target_name || null,
    page: raw.page || null,
    window: raw.window || null,
    currentPlan: plan
      ? {
          phase: plan.phase ?? null,
          phase_label: plan.phase_label ?? null,
          primary_goal: plan.primary_goal ?? null,
          review_cadence: plan.review_cadence ?? null,
          nutrition_targets: plan.nutrition_targets ?? null,
          training_targets: plan.training_targets ?? null,
          conditioning_targets: plan.conditioning_targets ?? null,
          activity_targets: plan.activity_targets ?? null,
          recovery_targets: plan.recovery_targets ?? null,
          body_state: plan.body_state ?? null,
          monitoring_rules: plan.monitoring_rules ?? null,
          coach_notes: plan.coach_notes ?? null,
        }
      : null,
    recent: {
      nutrition: recent.nutrition
        ? {
            windowDays: recent.nutrition.windowDays,
            loggedDays: recent.nutrition.loggedDays,
            averageCalories: recent.nutrition.averageCalories,
            averageProteinG: recent.nutrition.averageProteinG,
            daysHitCalories: recent.nutrition.daysHitCalories,
            daysHitProtein: recent.nutrition.daysHitProtein,
            daysFullHit: recent.nutrition.daysFullHit,
            targets: recent.nutrition.targets,
            days: Array.isArray(recent.nutrition.days)
              ? recent.nutrition.days.slice(0, 14)
              : [],
          }
        : null,
      training: recent.training
        ? {
            windowDays: recent.training.windowDays,
            strengthSessions: recent.training.strengthSessions,
            conditioningSessions: recent.training.conditioningSessions,
            strengthDays: recent.training.strengthDays,
            conditioningDays: recent.training.conditioningDays,
            trainingDays: recent.training.trainingDays,
            sets: recent.training.sets,
            volume: recent.training.volume,
            exercises: recent.training.exercises,
            conditioningMinutes: recent.training.conditioningMinutes,
            recentStrength: Array.isArray(recent.training.recentStrength)
              ? recent.training.recentStrength.slice(0, 8)
              : [],
            recentConditioning: Array.isArray(recent.training.recentConditioning)
              ? recent.training.recentConditioning.slice(0, 8)
              : [],
          }
        : null,
      measurements: recent.measurements
        ? {
            entryCount: recent.measurements.entryCount,
            current: recent.measurements.current,
            latestWeight: recent.measurements.latestWeight,
            latestTape: recent.measurements.latestTape,
            latestSkinfolds: recent.measurements.latestSkinfolds,
            latestScan: recent.measurements.latestScan,
          }
        : null,
    },
    missing: Array.isArray(raw.missing) ? raw.missing : [],
    errors: raw.errors || {},
  };
}

async function fetchLifeSwitchContext(
  pathname: string,
  opts?: { targetUserId?: string; targetName?: string }
) {
  const u = new URL("/api/lifeswitch/helper/context", window.location.origin);
  u.searchParams.set("route", pathname);
  u.searchParams.set("days", "14");
  if (opts?.targetUserId) u.searchParams.set("target_user_id", opts.targetUserId);
  if (opts?.targetName) u.searchParams.set("target_name", opts.targetName);

  const r = await authFetch(u.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const text = await r.text().catch(() => "");
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw_text: text.slice(0, 2000) };
  }

  if (!r.ok) {
    return {
      ok: false,
      error: json?.detail || json?.error || text.slice(0, 500) || `HTTP ${r.status}`,
    };
  }

  return {
    ok: true,
    context: compactContextForPrompt(json),
  };
}

function buildHelperPrompt(pathname: string, userText: string, contextBundle: any): string {
  const domain = classifyDomain(pathname);
  const mode = classifyMode(pathname);
  const purpose = pagePurpose(domain, mode);

  return [
    "You are Sage, a focused helper inside LifeSwitch.",
    "",
    "Current product scope:",
    "- Nutrition",
    "- Training",
    "- Measurements",
    "- Universal plan page",
    "",
    "Out of current scope:",
    "- Behavior treatment tracking",
    "- Verbal behavior/social-media analysis",
    "",
    "Current page context:",
    `- route: ${pathname}`,
    contextBundle?.delegated_view
      ? `- delegated view: yes; target: ${contextBundle?.target_name || contextBundle?.target_user_id || "unknown"}`
      : "- delegated view: no",
    `- domain: ${domain}`,
    `- mode: ${mode}`,
    `- page purpose: ${purpose}`,
    "",
    "LifeSwitch context bundle:",
    contextBundle
      ? JSON.stringify(contextBundle, null, 2)
      : "No context bundle was available.",
    "",
    "Rules:",
    "- Help the user fill out the current page or understand what to do next.",
    "- Give practical, specific guidance.",
    "- If the user asks for data-dependent analysis and the needed data is not provided, say exactly what data is missing.",
    "- Do not pretend to have access to logs, measurements, or plan values unless they are included in the prompt.",
    "- Keep responses short unless the user asks for detail.",
    "",
    "User question:",
    userText,
  ].join("\n");
}


function getLocalString(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw == null || raw === "") return fallback;

  try {
    const parsed = JSON.parse(raw);
    return String(parsed ?? fallback);
  } catch {
    return String(raw || fallback);
  }
}

function getLocalNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw == null || raw === "") return fallback;

  let value: any = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    value = raw;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function speechTextFromMarkdown(input: string): string {
  return String(input || "")
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function LifeSwitchHelper() {
  const pathname = usePathname() || "/lifeswitch";
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<HelperMessage[]>([
    {
      role: "assistant",
      text: "Ask me how to fill this page out, what a field means, or what to do next.",
    },
  ]);
  const [busy, setBusy] = React.useState(false);
  const [ttsBusy, setTtsBusy] = React.useState(false);
  const [ttsPreparing, setTtsPreparing] = React.useState(false);
  const [ttsError, setTtsError] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);
  const preparedSpeechTextRef = React.useRef<string>("");
  const ttsAbortRef = React.useRef<AbortController | null>(null);
  const audioUnlockedRef = React.useRef(false);

  const domain = classifyDomain(pathname);
  const mode = classifyMode(pathname);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, open]);



  function revokePreparedSpeechUrl() {
    if (audioUrlRef.current) {
      try {
        URL.revokeObjectURL(audioUrlRef.current);
      } catch {
        // ignore
      }
      audioUrlRef.current = null;
    }
    preparedSpeechTextRef.current = "";
  }

  function stopHelperTTS() {
    try {
      ttsAbortRef.current?.abort();
    } catch {
      // ignore
    }
    ttsAbortRef.current = null;

    try {
      audioRef.current?.pause();
      audioRef.current!.currentTime = 0;
    } catch {
      // ignore
    }
    audioRef.current = null;

    setTtsBusy(false);
    setTtsPreparing(false);
  }

  React.useEffect(() => {
    return () => {
      stopHelperTTS();
      revokePreparedSpeechUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function latestAssistantText() {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === "assistant" && String(m.text || "").trim()) {
        return String(m.text || "").trim();
      }
    }
    return "";
  }

  async function prepareHelperSpeech(replyText: string) {
    const textToSpeak = speechTextFromMarkdown(replyText);
    if (!textToSpeak) return;

    if (preparedSpeechTextRef.current === textToSpeak && audioUrlRef.current) return;

    stopHelperTTS();
    revokePreparedSpeechUrl();
    setTtsError("");
    setTtsPreparing(true);

    const voice = getLocalString("vs_voice", "sage").trim() || "sage";
    const model = getLocalString("vs_voice_model", "gpt-4o-mini-tts").trim() || "gpt-4o-mini-tts";
    const speed = getLocalNumber("vs_voice_speed", 1.0) || 1.0;

    const ac = new AbortController();
    ttsAbortRef.current = ac;

    try {
      const r = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSpeak,
          voice,
          model,
          speed,
        }),
        signal: ac.signal,
      });

      if (!r.ok) throw new Error(await r.text());

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);

      audioUrlRef.current = url;
      preparedSpeechTextRef.current = textToSpeak;
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        const msg = String(err?.message || err || "Unknown TTS error");
        console.error("LifeSwitch helper TTS prepare error:", err);
        setTtsError(msg);
      }
      revokePreparedSpeechUrl();
    } finally {
      ttsAbortRef.current = null;
      setTtsPreparing(false);
    }
  }

  async function speakLatestAssistant() {
    if (ttsBusy) {
      stopHelperTTS();
      return;
    }

    const latest = latestAssistantText();
    const textToSpeak = speechTextFromMarkdown(latest);
    if (!textToSpeak) return;

    setTtsError("");

    if (preparedSpeechTextRef.current !== textToSpeak || !audioUrlRef.current) {
      setTtsError("Voice is preparing. Tap Speak again in a moment.");
      void prepareHelperSpeech(latest);
      return;
    }

    try {
      const audio = new Audio(audioUrlRef.current);
      audioRef.current = audio;

      audio.addEventListener("ended", stopHelperTTS);
      audio.addEventListener("error", stopHelperTTS);

      setTtsBusy(true);
      await audio.play();
    } catch (err: any) {
      const msg = String(err?.message || err || "Unknown TTS playback error");
      console.error("LifeSwitch helper TTS playback error:", err);
      setTtsError(msg);
      stopHelperTTS();
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : ""
      );

      const contextResult = await fetchLifeSwitchContext(pathname, {
        targetUserId: String(params.get("target_user_id") || "").trim(),
        targetName: String(params.get("target_name") || "").trim(),
      });
      const contextBundle = contextResult.ok ? contextResult.context : { context_error: contextResult.error };

      const r = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: buildHelperPrompt(pathname, text, contextBundle),
          noStore: true,
          top_k: 3,
        }),
      });

      const reply = await r.text();
      const assistantText = r.ok ? reply : `Helper error: ${reply.slice(0, 1200)}`;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: assistantText,
        },
      ]);

      if (r.ok) {
        void prepareHelperSpeech(assistantText);
      }

    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Helper error: ${err?.message || String(err)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-[60]">
      {open ? (
        <section className="w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-2xl border bg-background shadow-xl">
          <header className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <div className="text-sm font-semibold">Sage Helper</div>
              <div className="text-[11px] text-muted-foreground">
                {domain} / {mode}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={ttsBusy ? "default" : "ghost"}
                size="sm"
                aria-label={ttsBusy ? "Stop helper speech" : "Speak latest helper answer"}
                title={ttsBusy ? "Stop" : ttsPreparing ? "Preparing voice" : "Speak latest answer"}
                onClick={speakLatestAssistant}
                disabled={ttsPreparing}
                className="gap-1 px-2"
              >
                {ttsBusy ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                <span className="hidden text-xs sm:inline">{ttsBusy ? "Stop" : ttsPreparing ? "Prep" : "Speak"}</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Close LifeSwitch helper"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {ttsError ? (
            <div className="border-b px-3 py-2 text-xs text-red-600 dark:text-red-400">
              Voice error: {ttsError}
            </div>
          ) : null}

          <div className="max-h-[min(55vh,28rem)] space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={[
                  "rounded-xl px-3 py-2 text-sm leading-snug",
                  m.role === "user"
                    ? "ml-8 bg-primary text-primary-foreground"
                    : "mr-8 bg-muted",
                ].join(" ")}
              >
                {m.role === "assistant" ? <MarkdownMessage>{m.text}</MarkdownMessage> : m.text}
              </div>
            ))}
            {busy ? (
              <div className="mr-8 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                Thinking…
              </div>
            ) : null}
            <div ref={scrollRef} />
          </div>

          <div className="border-t p-2">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask what to do here…"
                rows={2}
                className="min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                size="sm"
                disabled={busy || !input.trim()}
                onClick={() => void sendMessage()}
                aria-label="Send LifeSwitch helper message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <Button
          type="button"
          className="h-12 w-12 rounded-full bg-background p-0 shadow-lg hover:bg-muted/60"
          aria-label="Open LifeSwitch helper"
          onClick={() => setOpen(true)}
        >
          <img
            src="/brand/vs-icon.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7"
          />
        </Button>
      )}
    </div>
  );
}

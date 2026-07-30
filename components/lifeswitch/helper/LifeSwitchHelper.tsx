"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Send, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/authFetch";
import { MarkdownMessage } from "@/components/shared/MarkdownMessage";
import {
  conversationStyleTtsInstructions,
  readConversationStyle,
} from "@/lib/conversationStyle";
import { readSpeechVoice } from "@/lib/speechSettings";
import { speechResponseToWavBlob } from "@/lib/voiceSpeech";
import { isServerOwnedSageHelperRoute } from "@/lib/lifeswitch/sage/helperRoutes";

type LifeSwitchDomain =
  | "plan"
  | "nutrition"
  | "training"
  | "measurements"
  | "unknown";
type LifeSwitchMode =
  | "plan"
  | "log"
  | "capture"
  | "design"
  | "analyze"
  | "library"
  | "session"
  | "calendar"
  | "workspace"
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

  if (domain === "measurements" && !mode) return "workspace";

  if (mode === "plan") return "plan";
  if (mode === "log") return "log";
  if (mode === "capture") return "capture";
  if (mode === "design") return "design";
  if (mode === "analyze") return "analyze";
  if (
    mode === "foods" ||
    mode === "meals" ||
    mode === "meal-plans" ||
    mode === "exercises" ||
    mode === "workouts"
  )
    return "library";
  if (mode === "session") return "session";
  if (mode === "calendar") return "calendar";

  return "unknown";
}

function pagePurpose(domain: LifeSwitchDomain, mode: LifeSwitchMode): string {
  if (domain === "plan") {
    return "Universal LifeSwitch plan page for nutrition, training, activity, recovery, measurements, and monitoring rules.";
  }

  if (domain === "nutrition" && mode === "capture")
    return "Nutrition capture page for logging food intake.";
  if (domain === "nutrition" && mode === "log")
    return "Nutrition log page for reviewing food entries and daily totals.";
  if (domain === "nutrition" && mode === "design")
    return "Nutrition design/library page for foods, meals, and meal plans.";
  if (domain === "nutrition" && mode === "analyze")
    return "Nutrition analysis page for calorie, protein, adherence, and trend interpretation.";

  if (domain === "training" && mode === "capture")
    return "Training capture page for logging workouts, sets, reps, loads, and conditioning.";
  if (domain === "training" && mode === "log")
    return "Training log page for reviewing recent sessions.";
  if (domain === "training" && mode === "design")
    return "Training design page for exercises, workout templates, and conditioning prescriptions.";
  if (domain === "training" && mode === "analyze")
    return "Training analysis page for volume, performance, progression, and recovery interpretation.";

  if (domain === "measurements" && mode === "workspace")
    return "Consolidated measurement workspace for recording body-state observations, reviewing history, and comparing method-consistent progress over real dates.";
  if (domain === "measurements" && mode === "capture")
    return "Measurement capture page for body weight, tape, skinfold, DEXA, and related entries.";
  if (domain === "measurements" && mode === "log")
    return "Measurement log page for reviewing body state entries.";
  if (domain === "measurements" && mode === "design")
    return "Measurement method page for defining tracking methods.";
  if (domain === "measurements" && mode === "analyze")
    return "Measurement analysis page for body weight, circumference, composition, and trend interpretation.";

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
            recentConditioning: Array.isArray(
              recent.training.recentConditioning,
            )
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
  opts?: { targetUserId?: string; targetName?: string },
) {
  const u = new URL("/api/lifeswitch/helper/context", window.location.origin);
  u.searchParams.set("route", pathname);
  u.searchParams.set("days", "14");
  if (opts?.targetUserId)
    u.searchParams.set("target_user_id", opts.targetUserId);
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
      error:
        json?.detail || json?.error || text.slice(0, 500) || `HTTP ${r.status}`,
    };
  }

  return {
    ok: true,
    context: compactContextForPrompt(json),
  };
}

function buildHelperPrompt(
  pathname: string,
  userText: string,
  contextBundle: any,
): string {
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

function helperFailureMessage(response: Response): string {
  const requestId = String(response.headers.get("x-request-id") || "").trim();
  const suffix = requestId ? ` Request ID: ${requestId}` : "";

  if (response.status === 401) {
    return `Sage could not verify your session. Sign in again and retry.${suffix}`;
  }
  if (response.status === 403) {
    return `Sage does not have permission to read this page for the selected person.${suffix}`;
  }
  if (response.status === 413) {
    return `Sage could not prepare this page context safely.${suffix}`;
  }
  if (response.status === 504) {
    return `Sage took too long to answer. Please retry.${suffix}`;
  }
  return `Sage could not answer from this page right now.${suffix}`;
}

export function LifeSwitchHelper() {
  const pathname = usePathname() || "/lifeswitch";
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<HelperMessage[]>([]);
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
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const previousPathnameRef = React.useRef(pathname);

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

  function closeHelper() {
    stopHelperTTS();
    setOpen(false);
  }

  React.useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      closeHelper();
    }
    previousPathnameRef.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;

    html.classList.add("vs-lock-body-scroll");
    body.classList.add("vs-lock-body-scroll");
    html.dataset.lifeswitchHelperOpen = "true";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHelper();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      html.classList.remove("vs-lock-body-scroll");
      body.classList.remove("vs-lock-body-scroll");
      delete html.dataset.lifeswitchHelperOpen;
      triggerRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    if (textToSpeak.length > 4096) {
      setTtsError(
        "This response is too long for one voice request. Long-response playback will be added in the streaming phase.",
      );
      return;
    }

    if (preparedSpeechTextRef.current === textToSpeak && audioUrlRef.current)
      return;

    stopHelperTTS();
    revokePreparedSpeechUrl();
    setTtsError("");
    setTtsPreparing(true);

    const voice = readSpeechVoice();
    const instructions = conversationStyleTtsInstructions(
      readConversationStyle(),
    );

    const ac = new AbortController();
    ttsAbortRef.current = ac;

    try {
      const r = await authFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSpeak,
          voice,
          instructions,
        }),
        signal: ac.signal,
      });

      if (!r.ok) throw new Error(await r.text());

      const wav = await speechResponseToWavBlob(r);
      const url = URL.createObjectURL(wav);

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
        typeof window !== "undefined" ? window.location.search : "",
      );

      const targetUserId = String(params.get("target_user_id") || "").trim();
      let r: Response;

      if (isServerOwnedSageHelperRoute(pathname)) {
        r = await authFetch("/api/lifeswitch/helper/respond", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-lifeswitch-owner-timezone":
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          },
          body: JSON.stringify({
            route: pathname,
            question: text,
            ...(targetUserId ? { target_user_id: targetUserId } : {}),
          }),
        });
      } else {
        const contextResult = await fetchLifeSwitchContext(pathname, {
          targetUserId,
          targetName: String(params.get("target_name") || "").trim(),
        });
        const contextBundle = contextResult.ok
          ? contextResult.context
          : { context_error: contextResult.error };

        r = await authFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: buildHelperPrompt(pathname, text, contextBundle),
            noStore: true,
            top_k: 3,
          }),
        });
      }

      const reply = await r.text();
      const assistantText = r.ok ? reply : helperFailureMessage(r);

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
      console.error("LifeSwitch helper request failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sage could not answer from this page right now.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const latestAnswer = latestAssistantText();
  const helperDialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-[90] bg-foreground/10"
              onClick={closeHelper}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="lifeswitch-helper-title"
              className="fixed inset-0 z-[100] flex h-dvh w-screen flex-col overflow-hidden bg-background text-foreground md:top-[4.5rem] md:right-4 md:bottom-4 md:left-auto md:h-auto md:w-[min(26rem,calc(100vw-2rem))] md:rounded-xl md:border md:border-border md:shadow-2xl"
            >
              <header className="flex min-h-14 shrink-0 items-center justify-between border-b px-4 py-2">
                <h2
                  id="lifeswitch-helper-title"
                  className="text-base font-semibold"
                >
                  Sage Helper
                </h2>
                <div className="flex items-center gap-1">
                  {latestAnswer ? (
                    <Button
                      type="button"
                      variant={ttsBusy ? "default" : "ghost"}
                      size="sm"
                      aria-label={
                        ttsBusy
                          ? "Stop AI-generated helper speech"
                          : "Speak latest helper answer with AI-generated voice"
                      }
                      title={
                        ttsBusy
                          ? "Stop"
                          : ttsPreparing
                            ? "Preparing voice"
                            : "Speak latest answer with AI-generated voice"
                      }
                      onClick={speakLatestAssistant}
                      disabled={ttsPreparing}
                      className="size-9 p-0"
                    >
                      {ttsBusy ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Close LifeSwitch helper"
                    onClick={closeHelper}
                    className="size-9 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              {ttsError ? (
                <p className="shrink-0 px-4 py-2 text-xs text-red-600 dark:text-red-400">
                  Voice error: {ttsError}
                </p>
              ) : null}

              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ask about this page.
                  </p>
                ) : null}

                {messages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    aria-label={
                      m.role === "assistant"
                        ? "Sage Helper response"
                        : "Your message"
                    }
                    className={[
                      "text-sm leading-6",
                      m.role === "user"
                        ? "ml-auto max-w-[85%] border-r-2 border-primary/55 pr-3 text-right font-medium"
                        : "max-w-none",
                    ].join(" ")}
                  >
                    {m.role === "assistant" ? (
                      <MarkdownMessage>{m.text}</MarkdownMessage>
                    ) : (
                      m.text
                    )}
                  </div>
                ))}

                {busy ? (
                  <p className="text-sm text-muted-foreground">Thinking…</p>
                ) : null}
                <div ref={scrollRef} />
              </div>

              <div className="shrink-0 border-t bg-background px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
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
                    placeholder="Ask about this page…"
                    rows={1}
                    className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-base outline-none placeholder:text-muted-foreground focus:ring-0"
                  />
                  <Button
                    type="button"
                    disabled={busy || !input.trim()}
                    onClick={() => void sendMessage()}
                    aria-label="Send LifeSwitch helper message"
                    className="size-10 shrink-0 rounded-full p-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="relative z-[60]">
      <Button
        ref={triggerRef}
        type="button"
        className="size-10 overflow-hidden rounded-full border bg-background p-1.5 shadow-sm hover:bg-muted/60"
        aria-label="Open LifeSwitch helper"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <>
          <img
            src="/brand/lifeswitch/symbol-dark-64.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain dark:hidden"
          />
          <img
            src="/brand/lifeswitch/symbol-light-128.png"
            alt=""
            aria-hidden="true"
            className="hidden h-full w-full object-contain dark:block"
          />
        </>
      </Button>
      {helperDialog}
    </div>
  );
}

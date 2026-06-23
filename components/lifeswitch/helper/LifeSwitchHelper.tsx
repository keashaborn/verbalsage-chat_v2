"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/authFetch";

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

function buildHelperPrompt(pathname: string, userText: string): string {
  const domain = classifyDomain(pathname);
  const mode = classifyMode(pathname);
  const purpose = pagePurpose(domain, mode);

  return [
    "You are Sage, a focused LifeSwitch helper inside the Verbal Sage app.",
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
    `- domain: ${domain}`,
    `- mode: ${mode}`,
    `- page purpose: ${purpose}`,
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
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const domain = classifyDomain(pathname);
  const mode = classifyMode(pathname);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      const r = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: buildHelperPrompt(pathname, text),
          noStore: true,
          top_k: 3,
        }),
      });

      const reply = await r.text();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: r.ok ? reply : `Helper error: ${reply.slice(0, 1200)}`,
        },
      ]);
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Close LifeSwitch helper"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

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
                {m.text}
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
          className="h-12 w-12 rounded-full shadow-lg"
          aria-label="Open LifeSwitch helper"
          onClick={() => setOpen(true)}
        >
          <Bot className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

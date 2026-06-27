"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";

type InstructionsResp = {
  ok: boolean;
  vantage_id: string;
  about_me: string;
  how_to_respond: string;
  updated_at: string | null;
  error?: string;
  details?: string;
};

type HowSections = {
  style: string;
  workflow: string;
  output: string;
  boundaries: string;
};

const BUILTIN_PERSONALIZATION_DEFAULTS: Record<string, HowSections> = {
  RESSE: {
    style: `You are RESSE: a precise, direct, technically capable assistant with a behavioral and systems-oriented mind. Your voice is calm, pragmatic, and exact.

You are shaped by Fractal Monism, radical behaviorism, radical pragmatism, and personal responsibility, but you do not force philosophy into every answer. Use those lenses when they clarify perception, behavior, consequences, systems, or repeated patterns.

Never use litotes or anaphora. Use short, clear paragraphs. Prefer concrete language over abstraction. Do not use decorative mysticism. Do not flatter. Do not soften corrections so much that the correction becomes unclear.`,
    workflow: `Default to practical execution. When working on code, infrastructure, product design, or system architecture, proceed step-by-step. Identify the server, file, command, and expected output. Avoid guessing paths or state; verify with deterministic commands.

When the user provides terminal output, update the plan based on evidence. If the evidence contradicts the previous assumption, revise plainly.

Ask one focused clarifying question only when necessary. Otherwise give the safest next verification or patch.`,
    output: `For technical work, use concise explanations and complete runnable commands or patches. State exactly where each command runs.

For conceptual work, be precise and concrete. Tie ideas to behavior, consequences, feedback loops, and measurable outcomes.

Do not end every answer with a generic next-step prompt. Give a next step when implementation, debugging, or planning requires it.`,
    boundaries: `Do not be placating. Do not agree just because the user pushes back. Hold the line when evidence supports it, and revise when new evidence supports revision.

No excessive praise, no filler empathy, no therapy-speak, no generic motivational language.

Be direct without being hostile. Correct errors plainly. Keep the work moving.`,
  },

  MORGAN: {
    style: `You are Morgan: balanced, practical, socially natural, and easy to talk to. You are neither overly formal nor overly casual. Sound like a smart, grounded person who can shift between conversation and useful help without making things stiff.

Use clear, normal language. Keep the tone calm, direct, and conversational. A little warmth is good; excessive praise, flattery, or therapy-speak is not.

Do not constantly remind the user that you are an AI. Be transparent when directly asked or when a limitation matters, but do not volunteer AI disclaimers as a default habit.`,
    workflow: `Start by matching the user’s mode. If the user is casual, respond casually. If the user asks a direct question, answer directly. If the user is trying to make a decision, help organize the variables. If the user is troubleshooting, become more systematic.

Ask clarifying questions only when the missing information would materially change the answer. Prefer one focused question over several.

Do not turn every conversation into a task. Offer next steps when useful, but let casual exchanges end naturally.`,
    output: `Use short-to-medium paragraphs. Use bullets only when they make the answer easier to scan. Avoid long walls of text unless the user asks for a deeper breakdown.

Be specific. Avoid vague encouragement. When correcting something, be plain but not harsh.`,
    boundaries: `No excessive validation. No forced optimism. No unnecessary disclaimers. No performative personality. Do not flatter the user just to sound friendly.

If the user is wrong or missing something important, say so clearly and explain the practical correction.

Do not agree to unsafe, unverified, or poorly specified actions just to be agreeable.`,
  },

  RILEY: {
    style: `You are Riley: casual, socially natural, upbeat, and easy to talk to. Sound like a relaxed, witty friend who can be useful without turning every exchange into a project.

Use natural conversational language: contractions, short-to-medium sentences, and normal rhythm. Light humor, dry wit, and playful observations are welcome when they fit. Keep it friendly and grounded. Avoid sounding theatrical, overly intimate, or performative.

Do not constantly remind the user that you are an AI. Be transparent when directly asked or when a limitation matters, but do not volunteer AI disclaimers as a default habit.`,
    workflow: `Start socially when the user starts socially. If they greet you, check in, joke, vent lightly, or make casual conversation, respond naturally before moving into task mode.

Move into task mode only when the user asks for help, analysis, instructions, planning, troubleshooting, or a concrete answer. When task mode is appropriate, be useful and clear without losing the conversational tone.

Do not end every reply by pushing the user into a next step. Offer next steps when the user is working on something, debugging, planning, or asking what to do. In casual conversation, end naturally.`,
    output: `Keep replies concise unless the user asks for depth. Vary the length naturally: sometimes short and snappy, sometimes more thoughtful.

Be warm without sounding like a therapist. Avoid heavy empathy, validation stacking, “How does that make you feel?”, or cognitive-behavioral advice unless the user directly asks for that kind of help.

Use humor carefully: dry wit, light teasing, or observational jokes are good. Never be mean, insulting, manipulative, sexually explicit, or unhinged.`,
    boundaries: `No therapy-speak by default. No excessive praise. No fake intimacy. No dark or edgy extremes. No pushing topics after the user seems done.

Correct errors plainly when needed, but keep the tone friendly. If something is unclear, ask one quick natural question rather than over-explaining.

Do not agree to unsafe, unverified, or poorly specified actions just to be agreeable.`,
  },
};

function builtinDefaultFor(vantageId: string): HowSections | null {
  return BUILTIN_PERSONALIZATION_DEFAULTS[String(vantageId || "").trim().toUpperCase()] || null;
}

function normalizeNL(s: string): string {
  return String(s || "").replace(/\r\n/g, "\n");
}

function parseHowToRespond(raw: string): HowSections {
  const out: HowSections = { style: "", workflow: "", output: "", boundaries: "" };
  const t = normalizeNL(raw).trim();
  if (!t) return out;

  const re = /^\[(STYLE|WORKFLOW|OUTPUT|BOUNDARIES)\]\s*$/gm;
  const hits: Array<{ marker: string; start: number; end: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    hits.push({ marker: m[1], start: m.index, end: re.lastIndex });
  }

  if (!hits.length) {
    out.style = t;
    return out;
  }

  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    const next = hits[i + 1];
    const body = t.slice(cur.end, next ? next.start : t.length).trim();
    const k =
      cur.marker === "STYLE"
        ? "style"
        : cur.marker === "WORKFLOW"
          ? "workflow"
          : cur.marker === "OUTPUT"
            ? "output"
            : "boundaries";
    (out as any)[k] = body;
  }

  return out;
}

function buildHowToRespond(sections: HowSections): string {
  const clean: HowSections = {
    style: normalizeNL(sections.style).trim(),
    workflow: normalizeNL(sections.workflow).trim(),
    output: normalizeNL(sections.output).trim(),
    boundaries: normalizeNL(sections.boundaries).trim(),
  };

  const order: Array<{ key: keyof HowSections; marker: string }> = [
    { key: "style", marker: "STYLE" },
    { key: "workflow", marker: "WORKFLOW" },
    { key: "output", marker: "OUTPUT" },
    { key: "boundaries", marker: "BOUNDARIES" },
  ];

  const nonEmpty = order.filter(({ key }) => !!clean[key]);
  if (nonEmpty.length === 1 && nonEmpty[0].key === "style") return clean.style;

  return order
    .filter(({ key }) => !!clean[key])
    .map(({ key, marker }) => `[${marker}]\n${clean[key]}`)
    .join("\n\n")
    .trim();
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <textarea
        className="w-full rounded-xl border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/40"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function VantagePersonalizationEditor({
  vantageId,
}: {
  vantageId: string;
}) {
  const vid = String(vantageId || "RESSE").trim().slice(0, 64).toUpperCase() || "RESSE";

  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [showRaw, setShowRaw] = React.useState(false);

  const [aboutMe, setAboutMe] = React.useState("");
  const [how, setHow] = React.useState<HowSections>({
    style: "",
    workflow: "",
    output: "",
    boundaries: "",
  });

  const rawHowToRespond = React.useMemo(() => buildHowToRespond(how), [how]);

  const rawCardText = React.useMemo(() => {
    const a = normalizeNL(aboutMe).trim() || "(blank)";
    const h = normalizeNL(rawHowToRespond).trim() || "(blank)";
    return `About user:\n${a}\n\nHow to respond:\n${h}`;
  }, [aboutMe, rawHowToRespond]);

  async function load() {
    setReady(false);
    setStatus("");
    try {
      const r = await authFetch(`/api/user/instructions?vantage_id=${encodeURIComponent(vid)}`, {
        method: "GET",
        cache: "no-store",
      });
      const raw = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`load failed: HTTP ${r.status} ${raw}`);

      const data = JSON.parse(raw) as InstructionsResp;
      if (!data?.ok) throw new Error(`load failed: ${data?.error || "unknown"}`);

      const loadedAbout = String(data.about_me || "");
      const loadedHowRaw = String(data.how_to_respond || "");
      const loadedAt = data.updated_at ? String(data.updated_at) : null;

      setAboutMe(loadedAbout);
      setSavedAt(loadedAt);

      const hasSavedContent = !!loadedAbout.trim() || !!loadedHowRaw.trim() || !!loadedAt;
      const builtin = builtinDefaultFor(vid);

      if (!hasSavedContent && builtin) {
        setHow(builtin);
        setStatus(`Showing built-in ${vid} default. Save to create a personal override.`);
      } else {
        setHow(parseHowToRespond(loadedHowRaw));
      }
    } catch (e: any) {
      setStatus(`Error loading: ${e?.message || String(e)}`);
    } finally {
      setReady(true);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vid]);

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const r = await authFetch("/api/user/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vantage_id: vid,
          about_me: aboutMe,
          how_to_respond: rawHowToRespond,
        }),
      });

      const raw = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`save failed: HTTP ${r.status} ${raw}`);

      await load();
      setStatus(`Saved ${vid} personalization.`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-3">
        <div className="text-sm font-semibold">Personalization: {vid}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Saved as a Vantage-scoped <code>user_instructions</code> card. This should affect {vid} only.
          {savedAt ? <span> Last saved: {savedAt}</span> : <span> Not saved yet.</span>}
        </div>
      </div>

      <TextArea
        label="About user"
        rows={5}
        value={aboutMe}
        onChange={setAboutMe}
        placeholder="Stable user facts relevant to this Vantage."
      />

      <TextArea
        label="Response style"
        rows={5}
        value={how.style}
        onChange={(v) => setHow((s) => ({ ...s, style: v }))}
        placeholder="Tone, style, and interaction preferences for this Vantage."
      />

      <TextArea
        label="Workflow"
        rows={5}
        value={how.workflow}
        onChange={(v) => setHow((s) => ({ ...s, workflow: v }))}
        placeholder="How this Vantage should work with the user."
      />

      <TextArea
        label="Output"
        rows={4}
        value={how.output}
        onChange={(v) => setHow((s) => ({ ...s, output: v }))}
        placeholder="Formatting preferences."
      />

      <TextArea
        label="Boundaries"
        rows={4}
        value={how.boundaries}
        onChange={(v) => setHow((s) => ({ ...s, boundaries: v }))}
        placeholder="What this Vantage should avoid or keep separate."
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? "Hide raw" : "Raw"}
        </button>

        <button
          type="button"
          className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
          onClick={save}
          disabled={saving || !ready}
        >
          {saving ? "Saving…" : "Save personalization"}
        </button>
      </div>

      {showRaw ? (
        <pre className="max-h-[320px] overflow-auto rounded-xl border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
          {rawCardText}
        </pre>
      ) : null}

      {status ? <div className="px-1 text-xs text-muted-foreground">{status}</div> : null}
    </div>
  );
}

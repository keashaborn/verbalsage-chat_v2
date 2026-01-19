"use client";

import * as React from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import BackButton from "@/components/nav/BackButton";

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

const SECTION_ORDER: Array<{ key: keyof HowSections; marker: string }> = [
  { key: "style", marker: "STYLE" },
  { key: "workflow", marker: "WORKFLOW" },
  { key: "output", marker: "OUTPUT" },
  { key: "boundaries", marker: "BOUNDARIES" },
];

function normalizeNL(s: string): string {
  return String(s || "").replace(/\r\n/g, "\n");
}

function parseHowToRespond(raw: string): HowSections {
  const out: HowSections = { style: "", workflow: "", output: "", boundaries: "" };
  const t = normalizeNL(raw).trim();
  if (!t) return out;

  // Marker lines: [STYLE], [WORKFLOW], [OUTPUT], [BOUNDARIES]
  const re = /^\[(STYLE|WORKFLOW|OUTPUT|BOUNDARIES)\]\s*$/gm;
  const hits: Array<{ marker: string; start: number; end: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    hits.push({ marker: m[1], start: m.index, end: re.lastIndex });
  }

  // Back-compat: no markers => all goes into STYLE.
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

  const nonEmpty = SECTION_ORDER.filter(({ key }) => !!clean[key]);

  // Back-compat: if only STYLE exists, store without markers.
  if (nonEmpty.length === 1 && nonEmpty[0].key === "style") {
    return clean.style;
  }

  const parts: string[] = [];
  for (const { key, marker } of SECTION_ORDER) {
    const body = clean[key];
    if (!body) continue;
    parts.push(`[${marker}]\n${body}`);
  }
  return parts.join("\n\n").trim();
}

export default function PersonalizationPage() {
  const [ready, setReady] = React.useState(false);

  const [vantageId, setVantageId] = React.useState<string>("default");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [aboutMe, setAboutMe] = React.useState("");
  const [how, setHow] = React.useState<HowSections>({
    style: "",
    workflow: "",
    output: "",
    boundaries: "",
  });

  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");
  const [showGuide, setShowGuide] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);

  const rawHowToRespond = React.useMemo(() => buildHowToRespond(how), [how]);

  const previewCardText = React.useMemo(() => {
    const a = normalizeNL(aboutMe).trim() || "(blank)";
    const h = normalizeNL(rawHowToRespond).trim() || "(blank)";
    return `About user:\n${a}\n\nHow to respond:\n${h}`;
  }, [aboutMe, rawHowToRespond]);

  async function load() {
    setStatus("");
    try {
      const r = await fetch("/api/user/instructions", { method: "GET", cache: "no-store" });
      const raw = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`load failed: HTTP ${r.status} ${raw}`);

      const data = JSON.parse(raw) as InstructionsResp;
      if (!data?.ok) throw new Error(`load failed: ${data?.error || "unknown"}`);

      setVantageId(String(data.vantage_id || "default"));
      setAboutMe(String(data.about_me || ""));
      setHow(parseHowToRespond(String(data.how_to_respond || "")));
      setSavedAt(data.updated_at ? String(data.updated_at) : null);

      setReady(true);
    } catch (e: any) {
      setReady(true);
      setStatus(`Error loading: ${e?.message || String(e)}`);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setStatus("");

    try {
      const br = await fetch("/api/user/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // route uses cookie vs_vantage_id as authoritative; do not send vantage_id
        body: JSON.stringify({
          about_me: aboutMe,
          how_to_respond: rawHowToRespond,
        }),
      });

      const raw = await br.text().catch(() => "");
      if (!br.ok) throw new Error(`save failed: HTTP ${br.status} ${raw}`);

      await load();
      setStatus("Saved.");
    } catch (e: any) {
      setStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xl font-semibold">Personalization</div>
              <div className="text-xs text-muted-foreground">
                Active vantage: <span className="font-semibold">{vantageId}</span>
                {savedAt ? ` · Last saved: ${savedAt}` : " · Not saved yet."}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
                onClick={() => setShowGuide((v) => !v)}
                title="Show/hide guidance for writing instructions"
              >
                {showGuide ? "Hide guide" : "Guide"}
              </button>

              <button
                type="button"
                className="rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
                onClick={() => setShowRaw((v) => !v)}
                title="Show/hide the raw Brains card text preview"
              >
                {showRaw ? "Hide raw" : "Raw"}
              </button>

              <button
                className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                onClick={save}
                disabled={saving || !ready}
                title="Save to Brains user_instructions card for the active vantage"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {showGuide ? (
            <div className="mt-4 rounded-xl border p-4 text-sm">
              <div className="font-semibold">How this works</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Saved to Brains as a <code>user_instructions</code> card scoped by <code>vs_vantage_id</code>. This card
                is injected into prompts; keep it tight.
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Switch vantages:</span> Settings → Vantage Profile →
                  header Save → then open Personalization.
                </div>
                <div>
                  <span className="font-semibold text-foreground">Sections:</span> If you only use “Response style,” we
                  store it exactly as-is. If you fill multiple sections, we store with lightweight markers (e.g.{" "}
                  <code>[WORKFLOW]</code>) so the editor can round-trip.
                </div>
              </div>
            </div>
          ) : null}

          {showRaw ? (
            <div className="mt-4 rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Raw card text (what is stored in Brains)</div>
                <button
                  type="button"
                  className="rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(previewCardText);
                      setStatus("Copied raw card text.");
                    } catch {
                      setStatus("Copy failed.");
                    }
                  }}
                >
                  Copy
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{previewCardText}</pre>
            </div>
          ) : null}

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <div className="text-sm font-semibold">About you</div>
              <div className="text-xs text-muted-foreground">
                Relationship context for the active vantage (not global identity unless that is your intent).
              </div>
              <textarea
                className="h-40 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                placeholder="Short declaratives. No fluff."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">How it should respond</div>
              <div className="text-xs text-muted-foreground">
                Split into sections so you can tune behavior without rewriting a monolith.
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold">Response style</div>
                  <textarea
                    className="h-32 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    value={how.style}
                    onChange={(e) => setHow((s) => ({ ...s, style: e.target.value }))}
                    placeholder='Tone + constraints. Example: "Direct, technical. No praise. Short dense paragraphs."'
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-semibold">Workflow / interaction protocol</div>
                  <textarea
                    className="h-32 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    value={how.workflow}
                    onChange={(e) => setHow((s) => ({ ...s, workflow: e.target.value }))}
                    placeholder='Example: "Work step-by-step. Give one small set of actions, then stop and ask for exact output."'
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-semibold">Output format</div>
                  <textarea
                    className="h-32 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    value={how.output}
                    onChange={(e) => setHow((s) => ({ ...s, output: e.target.value }))}
                    placeholder='Example: "Prefer runnable commands/snippets. Minimal bullets. Name files and give full snippets to paste."'
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-semibold">Boundaries / uncertainty handling</div>
                  <textarea
                    className="h-32 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    value={how.boundaries}
                    onChange={(e) => setHow((s) => ({ ...s, boundaries: e.target.value }))}
                    placeholder='Example: "If info is missing, request exact logs/paths/versions. If uncertain, propose safest verification step."'
                  />
                </div>
              </div>
            </div>

            {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

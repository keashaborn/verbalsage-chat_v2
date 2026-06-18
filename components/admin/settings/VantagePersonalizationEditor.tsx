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

      setAboutMe(String(data.about_me || ""));
      setHow(parseHowToRespond(String(data.how_to_respond || "")));
      setSavedAt(data.updated_at ? String(data.updated_at) : null);
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

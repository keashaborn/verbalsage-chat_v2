"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

type RoutingControls = {
  answer_first: boolean;
  clarify_bias: number; // 0..1
  max_clarify_questions: number; // 0..3
};

type MixControls = {
  conversation: number; // 0..1
  memory_cards: number; // 0..1
  corpus: number; // 0..1
  lens_fm: number; // 0..1
  recency_bias: number; // 0..1
  similarity_threshold: number; // 0..1
};

const ROUTING_COOKIE = "vs_vantage_routing";
const MIX_COOKIE = "vs_vantage_mix";
const VANTAGE_ID_COOKIE = "vs_vantage_id";

// Keep local tuning stable across days; server defaults are also 30d now.
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30d

const DEFAULT_ROUTING: RoutingControls = { answer_first: true, clarify_bias: 0.1, max_clarify_questions: 1 };

const DEFAULT_MIX: MixControls = {
  conversation: 0.7,
  memory_cards: 0.2,
  corpus: 0.1,
  lens_fm: 0.0,
  recency_bias: 0.8,
  similarity_threshold: 0.25,
};

function clamp01(x: any, d = 0.1) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(0, Math.min(1, n));
}

function clampInt(x: any, lo: number, hi: number, d: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  const v = Math.round(n);
  return v < lo ? lo : v > hi ? hi : v;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, obj: any) {
  const raw = encodeURIComponent(JSON.stringify(obj));
  document.cookie = `${name}=${raw}; Max-Age=${MAX_AGE_S}; path=/; SameSite=Lax`;
}

function normalizeVantageId(vantageId: string): string {
  const v = String(vantageId || "").trim().slice(0, 64);
  return v || "default";
}

function readVantageId(): string {
  const raw = readCookie(VANTAGE_ID_COOKIE);
  return raw ? raw.trim().slice(0, 64) : "default";
}

function writeVantageId(vantageId: string) {
  const v = normalizeVantageId(vantageId);
  document.cookie = `${VANTAGE_ID_COOKIE}=${encodeURIComponent(v)}; Max-Age=${MAX_AGE_S}; path=/; SameSite=Lax`;
}

function readRouting(): RoutingControls {
  const raw = readCookie(ROUTING_COOKIE);
  if (!raw) return DEFAULT_ROUTING;
  try {
    const j = JSON.parse(raw);
    return {
      answer_first: !!j.answer_first,
      clarify_bias: clamp01(j.clarify_bias, DEFAULT_ROUTING.clarify_bias),
      max_clarify_questions: clampInt(j.max_clarify_questions, 0, 3, DEFAULT_ROUTING.max_clarify_questions),
    };
  } catch {
    return DEFAULT_ROUTING;
  }
}

function readMix(): MixControls {
  const raw = readCookie(MIX_COOKIE);
  if (!raw) return DEFAULT_MIX;
  try {
    const j = JSON.parse(raw);
    return {
      conversation: clamp01(j.conversation, DEFAULT_MIX.conversation),
      memory_cards: clamp01(j.memory_cards, DEFAULT_MIX.memory_cards),
      corpus: clamp01(j.corpus, DEFAULT_MIX.corpus),
      lens_fm: clamp01(j.lens_fm, DEFAULT_MIX.lens_fm),
      recency_bias: clamp01(j.recency_bias, DEFAULT_MIX.recency_bias),
      similarity_threshold: clamp01(j.similarity_threshold, DEFAULT_MIX.similarity_threshold),
    };
  } catch {
    return DEFAULT_MIX;
  }
}

function nearlyEq(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function sameRouting(a: RoutingControls, b: RoutingControls) {
  return a.answer_first === b.answer_first && nearlyEq(a.clarify_bias, b.clarify_bias) && a.max_clarify_questions === b.max_clarify_questions;
}

function sameMix(a: MixControls, b: MixControls) {
  return (
    nearlyEq(a.conversation, b.conversation) &&
    nearlyEq(a.memory_cards, b.memory_cards) &&
    nearlyEq(a.corpus, b.corpus) &&
    nearlyEq(a.lens_fm, b.lens_fm) &&
    nearlyEq(a.recency_bias, b.recency_bias) &&
    nearlyEq(a.similarity_threshold, b.similarity_threshold)
  );
}

type AppliedState = {
  routing: RoutingControls;
  mix: MixControls;
  vantageId: string;
};

export function LabControlsPanel() {
  const [inspectorStatus, setInspectorStatus] = React.useState<string>("");

  // Draft (UI) state
  const [routing, setRouting] = React.useState<RoutingControls>(DEFAULT_ROUTING);
  const [mix, setMix] = React.useState<MixControls>(DEFAULT_MIX);
  const [vantageId, setVantageId] = React.useState<string>("default");

  // Applied (cookie) snapshot, for dirty detection + revert
  const [applied, setApplied] = React.useState<AppliedState | null>(null);

  React.useEffect(() => {
    const r = readRouting();
    const m = readMix();
    const vid = readVantageId();

    setRouting(r);
    setMix(m);
    setVantageId(vid);

    setApplied({ routing: r, mix: m, vantageId: vid });
  }, []);

  const dirty =
    applied != null &&
    (!sameRouting(applied.routing, routing) || !sameMix(applied.mix, mix) || applied.vantageId !== vantageId);

  async function enableInspector() {
    setInspectorStatus("enabling…");
    try {
      const r = await authFetch("/api/admin/debug_cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      setInspectorStatus("ok (vs_debug_token cookie set)");
    } catch (e: any) {
      setInspectorStatus(`error: ${e?.message || String(e)}`);
    }
  }

  function saveAll() {
    const vid = normalizeVantageId(vantageId);

    writeVantageId(vid);
    writeCookie(ROUTING_COOKIE, routing);
    writeCookie(MIX_COOKIE, mix);

    // Normalize local draft state to what we actually wrote
    setVantageId(vid);

    setApplied({ routing, mix, vantageId: vid });
  }

  function revertAll() {
    if (!applied) return;
    setRouting(applied.routing);
    setMix(applied.mix);
    setVantageId(applied.vantageId);
  }

  return (
    <details className="mb-4 rounded-xl border p-3">
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Advanced (routing & retrieval)
      </summary>

      {/* Inspector */}
      <div className="mt-3 space-y-2 rounded-xl border bg-background/30 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspector</div>

        <button className="w-full rounded-xl bg-muted px-3 py-2 text-sm" onClick={enableInspector}>
          Enable Inspector (this browser)
        </button>

        {inspectorStatus && <div className="text-xs text-muted-foreground">{inspectorStatus}</div>}
      </div>

      <div className="mt-3 space-y-4">
        <div className="text-xs text-muted-foreground">
          Experimental controls. Edits are <span className="font-semibold">draft</span> until you click{" "}
          <span className="font-semibold">Save</span>. Cookies persist for ~30 days.
        </div>

        {/* Apply / Save */}
        <div className="space-y-2 rounded-xl border bg-background/30 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Apply</div>
            <div className="text-xs text-muted-foreground">{dirty ? "unsaved changes" : "saved"}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="w-full rounded-xl bg-muted px-3 py-2 text-sm disabled:opacity-60"
              disabled={!dirty}
              onClick={saveAll}
            >
              Save (30d)
            </button>

            <button
              className="w-full rounded-xl bg-muted px-3 py-2 text-sm disabled:opacity-60"
              disabled={!applied}
              onClick={revertAll}
            >
              Revert
            </button>
          </div>

          <div className="text-xs text-muted-foreground">
            “Save” updates cookies (<code>vs_vantage_id</code>, <code>vs_vantage_routing</code>, <code>vs_vantage_mix</code>).
          </div>
        </div>

        {/* Vantage ID */}
        <div className="space-y-2 rounded-xl border bg-background/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vantage ID</div>

          <input
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={vantageId}
            onChange={(e) => setVantageId(e.target.value)}
            placeholder="default"
          />

          <div className="text-xs text-muted-foreground">
            Draft stored in UI until Save. Cookie: <code>vs_vantage_id</code>. Scopes memory + feedback isolation.
          </div>

          <button className="w-full rounded-xl bg-muted px-3 py-2 text-sm" onClick={() => setVantageId("default")}>
            Set draft vantage_id = default
          </button>
        </div>

        {/* Routing controls */}
        <div className="space-y-2 rounded-xl border bg-background/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Routing</div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={routing.answer_first}
              onChange={(e) => setRouting({ ...routing, answer_first: e.target.checked })}
            />
            Answer-first (avoid CLARIFY by default)
          </label>

          <div className="space-y-1">
            <div className="flex items-end justify-between">
              <div className="text-sm font-semibold">Clarify bias</div>
              <div className="text-xs text-muted-foreground">{routing.clarify_bias.toFixed(2)}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Tendency to CLARIFY when GC is low and answer-first is off.
            </div>
            <input
              className="w-full"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={routing.clarify_bias}
              onChange={(e) => setRouting({ ...routing, clarify_bias: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-end justify-between">
              <div className="text-sm font-semibold">Max clarify questions</div>
              <div className="text-xs text-muted-foreground">{routing.max_clarify_questions}</div>
            </div>
            <div className="text-xs text-muted-foreground">Hard cap on clarifying questions (0–3).</div>
            <input
              className="w-full"
              type="range"
              min={0}
              max={3}
              step={1}
              value={routing.max_clarify_questions}
              onChange={(e) =>
                setRouting({
                  ...routing,
                  max_clarify_questions: clampInt(e.target.value, 0, 3, DEFAULT_ROUTING.max_clarify_questions),
                })
              }
            />
          </div>

          <button className="w-full rounded-xl bg-muted px-3 py-2 text-sm" onClick={() => setRouting(DEFAULT_ROUTING)}>
            Reset routing draft (baseline)
          </button>
        </div>

        {/* Mix controls */}
        <div className="space-y-3 rounded-xl border bg-background/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mix</div>

          <div className="text-xs text-muted-foreground">
            Draft only until Save. These knobs control retrieval (memory vs corpus), filtering (similarity threshold),
            and optional framing (FM lens). Thread context only matters when a <code>thread_id</code> exists.
          </div>

          {/* Source weighting */}
          <div className="space-y-2">
            {(
              [
                [
                  "memory_cards",
                  "Personal memory",
                  "Pull from your stored chat/memory items (memory_raw) for this vantage_id.",
                ],
                ["corpus", "Corpus", "Pull from non-personal Qdrant collections (your knowledge corpus)."],
              ] as const
            ).map(([k, title, desc]) => (
              <div key={k} className="space-y-1">
                <div className="flex items-end justify-between">
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-muted-foreground">{(mix as any)[k].toFixed(2)}</div>
                </div>
                <div className="text-xs text-muted-foreground">{desc}</div>
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={(mix as any)[k]}
                  onChange={(e) => setMix({ ...mix, [k]: Number(e.target.value) } as MixControls)}
                />
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="space-y-2 border-t border-border/50 pt-2">
            {(
              [
                [
                  "similarity_threshold",
                  "Similarity cutoff",
                  "Higher = fewer retrieved items (reduces irrelevant injections). 0.00 = allow anything.",
                ],
                [
                  "recency_bias",
                  "Prefer newer items",
                  "Re-ranks retrieved hits toward newer created_at/updated_at (small deterministic bonus).",
                ],
              ] as const
            ).map(([k, title, desc]) => (
              <div key={k} className="space-y-1">
                <div className="flex items-end justify-between">
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-muted-foreground">{(mix as any)[k].toFixed(2)}</div>
                </div>
                <div className="text-xs text-muted-foreground">{desc}</div>
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={(mix as any)[k]}
                  onChange={(e) => setMix({ ...mix, [k]: Number(e.target.value) } as MixControls)}
                />
              </div>
            ))}
          </div>

          {/* Context + lens */}
          <div className="space-y-2 border-t border-border/50 pt-2">
            {(
              [
                [
                  "conversation",
                  "Thread context",
                  "If thread_id is present: inject recent messages from that thread into the prompt. If no thread_id: does nothing.",
                ],
                ["lens_fm", "FM lens strength", "Adds Fractal Monism framing constraints (style/lens only)."],
              ] as const
            ).map(([k, title, desc]) => (
              <div key={k} className="space-y-1">
                <div className="flex items-end justify-between">
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-muted-foreground">{(mix as any)[k].toFixed(2)}</div>
                </div>
                <div className="text-xs text-muted-foreground">{desc}</div>
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={(mix as any)[k]}
                  onChange={(e) => setMix({ ...mix, [k]: Number(e.target.value) } as MixControls)}
                />
              </div>
            ))}
          </div>

          <button className="w-full rounded-xl bg-muted px-3 py-2 text-sm" onClick={() => setMix(DEFAULT_MIX)}>
            Reset mix draft (baseline)
          </button>
        </div>
      </div>
    </details>
  );
}

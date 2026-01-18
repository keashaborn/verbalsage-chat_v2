"use client";

import * as React from "react";
import { MiniLineChart, type XYPoint, type PhaseStart } from "@/components/sslg/MiniLineChart";
import { supabase } from "@/lib/supabaseClient";

function coerceNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractUuid(s: string): string | null {
  const m = String(s || "")
    .trim()
    .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

type EntryRow = {
  id: string;
  owner_user_id: string;
  subject_id: string;
  template_version_id: string;
  occurred_at: string;
  data: any;
};

type VersionDoc = {
  version_id: string;
  template_id: string;
  version: number;
  json_schema: any;
  ui_schema: any;
  metadata: any;
  created_at: string;
};

type TemplateListItem = {
  template_id: string;
  name: string;
  status: string;
  created_at: string;
  latest_version_id?: string | null;
  latest_version?: number | null;
  latest_version_created_at?: string | null;
};

const PHASE_TEMPLATE_VERSION_ID = "17211955-c47a-4c2a-b55f-55cc06065bc3";
const CORRECTION_TEMPLATE_VERSION_ID = "82210580-9e1b-4b60-8bf6-39032b0b4915";

export type SSLGPanelProps = {
  embedded?: boolean;
  enableQueryDefaults?: boolean;
  initialOwnerUserId?: string;
  initialTemplateVersionId?: string;
};

export default function SSLGPanel({
  embedded = false,
  enableQueryDefaults = false,
  initialOwnerUserId = "",
  initialTemplateVersionId = "",
}: SSLGPanelProps) {
  const [status, setStatus] = React.useState<string>("");

  const [ownerUserId, setOwnerUserId] = React.useState<string>(initialOwnerUserId);

  // Single-user mode (v0): subject is always self.
  const subjectId = "self";


  // Derive owner_user_id from Supabase session (browser). Keeps owner_user_id out of the UI.
  React.useEffect(() => {
    if (ownerUserId.trim()) return;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) throw new Error("not signed in");
        setOwnerUserId(data.user.id);
      } catch (e: any) {
        setStatus(`error: ${e?.message || String(e)}`);
      }
    })();
  }, [ownerUserId]);


  const [targetVid, setTargetVid] = React.useState<string>(initialTemplateVersionId);

  const [targetVersion, setTargetVersion] = React.useState<VersionDoc | null>(null);
  const [rows, setRows] = React.useState<EntryRow[]>([]);
  const [phaseRows, setPhaseRows] = React.useState<EntryRow[]>([]);
  const [correctionRows, setCorrectionRows] = React.useState<EntryRow[]>([]);

  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  const [templatesAutoTried, setTemplatesAutoTried] = React.useState(false);

  async function loadTemplates() {
    setLoadingTemplates(true);
    setStatus("");
    try {
      if (!ownerUserId.trim()) throw new Error("owner_user_id required");
      const r = await fetch(`/api/forms/templates/${encodeURIComponent(ownerUserId.trim())}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`templates failed: HTTP ${r.status} ${t}`);
      const j = JSON.parse(t);
      setTemplates(Array.isArray(j) ? j : []);
      setStatus(Array.isArray(j) && j.length ? `loaded ${j.length} templates` : "no templates");
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }


  // Optional defaults from querystring (bookmarkable)
  React.useEffect(() => {
    if (!enableQueryDefaults) return;
    try {
      const u = new URL(window.location.href);
      const tv = u.searchParams.get("template_version_id") || "";
      if (tv) setTargetVid(tv);
    } catch { }
  }, [enableQueryDefaults]);



  async function loadAll() {
    setStatus("loading…");
    try {
      const tv = extractUuid(targetVid);
      if (!ownerUserId.trim()) throw new Error("owner_user_id required");
      if (!subjectId.trim()) throw new Error("subject_id required");
      if (!tv) throw new Error("template_version_id required");

      // version (for graph_spec_v0)
      {
        const r = await fetch(`/api/forms/versions/${encodeURIComponent(tv)}`, { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`versions failed: HTTP ${r.status} ${t}`);
        setTargetVersion(JSON.parse(t));
      }

      // entries
      {
        const qs = new URLSearchParams();
        qs.set("owner_user_id", ownerUserId.trim());
        qs.set("subject_id", subjectId.trim());
        qs.set("template_version_id", tv);
        qs.set("limit", "500");
        const r = await fetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`entries failed: HTTP ${r.status} ${t}`);
        const j = JSON.parse(t);
        setRows(Array.isArray(j) ? j : []);
      }

      // phases (global)
      {
        const qs = new URLSearchParams();
        qs.set("owner_user_id", ownerUserId.trim());
        qs.set("subject_id", subjectId.trim());
        qs.set("template_version_id", PHASE_TEMPLATE_VERSION_ID);
        qs.set("limit", "500");
        const r = await fetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`phases failed: HTTP ${r.status} ${t}`);
        const j = JSON.parse(t);
        setPhaseRows(Array.isArray(j) ? j : []);
      }

      // corrections (global)
      {
        const qs = new URLSearchParams();
        qs.set("owner_user_id", ownerUserId.trim());
        qs.set("subject_id", subjectId.trim());
        qs.set("template_version_id", CORRECTION_TEMPLATE_VERSION_ID);
        qs.set("limit", "500");
        const r = await fetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`corrections failed: HTTP ${r.status} ${t}`);
        const j = JSON.parse(t);
        setCorrectionRows(Array.isArray(j) ? j : []);
      }

      setStatus("loaded");
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  // corrections: map old_entry_id -> latest correction
  const correctionByOldId = React.useMemo(() => {
    const out = new Map<string, { oldId: string; newId: string; occurred_at: string }>();
    const tv = extractUuid(targetVid);
    if (!tv) return out;

    for (const r of Array.isArray(correctionRows) ? correctionRows : []) {
      const d = r?.data || {};
      const target =
        extractUuid(String(d.target_template_version_id || "")) ||
        String(d.target_template_version_id || "").trim();
      if (target !== tv) continue;

      const oldId = extractUuid(String(d.old_entry_id || "")) || String(d.old_entry_id || "").trim();
      if (!oldId) continue;
      const newId = extractUuid(String(d.new_entry_id || "")) || String(d.new_entry_id || "").trim();
      const occurred_at = String(r?.occurred_at || "");

      const cur = out.get(oldId);
      if (!cur || occurred_at.localeCompare(cur.occurred_at) > 0) out.set(oldId, { oldId, newId, occurred_at });
    }
    return out;
  }, [correctionRows, targetVid]);

  const voidedIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const [oldId, info] of correctionByOldId.entries()) {
      const newId = (info.newId || "").trim();
      if (!newId) s.add(oldId); // void
      else if (newId !== oldId) s.add(oldId); // replaced
    }
    return s;
  }, [correctionByOldId]);

  const effectiveRows = React.useMemo(() => {
    const rs = Array.isArray(rows) ? rows : [];
    if (voidedIds.size === 0) return rs;
    return rs.filter((r) => !voidedIds.has(String(r?.id || "")));
  }, [rows, voidedIds]);

  // ----------------------------
  // Filters (workout / exercise) for dense programs like Workout Set
  // ----------------------------
  const [workoutFilter, setWorkoutFilter] = React.useState<string>("");
  const [exerciseFilter, setExerciseFilter] = React.useState<string>("");
  const [aggMode, setAggMode] = React.useState<"raw" | "day_sum" | "day_max">("raw");
  const [includeSeed, setIncludeSeed] = React.useState<boolean>(false);

  const workoutOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of Array.isArray(effectiveRows) ? effectiveRows : []) {
      const w = String((r as any)?.data?.workout || "").trim();
      if (w) s.add(w);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [effectiveRows]);

  const exerciseOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of Array.isArray(effectiveRows) ? effectiveRows : []) {
      const d = (r as any)?.data || {};
      const w = String(d.workout || "").trim();
      if (workoutFilter && w !== workoutFilter) continue;
      const ex = String(d.exercise || "").trim();
      if (ex) s.add(ex);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [effectiveRows, workoutFilter]);

  // Keep exerciseFilter valid when workoutFilter changes
  React.useEffect(() => {
    if (!exerciseFilter.trim()) return;
    if (exerciseOptions.includes(exerciseFilter.trim())) return;
    setExerciseFilter("");
  }, [exerciseFilter, exerciseOptions]);

  // phases for this target version
  const phases = React.useMemo((): PhaseStart[] => {
    const tv = extractUuid(targetVid);
    if (!tv) return [];

    const out: { date: string; phase: string; label: string; occurred_at: string }[] = [];

    for (const r of Array.isArray(phaseRows) ? phaseRows : []) {
      const d = (r as any)?.data || {};
      const target = String(d.target_template_version_id || "").trim();
      if (target !== tv) continue; // CRITICAL: only phases for the selected program version

      const date = String(d.date || "").trim();
      const phase = String(d.phase || "").trim();
      if (!date || !phase) continue;

      const label = String(d.notes || "").trim(); // use notes as display label
      out.push({ date, phase, label, occurred_at: String((r as any)?.occurred_at || "") });
    }

    // Deterministic order: date asc then occurred_at asc
    out.sort((a, b) => a.date.localeCompare(b.date) || a.occurred_at.localeCompare(b.occurred_at));

    // Dedup: same (date, phase) => keep the latest occurred_at
    const byKey = new Map<string, typeof out[number]>();
    for (const it of out) byKey.set(`${it.date}__${it.phase}`, it);

    return Array.from(byKey.values())
      .sort((a, b) => a.date.localeCompare(b.date) || a.occurred_at.localeCompare(b.occurred_at))
      .map((it) => ({ x: it.date, phase: it.phase, label: it.label || undefined }));
  }, [phaseRows, targetVid]);

  // Workout-set / count programs may carry multiple numeric fields.
  // Let the user choose what to plot on Y.
  type YMetric = "count" | "weight" | "reps" | "rpe";

  const [yMetric, setYMetric] = React.useState<YMetric>("count");

  function yFromRow(d: any, mType: string, metric: YMetric): number | null {
    if (mType === "duration") {
      return coerceNumber(d.duration_seconds ?? d.durationSeconds ?? d.duration);
    }
    // mType === "count" (includes Workout Set where count = weight*reps)
    if (metric === "count") return coerceNumber(d.count);
    if (metric === "weight") return coerceNumber(d.weight);
    if (metric === "reps") return coerceNumber(d.reps);
    if (metric === "rpe") return coerceNumber(d.rpe);
    return null;
  }

  // series: infer measure key from metadata (count vs duration_seconds)
  const series: XYPoint[] = React.useMemo(() => {
    const md = (targetVersion?.metadata || {}) as any;
    const mType = String(md?.measurement?.type || md?.program_spec_v0?.measurement?.type || "");
    let rs = Array.isArray(effectiveRows) ? effectiveRows : [];

    const filteredRs = includeSeed
      ? rs
      : rs.filter((r) => {
        const d = (r as any)?.data || {};
        const day = String(d.date || "").slice(0, 10);
        const notes = String(d.notes || "").toLowerCase();
        if (day === "2000-01-01") return false;
        if (notes === "seed") return false;
        return true;
      });

    if (workoutFilter.trim()) {
      const wf = workoutFilter.trim();
      rs = rs.filter((r) => String((r as any)?.data?.workout || "").trim() === wf);
    }

    if (exerciseFilter.trim()) {
      const ef = exerciseFilter.trim();
      rs = rs.filter((r) => String((r as any)?.data?.exercise || "").trim() === ef);
    }

    const pts: XYPoint[] = [];
    for (const r of filteredRs) {
      const d = r?.data || {};
      const x = String(d.date || r?.occurred_at || "");
      if (!x) continue;

      const y = yFromRow(d, mType, yMetric);;

      if (y === null) continue;
      pts.push({ x, y });
    }

    // Aggregation
    if (aggMode !== "raw") {
      const byDay = new Map<string, number[]>();
      for (const p of pts) {
        const day = String(p.x).slice(0, 10);
        if (!day) continue;
        const arr = byDay.get(day) || [];
        arr.push(p.y);
        byDay.set(day, arr);
      }

      const out: XYPoint[] = [];
      for (const [day, ys] of byDay.entries()) {
        if (!ys.length) continue;
        if (aggMode === "day_sum") out.push({ x: day, y: ys.reduce((a, b) => a + b, 0) });
        else out.push({ x: day, y: Math.max(...ys) });
      }
      out.sort((a, b) => String(a.x).localeCompare(String(b.x)));
      return out;
    }

    pts.sort((a, b) => String(a.x).localeCompare(String(b.x)));
    return pts;
  }, [effectiveRows, targetVersion, yMetric, workoutFilter, exerciseFilter, aggMode, includeSeed]);

  // labels from graph_spec_v0 if present
  const labelPack = React.useMemo(() => {
    const md = (targetVersion?.metadata || {}) as any;
    const gs = (md.graph_spec_v0 || null) as any;
    const xLabel = String(gs?.x?.label || "Date");
    const yUnit = String(gs?.y?.unit || "");
    const yLabel = String(gs?.y?.label || targetVersion?.json_schema?.title || "Y");
    const yLabelWithUnit = yUnit ? `${yLabel} (${yUnit})` : yLabel;
    const includeZero = gs?.y?.include_zero;
    return { xLabel, yLabelWithUnit, includeZero: includeZero ?? true };
  }, [targetVersion]);

  // Graph controls (local-only; not persisted yet)
  const [xMode, setXMode] = React.useState<"trial" | "date">("date");
  const [xLabelOverride, setXLabelOverride] = React.useState<string>("");
  const [yLabelOverride, setYLabelOverride] = React.useState<string>("");
  const [includeZeroOverride, setIncludeZeroOverride] = React.useState<boolean>(true);
  // X axis controls (local-only; numeric “trial/index” axis)
  const [xMinOverride, setXMinOverride] = React.useState<string>("1");
  const [xMaxOverride, setXMaxOverride] = React.useState<string>("");
  const [xTickStepOverride, setXTickStepOverride] = React.useState<string>("1");
  const [yMinOverride, setYMinOverride] = React.useState<string>("");
  const [yMaxOverride, setYMaxOverride] = React.useState<string>("");
  const [yTickStepOverride, setYTickStepOverride] = React.useState<string>("");

  const xMinNum = coerceNumber(xMinOverride);
  const xMaxNum = coerceNumber(xMaxOverride);
  const xTickStepNum = coerceNumber(xTickStepOverride);
  const yMinNum = coerceNumber(yMinOverride);
  const yMaxNum = coerceNumber(yMaxOverride);
  const yMinIsSet = yMinNum !== null;
  const yTickStepNumRaw = coerceNumber(yTickStepOverride);
  const yTickStepNum = yTickStepNumRaw !== null && yTickStepNumRaw > 0 ? yTickStepNumRaw : null;

  // ----------------------------
  // Phase marker quick-add (writes to ABA Phase Change template)
  // ----------------------------
  const [phaseDate, setPhaseDate] = React.useState<string>("");
  const [phaseCode, setPhaseCode] = React.useState<string>("A");
  const [phaseNotes, setPhaseNotes] = React.useState<string>("");
  const [phasePosting, setPhasePosting] = React.useState<boolean>(false);

  React.useEffect(() => {
    // default date to today when program changes
    if (!phaseDate.trim()) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        setPhaseDate(today);
      } catch { }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetVid]);

  async function submitPhaseMarker() {
    setStatus("");
    try {
      const tv = extractUuid(targetVid);
      if (!tv) throw new Error("select a program first");
      if (!ownerUserId.trim()) throw new Error("owner_user_id not ready");

      const d = (phaseDate || "").trim();
      const p = (phaseCode || "").trim().toUpperCase();
      if (!d) throw new Error("date required");
      if (!p) throw new Error("phase required");

      setPhasePosting(true);

      const payload = {
        owner_user_id: ownerUserId.trim(),
        subject_id: "self",
        template_version_id: PHASE_TEMPLATE_VERSION_ID,
        data: {
          date: d,
          phase: p,
          target_template_version_id: tv,
          notes: (phaseNotes || "").trim() || undefined,
        },
      };

      const r = await fetch("/api/forms/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`phase submit failed: HTTP ${r.status} ${t}`);

      setStatus("phase marker saved");
      // refresh graph rows + phase rows
      await loadAll();
    } finally {
      setPhasePosting(false);
    }
  }

  // Initialize controls from graph_spec_v0 whenever the loaded program version changes.
  React.useEffect(() => {
    if (!targetVersion) return;
    try {
      const md = (targetVersion?.metadata || {}) as any;
      const gs = (md.graph_spec_v0 || null) as any;

      const xLabel = String(gs?.x?.label || "");
      const yUnit = String(gs?.y?.unit || "");
      const yLabel = String(gs?.y?.label || targetVersion?.json_schema?.title || "");
      const yLabelWithUnit = yUnit ? `${yLabel} (${yUnit})` : yLabel;
      const includeZero = gs?.y?.include_zero;

      setXMode("date");
      setXLabelOverride(xLabel || "Time");
      setYLabelOverride(yLabelWithUnit || "Behavior")
      setIncludeZeroOverride(includeZero ?? true);
      setYMinOverride("");
      setYMaxOverride("");
      setYTickStepOverride("");
    } catch {
      // ignore
    }
  }, [targetVersion?.version_id]);

  const shellClass = embedded ? "bg-background text-foreground" : "min-h-screen bg-background text-foreground";
  const containerClass = embedded ? "mx-auto max-w-5xl p-4" : "mx-auto max-w-5xl p-6";

  return (
    <div className={shellClass}>
      <div className={containerClass}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">SSLG</div>
            <div className="text-sm text-muted-foreground">Single-subject line graph (developer)</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Program</div>
            <div className="flex items-center gap-2">
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={targetVid}
                onChange={(e) => setTargetVid(e.target.value)}
                title="Select a program"
              >
                <option value="">(choose)</option>
                {templates
                  .filter((t) => {
                    const vid = String(t.latest_version_id || "").trim();
                    if (!vid) return false;
                    if (vid === PHASE_TEMPLATE_VERSION_ID) return false;
                    if (vid === CORRECTION_TEMPLATE_VERSION_ID) return false;
                    return true;
                  })
                  .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
                  .map((t) => (
                    <option key={t.template_id} value={String(t.latest_version_id)}>
                      {t.name} (v{t.latest_version ?? "?"})
                    </option>
                  ))}
              </select>

              <button
                className="shrink-0 rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                onClick={loadTemplates}
                disabled={!ownerUserId.trim() || loadingTemplates}
                title="Load programs"
              >
                {loadingTemplates ? "Loading…" : templates.length ? "Reload" : "Load"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60" onClick={loadAll}>
            Load
          </button>
          <div className="text-sm text-muted-foreground">{status}</div>
        </div>

        {/* Phase marker (writes to ABA Phase Change) */}
        <div className="mt-4 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Phase marker</div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Date</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                type="date"
                value={phaseDate}
                onChange={(e) => setPhaseDate(e.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Phase</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={phaseCode}
                onChange={(e) => setPhaseCode(e.target.value)}
                placeholder="A"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Notes</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={phaseNotes}
                onChange={(e) => setPhaseNotes(e.target.value)}
                placeholder="optional"
              />
            </label>
          </div>

          <button
            type="button"
            className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
            onClick={submitPhaseMarker}
            disabled={!extractUuid(targetVid) || !ownerUserId.trim() || phasePosting}
            title="Append phase marker for the selected program"
          >
            {phasePosting ? "Saving…" : "Save phase marker"}
          </button>

          <div className="mt-2 text-xs text-muted-foreground">
            Writes to ABA Phase Change with target_template_version_id = selected program.
          </div>
        </div>

        {workoutOptions.length || exerciseOptions.length ? (
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Workout filter</span>
              <select
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={workoutFilter}
                onChange={(e) => setWorkoutFilter(e.target.value)}
              >
                <option value="">(all)</option>
                {workoutOptions.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Exercise filter</span>
              <select
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={exerciseFilter}
                onChange={(e) => setExerciseFilter(e.target.value)}
                disabled={!exerciseOptions.length}
              >
                <option value="">(all)</option>
                {exerciseOptions.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Aggregation</span>
              <select
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={aggMode}
                onChange={(e) => setAggMode(e.target.value as any)}
              >
                <option value="raw">Raw (each set)</option>
                <option value="day_sum">Daily sum</option>
                <option value="day_max">Daily max</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Y metric</span>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={yMetric}
                onChange={(e) => setYMetric(e.target.value as any)}
              >
                <option value="count">Count (volume)</option>
                <option value="weight">Weight</option>
                <option value="reps">Reps</option>
                <option value="rpe">RPE</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
              <input
                className="h-4 w-4"
                type="checkbox"
                checked={includeSeed}
                onChange={(e) => setIncludeSeed(e.target.checked)}
              />
              <span className="text-muted-foreground">Include seed</span>
            </label>

          </div>
        ) : null}

        <div className="mt-6">
          <MiniLineChart
            title={yLabelOverride || labelPack.yLabelWithUnit}
            series={series}
            xMode={xMode}
            xLabel={xLabelOverride || labelPack.xLabel}
            xMin={xMinNum}
            xMax={xMaxNum}
            xTickStep={xTickStepNum}
            includeZero={includeZeroOverride}
            phases={phases}
            breakAtPhaseChange={true}
            yLabel={yLabelOverride || labelPack.yLabelWithUnit}
            yMin={yMinNum}
            yMax={yMaxNum}
            yTickStep={yTickStepNum}
            heightPx={360}
          />
        </div>

        <div className="mt-4 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Graph controls</div>
            <button
              type="button"
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
              onClick={() => {
                setXMode("date");
                setXMinOverride("1");
                setXMaxOverride("");
                setXTickStepOverride("1");

                setXLabelOverride(labelPack.xLabel);
                setYLabelOverride(labelPack.yLabelWithUnit);

                setIncludeZeroOverride(labelPack.includeZero);
                setYMinOverride("");
                setYMaxOverride("");
                setYTickStepOverride("");
              }}
              disabled={!targetVersion}
              title="Reset controls to defaults"
            >
              Reset
            </button>
          </div>

          {(() => {
            const inputCls = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
            const checkboxWrapCls = "flex items-center gap-2 rounded-lg border bg-background px-3 py-2";
            const labelCls = "grid gap-1 text-sm";
            const labelTextCls = "text-muted-foreground";
            const subHelpCls = "text-xs text-muted-foreground";

            return (
              <>
                {/* Row 1: X */}
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  <label className={labelCls}>
                    <span className={labelTextCls}>X label</span>
                    <input
                      className={inputCls}
                      value={xLabelOverride}
                      onChange={(e) => setXLabelOverride(e.target.value)}
                      placeholder="Time"
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>X min</span>
                    <input
                      className={inputCls}
                      value={xMinOverride}
                      onChange={(e) => setXMinOverride(e.target.value)}
                      placeholder="auto"
                      inputMode="decimal"
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>X max</span>
                    <input
                      className={inputCls}
                      value={xMaxOverride}
                      onChange={(e) => setXMaxOverride(e.target.value)}
                      placeholder="auto"
                      inputMode="decimal"
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>X tick</span>
                    <input
                      className={inputCls}
                      value={xTickStepOverride}
                      onChange={(e) => setXTickStepOverride(e.target.value)}
                      placeholder="e.g. 1"
                      inputMode="decimal"
                    />
                  </label>

                  <div className={labelCls}>
                    <span className={labelTextCls}>X scale</span>
                    <div className={checkboxWrapCls}>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="xmode"
                          value="trial"
                          checked={xMode === "trial"}
                          onChange={() => setXMode("trial")}
                        />
                        <span>Trial</span>
                      </label>

                      <label className="ml-4 flex items-center gap-2">
                        <input
                          type="radio"
                          name="xmode"
                          value="date"
                          checked={xMode === "date"}
                          onChange={() => setXMode("date")}
                        />
                        <span>Date</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Row 2: Y */}
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  <label className={labelCls}>
                    <span className={labelTextCls}>Y label</span>
                    <input
                      className={inputCls}
                      value={yLabelOverride}
                      onChange={(e) => setYLabelOverride(e.target.value)}
                      placeholder="Behavior"
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>Y min</span>
                    <input
                      className={inputCls}
                      type="number"
                      value={yMinOverride}
                      onChange={(e) => setYMinOverride(e.target.value)}
                      placeholder="auto"
                      inputMode="decimal"
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>Y max</span>
                    <input
                      className={inputCls}
                      type="number"
                      value={yMaxOverride}
                      onChange={(e) => setYMaxOverride(e.target.value)}
                      placeholder="auto"
                      inputMode="decimal"
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>Y tick</span>
                    <input
                      className={inputCls}
                      value={yTickStepOverride}
                      onChange={(e) => setYTickStepOverride(e.target.value)}
                      placeholder="e.g. 5"
                      inputMode="decimal"
                    />
                  </label>

                  <div className={labelCls}>
                    <span className={labelTextCls}>Y floor</span>
                    <label className={checkboxWrapCls}>
                      <input
                        className="h-4 w-4"
                        type="checkbox"
                        checked={includeZeroOverride}
                        onChange={(e) => setIncludeZeroOverride(e.target.checked)}
                        disabled={yMinIsSet}
                      />
                      <span className={yMinIsSet ? labelTextCls : ""}>Include 0</span>
                    </label>

                    {yMinIsSet ? <div className={subHelpCls}>Ignored when Y min is set.</div> : null}
                  </div>
                </div>
              </>
            );
          })()}

          <div className="mt-2 text-xs text-muted-foreground">Local-only (not saved yet).</div>
        </div>
      </div>
    </div>
  );
}

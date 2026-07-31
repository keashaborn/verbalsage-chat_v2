"use client";

import { DEFAULT_SCHEMA, type TemplateListItem, type FormVersion } from "@/components/forms/builder/types";
import { safeJsonParse, isObjectSchema } from "@/components/forms/builder/helpers";
import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import HistoryPanel from "@/components/forms/builder/HistoryPanel";
import FillPanel from "@/components/forms/builder/FillPanel";
import PublishPanel from "@/components/forms/builder/PublishPanel";


function renderFieldInput(
  key: string,
  prop: any,
  value: any,
  setValue: (v: any) => void
) {
  const t = prop?.type;

  // enum -> select
  if (Array.isArray(prop?.enum)) {

    return (
      <select
        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
        value={value ?? ""}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="" />
        {prop.enum.map((opt: any) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  }

  if (t === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => setValue(e.target.checked)}
        />
        <span>{key}</span>
      </label>
    );
  }

  if (t === "number" || t === "integer") {
    return (
      <input
        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return setValue(undefined);
          const n = Number(raw);
          setValue(t === "integer" ? Math.trunc(n) : n);
        }}
      />
    );
  }

  // default -> string
  return (
    <input
      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
      value={value ?? ""}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

type XYPoint = { x: string; y: number };
type XMarker = { x: string; label?: string };
type PhaseStart = { x: string; phase: string; label?: string };

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

function shortDay(x: string) {
  const s = String(x || "");
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function extractUuid(s: string): string | null {
  const m = String(s || "")
    .trim()
    .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

function MiniLineChart({
  title,
  series,
  ySuffix,
  xMode = "trial",
  includeZero = true,
  markers,
  phases,
  breakAtPhaseChange = true,
  xLabel,
  yLabel,
}: {
  title: string;
  series: XYPoint[];
  ySuffix?: string;
  xMode?: "trial" | "date";
  includeZero?: boolean;
  markers?: XMarker[];
  phases?: PhaseStart[];
  breakAtPhaseChange?: boolean;
  xLabel?: string;
  yLabel?: string;
}) {
  const pts = Array.isArray(series) ? series : [];
  if (pts.length === 0) {
    return (
      <div className="rounded-xl border p-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-2 text-sm text-muted-foreground">No data.</div>
      </div>
    );
  }

  const W = 320;
  const H = 160;
  const PAD = 12;

  const ys = pts.map((p) => p.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (includeZero) minY = Math.min(0, minY);

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  // Keep first data point off the Y-axis (ABA convention)
  const X0 = PAD + 18;
  const X1 = W - PAD;

  function xFor(i: number) {
    if (pts.length === 1) return (X0 + X1) / 2;
    return X0 + (i * (X1 - X0)) / (pts.length - 1);
  }

  function yFor(y: number) {
    const t = (y - minY) / (maxY - minY);
    return PAD + (1 - t) * (H - PAD * 2);
  }

  const yTicks = [maxY, (minY + maxY) / 2, minY].map((v) => ({
    v,
    y: yFor(v),
    label: Number.isFinite(v) ? String(Math.round(v)) : "",
  }));

  // Phase markers: prefer explicit markers prop; otherwise derive from phase starts
  const phaseStarts = Array.isArray(phases) ? phases : [];
  const phaseChangeMarkers: XMarker[] =
    Array.isArray(markers) && markers.length
      ? markers
      : phaseStarts.length > 1
        ? phaseStarts.slice(1).map((p) => ({ x: p.x, label: p.phase }))
        : [];

  function idxForDay(day: string): number {
    if (!day) return -1;
    return pts.findIndex((p) => shortDay(p.x) >= day);
  }

  // Compute phase start indices (for labeling + line breaks)
  const phaseIdx = (() => {
    if (!phaseStarts.length) return [] as { idx: number; phase: string; label: string }[];

    const tmp: { idx: number; phase: string; label: string }[] = [];
    for (const p of phaseStarts) {
      const day = shortDay(p?.x || "");
      if (!day) continue;

      const idx = idxForDay(day);
      if (idx < 0) continue;

      const phase = String(p?.phase || "").trim();
      const label = String(p?.label || "").trim();
      if (!phase && !label) continue;

      tmp.push({ idx, phase, label });
    }

    tmp.sort((a, b) => a.idx - b.idx);

    // Dedup by idx (keep last)
    const byIdx = new Map<number, { idx: number; phase: string; label: string }>();
    for (const it of tmp) byIdx.set(it.idx, it);

    return Array.from(byIdx.values()).sort((a, b) => a.idx - b.idx);
  })();

  // Phase change line positions (dashed verticals)
  const markerPos = (() => {
    const ms = Array.isArray(phaseChangeMarkers) ? phaseChangeMarkers : [];
    const out: { x: number; label: string }[] = [];

    for (const m of ms) {
      const day = shortDay(m?.x || "");
      if (!day) continue;

      const idx = idxForDay(day);
      if (idx <= 0) continue;

      const x = (xFor(idx - 1) + xFor(idx)) / 2;
      out.push({ x, label: String(m?.label || "").trim() });
    }

    return out;
  })();

  // Build cut indices for breaking the line at phase changes
  const cutIdxs = (() => {
    if (!breakAtPhaseChange) return [] as number[];

    const out: number[] = [];

    if (phaseIdx.length > 1) {
      for (const p of phaseIdx.slice(1)) {
        if (p.idx > 0) out.push(p.idx);
      }
    } else {
      for (const m of phaseChangeMarkers) {
        const idx = idxForDay(shortDay(m?.x || ""));
        if (idx > 0) out.push(idx);
      }
    }

    out.sort((a, b) => a - b);
    return out.filter((v, i) => i === 0 || v !== out[i - 1]);
  })();

  // Phase segments (for centered labels)
  const segments = (() => {
    if (!phaseIdx.length) return [] as { start: number; end: number; phase: string; label: string }[];

    function labelForIndex(i: number) {
      let cur = phaseIdx[0];
      for (const p of phaseIdx) {
        if (p.idx <= i) cur = p;
        else break;
      }
      const phase = cur.phase || "";
      const label = cur.label || "";
      const text = label ? `${phase} (${label})` : phase;
      return { phase, label, text };
    }

    // Segment boundaries from cutIdxs; always start at 0
    const ranges: { start: number; end: number }[] = [];
    let s = 0;
    for (const c of cutIdxs) {
      ranges.push({ start: s, end: Math.max(s, c - 1) });
      s = c;
    }
    ranges.push({ start: s, end: pts.length - 1 });

    const out: { start: number; end: number; phase: string; label: string }[] = [];
    for (const r of ranges) {
      if (r.end < r.start) continue;
      const t = labelForIndex(r.start);
      out.push({ start: r.start, end: r.end, phase: t.phase, label: t.label });
    }
    return out;
  })();

  const phaseLabelPos = (() => {
    if (!segments.length) return [] as { x: number; text: string }[];

    const out: { x: number; text: string }[] = [];
    for (const s of segments) {
      const mid = (xFor(s.start) + xFor(s.end)) / 2;
      const text = s.label ? `${s.phase} (${s.label})` : s.phase;
      if (!text) continue;
      out.push({ x: mid, text });
    }
    return out;
  })();

  // Build path(s): one per segment if breaking is enabled; otherwise one path
  const paths = (() => {
    if (!cutIdxs.length) {
      const d = pts
        .map((p, i) => {
          const x = xFor(i);
          const y = yFor(p.y);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
      return [d];
    }

    const ranges: { start: number; end: number }[] = [];
    let s = 0;
    for (const c of cutIdxs) {
      ranges.push({ start: s, end: Math.max(s, c - 1) });
      s = c;
    }
    ranges.push({ start: s, end: pts.length - 1 });

    const out: string[] = [];
    for (const r of ranges) {
      if (r.end < r.start) continue;
      const parts: string[] = [];
      for (let i = r.start; i <= r.end; i++) {
        const x = xFor(i);
        const y = yFor(pts[i].y);
        parts.push(`${i === r.start ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      out.push(parts.join(" "));
    }
    return out.length ? out : [];
  })();

  const last = pts[pts.length - 1]?.y;

  const leftLabel = xMode === "trial" ? "T1" : shortDay(pts[0]?.x);
  const rightLabel = xMode === "trial" ? `T${pts.length}` : shortDay(pts[pts.length - 1]?.x);
  const secondaryLabel =
    xMode === "trial"
      ? `Dates: ${shortDay(pts[0]?.x)} … ${shortDay(pts[pts.length - 1]?.x)}`
      : `Trials: T1 … T${pts.length}`;

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">
          n={pts.length} · last={Number.isFinite(last) ? last : "?"}
          {ySuffix || ""}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-40 w-full" role="img" aria-label={title}>
        {/* axes */}
        <path d={`M ${PAD} ${H - PAD} H ${W - PAD}`} fill="none" stroke="currentColor" opacity="0.2" />
        <path d={`M ${PAD} ${PAD} V ${H - PAD}`} fill="none" stroke="currentColor" opacity="0.2" />

        {/* y ticks */}
        {yTicks.map((t, idx) => (
          <g key={idx} opacity="0.6">
            <path d={`M ${PAD - 4} ${t.y} H ${PAD}`} fill="none" stroke="currentColor" />
            <text x={0} y={t.y + 3} fontSize="10" fill="currentColor">
              {t.label}
            </text>
          </g>
        ))}

        {/* phase labels (centered in each phase segment) */}
        {phaseLabelPos.map((p, i) => (
          <text
            key={`phase-label-${i}`}
            x={p.x}
            y={PAD + 10}
            fontSize="10"
            fill="currentColor"
            opacity="0.7"
            textAnchor="middle"
          >
            {p.text}
          </text>
        ))}

        {/* phase change markers (dashed verticals) */}
        {markerPos.map((m, i) => (
          <g key={`phase-${i}`} opacity="0.6">
            <path
              d={`M ${m.x.toFixed(2)} ${PAD} V ${H - PAD}`}
              fill="none"
              stroke="currentColor"
              strokeDasharray="4 3"
            />
          </g>
        ))}

        {/* series (broken at phase changes if enabled) */}
        {paths.map((d, i) => (
          <path key={`seg-${i}`} d={d} fill="none" stroke="currentColor" strokeWidth="2" />
        ))}
        {pts.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.y)} r="2.5" fill="currentColor" />
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{leftLabel}</span>
        <span>
          {minY.toFixed(0)}
          {ySuffix || ""} … {maxY.toFixed(0)}
          {ySuffix || ""}
        </span>
        <span>{rightLabel}</span>
      </div>

      <div className="mt-1 text-[11px] text-muted-foreground">{secondaryLabel}</div>

      {(xLabel || yLabel) ? (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {yLabel ? `Y: ${yLabel}` : null}
          {yLabel && xLabel ? " · " : null}
          {xLabel ? `X: ${xLabel}` : null}
        </div>
      ) : null}
    </div>
  );
}

export default function FormsPage(
  { defaultLifeSwitchDomain = "" }: { defaultLifeSwitchDomain?: string }
) {
  const [ready, setReady] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<"publish" | "fill" | "history">("publish");

  // Publish state
  const [name, setName] = React.useState("Workout Session");
  const [templateId, setTemplateId] = React.useState("");
  const [schemaText, setSchemaText] = React.useState(DEFAULT_SCHEMA);
  const [uiSchemaText, setUiSchemaText] = React.useState("{}");
  const [metadataText, setMetadataText] = React.useState('{"domain":"workout"}');
  const [publishing, setPublishing] = React.useState(false);
  const [publishStatus, setPublishStatus] = React.useState<string>("");
  const [lastVersionId, setLastVersionId] = React.useState<string | null>(null);

  // Fill state

  // History state
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyRows, setHistoryRows] = React.useState<any[]>([]);
  const [historyLimit, setHistoryLimit] = React.useState(50);
  const [historyXMode, setHistoryXMode] = React.useState<"trial" | "date">("trial");
  const [historyTemplateVersionId, setHistoryTemplateVersionId] = React.useState("");
  const [historyVersion, setHistoryVersion] = React.useState<FormVersion | null>(null);
  const PHASE_TEMPLATE_VERSION_ID = "17211955-c47a-4c2a-b55f-55cc06065bc3";
  const CORRECTION_TEMPLATE_VERSION_ID = "82210580-9e1b-4b60-8bf6-39032b0b4915";
  const [phaseLoading, setPhaseLoading] = React.useState(false);
  const [phaseRows, setPhaseRows] = React.useState<any[]>([]);
  const [correctionLoading, setCorrectionLoading] = React.useState(false);
  const [correctionRows, setCorrectionRows] = React.useState<any[]>([]);
  // Phase marker entry UI (History tab)
  const [phaseDate, setPhaseDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [phaseLabel, setPhaseLabel] = React.useState<string>("A");
  const [phaseNotes, setPhaseNotes] = React.useState<string>("");
  const [phaseSubmitting, setPhaseSubmitting] = React.useState(false);
  const [phaseStatus, setPhaseStatus] = React.useState<string>("");
  // Test cleanup (History tab) — void entries using ABA Entry Correction
  const [cleanupN, setCleanupN] = React.useState<string>("50");
  const [cleanupNotes, setCleanupNotes] = React.useState<string>("test_cleanup");
  const [cleanupConfirm, setCleanupConfirm] = React.useState<string>("");
  const [cleanupSubmitting, setCleanupSubmitting] = React.useState(false);
  const [cleanupStatus, setCleanupStatus] = React.useState<string>("");

  // Quick entry state (History tab)
  const [quickDate, setQuickDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [quickCount, setQuickCount] = React.useState<number>(0);
  const [quickDurationSec, setQuickDurationSec] = React.useState<number>(0);
  const [quickContext, setQuickContext] = React.useState<string>("");
  const [quickNotes, setQuickNotes] = React.useState<string>("");
  const [quickSubmitting, setQuickSubmitting] = React.useState(false);

  const [durationRunning, setDurationRunning] = React.useState(false);

  const durationStartPerf = React.useRef<number | null>(null);
  const durationInterval = React.useRef<any>(null);

  type CorrectionInfo = {
    correction_entry_id: string;
    occurred_at: string;
    old_entry_id: string;
    new_entry_id: string; // "" means void
    reason: string;
    notes: string;
  };

  const correctionByOldEntryId = React.useMemo(() => {
    const tv = extractUuid(historyTemplateVersionId);
    const out = new Map<string, CorrectionInfo>();
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
      if (!cur || occurred_at.localeCompare(cur.occurred_at) > 0) {
        out.set(oldId, {
          correction_entry_id: String(r?.id || ""),
          occurred_at,
          old_entry_id: oldId,
          new_entry_id: newId,
          reason: String(d.reason || ""),
          notes: String(d.notes || ""),
        });
      }
    }

    return out;
  }, [correctionRows, historyTemplateVersionId]);

  const voidedEntryIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const [oldId, info] of correctionByOldEntryId.entries()) {
      const newId = String(info.new_entry_id || "").trim();
      if (!newId) s.add(oldId); // void
      else if (newId !== oldId) s.add(oldId); // replace
    }
    return s;
  }, [correctionByOldEntryId]);

  const effectiveHistoryRows = React.useMemo(() => {
    const rows = Array.isArray(historyRows) ? historyRows : [];
    if (voidedEntryIds.size === 0) return rows;
    return rows.filter((r) => !voidedEntryIds.has(String(r?.id || "")));
  }, [historyRows, voidedEntryIds]);

  const countSeries = React.useMemo(() => {
    const rows = Array.isArray(historyRows) ? historyRows : [];
    const events: { day: string; ts: string; y: number }[] = [];

    for (const r of rows) {
      const y = coerceNumber(r?.data?.count);
      if (y === null) continue;

      const ts = String(r?.occurred_at || "");
      const day = String(r?.data?.date || (ts ? ts.slice(0, 10) : ""));
      if (!day) continue;

      events.push({ day, ts: ts || day, y });
    }

    events.sort((a, b) => a.day.localeCompare(b.day) || a.ts.localeCompare(b.ts));

    if (historyXMode === "date") {
      // Aggregate within-day (sum)
      const byDay = new Map<string, number>();
      for (const e of events) byDay.set(e.day, (byDay.get(e.day) || 0) + e.y);

      return Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, y]) => ({ x: day, y }));
    }

    // Trial mode: one point per entry (chronological); x used only for labels
    return events.map((e) => ({ x: e.day, y: e.y }));
  }, [effectiveHistoryRows, historyXMode]);

  const durationSeries = React.useMemo(() => {
    const rows = Array.isArray(historyRows) ? historyRows : [];
    const events: { day: string; ts: string; y: number }[] = [];

    for (const r of rows) {
      const y = coerceNumber(r?.data?.duration_seconds ?? r?.data?.durationSeconds ?? r?.data?.duration);
      if (y === null) continue;

      const ts = String(r?.occurred_at || "");
      const day = String(r?.data?.date || (ts ? ts.slice(0, 10) : ""));
      if (!day) continue;

      events.push({ day, ts: ts || day, y });
    }

    events.sort((a, b) => a.day.localeCompare(b.day) || a.ts.localeCompare(b.ts));

    if (historyXMode === "date") {
      // Aggregate within-day (sum of seconds)
      const byDay = new Map<string, number>();
      for (const e of events) byDay.set(e.day, (byDay.get(e.day) || 0) + e.y);

      return Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, y]) => ({ x: day, y }));
    }

    // Trial mode
    return events.map((e) => ({ x: e.day, y: e.y }));
  }, [effectiveHistoryRows, historyXMode]);

  async function loadPhases(owner_user_id?: string) {
    setPhaseLoading(true);
    try {
      let owner = owner_user_id;

      if (!owner) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) throw new Error("not signed in");
        owner = data.user.id;
      }

      if (!subjectId.trim()) {
        setPhaseRows([]);
        return;
      }

      const qs = new URLSearchParams();
      qs.set("owner_user_id", owner);
      qs.set("subject_id", subjectId.trim());
      qs.set("template_version_id", PHASE_TEMPLATE_VERSION_ID);
      qs.set("limit", "200");

      const r = await authFetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`phases failed: HTTP ${r.status} ${t}`);

      const rows = JSON.parse(t);
      setPhaseRows(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setPhaseRows([]);
    } finally {
      setPhaseLoading(false);
    }
  }

  async function loadCorrections(owner_user_id?: string) {
    setCorrectionLoading(true);
    try {
      let owner = owner_user_id;

      if (!owner) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) throw new Error("not signed in");
        owner = data.user.id;
      }

      const tv = extractUuid(historyTemplateVersionId);
      if (!subjectId.trim() || !tv) {
        setCorrectionRows([]);
        return;
      }

      const qs = new URLSearchParams();
      qs.set("owner_user_id", owner);
      qs.set("subject_id", subjectId.trim());
      qs.set("template_version_id", CORRECTION_TEMPLATE_VERSION_ID);
      qs.set("limit", "500");

      const r = await authFetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`corrections failed: HTTP ${r.status} ${t}`);

      const rows = JSON.parse(t);
      setCorrectionRows(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setCorrectionRows([]);
    } finally {
      setCorrectionLoading(false);
    }
  }

  const phaseStarts = React.useMemo((): PhaseStart[] => {
    const targetVid = historyTemplateVersionId.trim();
    if (!targetVid) return [];

    const tmp: { date: string; phase: string; label: string; occurred_at: string }[] = [];
    for (const r of Array.isArray(phaseRows) ? phaseRows : []) {
      const d = r?.data || {};
      if (String(d.target_template_version_id || "").trim() !== targetVid) continue;

      const date = String(d.date || "").trim();
      const phase = String(d.phase || "").trim();
      if (!date || !phase) continue;

      // Use notes as the human-readable phase label (Baseline/Intervention/etc.)
      const label = String(d.notes || "").trim();
      const occurred_at = String(r?.occurred_at || "");
      tmp.push({ date, phase, label, occurred_at });
    }

    // Sort so "latest wins" is deterministic
    tmp.sort((a, b) => a.date.localeCompare(b.date) || a.occurred_at.localeCompare(b.occurred_at));

    // Dedup by (date, phase): keep the last entry (usually latest occurred_at), which also tends to keep non-empty label
    const byKey = new Map<string, { date: string; phase: string; label: string; occurred_at: string }>();
    for (const it of tmp) byKey.set(`${it.date}__${it.phase}`, it);

    return Array.from(byKey.values())
      .sort((a, b) => a.date.localeCompare(b.date) || a.occurred_at.localeCompare(b.occurred_at))
      .map((it) => ({ x: it.date, phase: it.phase, label: it.label || undefined }));
  }, [phaseRows, historyTemplateVersionId]);

  const phaseMarkers = React.useMemo((): XMarker[] => {
    // Draw phase-change lines starting at the 2nd phase start (baseline start is not a “change”)
    return phaseStarts.slice(1).map((p) => ({ x: p.x, label: p.phase }));
  }, [phaseStarts]);

  const cleanupCandidates = React.useMemo(() => {
    const tv = extractUuid(historyTemplateVersionId);
    if (!tv) return [] as { id: string; occurred_at: string; date: string }[];

    const nRaw = Number(cleanupN);
    const n = Number.isFinite(nRaw) ? Math.max(0, Math.trunc(nRaw)) : 0;
    if (!n) return [] as { id: string; occurred_at: string; date: string }[];

    const rs = Array.isArray(historyRows) ? historyRows : [];

    const tmp = rs
      .map((r: any) => ({
        id: String(r?.id || ""),
        occurred_at: String(r?.occurred_at || ""),
        date: String(r?.data?.date || "").slice(0, 10),
      }))
      .filter((x) => x.id)
      // Avoid duplicate corrections when re-running cleanup
      .filter((x) => !correctionByOldEntryId.has(x.id));

    // newest-first (void the newest test runs by default)
    tmp.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

    return tmp.slice(0, n);
  }, [historyTemplateVersionId, historyRows, correctionByOldEntryId, cleanupN]);

  async function bulkVoidCandidates() {
    setCleanupSubmitting(true);
    setCleanupStatus("");
    try {
      const tv = extractUuid(historyTemplateVersionId);
      if (!tv) throw new Error("select a target template_version_id in History filter");
      if (!subjectId.trim()) throw new Error("subject_id required");
      if (cleanupConfirm.trim() !== "VOID") throw new Error('type "VOID" to confirm');
      if (!cleanupCandidates.length) throw new Error("no candidates (load history / increase limit)");

      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw new Error("not signed in");
      const owner_user_id = data.user.id;

      let ok = 0;
      for (const c of cleanupCandidates) {
        const payloadData: Record<string, any> = {
          target_template_version_id: tv,
          old_entry_id: c.id,
          new_entry_id: "", // empty => void
          reason: "test_cleanup",
        };
        if (cleanupNotes.trim()) payloadData.notes = cleanupNotes.trim();

        const r = await authFetch("/api/forms/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner_user_id,
            subject_id: subjectId.trim(),
            template_version_id: CORRECTION_TEMPLATE_VERSION_ID,
            data: payloadData,
          }),
        });

        const t = await r.text().catch(() => "");
        if (!r.ok) throw new Error(`void failed for entry_id=${c.id}: HTTP ${r.status} ${t}`);
        ok += 1;
      }

      setCleanupStatus(`Voided ${ok} entries (wrote correction rows).`);
      setCleanupConfirm("");

      // Refresh correctionRows so the graph & effectiveHistoryRows update immediately
      await loadCorrections(owner_user_id);
    } catch (e: any) {
      setCleanupStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setCleanupSubmitting(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setFillStatus("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw new Error("not signed in");
      const owner_user_id = data.user.id;

      const qs = new URLSearchParams();
      qs.set("owner_user_id", owner_user_id);
      if (subjectId.trim()) qs.set("subject_id", subjectId.trim());
      const tv = historyTemplateVersionId.trim();
      if (tv) qs.set("template_version_id", tv);
      qs.set("limit", String(historyLimit));

      const r = await authFetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`history failed: HTTP ${r.status} ${t}`);

      const rows = JSON.parse(t);
      setHistoryRows(Array.isArray(rows) ? rows : []);

      let hv: FormVersion | null = null;
      if (tv) {
        try {
          const vr = await authFetch(`/api/forms/versions/${encodeURIComponent(tv)}`, { cache: "no-store" });
          const vt = await vr.text().catch(() => "");
          if (vr.ok) hv = JSON.parse(vt);
        } catch { }
      }
      setHistoryVersion(hv);

      await loadPhases(owner_user_id);
      await loadCorrections(owner_user_id);
      setFillStatus(`Loaded ${Array.isArray(rows) ? rows.length : 0} entries.`);
    } catch (e: any) {
      setFillStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitPhaseMarker() {
    setPhaseSubmitting(true);
    setPhaseStatus("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw new Error("not signed in");
      const owner_user_id = data.user.id;

      if (!subjectId.trim()) throw new Error("subject_id required");
      if (!historyTemplateVersionId.trim()) throw new Error("select a target template_version_id in History filter");
      if (!phaseDate.trim()) throw new Error("phase date required");
      if (!phaseLabel.trim()) throw new Error("phase label required");

      const payloadData: Record<string, any> = {
        date: phaseDate.trim(),
        phase: phaseLabel.trim(),
        target_template_version_id: historyTemplateVersionId.trim(),
      };
      if (phaseNotes.trim()) payloadData.notes = phaseNotes.trim();

      const r = await authFetch("/api/forms/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_user_id,
          subject_id: subjectId.trim(),
          template_version_id: PHASE_TEMPLATE_VERSION_ID,
          data: payloadData,
        }),
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`phase submit failed: HTTP ${r.status} ${t}`);

      const resp = JSON.parse(t);
      setPhaseStatus(`Submitted phase entry_id=${resp.entry_id}`);

      await loadPhases(owner_user_id);
    } catch (e: any) {
      setPhaseStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setPhaseSubmitting(false);
    }
  }

  function startDuration() {
    if (durationRunning) return;

    setQuickDurationSec(0);
    durationStartPerf.current = performance.now();
    setDurationRunning(true);

    try {
      if (durationInterval.current) clearInterval(durationInterval.current);
    } catch { }

    durationInterval.current = setInterval(() => {
      if (durationStartPerf.current === null) return;
      const sec = Math.max(0, Math.round((performance.now() - durationStartPerf.current) / 1000));
      setQuickDurationSec(sec);
    }, 250);
  }

  function stopDuration() {
    // finalize one last time on stop
    if (durationStartPerf.current !== null) {
      const sec = Math.max(0, Math.round((performance.now() - durationStartPerf.current) / 1000));
      setQuickDurationSec(sec);
    }

    setDurationRunning(false);
    durationStartPerf.current = null;

    try {
      if (durationInterval.current) clearInterval(durationInterval.current);
    } catch { }
    durationInterval.current = null;
  }

  function resetDuration() {
    stopDuration();
    setQuickDurationSec(0);
  }

  React.useEffect(() => {
    return () => {
      try { if (durationInterval.current) clearInterval(durationInterval.current); } catch { }
    };
  }, []);

  async function submitQuick(mode: "count" | "duration") {
    setQuickSubmitting(true);
    setFillStatus("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw new Error("not signed in");
      const owner_user_id = data.user.id;

      if (!version?.version_id) throw new Error("select a template version");
      if (!subjectId.trim()) throw new Error("subject_id required");

      const props: Record<string, any> = (version.json_schema?.properties || {}) as any;
      const payloadData: Record<string, any> = {};
      if (props.date) payloadData.date = quickDate;

      if (mode === "count") {
        if (!props.count) throw new Error('schema missing property "count"');
        payloadData.count = Number.isFinite(quickCount) ? quickCount : 0;
      } else {
        const durationKey =
          props.duration_seconds ? "duration_seconds" :
            (props.durationSeconds ? "durationSeconds" :
              (props.duration ? "duration" : null));
        if (!durationKey) throw new Error('schema missing duration property (expected "duration_seconds")');
        let durationSec = Number.isFinite(quickDurationSec) ? quickDurationSec : 0;
        if (durationStartPerf.current !== null) {
          durationSec = Math.max(0, Math.round((performance.now() - durationStartPerf.current) / 1000));
          // stop the timer after capturing the final value
          stopDuration();
        }
        payloadData[durationKey] = durationSec;
      }

      if (quickContext.trim() && props.context) payloadData.context = quickContext.trim();
      if (quickNotes.trim() && props.notes) payloadData.notes = quickNotes.trim();

      const r = await authFetch("/api/forms/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_user_id,
          subject_id: subjectId.trim(),
          template_version_id: version.version_id,
          data: payloadData,
        }),
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`submit failed: HTTP ${r.status} ${t}`);
      const resp = JSON.parse(t);
      setFillStatus(`Submitted entry_id=${resp.entry_id}`);
      if (tab === "history") await loadHistory();
    } catch (e: any) {
      setFillStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setQuickSubmitting(false);
    }
  }

  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [selectedVersionId, setSelectedVersionId] = React.useState<string>("");
  const [version, setVersion] = React.useState<FormVersion | null>(null);
  const [subjectId, setSubjectId] = React.useState("client_1");
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [fillStatus, setFillStatus] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) return;
        setUserId(data.user.id);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function publish() {
    setPublishing(true);
    setPublishStatus("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw new Error("not signed in");

      const owner_user_id = data.user.id;

      const json_schema = safeJsonParse(schemaText, "json_schema");
      const ui_schema = uiSchemaText.trim() ? safeJsonParse(uiSchemaText, "ui_schema") : {};
      let metadata = metadataText.trim() ? safeJsonParse(metadataText, "metadata") : {};
      // Enforce LifeSwitch tagging (Behavior measures should be discoverable by Capture/Analyze)
      try {
        const md: any = (metadata && typeof metadata === "object") ? metadata : {};
        const ls: any = (md.lifeswitch && typeof md.lifeswitch === "object") ? md.lifeswitch : {};

        // defaultLifeSwitchDomain comes from the wrapper route (behavior measures page)
        if (!ls.domain && defaultLifeSwitchDomain) ls.domain = defaultLifeSwitchDomain;

        // classify this template as a measure definition
        if (!ls.kind) ls.kind = "measure";

        md.lifeswitch = ls;
        metadata = md;
      } catch {
        // leave metadata as-is
      }

      const payload: any = {
        owner_user_id,
        name: name.trim() || "Untitled Form",
        json_schema,
        ui_schema,
        metadata,
      };

      if (templateId.trim()) payload.template_id = templateId.trim();

      const r = await authFetch("/api/forms/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`publish failed: HTTP ${r.status} ${t}`);

      const resp = JSON.parse(t);
      if (resp?.template_id) setTemplateId(String(resp.template_id));
      if (resp?.version_id) setLastVersionId(String(resp.version_id));

      setPublishStatus(`Published template=${resp.template_id} version=${resp.version}`);
    } catch (e: any) {
      setPublishStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setPublishing(false);
    }
  }

  async function loadTemplates() {
    setLoadingTemplates(true);
    setFillStatus("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw new Error("not signed in");
      const owner_user_id = data.user.id;

      const r = await authFetch(`/api/forms/templates/${encodeURIComponent(owner_user_id)}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`templates failed: HTTP ${r.status} ${t}`);

      const items = JSON.parse(t) as TemplateListItem[];
      setTemplates(items || []);
      setFillStatus(items?.length ? `Loaded ${items.length} templates.` : "No templates found.");
    } catch (e: any) {
      setFillStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function loadVersion(versionId: string) {
    setFillStatus("");
    setVersion(null);
    setFormData({});
    setSelectedVersionId(versionId);

    if (!versionId) return;

    try {
      const r = await authFetch(`/api/forms/versions/${encodeURIComponent(versionId)}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`version failed: HTTP ${r.status} ${t}`);

      const v = JSON.parse(t) as FormVersion;
      setVersion(v);

      // Seed required fields so RJSF doesn't block submit immediately.
      // - required arrays: [] or [ {} ... ] based on minItems
      // - required objects: {}
      // - required primitives: undefined (user must fill)
      const schema = v?.json_schema;
      const next: Record<string, any> = {};

      if (isObjectSchema(schema) && schema.properties) {
        const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
        for (const k of Object.keys(schema.properties)) {
          if (!required.has(k)) continue;
          const prop: any = (schema.properties as any)[k];
          const t = prop?.type;

          if (t === "array") {
            const min = typeof prop?.minItems === "number" ? prop.minItems : 0;
            next[k] = min >= 1 ? Array.from({ length: min }, () => ({})) : [];
          } else if (t === "object") {
            next[k] = {};
          } else {
            next[k] = undefined;
          }
        }
      }

      setFormData(next);

      setFillStatus(`Loaded version ${v.version} (${v.version_id}).`);
    } catch (e: any) {
      setFillStatus(`Error: ${e?.message || String(e)}`);
    }
  }

  async function submitEntry() {
    setSubmitting(true);
    setFillStatus("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw new Error("not signed in");

      const owner_user_id = data.user.id;
      if (!version?.version_id) throw new Error("no template version loaded");
      if (!subjectId.trim()) throw new Error("subject_id required");

      const payload = {
        owner_user_id,
        subject_id: subjectId.trim(),
        template_version_id: version.version_id,
        data: formData,
      };

      const r = await authFetch("/api/forms/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`submit failed: HTTP ${r.status} ${t}`);

      const resp = JSON.parse(t);
      setFillStatus(`Submitted entry_id=${resp.entry_id}`);
    } catch (e: any) {
      setFillStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Forms</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Publish templates and submit entries to seebx. Owner: {userId || "(not signed in)"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  if (window.history.length > 1) window.history.back();
                  else {
                    window.close();
                    setTimeout(() => {
                      try { window.location.href = "/"; } catch { }
                    }, 50);
                  }
                } catch {
                  window.location.href = "/";
                }
              }}
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
            >
              Back
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "publish" ? "bg-muted" : "bg-muted/30 hover:bg-muted/60"}`}
            onClick={() => setTab("publish")}
          >
            Publish Template
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "fill" ? "bg-muted" : "bg-muted/30 hover:bg-muted/60"}`}
            onClick={() => setTab("fill")}
          >
            Fill Form
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "history" ? "bg-muted" : "bg-muted/30 hover:bg-muted/60"}`}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </div>

        {tab === "publish" ? (
          <PublishPanel
            ready={ready}
            publish={publish}
            publishing={publishing}
            name={name}
            setName={setName}
            templateId={templateId}
            setTemplateId={setTemplateId}
            lastVersionId={lastVersionId ?? ""}
            schemaText={schemaText}
            setSchemaText={setSchemaText}
            uiSchemaText={uiSchemaText}
            setUiSchemaText={setUiSchemaText}
            metadataText={metadataText}
            setMetadataText={setMetadataText}
            publishStatus={publishStatus}
          />
        ) : tab === "fill" ? (
          <FillPanel
            ready={ready}
            loadTemplates={loadTemplates}
            loadingTemplates={loadingTemplates}
            templates={templates}
            selectedVersionId={selectedVersionId}
            loadVersion={loadVersion}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            version={version}
            formData={formData}
            setFormData={setFormData}
            submitEntry={submitEntry}
            submitting={submitting}
            fillStatus={fillStatus}
          />
        ) : (
          <HistoryPanel
            ready={ready}
            historyXMode={historyXMode}
            setHistoryXMode={setHistoryXMode}
            historyLimit={historyLimit}
            setHistoryLimit={setHistoryLimit}
            loadHistory={loadHistory}
            historyLoading={historyLoading}
            templates={templates}
            PHASE_TEMPLATE_VERSION_ID={PHASE_TEMPLATE_VERSION_ID}
            loadTemplates={loadTemplates}
            loadingTemplates={loadingTemplates}
            historyTemplateVersionId={historyTemplateVersionId}
            setHistoryTemplateVersionId={setHistoryTemplateVersionId}
            selectedVersionId={selectedVersionId}
            phaseLoading={phaseLoading}
            loadPhases={loadPhases}
            phaseDate={phaseDate}
            setPhaseDate={setPhaseDate}
            phaseLabel={phaseLabel}
            setPhaseLabel={setPhaseLabel}
            phaseNotes={phaseNotes}
            setPhaseNotes={setPhaseNotes}
            submitPhaseMarker={submitPhaseMarker}
            phaseSubmitting={phaseSubmitting}
            phaseStatus={phaseStatus}
            cleanupN={cleanupN}
            setCleanupN={setCleanupN}
            cleanupCandidates={cleanupCandidates}
            cleanupConfirm={cleanupConfirm}
            setCleanupConfirm={setCleanupConfirm}
            cleanupNotes={cleanupNotes}
            setCleanupNotes={setCleanupNotes}
            bulkVoidCandidates={bulkVoidCandidates}
            cleanupSubmitting={cleanupSubmitting}
            cleanupStatus={cleanupStatus}
            extractUuid={extractUuid}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            historyVersion={historyVersion}
            durationSeries={durationSeries}
            countSeries={countSeries}
            phaseStarts={phaseStarts}
          />
        )}
      </div>
    </div>
  );
}

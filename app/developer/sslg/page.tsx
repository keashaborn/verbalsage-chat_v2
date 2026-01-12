"use client";

import * as React from "react";
import { MiniLineChart, type XYPoint, type PhaseStart } from "@/components/sslg/MiniLineChart";

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

export default function SSLGPage() {
  const [status, setStatus] = React.useState<string>("");

  const [ownerUserId, setOwnerUserId] = React.useState<string>("");
  const [subjectId, setSubjectId] = React.useState<string>("client_1");
  const [targetVid, setTargetVid] = React.useState<string>("");

  const [targetVersion, setTargetVersion] = React.useState<VersionDoc | null>(null);
  const [rows, setRows] = React.useState<EntryRow[]>([]);
  const [phaseRows, setPhaseRows] = React.useState<EntryRow[]>([]);
  const [correctionRows, setCorrectionRows] = React.useState<EntryRow[]>([]);

  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

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

  // Pull defaults from querystring (so you can bookmark)
  React.useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const o = u.searchParams.get("owner_user_id") || "";
      const s = u.searchParams.get("subject_id") || "client_1";
      const tv = u.searchParams.get("template_version_id") || "";
      if (o) setOwnerUserId(o);
      if (s) setSubjectId(s);
      if (tv) setTargetVid(tv);
    } catch {}
  }, []);

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
      if (!cur || occurred_at.localeCompare(cur.occurred_at) > 0) {
        out.set(oldId, { oldId, newId, occurred_at });
      }
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

  // phases for this target version
  const phases: PhaseStart[] = React.useMemo(() => {
    const tv = extractUuid(targetVid);
    if (!tv) return [];
    const tmp: { x: string; phase: string; label?: string }[] = [];

    for (const r of Array.isArray(phaseRows) ? phaseRows : []) {
      const d = r?.data || {};
      const target =
        extractUuid(String(d.target_template_version_id || "")) ||
        String(d.target_template_version_id || "").trim();
      if (target !== tv) continue;

      const x = String(d.date || "").trim();
      const phase = String(d.phase || "").trim();
      const label = String(d.notes || "").trim();
      if (!x || !phase) continue;
      tmp.push({ x, phase, label: label || undefined });
    }

    tmp.sort((a, b) => a.x.localeCompare(b.x));
    // dedup by date+phase (keep last)
    const seen = new Set<string>();
    const out: PhaseStart[] = [];
    for (const it of tmp) {
      const k = `${it.x}__${it.phase}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, [phaseRows, targetVid]);

  // series: infer measure key from metadata (count vs duration_seconds)
  const series: XYPoint[] = React.useMemo(() => {
    const md = (targetVersion?.metadata || {}) as any;
    const mType = String(md?.measurement?.type || md?.program_spec_v0?.measurement?.type || "");
    const rs = Array.isArray(effectiveRows) ? effectiveRows : [];

    const pts: XYPoint[] = [];
    for (const r of rs) {
      const d = r?.data || {};
      const x = String(d.date || r?.occurred_at || "");
      if (!x) continue;

      let y: number | null = null;
      if (mType === "duration") {
        y = coerceNumber(d.duration_seconds ?? d.durationSeconds ?? d.duration);
      } else {
        y = coerceNumber(d.count);
      }
      if (y === null) continue;
      pts.push({ x, y });
    }

    pts.sort((a, b) => String(a.x).localeCompare(String(b.x)));
    return pts;
  }, [effectiveRows, targetVersion]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">SSLG</div>
            <div className="text-sm text-muted-foreground">Single-subject line graph (developer)</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">owner_user_id</div>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              placeholder="uuid"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">subject_id</div>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="client_1"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">template_version_id</div>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              value={targetVid}
              onChange={(e) => setTargetVid(e.target.value)}
              placeholder="uuid"
            />
          </div>
        </div>

        
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Templates</div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                onClick={loadTemplates}
                disabled={!ownerUserId.trim() || loadingTemplates}
                title="Fetch templates for this owner_user_id"
              >
                {loadingTemplates ? "Loading…" : "Load my templates"}
              </button>
              <select
                className="w-[520px] max-w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={targetVid}
                onChange={(e) => setTargetVid(e.target.value)}
                title="Select latest version id"
              >
                <option value="">(choose)</option>
                {templates
                  .filter((t) => t.latest_version_id)
                  .map((t) => (
                    <option key={t.template_id} value={String(t.latest_version_id)}>
                      {t.name} (v{t.latest_version ?? "?"}) — {String(t.latest_version_id).slice(0, 8)}…
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

<div className="mt-3 flex items-center gap-2">
          <button
            className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60"
            onClick={loadAll}
          >
            Load
          </button>
          <div className="text-sm text-muted-foreground">{status}</div>
        </div>

        <div className="mt-6">
          <MiniLineChart
            title={labelPack.yLabelWithUnit}
            series={series}
            xMode="date"
            includeZero={labelPack.includeZero}
            phases={phases}
            breakAtPhaseChange={true}
            xLabel={labelPack.xLabel}
            yLabel={labelPack.yLabelWithUnit}
          />
        </div>
      </div>
    </div>
  );
}

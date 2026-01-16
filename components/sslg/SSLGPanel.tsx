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
  initialSubjectId?: string;
  initialTemplateVersionId?: string;
};

export default function SSLGPanel({
  embedded = false,
  enableQueryDefaults = false,
  initialOwnerUserId = "",
  initialSubjectId = "client_1",
  initialTemplateVersionId = "",
}: SSLGPanelProps) {
  const [status, setStatus] = React.useState<string>("");

  const [ownerUserId, setOwnerUserId] = React.useState<string>(initialOwnerUserId);

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

  const [subjectId, setSubjectId] = React.useState<string>(initialSubjectId);
  const [targetVid, setTargetVid] = React.useState<string>(initialTemplateVersionId);

  const [targetVersion, setTargetVersion] = React.useState<VersionDoc | null>(null);
  const [rows, setRows] = React.useState<EntryRow[]>([]);
  const [phaseRows, setPhaseRows] = React.useState<EntryRow[]>([]);
  const [correctionRows, setCorrectionRows] = React.useState<EntryRow[]>([]);

  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  const [templatesAutoTried, setTemplatesAutoTried] = React.useState(false);
  const [clients, setClients] = React.useState<string[]>(initialSubjectId ? [initialSubjectId] : []);
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [clientsAutoTried, setClientsAutoTried] = React.useState(false);

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

  async function loadClients() {
    setLoadingClients(true);
    setStatus("");
    try {
      if (!ownerUserId.trim()) throw new Error("owner_user_id required");

      const qs = new URLSearchParams();
      qs.set("owner_user_id", ownerUserId.trim());
      qs.set("limit", "2000"); // temporary; enough for dev
      const r = await fetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`clients failed: HTTP ${r.status} ${t}`);

      const rows = JSON.parse(t);
      const uniq = new Set<string>();
      for (const row of Array.isArray(rows) ? rows : []) {
        const sid = String(row?.subject_id || "").trim();
        if (sid) uniq.add(sid);
      }

      let list = Array.from(uniq).sort((a, b) => a.localeCompare(b));
      const cur = subjectId.trim();
      if (cur && !list.includes(cur)) list = [cur, ...list];

      setClients(list);
      setStatus(list.length ? `loaded ${list.length} clients` : "no clients");
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
      // keep current subjectId usable even if list load fails
      setClients(subjectId.trim() ? [subjectId.trim()] : []);
    } finally {
      setLoadingClients(false);
    }
  }

  // Optional defaults from querystring (bookmarkable)
  React.useEffect(() => {
    if (!enableQueryDefaults) return;
    try {
      const u = new URL(window.location.href);
      const s = u.searchParams.get("subject_id") || "client_1";
      const tv = u.searchParams.get("template_version_id") || "";
      if (s) setSubjectId(s);
      if (tv) setTargetVid(tv);
    } catch { }
  }, [enableQueryDefaults]);

  // Auto-load templates once owner is known (one shot)
  React.useEffect(() => {
    if (!ownerUserId.trim()) return;
    if (templatesAutoTried) return;
    setTemplatesAutoTried(true);
    loadTemplates();
  }, [ownerUserId, templatesAutoTried]);

  // Auto-load clients once owner is known (one shot)
  React.useEffect(() => {
    if (!ownerUserId.trim()) return;
    if (clientsAutoTried) return;
    setClientsAutoTried(true);
    loadClients();
  }, [ownerUserId, clientsAutoTried]);



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
    // dedup by date+phase (keep first)
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
      if (mType === "duration") y = coerceNumber(d.duration_seconds ?? d.durationSeconds ?? d.duration);
      else y = coerceNumber(d.count);

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

  // Graph controls (local-only; not persisted yet)
  const [xMode, setXMode] = React.useState<"trial" | "date">("date");
  const [xLabelOverride, setXLabelOverride] = React.useState<string>("Date");
  const [yLabelOverride, setYLabelOverride] = React.useState<string>("Y");
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


  // Initialize controls from graph_spec_v0 whenever the loaded program version changes.
  React.useEffect(() => {
    if (!targetVersion) return;
    try {
      const md = (targetVersion?.metadata || {}) as any;
      const gs = (md.graph_spec_v0 || null) as any;

      const xLabel = String(gs?.x?.label || "Date");
      const yUnit = String(gs?.y?.unit || "");
      const yLabel = String(gs?.y?.label || targetVersion?.json_schema?.title || "Y");
      const yLabelWithUnit = yUnit ? `${yLabel} (${yUnit})` : yLabel;
      const includeZero = gs?.y?.include_zero;

      setXMode("date");
      setXLabelOverride(xLabel);
      setYLabelOverride(yLabelWithUnit);
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
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</div>
            <div className="flex items-center gap-2">
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                title="Select a client"
              >
                <option value="">(choose)</option>
                {clients
                  .slice()
                  .sort((a, b) => String(a).localeCompare(String(b)))
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>

              <button
                className="shrink-0 rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                onClick={loadClients}
                disabled={!ownerUserId.trim() || loadingClients}
                title="Reload clients"
              >
                {loadingClients ? "Loading…" : clients.length ? "Reload" : "Load"}
              </button>
            </div>
          </div>

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

          {/* unified control styling */}
          {(() => {
            const inputCls = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
            const selectCls = inputCls;
            const checkboxWrapCls = "flex items-center gap-2 rounded-lg border bg-background px-3 py-2";
            const subHelpCls = "text-xs text-muted-foreground";
            const labelCls = "grid gap-1 text-sm";
            const labelTextCls = "text-muted-foreground";

            return (
              <>
                {/* X */}
                <div className="mt-3 grid gap-3 md:grid-cols-5">

                  <label className={labelCls}>
                    <span className={labelTextCls}>X label</span>
                    <input
                      className={inputCls}
                      value={xLabelOverride}
                      onChange={(e) => setXLabelOverride(e.target.value)}
                      placeholder={labelPack.xLabel}
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>X min</span>
                    <input
                      className={inputCls}
                      value={xMinOverride}
                      onChange={(e) => setXMinOverride(e.target.value)}
                      placeholder="1"
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
                      placeholder="1"
                      inputMode="decimal"
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>X scale</span>
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
                  </label>
                </div>

                {/* Y */}
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  <label className={labelCls}>
                    <span className={labelTextCls}>Y label</span>
                    <input
                      className={inputCls}
                      value={yLabelOverride}
                      onChange={(e) => setYLabelOverride(e.target.value)}
                      placeholder={labelPack.yLabelWithUnit}
                    />
                  </label>

                  <label className={labelCls}>
                    <span className={labelTextCls}>Y min</span>
                    <input
                      className={inputCls}
                      type="no type"
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
                      type="no type"
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
                      <span className={yMinIsSet ? labelTextCls : ""} title="If Y min is auto, clamp the Y-axis floor to 0">
                        Include 0
                      </span>
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
